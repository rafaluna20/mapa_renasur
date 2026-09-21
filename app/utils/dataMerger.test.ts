import { describe, it, expect } from 'vitest';
import { mergeLotsData } from './dataMerger';
import type { OdooProduct } from '@/app/services/odooService';
import type { Lot } from '@/app/data/lotsData';
import type { EnrichedGeometry } from './dataMerger';

function makeProduct(overrides: Partial<OdooProduct> & { default_code: string }): OdooProduct {
    return {
        id: 1,
        name: 'Lote Test',
        list_price: 0,
        qty_available: 1,
        x_statu: 'Disponible',
        x_mz: 'X',
        x_etapa: '1',
        x_lote: '0',
        ...overrides,
    };
}

describe('mergeLotsData — limpieza de vértices duplicados', () => {
    // Caso real reportado: E01MZS081P tenía dos vértices consecutivos EN EL
    // MEDIO del polígono (no en el cierre) con las mismas coordenadas
    // exactas — generaba una arista fantasma de 0.00ml en la Memoria
    // Descriptiva y descuadraba la clasificación frente/fondo/derecha/
    // izquierda (ver colindanciasUtils.test.ts para ese efecto secundario).
    it('quita un vértice duplicado EN EL MEDIO del anillo, no solo en el cierre', () => {
        const producto = makeProduct({
            default_code: 'E01MZS081P',
            x_geometry_utm: [
                [0, 0],
                [-4.58, -2.13],
                [-5.12, -20.09],
                [1.73, -19.74],
                [1.73, -19.74], // duplicado exacto del vértice anterior
                [8.43, -18.14],
            ],
        });

        const [lote] = mergeLotsData([producto], [], {});

        expect(lote.points).toHaveLength(5);
        // Ningún lado debería quedar en 0 tras la limpieza.
        for (let i = 0; i < lote.points.length; i++) {
            const [ax, ay] = lote.points[i];
            const [bx, by] = lote.points[(i + 1) % lote.points.length];
            const longitud = Math.hypot(bx - ax, by - ay);
            expect(longitud).toBeGreaterThan(0.01);
        }
    });

    // Regresión: el caso original (cierre estilo GeoJSON, primer punto ==
    // último) debe seguir funcionando igual que antes.
    it('sigue quitando el vértice de cierre duplicado (primer punto == último)', () => {
        const producto = makeProduct({
            default_code: 'E01MZX001P',
            x_geometry_utm: [
                [0, 0],
                [10, 0],
                [10, 5],
                [0, 5],
                [0, 0], // cierre GeoJSON
            ],
        });

        const [lote] = mergeLotsData([producto], [], {});
        expect(lote.points).toHaveLength(4);
    });
});

// Los lotes que solo existen en el respaldo geometries-enriched.json (sin
// producto en Odoo) no pasaban por la limpieza: 8 lotes reales (E04MZA015P,
// E03MZD049P, E02MZW022P, E02MZO003P, E04MZZ001P/003P/004P/005P) arrastraban un
// lado de 0.00 ml a la Memoria Descriptiva.
describe('mergeLotsData — limpieza de vértices duplicados en la geometría de respaldo (JSON)', () => {
    const geometria = (coordinates: [number, number][], sides: number[]): EnrichedGeometry => ({
        coordinates,
        measurements: { sides, area: 50, perimeter: 30, centroid: [5, 2.5] },
    });

    it('quita el vértice de cierre repetido (estilo GeoJSON) y mantiene `sides` alineado con los vértices', () => {
        const json = { E04MZA015P: geometria([[0, 0], [10, 0], [10, 5], [0, 5], [0, 0]], [10, 5, 10, 5, 0]) };
        const lote = mergeLotsData([], [], json).find((l) => l.default_code === 'E04MZA015P')!;
        expect(lote.points).toHaveLength(4);
        expect(lote.measurements!.sides).toEqual([10, 5, 10, 5]);
        // Área y perímetro precalculados no se tocan.
        expect(lote.measurements!.area).toBe(50);
        expect(lote.measurements!.perimeter).toBe(30);
    });

    it('quita un vértice repetido EN EL MEDIO (caso E04MZZ001P)', () => {
        const json = { E04MZZ001P: geometria([[0, 0], [10, 0], [10, 5], [10, 5], [0, 5]], [10, 5, 0, 10, 5]) };
        const lote = mergeLotsData([], [], json).find((l) => l.default_code === 'E04MZZ001P')!;
        expect(lote.points).toEqual([[0, 0], [10, 0], [10, 5], [0, 5]]);
        expect(lote.measurements!.sides).toEqual([10, 5, 10, 5]);
    });

    it('una geometría limpia entra exactamente igual que antes (mismo objeto, sin copiar)', () => {
        const limpia = geometria([[0, 0], [10, 0], [10, 5], [0, 5]], [10, 5, 10, 5]);
        const lote = mergeLotsData([], [], { E01MZX001P: limpia }).find((l) => l.default_code === 'E01MZX001P')!;
        expect(lote.points).toBe(limpia.coordinates);
        expect(lote.measurements).toBe(limpia.measurements);
    });

    it('también limpia cuando el lote viene de lotsData y solo la geometría sale del JSON', () => {
        const local = { id: 'x', name: 'Lote local', x_statu: 'libre', list_price: 0, x_area: 50, x_mz: 'Z', x_etapa: '4', x_lote: '1', default_code: 'E04MZZ003P', points: [] } as unknown as Lot;
        const json = { E04MZZ003P: geometria([[0, 0], [10, 0], [10, 5], [0, 5], [0, 0]], [10, 5, 10, 5, 0]) };
        const [lote] = mergeLotsData([], [local], json);
        expect(lote.points).toHaveLength(4);
        expect(lote.measurements!.sides).toHaveLength(4);
    });
});
