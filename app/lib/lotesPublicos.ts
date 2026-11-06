// Qué lotes se publican en la landing pública (/venta).
//
// Antes bastaba con tener id numérico de Odoo: los lotes «solo geometría» (`fb-…`) quedaban fuera por no tener producto.
// Con P4 esos lotes pasan a ser productos reales en estado «no vender» (sin precio): sin esta regla EXPLÍCITA saldrían
// de golpe en un anuncio pagado. «no vender» significa justamente que no se ofrece: no se publica.

export const ID_ODOO_REAL = /^\d+$/;

export function esPublicable(lote: { id: string; x_statu?: string | null }): boolean {
  return ID_ODOO_REAL.test(lote.id) && (lote.x_statu ?? '').trim().toLowerCase() !== 'no vender';
}
