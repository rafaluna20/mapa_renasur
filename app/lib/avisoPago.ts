/**
 * Aviso de pago de una cuota SIN factura (ficha «aviso de pago de una cuota sin factura», bloques 3 y 4).
 *
 * En un contrato de facturación Manual la factura nace cuando administración confirma el dinero, así que una cuota vencida
 * que nadie cobró no tiene factura y el cliente no tenía dónde dejar constancia de su transferencia. Aquí vive la lógica
 * pura (validar archivo y datos, limitar intentos, etiquetar el estado) para probarla sin Odoo ni red.
 */

/** Estados del aviso en Odoo (simple.contract.payment.notice, módulo >= 3.24). */
export type EstadoAviso = 'pending' | 'observed' | 'invoiced' | 'rejected';

/** Lo que el portal ve de un aviso. Nunca incluye quién pagó, ni la nota interna, ni la factura. */
export interface AvisoPago {
    id: number;
    quota_number: number;
    amount: number;
    expected_amount: number;
    state: EstadoAviso;
    reject_reason?: string | false;
    create_date?: string;
}

// ---------------------------------------------------------------- archivo

export const TAMANO_MAXIMO_COMPROBANTE = 5 * 1024 * 1024;

const FIRMAS: Record<string, number[]> = {
    'image/jpeg': [0xff, 0xd8, 0xff],
    'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    'application/pdf': [0x25, 0x50, 0x44, 0x46],
};

export interface ResultadoArchivo {
    valido: boolean;
    tipo?: string;
    error?: string;
}

/** Valida por los primeros bytes (no por la extension ni por el tipo que declara el navegador) y por el tamano. */
export function validarArchivoComprobante(buffer: Buffer): ResultadoArchivo {
    if (buffer.length === 0) return { valido: false, error: 'El archivo está vacío.' };
    if (buffer.length > TAMANO_MAXIMO_COMPROBANTE) return { valido: false, error: 'El archivo no debe exceder 5MB.' };
    for (const [tipo, firma] of Object.entries(FIRMAS)) {
        if (firma.every((byte, i) => buffer[i] === byte)) return { valido: true, tipo };
    }
    return { valido: false, error: 'Tipo de archivo no permitido. Solo se aceptan JPG, PNG o PDF auténticos.' };
}

// ---------------------------------------------------------------- datos del formulario

export interface DatosAviso {
    contractId: number;
    quotaNumber: number;
    amount: number;
    bankName: string;
    operationNumber: string;
    transferDate: string;
    note: string;
}

export type ResultadoDatos = { ok: true; datos: DatosAviso } | { ok: false; error: string };

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Valida y normaliza lo que llega del formulario. `hoy` se inyecta para poder probar fechas. */
export function validarDatosAviso(raw: Record<string, unknown>, hoy: Date = new Date()): ResultadoDatos {
    const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    const contractId = Number(texto(raw.contract_id));
    if (!Number.isInteger(contractId) || contractId <= 0) return { ok: false, error: 'Contrato inválido.' };
    const quotaText = texto(raw.quota_number);
    const quotaNumber = Number(quotaText);
    if (quotaText === '' || !Number.isInteger(quotaNumber) || quotaNumber < 0 || quotaNumber > 1000) {
        return { ok: false, error: 'Cuota inválida.' };
    }
    const amountText = texto(raw.amount);
    const amount = Number(amountText);
    if (amountText === '' || !Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) / 100 !== amount) {
        return { ok: false, error: 'El monto debe ser mayor a cero y tener hasta 2 decimales.' };
    }
    const operationNumber = texto(raw.operation_number);
    if (!operationNumber || operationNumber.length > 100) {
        return { ok: false, error: 'Indique el número de operación (hasta 100 caracteres).' };
    }
    const bankName = texto(raw.bank_name);
    if (bankName.length > 100) return { ok: false, error: 'El nombre del banco es demasiado largo.' };
    const note = texto(raw.note);
    if (note.length > 500) return { ok: false, error: 'La nota es demasiado larga (máximo 500 caracteres).' };

    const transferDate = texto(raw.transfer_date);
    if (!FECHA_ISO.test(transferDate)) return { ok: false, error: 'Fecha de transferencia inválida.' };
    const fecha = new Date(transferDate + 'T00:00:00');
    if (Number.isNaN(fecha.getTime())) return { ok: false, error: 'Fecha de transferencia inválida.' };
    const finDeHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59);
    const haceUnAno = new Date(hoy.getFullYear() - 1, hoy.getMonth(), hoy.getDate());
    if (fecha > finDeHoy) return { ok: false, error: 'La fecha de la transferencia no puede ser futura.' };
    if (fecha < haceUnAno) return { ok: false, error: 'La fecha de la transferencia tiene más de un año.' };

    return { ok: true, datos: { contractId, quotaNumber, amount, bankName, operationNumber, transferDate, note } };
}

// ---------------------------------------------------------------- Odoo

/** Odoo responde "Odoo Error: Odoo Server Error - <texto del UserError>": se devuelve solo el texto. */
export function mensajeDeOdoo(error: unknown): string {
    const mensaje = error instanceof Error ? error.message : String(error);
    const i = mensaje.indexOf(' - ');
    return mensaje.startsWith('Odoo Error:') && i >= 0 ? mensaje.slice(i + 3).trim() : mensaje;
}

// ---------------------------------------------------------------- limitador de intentos

export interface ResultadoLimite {
    permitido: boolean;
    minutos?: number;
}

/**
 * Limitador en memoria (por instancia del servidor): protege de envios repetidos. Es la misma idea que el de vouchers; en
 * un despliegue con varias instancias seria por instancia, no global.
 */
export function crearLimitador(opciones: { maxIntentos: number; ventanaMs: number; ahora?: () => number }) {
    const ahora = opciones.ahora ?? Date.now;
    const intentos = new Map<string, { cuenta: number; vence: number }>();
    return (clave: string): ResultadoLimite => {
        const t = ahora();
        const actual = intentos.get(clave);
        if (!actual || t > actual.vence) {
            intentos.set(clave, { cuenta: 1, vence: t + opciones.ventanaMs });
            return { permitido: true };
        }
        if (actual.cuenta >= opciones.maxIntentos) {
            return { permitido: false, minutos: Math.max(1, Math.ceil((actual.vence - t) / 60000)) };
        }
        actual.cuenta += 1;
        return { permitido: true };
    };
}

// ---------------------------------------------------------------- lo que ve el cliente

/**
 * Aviso que corresponde mostrar en una cuota: el abierto (por verificar o en observación); si no hay, el rechazado más
 * reciente (para que el cliente vea el motivo y pueda informar de nuevo). Un aviso facturado no cuenta: la cuota ya tiene
 * factura y deja de ser una cuota sin comprobante.
 */
export function avisoPorCuota(avisos: AvisoPago[] | undefined, cuota: number): AvisoPago | null {
    const deLaCuota = (avisos ?? []).filter((a) => a.quota_number === cuota);
    const abierto = deLaCuota.find((a) => a.state === 'pending' || a.state === 'observed');
    if (abierto) return abierto;
    const rechazados = deLaCuota
        .filter((a) => a.state === 'rejected')
        .sort((a, b) => (b.create_date ?? '').localeCompare(a.create_date ?? '') || b.id - a.id);
    return rechazados[0] ?? null;
}

export interface EtiquetaAviso {
    texto: string;
    detalle?: string;
    permiteReinformar: boolean;
}

/** "En observación" se muestra igual que "Por verificar": la diferencia de monto es un asunto interno hasta que administración habla con el cliente. */
export function etiquetaAviso(aviso: AvisoPago): EtiquetaAviso {
    if (aviso.state === 'rejected') {
        const motivo = typeof aviso.reject_reason === 'string' ? aviso.reject_reason : '';
        return {
            texto: 'Rechazado',
            detalle: motivo ? `Motivo: ${motivo}` : 'Administración no pudo validar el pago.',
            permiteReinformar: true,
        };
    }
    return { texto: 'En revisión', detalle: 'Administración está verificando su transferencia.', permiteReinformar: false };
}
