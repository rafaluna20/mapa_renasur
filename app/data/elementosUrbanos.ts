import elementosUrbanosRaw from './elementos-urbanos.json';
import { ArcoMetadata } from '@/app/utils/arcoUtils';

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
    /**
     * Código de capa (elemento.urbano.capa en Odoo) — ya no es un enum
     * fijo: un admin puede crear una capa nueva (ej. "postes") desde Odoo
     * sin tocar código acá, siempre que también traiga su "color".
     */
    tipo: string;
    /** Color hex de la capa (definido en Odoo, editable sin deploy). */
    color: string;
    /** Si el nombre del elemento se imprime como etiqueta en el plano. */
    mostrarEtiqueta: boolean;
    /** Si la capa es un área (polígono relleno) o una línea (trazo abierto, sin relleno). */
    esArea: boolean;
    /** Solo relevante si esArea=true: si el polígono se dibuja sin color de relleno (solo borde). */
    sinRelleno: boolean;
    points: [number, number][];
    /** Lados curvos del polígono (points), si el elemento tiene alguno. */
    arcos?: ArcoMetadata[];
    /** Presente solo si el elemento es un círculo completo (reemplaza a "points"). */
    circulo?: { centro: [number, number]; radio: number };
    /**
     * URLs de fotos (solo presente en elementos de la capa "foto" — puntos
     * de interés fotográfico, ej. vista del parque). Cada URL apunta a
     * /api/odoo/photo/[attachmentId] (server-side, nunca directo a Odoo).
     */
    fotos?: string[];
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
