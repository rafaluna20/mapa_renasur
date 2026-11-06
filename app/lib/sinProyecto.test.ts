import { describe, expect, it } from 'vitest';
import { contarSinProyecto, mensajeSinProyecto } from './sinProyecto';

describe('contarSinProyecto', () => {
  it('cuenta lotes y elementos sin proyecto (ausente, null o 0)', () => {
    const r = contarSinProyecto(
      [{ x_proyectoId: 2 }, {}, { x_proyectoId: null }, { x_proyectoId: 0 }],
      [{ proyectoId: 3 }, {}],
    );
    expect(r).toEqual({ lotes: 3, elementos: 1, total: 4 });
  });

  it('todo asignado: no hay aviso', () => {
    const r = contarSinProyecto([{ x_proyectoId: 1 }], [{ proyectoId: 1 }]);
    expect(r.total).toBe(0);
    expect(mensajeSinProyecto(r)).toBeNull();
  });

  it('el mensaje concuerda en singular y plural', () => {
    expect(mensajeSinProyecto({ lotes: 1, elementos: 0, total: 1 })).toContain('1 lote sin proyecto');
    expect(mensajeSinProyecto({ lotes: 0, elementos: 156, total: 156 })).toContain('156 elementos urbanos sin proyecto');
    expect(mensajeSinProyecto({ lotes: 2, elementos: 1, total: 3 })).toContain('2 lotes y 1 elemento urbano sin proyecto');
  });
});
