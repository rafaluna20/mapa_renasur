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

  describe('campos opcionales (Odoo más nuevo)', () => {
    it('los pide junto con los demás cuando Odoo los conoce', async () => {
      const rpc = rpcDe(3);
      await leerLotesPaginados(rpc, [], ['id'], { camposOpcionales: ['x_frente'] });
      expect(rpc.mock.calls[0][3]?.fields).toEqual(['id', 'x_frente']);
      expect(rpc).toHaveBeenCalledTimes(1);
    });

    it('si Odoo no los conoce (falla la consulta) reintenta SIN ellos y no deja el mapa vacío', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const bueno = rpcDe(3);
      const rpc = vi.fn(async (m: string, met: string, a: unknown[], kw: Record<string, unknown> = {}) => {
        if ((kw.fields as string[]).includes('x_frente')) throw new Error("Invalid field 'x_frente' on model 'product.template'");
        return bueno(m, met, a, kw);
      });
      const r = await leerLotesPaginados(rpc, [], ['id'], { camposOpcionales: ['x_frente'] });
      expect(r.registros).toHaveLength(3);
      expect(rpc.mock.calls.at(-1)?.[3]?.fields).toEqual(['id']);
    });

    it('un fallo que no tiene que ver con los opcionales sigue siendo un fallo', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const rpc = vi.fn(async () => { throw new Error('Odoo caído'); });
      await expect(leerLotesPaginados(rpc, [], ['id'], { camposOpcionales: ['x_frente'] })).rejects.toThrow('Odoo caído');
    });
  });
});
