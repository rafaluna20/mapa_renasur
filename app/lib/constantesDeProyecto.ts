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
//   proyecto    texto que DEBERÍA salir del proyecto (pendiente de convertir): hoy NINGUNO;
//   marca       nombre de la empresa/aplicación: decisión tomada 2026-11-06, «la marca es el nombre del proyecto» (app/lib/marca.ts);
//               hoy NINGUNO.

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
  'app/lib/marcaServidor.ts': { max: 1, categoria: 'comentario' },
  'app/lib/ubicacionProyecto.ts': { max: 1, categoria: 'comentario' },
  'app/services/emailService.ts': { max: 1, categoria: 'comentario', nota: 'un dominio de correo citado en un comentario' },
  'app/services/odooService.ts': { max: 1, categoria: 'comentario' },
  'app/services/validationService.ts': { max: 1, categoria: 'comentario' },
  'app/utils/imageHelper.ts': { max: 1, categoria: 'comentario' },
  'app/venta/VentaClient.tsx': { max: 1, categoria: 'comentario' },

  // --- identificadores (nombres de clase CSS; no se muestran como texto) ---
  'app/globals.css': { max: 6, categoria: 'identificador', nota: 'clases CSS del cubo del mapa (terra-lima-cube)' },
  'app/components/Map/MapArea.tsx': { max: 2, categoria: 'identificador', nota: 'las mismas clases CSS; el TEXTO del cubo ya es el nombre del proyecto' },

  // --- respaldo «de siempre» ---
  'app/venta/ofertaComercial.ts': { max: 3, categoria: 'legada', nota: 'oferta de respaldo de Terra Lima mientras Odoo no tenga los campos de P5' },
  'app/lib/marca.ts': { max: 5, categoria: 'legada', nota: 'MARCA_LEGADA (nombre, archivo y logo de siempre) y su documentación' },
};

export function resumenPorCategoria(): Record<CategoriaMencion, number> {
  const resumen: Record<CategoriaMencion, number> = { comentario: 0, identificador: 0, legada: 0, proyecto: 0, marca: 0 };
  for (const r of Object.values(MENCIONES_TERRA_LIMA)) resumen[r.categoria] += r.max;
  return resumen;
}
