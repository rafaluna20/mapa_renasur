import { describe, it, expect } from 'vitest';
import { construirEscena, centroide, partesDeCodigo, type Punto } from './escenaLote';

const cuadrado = (x: number, y: number, l: number): Punto[] => [[x, y], [x + l, y], [x + l, y + l], [x, y + l]];

describe('construirEscena', () => {
    it('centra el lote en el cuadro y voltea el eje Y (norte arriba)', () => {
        const e = construirEscena({ lote: cuadrado(1000, 2000, 10), vecinos: [], elementos: [], lado: 1000 })!;
        expect(e.lote.centro[0]).toBeCloseTo(500, 5);
        expect(e.lote.centro[1]).toBeCloseTo(500, 5);
        // El vértice sur-oeste (y menor en UTM) queda ABAJO a la izquierda en pantalla.
        const [x0, y0] = e.lote.puntos[0];
        const [x2, y2] = e.lote.puntos[2];
        expect(x0).toBeLessThan(x2);
        expect(y0).toBeGreaterThan(y2);
    });

    it('la escala depende del lote más el margen (lote de 10 m + 2×32 m de margen → 74 m visibles)', () => {
        const e = construirEscena({ lote: cuadrado(0, 0, 10), vecinos: [], elementos: [], lado: 740 })!;
        expect(e.escala).toBeCloseTo(10, 5);
        expect(e.lote.ancho).toBeCloseTo(100, 5);
    });

    it('descarta vecinos y elementos fuera de la ventana y conserva los cercanos', () => {
        const e = construirEscena({
            lote: cuadrado(0, 0, 10),
            vecinos: [{ puntos: cuadrado(12, 0, 10), etiqueta: '2' }, { puntos: cuadrado(5000, 5000, 10), etiqueta: '99' }],
            elementos: [
                { puntos: cuadrado(-20, -20, 8), tipo: 'aporte_recreacion', nombre: 'Parque', colorBorde: '#0a0', colorRelleno: '#afa' },
                { puntos: cuadrado(9000, 0, 8), tipo: 'calle', nombre: 'Lejos', colorBorde: '#000', colorRelleno: '#ccc' },
            ],
            lado: 1000,
        })!;
        expect(e.vecinos.map((v) => v.etiqueta)).toEqual(['2']);
        expect(e.elementos.map((x) => x.nombre)).toEqual(['Parque']);
    });

    it('un polígono que solo asoma por el borde de la ventana se conserva (se recorta al dibujar)', () => {
        const e = construirEscena({ lote: cuadrado(0, 0, 10), vecinos: [], elementos: [{ puntos: cuadrado(35, 0, 100), tipo: 'calle', nombre: 'C', colorBorde: '#000', colorRelleno: '#ccc' }], lado: 1000 })!;
        expect(e.elementos).toHaveLength(1);
    });

    it('ignora el vértice de cierre repetido y rechaza polígonos degenerados', () => {
        const cerrado = [...cuadrado(0, 0, 10), [0, 0] as Punto];
        expect(construirEscena({ lote: cerrado, vecinos: [], elementos: [], lado: 500 })!.lote.puntos).toHaveLength(4);
        expect(construirEscena({ lote: [[0, 0], [1, 1]], vecinos: [], elementos: [], lado: 500 })).toBeNull();
    });
});

describe('centroide', () => {
    it('centro de un cuadrado y respaldo cuando el área es 0', () => {
        expect(centroide(cuadrado(0, 0, 10))).toEqual([5, 5]);
        expect(centroide([[0, 0], [10, 0], [20, 0]])).toEqual([10, 0]);
    });
});

describe('centroide con coordenadas UTM reales', () => {
    it('no pierde precisión con norte ≈ 8.6e6 (el número del lote debe caer dentro de su lote)', () => {
        const p: Punto[] = [[286400.12, 8600000.34], [286412.12, 8600003.34], [286410.12, 8600011.34], [286398.12, 8600008.34]];
        const [cx, cy] = centroide(p);
        expect(cx).toBeCloseTo(286405.12, 3);
        expect(cy).toBeCloseTo(8600005.84, 3);
    });
});

describe('partesDeCodigo', () => {
    it('lote normal, lote partido y código inválido', () => {
        expect(partesDeCodigo('E01MZV001P')).toEqual({ manzana: 'V', lote: '1' });
        expect(partesDeCodigo('E01MZS0331')).toEqual({ manzana: 'S', lote: '33A' });
        expect(partesDeCodigo('e02mzu0342')).toEqual({ manzana: 'U', lote: '34B' });
        expect(partesDeCodigo('BASURA')).toBeNull();
    });
});
