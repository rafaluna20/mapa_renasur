import { describe, expect, it } from 'vitest';
import { elementosDelEntorno } from './contextoPlano';

const cuadro = (x: number, y: number): [number, number][] => [[x, y], [x + 10, y], [x + 10, y + 10], [x, y + 10]];
const el = (codigo: string, proyectoId: number | undefined, x: number, y: number) => ({ codigo, proyectoId, points: cuadro(x, y) });

describe('elementosDelEntorno', () => {
  const centro: [number, number] = [1000, 1000];
  const todos = [
    el('MIO-CERCA', 2, 1050, 1050),
    el('MIO-LEJOS', 2, 9000, 9000),            // del mismo proyecto: va aunque esté lejos (como antes)
    el('AJENO-CERCA', 5, 1060, 1060),          // de otro proyecto: no va, aunque esté cerca
    el('AJENO-LEJOS', 5, 90000, 90000),
    el('HUERFANO-CERCA', undefined, 1300, 1300),
    el('HUERFANO-LEJOS', undefined, 50000, 50000),
  ];

  it('deja los del mismo proyecto y los huérfanos cercanos; quita los de otro proyecto y los huérfanos lejanos', () => {
    expect(elementosDelEntorno(todos, 2, centro).map((e) => e.codigo)).toEqual(['MIO-CERCA', 'MIO-LEJOS', 'HUERFANO-CERCA']);
  });

  it('el plano de un proyecto lejano NO lleva los elementos de otro proyecto', () => {
    const industrial = elementosDelEntorno(todos, 7, [312700, 8615200]);
    expect(industrial).toEqual([]);
  });

  it('un huérfano sin geometría suficiente no entra', () => {
    expect(elementosDelEntorno([{ codigo: 'X', points: [[1000, 1000]] }], 2, centro)).toEqual([]);
  });

  it('sin proyecto del lote deja todo como antes (la ruta responde 422 de todas formas)', () => {
    expect(elementosDelEntorno(todos, undefined, centro)).toHaveLength(todos.length);
  });
});
