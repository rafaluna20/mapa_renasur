import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { fetchOdoo } from '@/app/services/odooService';
import { contratosDelTitular } from '@/app/lib/contratoEstadoCuenta';
import { crearLimitador, mensajeDeOdoo, validarArchivoComprobante, validarDatosAviso } from '@/app/lib/avisoPago';

/**
 * POST /api/avisos-pago
 * El cliente informa el pago de una cuota que todavia NO tiene factura (contrato de facturacion Manual): monto, banco, numero
 * de operacion, fecha y comprobante. Queda como «aviso de pago» en Odoo (simple.contract.payment.notice, modulo >= 3.24); el
 * Administrador lo verifica contra el banco y lo convierte en factura. Esta ruta NO crea facturas ni registra pagos.
 *
 * - El cliente sale SIEMPRE de la sesion del servidor (NextAuth), nunca del formulario.
 * - El contrato debe ser suyo (titular o copropietario), Manual y Vigente; las reglas de fondo (cuota pendiente, un solo
 *   aviso abierto por cuota, pagador titular o copropietario) las valida Odoo, que es quien tiene la verdad.
 * - El comprobante se guarda SOLO en Odoo (adjunto del aviso): no se sube a servicios externos.
 */

// 3 avisos por hora y por cliente (en memoria, por instancia del servidor).
const limitar = crearLimitador({ maxIntentos: 3, ventanaMs: 60 * 60 * 1000 });

const MODELO = 'simple.contract.payment.notice';

function respuestaError(estado: number, error: string) {
    return Response.json({ success: false, error }, { status: estado });
}

function nombreSeguro(nombre: string): string {
    return nombre.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '_').slice(0, 100) || 'comprobante';
}

/** Traduce el rechazo de Odoo a un estado HTTP y un mensaje que el cliente pueda leer (sin trazas internas). */
function traducirErrorDeOdoo(error: unknown): { estado: number; mensaje: string } {
    const texto = mensajeDeOdoo(error);
    if (/doesn't exist|does not exist|no existe/i.test(texto)) {
        return { estado: 501, mensaje: 'Esta función aún no está disponible. Avise a administración.' };
    }
    const seguro = texto.length > 300 || /traceback/i.test(texto)
        ? 'No se pudo registrar el aviso. Inténtelo de nuevo o avise a administración.'
        : texto;
    if (/aviso de pago abierto/i.test(texto)) return { estado: 409, mensaje: seguro };
    if (/titular ni copropietario/i.test(texto)) return { estado: 403, mensaje: seguro };
    return { estado: 400, mensaje: seguro };
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return new Response('No autenticado', { status: 401 });

    const partnerId = (session.user as unknown as { odooPartnerId?: number }).odooPartnerId;
    if (!partnerId) return respuestaError(400, 'Tu cuenta no tiene un cliente de Odoo asociado.');

    const limite = limitar(String(partnerId));
    if (!limite.permitido) {
        return respuestaError(429, `Has alcanzado el límite de avisos. Inténtalo de nuevo en ${limite.minutos} minutos.`);
    }

    let formData: FormData;
    try {
        formData = await request.formData();
    } catch {
        return respuestaError(400, 'Formulario inválido.');
    }

    const validado = validarDatosAviso(Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === 'string')));
    if (!validado.ok) return respuestaError(400, validado.error);
    const datos = validado.datos;

    // Se reconoce el archivo por sus metodos (no por `instanceof File`: segun el entorno la clase File del formulario es otra).
    const archivo = formData.get('file') as unknown as { name: string; size: number; arrayBuffer(): Promise<ArrayBuffer> } | string | null;
    if (!archivo || typeof archivo === 'string' || typeof archivo.arrayBuffer !== 'function' || archivo.size === 0) {
        return respuestaError(400, 'Adjunte el comprobante de la transferencia.');
    }
    const buffer = Buffer.from(await archivo.arrayBuffer());
    const revision = validarArchivoComprobante(buffer);
    if (!revision.valido) return respuestaError(400, revision.error ?? 'Archivo inválido.');

    // El contrato debe ser del cliente de la SESION.
    let contratos;
    try {
        contratos = await contratosDelTitular(partnerId);
    } catch (error) {
        console.error('[AVISO-PAGO] No se pudieron leer los contratos del cliente:', error instanceof Error ? error.message : error);
        return respuestaError(502, 'No se pudo comprobar su contrato. Inténtelo de nuevo en unos minutos.');
    }
    const contrato = contratos.find((c) => c.id === datos.contractId);
    if (!contrato) return respuestaError(403, 'Ese contrato no está a su nombre.');
    if (contrato.state !== 'confirmed' || contrato.billingMode !== 'manual') {
        return respuestaError(403, 'Este contrato no admite avisos de pago: sus cuotas se facturan automáticamente.');
    }

    // Crear el aviso (Odoo valida las reglas de fondo y decide el estado inicial segun el monto).
    let avisoId: number;
    try {
        avisoId = (await fetchOdoo(MODELO, 'create', [{
            contract_id: datos.contractId,
            quota_number: datos.quotaNumber,
            payer_id: partnerId,
            amount: datos.amount,
            bank_name: datos.bankName || false,
            operation_number: datos.operationNumber,
            transfer_date: datos.transferDate,
            note: datos.note || false,
        }])) as number;
    } catch (error) {
        const { estado, mensaje } = traducirErrorDeOdoo(error);
        console.warn(`[AVISO-PAGO] Odoo rechazó el aviso (${estado}) contrato ${datos.contractId} cuota ${datos.quotaNumber}`);
        return respuestaError(estado, mensaje);
    }

    // Adjuntar el comprobante al aviso. Sin comprobante el aviso no sirve: si falla, se intenta deshacer.
    try {
        const adjuntoId = (await fetchOdoo('ir.attachment', 'create', [{
            name: nombreSeguro(archivo.name),
            datas: buffer.toString('base64'),
            res_model: MODELO,
            res_id: avisoId,
            public: false,
            description: 'Comprobante de transferencia informado desde el portal del cliente',
        }])) as number;
        await fetchOdoo(MODELO, 'write', [[avisoId], { attachment_ids: [[4, adjuntoId]] }]);
    } catch (error) {
        console.error('[AVISO-PAGO] No se pudo adjuntar el comprobante:', error instanceof Error ? error.message : error);
        try {
            await fetchOdoo(MODELO, 'unlink', [[avisoId]]);
        } catch {
            console.error(`[AVISO-PAGO] No se pudo deshacer el aviso ${avisoId}: revisar a mano en Odoo.`);
        }
        return respuestaError(502, 'No se pudo guardar el comprobante. Inténtelo de nuevo.');
    }

    let state = 'pending';
    try {
        const leido = (await fetchOdoo(MODELO, 'read', [[avisoId]], { fields: ['state'] })) as { state?: string }[];
        state = leido?.[0]?.state ?? 'pending';
    } catch {
        // el aviso ya existe: no se falla por no poder releer el estado
    }
    return Response.json({ success: true, notice: { id: avisoId, state } }, { status: 201 });
}
