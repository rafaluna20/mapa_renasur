import { describe, it, expect } from 'vitest';
import { muestrearArco, expandirVerticesConArcos, buscarArcoPorIndice, ArcoMetadata } from './arcoUtils';

// Datos reales de un lote de producción (Mz Q Lote 39, ver sesión de
// depuración de arcos): radio=6, longitudArco=10.74, sentido=horario.
const p1: [number, number] = [308626.1493, 8622896.2968];
const p2: [number, number] = [308620.6952, 8622903.905];
const arcoReal: ArcoMetadata = { indiceVertice: 0, radio: 6, longitudArco: 10.74, sentido: 'horario' };

function distancia(a: [number, number], b: [number, number]): number {
    return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
}

describe('muestrearArco', () => {
    it('el primer y ultimo punto muestreado coinciden exactamente con p1/p2', () => {
        const puntos = muestrearArco(p1, p2, arcoReal, 16);
        expect(puntos[0][0]).toBeCloseTo(p1[0], 6);
        expect(puntos[0][1]).toBeCloseTo(p1[1], 6);
        expect(puntos[puntos.length - 1][0]).toBeCloseTo(p2[0], 6);
        expect(puntos[puntos.length - 1][1]).toBeCloseTo(p2[1], 6);
    });

    it('todos los puntos muestreados quedan a "radio" metros de un centro comun (estan en el circulo)', () => {
        const puntos = muestrearArco(p1, p2, arcoReal, 16);
        // Reconstruir el circuncentro a partir de 3 puntos muestreados
        // (formula estandar) y verificar que TODOS los demas puntos quedan
        // a esa misma distancia (el radio) de ese centro.
        const [ax, ay] = puntos[0];
        const [bx, by] = puntos[Math.floor(puntos.length / 2)];
        const [cx, cy] = puntos[puntos.length - 1];
        const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
        const centroX = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
        const centroY = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;

        for (const p of puntos) {
            // Tolerancia de 2 decimales (cm), no mas: las coordenadas UTM
            // reales rondan 10^5-10^6, asi que la formula del circuncentro
            // (resta numeros grandes) acumula ruido de punto flotante mucho
            // antes del limite teorico de precision de un float64.
            expect(distancia(p, [centroX, centroY])).toBeCloseTo(arcoReal.radio, 2);
        }
    });

    it('la suma de las distancias entre puntos consecutivos aproxima la longitud real del arco', () => {
        const puntos = muestrearArco(p1, p2, arcoReal, 64); // mas puntos = mejor aproximacion
        let longitud = 0;
        for (let i = 1; i < puntos.length; i++) {
            longitud += distancia(puntos[i - 1], puntos[i]);
        }
        expect(longitud).toBeCloseTo(arcoReal.longitudArco, 1);
    });

    it('lanza un error si el radio es menor a la mitad de la distancia entre los 2 puntos', () => {
        const radioInvalido = { radio: 1, longitudArco: 5, sentido: 'horario' as const };
        expect(() => muestrearArco(p1, p2, radioInvalido)).toThrow();
    });
});

describe('expandirVerticesConArcos', () => {
    const cuadrado: [number, number][] = [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
    ];

    it('sin arcos, devuelve los vertices sin modificar', () => {
        expect(expandirVerticesConArcos(cuadrado, undefined)).toEqual(cuadrado);
        expect(expandirVerticesConArcos(cuadrado, [])).toEqual(cuadrado);
    });

    it('con un arco, inserta puntos intermedios entre esos 2 vertices', () => {
        const arco: ArcoMetadata = { indiceVertice: 0, radio: 10, longitudArco: 12, sentido: 'antihorario' };
        const expandido = expandirVerticesConArcos(cuadrado, [arco]);
        // El cuadrado original tiene 4 vertices; expandido debe tener mas
        // (16 puntos de muestreo insertados en el lado 0->1, menos 1 porque
        // el primer punto muestreado coincide con el vertice inicial).
        expect(expandido.length).toBeGreaterThan(cuadrado.length);
        // El primer vertice se mantiene igual
        expect(expandido[0]).toEqual(cuadrado[0]);
    });

    it('los lados sin arco se mantienen como lineas rectas (sin puntos extra)', () => {
        const arco: ArcoMetadata = { indiceVertice: 2, radio: 10, longitudArco: 12, sentido: 'horario' };
        const expandido = expandirVerticesConArcos(cuadrado, [arco]);
        // El lado 0->1 (sin arco) debe seguir teniendo el vertice 1 tal cual
        expect(expandido).toContainEqual(cuadrado[1]);
    });
});

describe('buscarArcoPorIndice', () => {
    const arcos: ArcoMetadata[] = [
        { indiceVertice: 0, radio: 5, longitudArco: 6, sentido: 'horario' },
        { indiceVertice: 2, radio: 8, longitudArco: 9, sentido: 'antihorario' },
    ];

    it('encuentra el arco correcto por indiceVertice', () => {
        expect(buscarArcoPorIndice(arcos, 2)?.radio).toBe(8);
    });

    it('devuelve undefined si no hay arco en ese indice, o si arcos es null/undefined', () => {
        expect(buscarArcoPorIndice(arcos, 1)).toBeUndefined();
        expect(buscarArcoPorIndice(undefined, 0)).toBeUndefined();
        expect(buscarArcoPorIndice(null, 0)).toBeUndefined();
    });
});
