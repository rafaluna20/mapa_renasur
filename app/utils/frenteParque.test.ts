import { describe, it, expect } from 'vitest';
import { clasificarFrenteParque, crearContextoFrenteParque, type Punto } from './frenteParque';

const rect = (x0: number, y0: number, x1: number, y1: number): Punto[] => [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
];

// Parque 40x30 en (0..40, 0..30). Calle de 10 m de ancho pegada por debajo
// (y -10..0), larga en x. Todo en metros.
const parque = rect(0, 0, 40, 30);
const calle = rect(-50, -10, 100, 0);
const ctx = crearContextoFrenteParque([calle], [parque]);

describe('clasificarFrenteParque', () => {
    it('lote que comparte un lado con el parque -> colindante', () => {
        const lote = rect(10, 30, 20, 45); // apoyado sobre el borde superior del parque
        const r = clasificarFrenteParque(lote, ctx);
        expect(r.tipo).toBe('colindante');
    });

    it('lote al otro lado de la calle, a 10 m del parque -> al_otro_lado', () => {
        const lote = rect(10, -25, 20, -10); // su frente (y=-10) pega con la calle
        const r = clasificarFrenteParque(lote, ctx);
        expect(r.tipo).toBe('al_otro_lado');
        expect(r.distanciaM).toBeCloseTo(10, 1);
    });

    it('un roce en un solo vértice NO cuenta como colindante', () => {
        const lote = rect(40, 30, 50, 40); // toca solo la esquina (40,30)
        const r = clasificarFrenteParque(lote, ctx);
        expect(r.tipo).toBeNull();
    });

    it('lote lejos (más de 25 m) -> sin frente a parque', () => {
        const lote = rect(10, -80, 20, -65);
        const r = clasificarFrenteParque(lote, ctx);
        expect(r.tipo).toBeNull();
        expect(r.distanciaM).toBeGreaterThan(25);
    });

    it('cruzando una calle ancha, a más de 25 m -> null', () => {
        const calleAncha = rect(-50, -30, 100, 0);
        const c2 = crearContextoFrenteParque([calleAncha], [parque]);
        const lote = rect(10, -45, 20, -30); // 30 m del parque
        expect(clasificarFrenteParque(lote, c2).tipo).toBeNull();
    });

    it('cerca del parque pero SIN calle de por medio (ej. lote de la misma fila) -> null', () => {
        // Sin calle que cruzar: a 8 m del parque pero por terreno sin calle.
        const sinCalle = crearContextoFrenteParque([], [parque]);
        const lote = rect(10, -18, 20, -8);
        expect(clasificarFrenteParque(lote, sinCalle).tipo).toBeNull();
    });

    it('lote junto al parque pero con su frente a una calle que NO está entre ambos -> null', () => {
        // El parque queda "detrás" del lote y la calle del lote está del lado opuesto:
        // la línea lote->parque no cruza ninguna calle.
        const calleOpuesta = rect(-50, 60, 100, 70);
        const c2 = crearContextoFrenteParque([calleOpuesta], [parque]);
        const lote = rect(10, 45, 20, 60); // pegado a la calle de arriba; parque a 15 m hacia abajo
        expect(clasificarFrenteParque(lote, c2).tipo).toBeNull();
    });

    it('sin parques cargados -> tipo null y distancia null (no inventa)', () => {
        const vacio = crearContextoFrenteParque([calle], []);
        const r = clasificarFrenteParque(rect(10, 30, 20, 45), vacio);
        expect(r).toEqual({ tipo: null, distanciaM: null });
    });

    it('acepta polígonos con el primer punto repetido al final', () => {
        const lote: Punto[] = [...rect(10, 30, 20, 45), [10, 30]];
        expect(clasificarFrenteParque(lote, ctx).tipo).toBe('colindante');
    });

    it('polígono degenerado (menos de 3 puntos) -> null sin lanzar error', () => {
        expect(clasificarFrenteParque([[0, 0], [1, 1]], ctx)).toEqual({ tipo: null, distanciaM: null });
    });
});
