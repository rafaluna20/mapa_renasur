// Inventario de TODAS las rutas /api y cómo se protege cada una (P3 multiproyecto).
//
// La prueba app/lib/rutasAcceso.test.ts lee las carpetas de app/api y FALLA si:
//   · hay una ruta que no está aquí (alguien añadió una ruta sin decidir su protección);
//   · una ruta de este listado ya no existe;
//   · una ruta no cumple lo que su categoría promete (p. ej. «staff-lote» sin guardiaLote, «retirada» sin 410).
//
// Categorías:
//   publica         sin sesión A PROPÓSITO (login, chatbot, captación de leads);
//   cliente         sesión de cliente del portal (cada cliente ve lo suyo);
//   secreto         llamada de otro sistema con secreto compartido (webhooks, plan_pro);
//   staff-lote      sesión de personal + el lote debe ser de un proyecto al que el usuario tiene acceso (guardiaLote);
//   staff-admin     solo administrador del sistema (isSystem);
//   staff-neutra    sesión de personal; no toca datos de un proyecto;
//   staff-pendiente sesión de personal, SIN alcance por proyecto todavía (clientes, contratos, facturas, estadísticas).
//                   Es la deuda de P3: se reduce moviendo rutas a «staff-lote» o con un filtro propio;
//   retirada        ya no existe: responde 410.

export type CategoriaRuta =
  | 'publica'
  | 'cliente'
  | 'secreto'
  | 'staff-lote'
  | 'staff-admin'
  | 'staff-neutra'
  | 'staff-pendiente'
  | 'retirada';

export const RUTAS_ACCESO: Record<string, CategoriaRuta> = {
  '/api/auth/[...nextauth]': 'publica',
  '/api/auth/login': 'publica',
  '/api/auth/odoo-sso': 'publica',
  '/api/auth/request-code': 'publica',
  '/api/auth/staff-logout': 'publica',
  '/api/chat': 'publica',
  '/api/public/lead': 'publica',

  '/api/invoices/history': 'cliente',
  '/api/invoices/pending': 'cliente',
  '/api/invoices/statement': 'cliente',
  '/api/payments/niubiz/authorize': 'cliente',
  '/api/payments/niubiz/create-session': 'cliente',
  '/api/vouchers/status': 'cliente',
  '/api/vouchers/upload': 'cliente',

  '/api/webhooks/odoo': 'secreto',
  '/api/planos/estado/[id]': 'secreto',

  '/api/odoo/product/[id]': 'staff-lote',
  '/api/odoo/update_status': 'staff-lote',
  '/api/odoo/get_lot_contract': 'staff-lote',
  '/api/odoo/get_reservation_owner': 'staff-lote',
  '/api/odoo/find_draft_order': 'staff-lote',
  '/api/odoo/get_active_quotes': 'staff-lote',
  '/api/odoo/create_sale_order': 'staff-lote',
  '/api/odoo/search_product_by_code': 'staff-lote',

  '/api/planos/generar': 'staff-admin',
  '/api/planos/generar-matriz': 'staff-admin',
  '/api/planos/generar-resumen': 'staff-admin',
  '/api/planos/descargas-stats': 'staff-admin',
  '/api/odoo/stats/general': 'staff-admin',
  '/api/odoo/stats/invoices': 'staff-admin',

  '/api/dni-lookup': 'staff-neutra',

  '/api/odoo/add_attachment': 'staff-pendiente',
  '/api/odoo/check_partner_document': 'staff-pendiente',
  '/api/odoo/confirm_order': 'staff-pendiente',
  '/api/odoo/create_contract': 'staff-pendiente',
  '/api/odoo/create_partner': 'staff-pendiente',
  '/api/odoo/get_client_invoices': 'staff-pendiente',
  '/api/odoo/pay-invoice': 'staff-pendiente',
  '/api/odoo/photo/[attachmentId]': 'staff-pendiente',
  '/api/odoo/process_refund': 'staff-pendiente',
  '/api/odoo/search_partners': 'staff-pendiente',
  '/api/odoo/update_partner': 'staff-pendiente',
  '/api/odoo/stats': 'staff-pendiente',
  '/api/odoo/stats/detailed': 'staff-pendiente',

  '/api/odoo/call': 'retirada',
  '/api/odoo/read': 'retirada',
  '/api/odoo/search-read': 'retirada',
  '/api/odoo': 'retirada',
};
