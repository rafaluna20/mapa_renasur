import { getServerSession } from 'next-auth';
import { numeroDeLote } from '@/app/lib/etiquetaLote';
import { extraerCodigoDeReferencia } from '@/app/lib/codigoLote';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { fetchOdoo } from '@/app/services/odooService';
import { fetchLotContractInfo } from '@/app/lib/lotContract';
import { obtenerMapaAlias } from '@/app/lib/aliasLotesServidor';
import { resolverCodigoViejo } from '@/app/lib/aliasLotes';
import { normalizeCurrency } from '@/app/utils/money';
import { contratosDelTitular, fetchCronograma, type ContratoEstado } from '@/app/lib/contratoEstadoCuenta';
import type { ScheduleLineLike } from '@/app/utils/statementModel';
import type { AvisoPago } from '@/app/lib/avisoPago';

interface ExtendedUser {
    odooPartnerId?: number;
}

interface OdooInvoice {
    id: number;
    name: string;
    ref?: string | false;
    payment_reference?: string | false;
    invoice_date: string;
    invoice_date_due: string;
    payment_state: string;
    amount_total: number;
    amount_residual: number;
    // Moneda de la factura ([id, 'USD'] | false): los contratos en dólares facturan en USD.
    currency_id?: [number, string] | false;
    // Mora (simple_recurring_contract >= 3.18): separa los cargos por mora de las cuotas.
    is_late_fee?: boolean;
    late_fee_origin_id?: [number, string] | false;
    late_fee_days_late?: number;
    late_fee_percentage_applied?: number;
    late_fee_waived?: boolean;
    // Cuota que cubre la factura y contrato de origen (estado de cuenta por contrato). Nunca el nombre de quién pagó.
    contract_id?: [number, string] | false;
    contract_quota_number?: number;
    // Único lugar donde vive la fecha real de pago (no existe como campo
    // plano en account.move) — la usa el PDF de Estado de Cuenta para la
    // columna "Fecha de Pago" / "Días de atraso-adelanto".
    invoice_payments_widget?: { content?: { date?: string; is_exchange?: boolean }[] } | false;
}

interface OdooProductTemplate {
    default_code: string;
    list_price: number;
    x_mz?: string | false;
    x_etapa?: string | false;
    x_lote?: string | false;
    x_area?: number | false;
}

/**
 * Extrae el código de lote Terra Lima (ej. "E01MZR016P") embebido en un
 * texto de referencia libre. Formato real confirmado contra Odoo (campo
 * `ref` de account.move): "CONTRATOMANUAL-E01MZR016P-C008" — sin el sufijo
 * de fecha de 8 dígitos que sí exige paymentService.parsePaymentReference
 * (esa función lee `payment_reference`, que en la práctica suele traer el
 * número de factura, no el código de lote — son campos distintos con datos
 * distintos en este Odoo). Se exige el "-C<num>" o "-INIT" final para no
 * confundir cualquier texto parecido con una referencia real de cuota — el
 * "-INIT" es necesario: la cuota inicial de cada lote usa ese sufijo en vez
 * de "-C<num>", y sin esta alternativa esas facturas caían todas en "Otros
 * pagos" en lugar de su lote real (confirmado con datos reales: 2 de 34
 * facturas de un cliente de prueba, una por cada uno de sus 2 lotes).
 */
function extraerCodigoLote(texto: string): string | null {
    // P6: el intérprete único de códigos (acepta también P01-E01MZR016P y mantiene la lectura floja de antes).
    return extraerCodigoDeReferencia(texto)?.codigo ?? null;
}

/**
 * GET /api/invoices/statement
 * Estado de cuenta completo del cliente logueado (pagadas + pendientes),
 * agrupado por lote — a diferencia de /api/invoices/pending (solo
 * pendientes, sin agrupar). El partnerId SIEMPRE sale de la sesión del
 * servidor (NextAuth), nunca de un parámetro del cliente: es data
 * financiera y un cliente no debe poder pedir la de otro cambiando un
 * query param.
 */
export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return new Response('No autenticado', { status: 401 });
    }

    const partnerId = (session.user as unknown as ExtendedUser).odooPartnerId;
    if (!partnerId) {
        return Response.json({ success: false, error: 'Tu cuenta no tiene un cliente de Odoo asociado.' }, { status: 400 });
    }

    try {
        // El teléfono no viaja en la sesión de NextAuth (solo name/email/dni,
        // ver [...nextauth]/route.ts) aunque Odoo sí lo tiene — se trae acá
        // con un fetch puntual por partnerId, mismo patrón ya usado en
        // get_reservation_owner/route.ts para el mismo dato.
        // Estado de cuenta POR CONTRATO: además de las facturas a su nombre, el cliente ve las de los contratos donde es
        // titular o copropietario (en un lote con copropietarios la factura nace al cobro, a nombre de quien paga).
        // El cliente sale de la SESIÓN del servidor. Si la lectura de contratos falla, se vuelve al filtro de siempre.
        let contratos: ContratoEstado[] = [];
        try {
            contratos = await contratosDelTitular(partnerId);
        } catch (e) {
            console.warn('[STATEMENT] No se pudieron leer los contratos del cliente; se usa solo su cliente:', e);
        }
        const contractIds = contratos.map((c) => c.id);
        const dominioFacturas = contractIds.length > 0
            ? ['|', ['partner_id', '=', partnerId], ['contract_id', 'in', contractIds],
                ['move_type', '=', 'out_invoice'], ['state', '=', 'posted']]
            : [['partner_id', '=', partnerId], ['move_type', '=', 'out_invoice'], ['state', '=', 'posted']];

        const [invoices, partners] = await Promise.all([
            fetchOdoo('account.move', 'search_read', [dominioFacturas], {
                fields: ['id', 'name', 'ref', 'payment_reference', 'invoice_date', 'invoice_date_due', 'payment_state', 'amount_total', 'amount_residual', 'currency_id', 'contract_id', 'contract_quota_number', 'is_late_fee', 'late_fee_origin_id', 'late_fee_days_late', 'late_fee_percentage_applied', 'late_fee_waived', 'invoice_payments_widget'],
                limit: 500,
                order: 'invoice_date asc',
            }) as Promise<OdooInvoice[]>,
            fetchOdoo('res.partner', 'read', [[partnerId]], { fields: ['phone', 'mobile'] }) as Promise<{ phone?: string | false; mobile?: string | false }[]>,
        ]);
        const clientPhone = (partners[0]?.mobile || partners[0]?.phone || null) as string | null;

        // Agrupar por código de lote parseado de ref/payment_reference/name.
        // Una factura ya emitida puede llevar el código VIEJO de un lote que cambió de código (p. ej. E01MZD129P → E01MZD1293): esas
        // referencias no se reescriben, se resuelven con los alias de Odoo (proyecto.lote.alias). Sin alias el código queda tal cual.
        const mapaAlias = await obtenerMapaAlias();
        const grupos = new Map<string, OdooInvoice[]>();
        // El lote de una factura sale primero de su CONTRATO (account.move.contract_id): no depende de como este escrita la
        // referencia (en algunas bases es "CTR10691-C001", sin el codigo del lote). Sin contrato conocido se lee de la referencia.
        const codigoPorContrato = new Map<number, string>(
            contratos.filter((c) => c.productCode).map((c) => [c.id, c.productCode as string]),
        );
        for (const inv of invoices) {
            const texto = inv.ref || inv.payment_reference || inv.name || '';
            const contratoId = Array.isArray(inv.contract_id) ? inv.contract_id[0] : null;
            const extraido = (contratoId !== null ? codigoPorContrato.get(contratoId) : undefined) ?? extraerCodigoLote(texto);
            const codigo = (extraido ? resolverCodigoViejo(extraido, mapaAlias) : null) || 'SIN_LOTE';
            if (!grupos.has(codigo)) grupos.set(codigo, []);
            grupos.get(codigo)!.push(inv);
        }

        // Contratos Manuales VIGENTES: la factura nace al cobro, así que una cuota vencida que nadie cobró no tiene
        // factura y se toma del cronograma. Un contrato cerrado no aporta cuotas por facturar. Si el contrato es del
        // lote pero aún no tiene facturas a la vista, el lote igual aparece (para mostrar lo que se debe).
        const cronogramaPorLote = new Map<string, ScheduleLineLike[]>();
        const contratoPorLote = new Map<string, number>();
        const lotePorContrato = new Map<number, string>();
        for (const c of contratos) {
            if (c.billingMode !== 'manual' || c.state !== 'confirmed' || !c.productCode) continue;
            const codigoLote = resolverCodigoViejo(c.productCode, mapaAlias) || c.productCode;
            try {
                const lineas = await fetchCronograma(c.id);
                cronogramaPorLote.set(codigoLote, [...(cronogramaPorLote.get(codigoLote) ?? []), ...lineas]);
                contratoPorLote.set(codigoLote, c.id);
                lotePorContrato.set(c.id, codigoLote);
                if (!grupos.has(codigoLote)) grupos.set(codigoLote, []);
            } catch (e) {
                console.warn('[STATEMENT] No se pudo leer el cronograma del contrato manual:', e);
            }
        }

        // Avisos de pago de esas cuotas (modulo >= 3.24): el cliente ve si su transferencia esta en revision o fue rechazada.
        // Solo lo necesario para mostrarlo: nunca quien pago, ni la nota interna, ni la factura. Sin el modelo (Odoo anterior)
        // o ante cualquier fallo, la lista queda vacia y el estado de cuenta sale igual.
        const avisosPorLote = new Map<string, AvisoPago[]>();
        if (lotePorContrato.size > 0) {
            try {
                const filas = (await fetchOdoo('simple.contract.payment.notice', 'search_read', [[
                    ['contract_id', 'in', [...lotePorContrato.keys()]],
                ]], {
                    fields: ['contract_id', 'quota_number', 'amount', 'expected_amount', 'state', 'reject_reason', 'create_date'],
                    order: 'id desc',
                    limit: 200,
                })) as (AvisoPago & { id: number; contract_id: [number, string] | false })[];
                for (const fila of filas ?? []) {
                    const codigoLote = fila.contract_id ? lotePorContrato.get(fila.contract_id[0]) : undefined;
                    if (!codigoLote) continue;
                    const { contract_id: _omitido, ...aviso } = fila;
                    void _omitido;
                    avisosPorLote.set(codigoLote, [...(avisosPorLote.get(codigoLote) ?? []), aviso]);
                }
            } catch (e) {
                console.warn('[STATEMENT] No se pudieron leer los avisos de pago (¿modulo < 3.24?):', e instanceof Error ? e.message : e);
            }
        }

        // Traer precio de lista + datos de manzana/etapa/lote para cada
        // código detectado (batch, un solo viaje a Odoo).
        const codigos = [...grupos.keys()].filter((c) => c !== 'SIN_LOTE');
        const productosPorCodigo = new Map<string, OdooProductTemplate>();
        if (codigos.length > 0) {
            const productos = await fetchOdoo('product.template', 'search_read', [[
                ['default_code', 'in', codigos],
            ]], {
                fields: ['default_code', 'list_price', 'x_mz', 'x_etapa', 'x_lote', 'x_area'],
            }) as OdooProductTemplate[];
            for (const p of productos) {
                productosPorCodigo.set(p.default_code, p);
            }
        }

        // Contrato vigente por lote: aporta la MONEDA y, si es en moneda extranjera, el precio
        // pactado (el list_price del catálogo está en soles y no sirve para un contrato en dólares).
        const contratosPorCodigo = await fetchLotContractInfo(codigos);

        const lots = [...grupos.entries()].map(([codigo, invs]) => {
            const producto = productosPorCodigo.get(codigo);
            const contrato = contratosPorCodigo.get(codigo);
            // La moneda sale de las facturas (lo que realmente se le cobra al cliente); el contrato
            // solo se usa para el precio cuando ambos son en moneda extranjera.
            // Sin facturas todavia (contrato Manual con la primera cuota por cobrar) la moneda es la del contrato.
            const currency = invs.length === 0 && contrato ? contrato.currency : normalizeCurrency(invs[0]?.currency_id);
            const esMonedaExtranjera = currency !== 'PEN';
            const listPrice = esMonedaExtranjera
                ? (contrato && contrato.currency === currency ? contrato.finalPrice : 0)
                : (producto?.list_price || 0);
            const label = codigo === 'SIN_LOTE'
                ? 'Otros pagos'
                : producto
                    ? `Etapa ${producto.x_etapa || '?'} Mz ${producto.x_mz || '?'} Lote ${numeroDeLote(producto) || '?'}`
                    : codigo;

            return {
                code: codigo,
                label,
                mz: producto?.x_mz || null,
                etapa: producto?.x_etapa || null,
                numeroLote: numeroDeLote(producto) || null,
                area: producto?.x_area || null,
                // En dólares: precio pactado del contrato (0 si no se pudo leer: la UI muestra
                // "—" en vez de un número en la moneda equivocada). En soles: catálogo, como antes.
                listPrice,
                currency,
                invoices: invs,
                // Cuotas del cronograma de un contrato Manual (vacío en Automáticos): el modelo del estado de cuenta
                // las usa para mostrar las vencidas sin factura.
                scheduleLines: cronogramaPorLote.get(codigo) ?? [],
                // Contrato Manual del lote (para informar un pago) y avisos de pago ya enviados.
                contractId: contratoPorLote.get(codigo) ?? null,
                avisos: avisosPorLote.get(codigo) ?? [],
            };
        });

        return Response.json({ success: true, lots, clientPhone });
    } catch (error: unknown) {
        console.error('[STATEMENT] Error fetching account statement:', error);
        return Response.json({
            success: false,
            error: error instanceof Error ? error.message : 'Error al obtener el estado de cuenta',
        }, { status: 500 });
    }
}
