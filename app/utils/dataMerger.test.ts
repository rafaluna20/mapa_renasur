import { describe, it, expect } from 'vitest';
import { mergeLotsData } from './dataMerger';
import type { OdooProduct } from '@/app/services/odooService';

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
