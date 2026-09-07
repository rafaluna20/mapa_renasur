import { describe, it, expect } from 'vitest';
import { derivarColindanciasYDimensiones } from './colindanciasUtils';
import type { Lot } from '@/app/data/lotsData';

function makeLot(overrides: Partial<Lot> & { points: [number, number][] }): Lot {
    return {
        id: overrides.default_code || 'TEST',
        name: overrides.name || 'Lote Test',
        x_statu: 'Disponible',
        list_price: 0,
        x_area: 0,
        x_mz: 'X',
        x_etapa: '1',
        x_lote: '0',
        default_code: 'TEST',
        ...overrides,
    };
}

describe('derivarColindanciasYDimensiones', () => {
    // Caso real reportado: E01MZR045P — un pentágono donde dos aristas no
    // consecutivas (5.70ml a 36° del frente, y 20.00ml a ~1° del frente)
    // calificaban ambas como "paralelas" (candidatas a fondo). Antes del fix,
    // la de 5.70ml (la primera en el recorrido) disparaba la transición de
    // estado, "DERECHA" quedaba vacío, y el verdadero fondo (20.00ml,
    // colindante con el lote 44) terminaba mal clasificado como izquierda.
    it('no deja "derecha" vacío cuando hay dos aristas casi-paralelas al frente no contiguas (lote real E01MZR045P)', () => {
        const lote45 = makeLot({
            default_code: 'E01MZR045P',
            name: 'Etapa 1 Mz R Lote 45',
            points: [
                [308455.89935399895, 8622837.624256909],
                [308468.30102672393, 8622821.933542663],
                [308474.556297455, 8622826.87766899],
                [308465.01542792737, 8622838.948653106],
                [308459.5282881172, 8622840.492570965],
            ],
        });
        const lote44 = makeLot({
            default_code: 'E01MZR044P',
            name: 'Etapa 1 Mz R Lote 44',
            points: [
                [308455.89935399895, 8622837.624256909],
                [308451.19218162843, 8622833.90370199],
                [308463.5940312466, 8622818.213127559],
                [308468.3012036172, 8622821.933682477],
            ],
        });
        const lote46 = makeLot({
            default_code: 'E01MZR046P',
            name: 'Etapa 1 Mz R Lote 46',
            points: [
                [308474.556310096, 8622826.877611874],
                [308468.3012036172, 8622821.933682477],
                [308473.5413436034, 8622798.25597848],
                [308478.9818279959, 8622799.39440464],
                [308480.13413443655, 8622801.675664565],
            ],
        });

        const { colindancias, dimensiones } = derivarColindanciasYDimensiones(
            lote45,
            [lote45, lote44, lote46],
            []
        );

        const porLado = (lado: string) => colindancias.filter((c) => c.lado === lado);

        expect(porLado('frente')).toHaveLength(1);
        expect(porLado('frente')[0].longitud).toBeCloseTo(15.39, 1);

        // El bug reportado: esto quedaba vacío.
        expect(porLado('derecha').length).toBeGreaterThan(0);
        expect(dimensiones.ladoDerecho).toBeCloseTo(10.33, 1);

        // El verdadero fondo (colindante con el lote 44) debe quedar como
        // fondo, no como izquierda.
        const fondo = porLado('fondo');
        expect(fondo).toHaveLength(1);
        expect(fondo[0].tipo).toBe('lote');
        expect(fondo[0].nombre).toContain('44');
        expect(dimensiones.fondo).toBeCloseTo(20.0, 1);

        const izquierda = porLado('izquierda');
        expect(izquierda).toHaveLength(1);
        expect(izquierda[0].nombre).toContain('46');
        expect(dimensiones.ladoIzquierdo).toBeCloseTo(7.97, 1);
    });

    // Regresión: un rectángulo simple (el caso común, sin ninguna arista
    // "paralela" ambigua) debe seguir dando exactamente un lado por cada
    // rótulo, igual que antes del fix.
    it('sigue clasificando un rectángulo simple con un solo lado por rótulo', () => {
        const rectangulo = makeLot({
            default_code: 'E01MZX001P',
            points: [
                [0, 0],
                [10, 0],
                [10, 5],
                [0, 5],
            ],
        });

        const { colindancias, dimensiones } = derivarColindanciasYDimensiones(
            rectangulo,
            [rectangulo],
            []
        );

        const porLado = (lado: string) => colindancias.filter((c) => c.lado === lado);
        expect(porLado('frente')).toHaveLength(1);
        expect(porLado('fondo')).toHaveLength(1);
        expect(porLado('derecha')).toHaveLength(1);
        expect(porLado('izquierda')).toHaveLength(1);
        expect(dimensiones.frente).toBeCloseTo(10, 1);
        expect(dimensiones.fondo).toBeCloseTo(10, 1);
        expect(dimensiones.ladoDerecho).toBeCloseTo(5, 1);
        expect(dimensiones.ladoIzquierdo).toBeCloseTo(5, 1);
    });
});
