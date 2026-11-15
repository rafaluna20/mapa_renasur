/**
 * Tipos de documento que se adjuntan a una reserva (orden de venta) y que luego se copian al contrato de financiamiento.
 * Antes todo se guardaba con la descripción «Comprobante de pago - Reserva», incluso la cotización en PDF, y en Odoo no
 * había forma de distinguir un documento de otro.
 */
export type TipoAdjunto = 'cotizacion' | 'comprobante';

export const DESCRIPCION_ADJUNTO: Record<TipoAdjunto, string> = {
    cotizacion: 'Cotización del terreno',
    comprobante: 'Comprobante de pago - Reserva',
};

/** Un valor desconocido o ausente es «comprobante»: es lo que siempre se asumió, así los llamadores viejos no cambian. */
export function normalizarTipoAdjunto(valor: unknown): TipoAdjunto {
    return valor === 'cotizacion' ? 'cotizacion' : 'comprobante';
}
