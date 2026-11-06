import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TTL_CACHE_MS,
  aplicarAcceso,
  guardiaProyecto,
  idProyecto,
  modoAcceso,
  obtenerAcceso,
  proyectoDeLote,
  puedeVer,
  vaciarCacheAcceso,
  type AccesoProyectos,
} from './accesoProyectos';

const acceso = (ids: number[], todos = false): AccesoProyectos => ({ todos, ids: new Set(ids), origen: 'odoo' });
const vendedor = { odooUid: 7, isSystem: false };

describe('modoAcceso', () => {
  it('por defecto es observar y un valor raro también', () => {
    expect(modoAcceso({})).toBe('observar');
    expect(modoAcceso({ ACCESO_PROYECTOS_MODO: 'quizas' })).toBe('observar');
  });
  it('acepta off, observar y bloquear (sin importar mayúsculas)', () => {
    expect(modoAcceso({ ACCESO_PROYECTOS_MODO: 'OFF' })).toBe('off');
    expect(modoAcceso({ ACCESO_PROYECTOS_MODO: ' Bloquear ' })).toBe('bloquear');
  });
});

describe('puedeVer', () => {
  it('quien ve todos ve todo, también lo que no tiene proyecto', () => {
    expect(puedeVer(acceso([], true), 99)).toBe(true);
    expect(puedeVer(acceso([], true), null)).toBe(true);
  });
  it('los demás solo ven sus proyectos', () => {
    expect(puedeVer(acceso([1, 2]), 2)).toBe(true);
    expect(puedeVer(acceso([1, 2]), 3)).toBe(false);
  });
  it('lo que no tiene proyecto queda en cuarentena para quien no ve todo', () => {
    expect(puedeVer(acceso([1]), null)).toBe(false);
    expect(puedeVer(acceso([1]), undefined)).toBe(false);
    expect(puedeVer(acceso([1]), 0)).toBe(false);
  });
});

describe('idProyecto', () => {
  it('lee la tupla de Odoo, un id suelto y descarta false', () => {
    expect(idProyecto([3, 'Terra Lima'])).toBe(3);
    expect(idProyecto(5)).toBe(5);
    expect(idProyecto(false)).toBeNull();
    expect(idProyecto(undefined)).toBeNull();
  });
});

describe('obtenerAcceso', () => {
  beforeEach(() => vaciarCacheAcceso());
  afterEach(() => vi.restoreAllMocks());

  it('el administrador del sistema ve todo sin consultar a Odoo', async () => {
    const rpc = vi.fn();
    const a = await obtenerAcceso({ odooUid: 1, isSystem: true }, { rpc, modo: 'bloquear' });
    expect(a.todos).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('en modo off no restringe a nadie', async () => {
    const rpc = vi.fn();
    expect((await obtenerAcceso(vendedor, { rpc, modo: 'off' })).todos).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('lee los proyectos habilitados de Odoo', async () => {
    const rpc = vi.fn().mockResolvedValue([{ proyecto_acceso_todos: false, proyecto_ids: [1, 2] }]);
    const a = await obtenerAcceso(vendedor, { rpc, modo: 'bloquear' });
    expect(a.todos).toBe(false);
    expect([...a.ids]).toEqual([1, 2]);
    expect(rpc).toHaveBeenCalledWith('res.users', 'read', [[7], ['proyecto_acceso_todos', 'proyecto_ids']]);
  });

  it('guarda en caché un minuto y luego vuelve a leer (quitar un acceso surte efecto pronto)', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce([{ proyecto_acceso_todos: false, proyecto_ids: [1] }])
      .mockResolvedValueOnce([{ proyecto_acceso_todos: false, proyecto_ids: [] }]);
    let t = 1_000;
    const ahora = () => t;
    await obtenerAcceso(vendedor, { rpc, ahora, modo: 'bloquear' });
    t += TTL_CACHE_MS - 1;
    expect([...(await obtenerAcceso(vendedor, { rpc, ahora, modo: 'bloquear' })).ids]).toEqual([1]);
    expect(rpc).toHaveBeenCalledTimes(1);
    t += 2;
    expect([...(await obtenerAcceso(vendedor, { rpc, ahora, modo: 'bloquear' })).ids]).toEqual([]);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('si Odoo falla: en observar deja pasar, en bloquear NIEGA', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const rpc = vi.fn().mockRejectedValue(new Error('Odoo caído'));
    expect((await obtenerAcceso(vendedor, { rpc, modo: 'observar' })).todos).toBe(true);
    vaciarCacheAcceso();
    const cerrado = await obtenerAcceso(vendedor, { rpc, modo: 'bloquear' });
    expect(cerrado.todos).toBe(false);
    expect(cerrado.ids.size).toBe(0);
  });

  it('si el módulo de Odoo no está desplegado (sin los campos) se trata como fallo', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const rpc = vi.fn().mockResolvedValue([{ id: 7 }]);
    expect((await obtenerAcceso(vendedor, { rpc, modo: 'bloquear' })).todos).toBe(false);
  });

  it('un error no se guarda en caché', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const rpc = vi.fn()
      .mockRejectedValueOnce(new Error('x'))
      .mockResolvedValueOnce([{ proyecto_acceso_todos: true, proyecto_ids: [] }]);
    await obtenerAcceso(vendedor, { rpc, modo: 'bloquear' });
    expect((await obtenerAcceso(vendedor, { rpc, modo: 'bloquear' })).todos).toBe(true);
  });
});

describe('aplicarAcceso', () => {
  const lotes = [
    { c: 'A1', p: 1 }, { c: 'A2', p: 1 }, { c: 'B1', p: 2 }, { c: 'S1', p: null },
  ];
  afterEach(() => vi.restoreAllMocks());

  it('bloquear: deja solo los proyectos habilitados y oculta lo que no tiene proyecto', () => {
    const r = aplicarAcceso(lotes, acceso([1]), (l) => l.p, { uid: 7, recurso: 'lotes', modo: 'bloquear' });
    expect(r.map((l) => l.c)).toEqual(['A1', 'A2']);
  });

  it('quien ve todos recibe todo', () => {
    const r = aplicarAcceso(lotes, acceso([], true), (l) => l.p, { uid: 1, recurso: 'lotes', modo: 'bloquear' });
    expect(r).toHaveLength(4);
  });

  it('observar: devuelve TODO pero registra lo que habría ocultado, con el detalle por proyecto', () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = aplicarAcceso(lotes, acceso([1]), (l) => l.p, { uid: 7, recurso: 'lotes', modo: 'observar' });
    expect(r).toHaveLength(4);
    const dato = JSON.parse(String(aviso.mock.calls[0][0]).split('bloquearía: ')[1]);
    expect(dato).toMatchObject({ uid: 7, recurso: 'lotes', ocultos: 2, sinProyecto: 1, porProyecto: { '2': 1 } });
  });

  it('observar sin nada que ocultar no registra ruido', () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    aplicarAcceso(lotes.slice(0, 2), acceso([1]), (l) => l.p, { uid: 7, recurso: 'lotes', modo: 'observar' });
    expect(aviso).not.toHaveBeenCalled();
  });

  it('off: no toca nada', () => {
    expect(aplicarAcceso(lotes, acceso([]), (l) => l.p, { uid: 7, recurso: 'lotes', modo: 'off' })).toHaveLength(4);
  });

  it('no modifica la lista original', () => {
    const copia = [...lotes];
    aplicarAcceso(lotes, acceso([1]), (l) => l.p, { uid: 7, recurso: 'lotes', modo: 'bloquear' });
    expect(lotes).toEqual(copia);
  });
});

describe('guardiaProyecto', () => {
  afterEach(() => vi.restoreAllMocks());

  it('permite el proyecto habilitado', () => {
    expect(guardiaProyecto(acceso([1]), 1, { uid: 7, ruta: '/x', modo: 'bloquear' }).ok).toBe(true);
  });

  it('bloquear: responde 403 para otro proyecto y para lo que no tiene proyecto', async () => {
    for (const proyecto of [2, null]) {
      const r = guardiaProyecto(acceso([1]), proyecto, { uid: 7, ruta: '/x', modo: 'bloquear' });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.response.status).toBe(403);
    }
  });

  it('observar: deja pasar pero registra', () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(guardiaProyecto(acceso([1]), 2, { uid: 7, ruta: '/api/odoo/x', modo: 'observar' }).ok).toBe(true);
    expect(String(aviso.mock.calls[0][0])).toContain('/api/odoo/x');
  });

  it('off: siempre permite', () => {
    expect(guardiaProyecto(acceso([]), 9, { uid: 7, ruta: '/x', modo: 'off' }).ok).toBe(true);
  });
});

describe('proyectoDeLote', () => {
  it('busca por id de producto, por plantilla o por código', async () => {
    const rpc = vi.fn().mockResolvedValue([{ x_proyecto_id: [4, 'P'] }]);
    expect(await proyectoDeLote({ productId: 10 }, rpc)).toBe(4);
    expect(rpc.mock.calls[0][0]).toBe('product.product');
    expect(await proyectoDeLote({ templateId: 11 }, rpc)).toBe(4);
    expect(rpc.mock.calls[1][0]).toBe('product.template');
    expect(await proyectoDeLote({ codigo: 'E01MZQ055P' }, rpc)).toBe(4);
    expect(rpc.mock.calls[2][1]).toBe('search_read');
  });

  it('un lote sin proyecto da null y uno inexistente da undefined', async () => {
    expect(await proyectoDeLote({ productId: 1 }, vi.fn().mockResolvedValue([{ x_proyecto_id: false }]))).toBeNull();
    expect(await proyectoDeLote({ productId: 1 }, vi.fn().mockResolvedValue([]))).toBeUndefined();
    expect(await proyectoDeLote({}, vi.fn())).toBeUndefined();
  });
});
