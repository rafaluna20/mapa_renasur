/**
 * Modelos que las rutas genéricas /api/odoo/call, /search-read y /read pueden
 * tocar. Estas rutas reenvían { model, method, args } tal cual a Odoo con la
 * cuenta de servicio (ODOO_USER_ID/ODOO_PASSWORD, con privilegios amplios):
 * sin esta lista, cualquier caller autenticado como staff podría igual pedir
 * 'res.users'/'ir.config_parameter'/etc.
 *
 * Lista construida a partir de los modelos que el resto de la app realmente
 * usa (grep de fetchOdoo(...) en todo app/). Si una función nueva necesita un
 * modelo que no está aquí, agrégalo explícitamente en vez de abrir la lista.
 */
export const ODOO_MODEL_ALLOWLIST = new Set([
    'res.partner',
    'account.move',
    'account.move.line',
    'account.move.reversal',
    'account.payment',
    'account.payment.register',
    'account.journal',
    'ir.attachment',
    'product.product',
    'product.template',
    'sale.order',
    'sale.order.line',
    'simple.contract',
    'stock.picking',
    'mail.message',
]);

export function isModelAllowed(model: unknown): model is string {
    return typeof model === 'string' && ODOO_MODEL_ALLOWLIST.has(model);
}
