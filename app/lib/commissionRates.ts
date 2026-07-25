/**
 * Tasas de comisión por asesor.
 *
 * No existe ningún campo en Odoo (ni en res.users, ni en sale.order) que
 * almacene una tasa de comisión personalizada — todo lo que se consulta de
 * un asesor es user_id como tupla [id, nombre]. Esta tabla es la fuente de
 * verdad hasta que exista un campo real en Odoo para esto.
 *
 * La clave es el ID de usuario de Odoo (el mismo número que aparece como
 * user_id[0] en sale.order) — NO el nombre, que puede repetirse o cambiar.
 */
export const DEFAULT_COMMISSION_RATE = 0.075;

export const COMMISSION_RATES: Record<number, number> = {
    // 12: 0.08, // ejemplo: agregar aquí cuando un asesor tenga tasa acordada distinta a la base
};

export function getCommissionRate(userId: number | null | undefined): number {
    if (userId == null || Number.isNaN(userId)) return DEFAULT_COMMISSION_RATE;
    return COMMISSION_RATES[userId] ?? DEFAULT_COMMISSION_RATE;
}
