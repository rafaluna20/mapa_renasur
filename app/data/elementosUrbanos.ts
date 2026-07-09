import elementosUrbanosRaw from './elementos-urbanos.json';

/**
 * Elemento urbano no vendible (calle, área verde/parque): geometría real
 * independiente de los productos Odoo, para que:
 * 1. El mapa los dibuje con su propio color, sin pasar por la leyenda de
 *    estados de venta ni por los conteos de stats/cotización (nunca entran
 *    a mergeLotsData ni a ningún endpoint que trate productos Odoo).
 * 2. derivarColindanciasYDimensiones (colindanciasUtils.ts) pueda verificar
 *    contra su geometría real qué lado de un lote da a qué calle/parque, en
 *    vez de asumir "sin lote vecino = debe ser calle" e imprimir el nombre
 *    genérico "Calle" en la Memoria Descriptiva.
 */
export interface ElementoUrbano {
    codigo: string;
    nombre: string;
    tipo: 'calle' | 'area_verde';
    points: [number, number][];
}

// Respaldo estático (mismo rol que geometries.json para lotes no migrados a
// Odoo): útil antes de instalar el módulo elemento_urbano_geometry, o para
// cualquier elemento que aún no se haya cargado ahí.
export const elementosUrbanosEstaticos = elementosUrbanosRaw as ElementoUrbano[];

/**
 * Combina los elementos urbanos traídos de Odoo (fetchElementosUrbanos, vía
 * el modelo elemento.urbano) con el respaldo estático de este archivo. Odoo
 * tiene prioridad: si un código existe en ambas fuentes, gana el de Odoo
 * (mismo criterio que resolveGeometry en dataMerger.ts para lotes).
 */
export function mergeElementosUrbanos(deOdoo: ElementoUrbano[]): ElementoUrbano[] {
    const codigosOdoo = new Set(deOdoo.map((e) => e.codigo));
    const soloEstaticos = elementosUrbanosEstaticos.filter((e) => !codigosOdoo.has(e.codigo));
    return [...deOdoo, ...soloEstaticos];
}
