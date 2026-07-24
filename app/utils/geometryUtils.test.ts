import { describe, it, expect } from 'vitest';
import {
    calculateDistance,
    calculateMidpoint,
    calculateSideLengths,
    calculateArea,
    calculatePerimeter,
    calculateCentroid,
} from './geometryUtils';
import type { ArcoMetadata } from './arcoUtils';

describe('calculateDistance / calculateMidpoint', () => {
    it('calcula distancia euclidiana correctamente', () => {
        expect(calculateDistance([0, 0], [3, 4])).toBe(5);
    });

    it('calcula el punto medio correctamente', () => {
        expect(calculateMidpoint([0, 0], [10, 20])).toEqual([5, 10]);
    });
});

describe('calculateArea / calculatePerimeter (cuadrado 10x10)', () => {
    const cuadrado: [number, number][] = [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
    ];

    it('area de un cuadrado 10x10 es 100', () => {
        expect(calculateArea(cuadrado)).toBeCloseTo(100, 6);
    });

    it('perimetro de un cuadrado 10x10 es 40', () => {
        expect(calculatePerimeter(cuadrado)).toBeCloseTo(40, 6);
    });
});

describe('calculateCentroid', () => {
    it('centroide de un cuadrado 10x10 en el origen es (5,5)', () => {
        const cuadrado: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];
        expect(calculateCentroid(cuadrado)).toEqual([5, 5]);
    });
});

describe('calculateSideLengths con lados curvos (arcos)', () => {
    const cuadrado: [number, number][] = [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
    ];

    it('sin arcos, usa la distancia recta entre vertices', () => {
        const lados = calculateSideLengths(cuadrado);
        expect(lados).toEqual([10, 10, 10, 10]);
    });

    it('con un lado marcado como arco, usa longitudArco en vez de la distancia recta', () => {
        // Lado 0 (de [0,0] a [10,0]): cuerda recta = 10, pero longitudArco = 12
        const arco: ArcoMetadata = { indiceVertice: 0, radio: 10, longitudArco: 12, sentido: 'antihorario' };
        const lados = calculateSideLengths(cuadrado, [arco]);
        expect(lados[0]).toBe(12); // arco, no la cuerda recta de 10
        expect(lados[1]).toBe(10); // los demas lados sin cambios
        expect(lados[2]).toBe(10);
        expect(lados[3]).toBe(10);
    });

    it('el perimetro con arco tambien refleja la longitud de arco, no la cuerda', () => {
        const arco: ArcoMetadata = { indiceVertice: 0, radio: 10, longitudArco: 12, sentido: 'antihorario' };
        expect(calculatePerimeter(cuadrado, [arco])).toBe(42); // 12+10+10+10
    });
});
