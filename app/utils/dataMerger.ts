import { OdooProduct } from '@/app/services/odooService';
import { Lot } from '@/app/data/lotsData';
import { calculateLotMeasurements, LotMeasurements } from '@/app/utils/geometryUtils';
import { ArcoMetadata } from '@/app/utils/arcoUtils';

export interface EnrichedGeometry {
    coordinates: [number, number][];
    measurements: {
        sides: number[];
        area: number;
        perimeter: number;
        centroid: [number, number];
    };
}

interface ResolvedGeometry {
    points: [number, number][];
    measurements: LotMeasurements;
}

/**
 * Resuelve qué geometría usar para un lote: Odoo (product_lot_geometry) es
 * la fuente preferida; el JSON estático es el fallback mientras existan
 * lotes (ej. Etapa 2) que aún no se migraron a Odoo.
 */
function resolveGeometry(
    odooVertices: [number, number][] | false | undefined,
    registryGeometry: EnrichedGeometry | undefined,
    arcos?: ArcoMetadata[] | false
): ResolvedGeometry | null {
    if (Array.isArray(odooVertices) && odooVertices.length >= 3) {
        return {
            points: odooVertices,
            measurements: calculateLotMeasurements(odooVertices, arcos || undefined),
        };
    }
    if (registryGeometry?.coordinates?.length) {
        return { points: registryGeometry.coordinates, measurements: registryGeometry.measurements };
    }
    return null;
}

// Helpers exportados por si se necesitan en otro lado
export const normalizeCode = (c: string) => (c || '').toString().replace(/\s+/g, '').toUpperCase().trim();

export const getOdooVal = (v: unknown, fallback: string): string => {
    if (v === undefined || v === null || v === false) return fallback;
    return v.toString();
};

/**
 * Corrige el área embebida como texto en el "name" de Odoo (ej. "Etapa 2 Mz
 * V Lote 1  Area=100.18m2") para que coincida con x_area, el campo numérico
 * real que usan los cálculos, la etiqueta del mapa y el PDF. El texto de
 * "name" se escribe a mano al crear el lote y puede quedar desactualizado
 * si luego se corrige el área (geometría/fusión de lotes) sin editar
 * también el nombre — ver incidente lote E02MZV001P, ago 2026, donde x_area
 * ya estaba en 401.96 pero el name seguía diciendo "Area=100.18m2".
 */
export const syncAreaInLotName = (name: string, area: number): string => {
    if (!name || !Number.isFinite(area)) return name;
    if (!/Area=[\d.,]+\s*m2/i.test(name)) return name;
    return name.replace(/Area=[\d.,]+\s*m2/i, `Area=${area.toFixed(2)}m2`);
};

export const parseVal = (v: unknown, fallback: number): number => {
    if (v === undefined || v === null || v === false || v === '') return fallback;
    if (typeof v === 'number') return v;
    
    let s = v.toString().trim();
    if (s.includes(',') && (!s.includes('.') || s.indexOf(',') > s.lastIndexOf('.'))) {
        s = s.replace(/\./g, '').replace(',', '.');
    } else {
        s = s.replace(/,/g, '');
    }
    
    const n = parseFloat(s);
    return isNaN(n) ? fallback : n;
};

export const mapOdooStatus = (s: string | undefined): 'libre' | 'separado' | 'vendido' | 'cotizacion' | string | null => {
    if (!s) return null;
    const status = s.toLowerCase();
    if (status.includes('disponible') || status === 'available' || status === 'libre') return 'libre';
    if (status.includes('cotizacion') || status.includes('cotización')) return 'cotizacion';
    if (status.includes('reservado') || status === 'reserved' || status === 'separado') return 'separado';
    if (status.includes('vendido') || status === 'sold') return 'vendido';
    return status;
};

/**
 * Fusiona la data dinámica de Odoo con la data estática y geométrica local.
 */
export function mergeLotsData(
    odooProducts: OdooProduct[],
    localLotsData: Lot[],
    geometriesJson: Record<string, EnrichedGeometry>
): Lot[] {
    // 1. Mapa de productos Odoo
    const odooMap = new Map<string, OdooProduct>();
    odooProducts.forEach(p => {
        if (p.default_code) {
            const code = normalizeCode(p.default_code);
            odooMap.set(code, p);
        }
    });

    console.log("[SYNC_DEBUG] Odoo Map entries:", odooMap.size);
    const integratedCodes = new Set<string>();
    const integratedIds = new Set<string>();

    // 2. Procesar lotes locales (Base fija lotsData.ts)
    const matched = localLotsData.map(lot => {
        const rawCode = lot.default_code;
        const normCode = normalizeCode(rawCode);
        integratedCodes.add(normCode);

        // Intentar match con y sin sufijo 'P'
        let odooMatch = odooMap.get(normCode);
        if (!odooMatch) {
            odooMatch = normCode.endsWith('P') ? odooMap.get(normCode.slice(0, -1)) : odooMap.get(normCode + 'P');
        }

        const registryGeometry = geometriesJson[normCode] || geometriesJson[rawCode];
        const geometry = resolveGeometry(odooMatch?.x_geometry_utm, registryGeometry, odooMatch?.x_geometry_arcos);

        if (odooMatch) {
            if (odooMatch.default_code) integratedCodes.add(normalizeCode(odooMatch.default_code));
            integratedIds.add(odooMatch.id.toString());

            const mappedStatus = mapOdooStatus(odooMatch.x_statu);
            const resolvedArea = parseVal(odooMatch.x_area, lot.x_area);
            return {
                ...lot,
                id: odooMatch.id.toString(),
                name: syncAreaInLotName(odooMatch.name || lot.name, resolvedArea),
                x_statu: mappedStatus || lot.x_statu,
                list_price: parseVal(odooMatch.list_price, lot.list_price),
                x_area: resolvedArea,
                x_mz: getOdooVal(odooMatch.x_mz, lot.x_mz),
                x_etapa: getOdooVal(odooMatch.x_etapa, lot.x_etapa),
                x_lote: getOdooVal(odooMatch.x_lote, lot.x_lote),
                default_code: getOdooVal(odooMatch.default_code, lot.default_code),
                x_cliente: getOdooVal(odooMatch.x_cliente, ''),
                x_proyecto: getOdooVal(odooMatch.x_proyecto, lot.x_proyecto || ''),
                x_proyectoId: odooMatch.x_proyecto_id ? odooMatch.x_proyecto_id[0] : lot.x_proyectoId,
                x_ubicacion: getOdooVal(odooMatch.x_ubicacion, lot.x_ubicacion || ''),
                x_geometry_arcos: odooMatch.x_geometry_arcos || lot.x_geometry_arcos,
                points: geometry?.points || lot.points,
                measurements: geometry?.measurements
            } as Lot;
        }

        return {
            ...lot,
            id: `local-${lot.id}`,
            points: geometry?.points || lot.points,
            measurements: geometry?.measurements
        } as Lot;
    });

    // 3. INTEGRACIÓN DINÁMICA: Productos Odoo no incluidos en lotsData
    const dynamicLots: Lot[] = [];
    odooProducts.forEach(odooMatch => {
        const code = normalizeCode(odooMatch.default_code || '');
        const odooId = odooMatch.id.toString();

        if (code && !integratedCodes.has(code) && !integratedIds.has(odooId)) {
            const registryGeometry = geometriesJson[code];
            const geometry = resolveGeometry(odooMatch.x_geometry_utm, registryGeometry, odooMatch.x_geometry_arcos);
            if (geometry) {
                integratedCodes.add(code);
                integratedIds.add(odooId);
                const resolvedArea = parseVal(odooMatch.x_area, 0);
                dynamicLots.push({
                    id: odooId,
                    name: syncAreaInLotName(odooMatch.name || `Lote ${code}`, resolvedArea),
                    x_statu: mapOdooStatus(odooMatch.x_statu) || 'libre',
                    list_price: parseVal(odooMatch.list_price, 0),
                    x_area: resolvedArea,
                    x_mz: getOdooVal(odooMatch.x_mz, ''),
                    x_etapa: getOdooVal(odooMatch.x_etapa, ''),
                    x_cliente: getOdooVal(odooMatch.x_cliente, ''),
                    x_lote: getOdooVal(odooMatch.x_lote, ''),
                    x_proyecto: getOdooVal(odooMatch.x_proyecto, ''),
                    x_proyectoId: odooMatch.x_proyecto_id ? odooMatch.x_proyecto_id[0] : undefined,
                    x_ubicacion: getOdooVal(odooMatch.x_ubicacion, ''),
                    x_geometry_arcos: odooMatch.x_geometry_arcos || undefined,
                    default_code: code,
                    points: geometry.points,
                    measurements: geometry.measurements,
                    image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
                    description: 'Lote detectado dinámicamente desde Odoo.'
                });
            }
        }
    });

    // 4. FALLBACK: Geometrías en JSON no cubiertas
    const fallbackLots: Lot[] = [];
    Object.keys(geometriesJson).forEach(code => {
        const normCode = normalizeCode(code);
        if (!integratedCodes.has(normCode)) {
            const metadataMatch = normCode.match(/E(\d+)MZ([A-Z]+)(\w+)/);
            const geometry = geometriesJson[code];
            fallbackLots.push({
                id: `fb-${normCode}`,
                name: `Lote ${normCode} (Geometría)`,
                x_statu: 'no vender',
                list_price: 0,
                x_area: geometry.measurements?.area || 0,
                x_mz: metadataMatch ? metadataMatch[2] : '',
                x_etapa: metadataMatch ? metadataMatch[1] : '',
                x_lote: metadataMatch ? metadataMatch[3] : '',
                default_code: normCode,
                points: geometry.coordinates,
                measurements: geometry.measurements,
                image: '',
                description: 'Lote detectado únicamente por geometría.'
            });
        }
    });

    const finalResult = [...matched, ...dynamicLots, ...fallbackLots];
    console.log(`[MAP_SYNC] Local: ${matched.length}, Odoo: ${dynamicLots.length}, Fallback: ${fallbackLots.length}`);
    return finalResult;
}
