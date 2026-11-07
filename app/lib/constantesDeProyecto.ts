// Inventario de las menciones a «Terra Lima» que siguen escritas en el código (P5 multiproyecto).
//
// Meta del plan: que el código no tenga constantes de un proyecto. La prueba app/lib/constantesDeProyecto.test.ts cuenta las
// menciones de cada archivo y exige que coincidan EXACTAMENTE con este registro: si alguien añade una mención nueva, o quita
// una y no actualiza el número, falla. Así la deuda solo puede bajar y queda a la vista.
//
// Categorías:
//   comentario  solo aparece en un comentario o documentación (inofensivo);
//   identificador  nombre de una clase CSS o de un archivo (no se muestra como texto);
//   legada      la oferta «de siempre» que se usa mientras Odoo no tenga los campos de P5 (ver app/venta/ofertaComercial.ts);
//   proyecto    texto que DEBERÍA salir del proyecto del lote/usuario (pendiente de convertir);
//   marca       nombre de la empresa/aplicación en títulos, correos y reportes: ES UNA DECISIÓN DE MARCA (¿«Renasur», «Terra Lima»,
//               el nombre del proyecto?), no una constante técnica. Pendiente de decisión.

export type CategoriaMencion = 'comentario' | 'identificador' | 'legada' | 'proyecto' | 'marca';

export interface RegistroMencion {
  max: number;
  categoria: CategoriaMencion;
  nota?: string;
}

export const MENCIONES_TERRA_LIMA: Record<string, RegistroMencion> = {
  // --- comentarios ---
  'app/api/invoices/statement/route.ts': { max: 1, categoria: 'comentario' },
  'app/api/odoo/stats/general/route.ts': { max: 1, categoria: 'comentario' },
  'app/api/odoo/stats/invoices/route.ts': { max: 1, categoria: 'comentario' },
  'app/components/Map/LeafletMap.tsx': { max: 1, categoria: 'comentario' },
  'app/components/Quote/ScenarioSimulator.tsx': { max: 1, categoria: 'comentario' },
  'app/components/UI/ValidationAlert.tsx': { max: 1, categoria: 'comentario' },
  'app/hooks/useClientSearch.ts': { max: 1, categoria: 'comentario' },
  'app/lib/ubicacionProyecto.ts': { max: 1, categoria: 'comentario' },
  'app/services/odooService.ts': { max: 1, categoria: 'comentario' },
  'app/services/validationService.ts': { max: 1, categoria: 'comentario' },
  'app/utils/imageHelper.ts': { max: 1, categoria: 'comentario' },
  'app/venta/VentaClient.tsx': { max: 1, categoria: 'comentario' },

  // --- identificadores ---
  'app/globals.css': { max: 6, categoria: 'identificador', nota: 'clases CSS del cubo de marca (terra-lima-cube)' },

  // --- oferta legada ---
  'app/venta/ofertaComercial.ts': { max: 3, categoria: 'legada', nota: 'valores de respaldo de Terra Lima mientras Odoo no tenga la oferta' },

  // --- texto que debería salir del proyecto (pendiente) ---
  'app/api/chat/route.ts': { max: 2, categoria: 'proyecto', nota: 'prompt del asistente y descripción de la herramienta de búsqueda: «proyecto Terra Lima»' },
  'app/api/public/lote-imagen/route.tsx': { max: 2, categoria: 'proyecto', nota: 'imagen pública del lote: nombre del proyecto del lote' },
  'app/components/Chat/ChatWidget.tsx': { max: 2, categoria: 'proyecto', nota: 'saludo y título del asistente' },
  'app/components/UI/LotDetailModal.tsx': { max: 1, categoria: 'proyecto', nota: 'mensaje de WhatsApp de cobranza: «de Terra Lima»' },
  'app/quote/[lotId]/page.tsx': { max: 1, categoria: 'proyecto', nota: 'título visible de la pantalla de cotización: «Cotización TERRA-LIMA»' },
  'app/utils/quotePdfExporter.ts': { max: 9, categoria: 'proyecto', nota: 'PDF de la cotización: encabezado, logo, pie y nombre del archivo del proyecto del lote' },
  'app/components/Map/MapArea.tsx': { max: 6, categoria: 'proyecto', nota: 'cubo isométrico del mapa con el nombre del proyecto' },

  // --- marca (decisión pendiente) ---
  'app/layout.tsx': { max: 3, categoria: 'marca', nota: 'título y descripción de la aplicación (y de su vista previa)' },
  'app/components/UI/Header.tsx': { max: 2, categoria: 'marca', nota: 'logo y nombre en la cabecera' },
  'app/portal/login/page.tsx': { max: 1, categoria: 'marca', nota: 'portal de clientes' },
  'app/services/emailService.ts': { max: 8, categoria: 'marca', nota: 'remitente, asunto y pie de los correos' },
  'app/services/csvExportService.ts': { max: 4, categoria: 'marca', nota: 'nombres de archivo de los reportes' },
  'app/services/reportService.ts': { max: 22, categoria: 'marca', nota: 'reportes PDF de la empresa (encabezados, pies, nombres de archivo)' },
};

export function resumenPorCategoria(): Record<CategoriaMencion, number> {
  const resumen: Record<CategoriaMencion, number> = { comentario: 0, identificador: 0, legada: 0, proyecto: 0, marca: 0 };
  for (const r of Object.values(MENCIONES_TERRA_LIMA)) resumen[r.categoria] += r.max;
  return resumen;
}
