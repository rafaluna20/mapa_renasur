import { describe, expect, it, vi } from 'vitest';
import { DOMINIO_PROYECTO_ACTIVO, leerLotesPaginados } from './lotesPaginados';

const filas = (desde: number, n: number) => Array.from({ length: n }, (_, i) => ({ id: desde + i }));

function rpcDe(total: number) {
  return vi.fn(async (_m: string, _met: string, _a: unknown[], kw: Record<string, unknown> = {}) => {
    const off = kw.offset as number;
    const lim = kw.limit as number;
    return filas(off + 1, Math.max(0, Math.min(lim, total - off)));
  });
}

describe('leerLotesPaginados', () => {
  it('trae TODOS los lotes aunque pasen de 1000 (el límite fijo anterior los recortaba en silencio)', async () => {
    const r = await leerLotesPaginados<{ id: number }>(rpcDe(1350), [['active', '=', true]], ['id'], { pagina: 500 });
    expect(r.registros).toHaveLength(1350);
    expect(r.truncado).toBe(false);
    expect(new Set(r.registros.map((x) => x.id)).size).toBe(1350); // sin repetidos entre páginas
  });

  it('un total exacto múltiplo de la página no se queda a medias', async () => {
    const r = await leerLotesPaginados(rpcDe(1000), [], ['id'], { pagina: 500 });
    expect(r.registros).toHaveLength(1000);
    expect(r.truncado).toBe(false);
  });

  it('al llegar al tope avisa que está truncado', async () => {
    const r = await leerLotesPaginados(rpcDe(5000), [], ['id'], { pagina: 500, tope: 2000 });
    expect(r.registros).toHaveLength(2000);
    expect(r.truncado).toBe(true);
  });

  it('agrega siempre el filtro de proyecto activo y un orden estable', async () => {
    const rpc = rpcDe(3);
    await leerLotesPaginados(rpc, [['active', '=', true]], ['id']);
    const [, , args, kw] = rpc.mock.calls[0];
    expect((args as unknown[][])[0]).toEqual([['active', '=', true], ...DOMINIO_PROYECTO_ACTIVO]);
    expect(kw?.order).toBe('id');
  });

  it('el filtro deja pasar lotes sin proyecto y excluye los de proyecto inactivo', () => {
    expect(DOMINIO_PROYECTO_ACTIVO).toEqual(['|', ['x_proyecto_id', '=', false], ['x_proyecto_id.active', '=', true]]);
  });
});
