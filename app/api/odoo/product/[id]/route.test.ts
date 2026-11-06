import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// P3: /api/odoo/product/[id] antes no pedía sesión y devolvía precio y estado de cualquier lote.
// Ahora exige sesión de personal y que el lote sea de un proyecto al que el usuario tiene acceso.

const estado = vi.hoisted(() => ({
  sesion: { odooUid: 7, name: 'Vendedor', companyId: 1, isSystem: false } as unknown,
  acceso: { proyecto_acceso_todos: false, proyecto_ids: [1] } as Record<string, unknown>,
  proyectoDelLote: [2, 'Otro proyecto'] as unknown,
}));

vi.mock('@/app/lib/staffAuth', () => ({
  requireStaffSession: vi.fn(async () =>
    estado.sesion
      ? { session: estado.sesion, response: null }
      : { session: null, response: new Response(JSON.stringify({ success: false }), { status: 401 }) }),
}));

vi.mock('@/app/services/odooService', () => ({
  fetchOdoo: vi.fn(async (model: string, _m: string, _a: unknown[], kw: { fields?: string[] } = {}) => {
    if (model === 'res.users') return [estado.acceso];
    // La consulta de la guardia pide solo x_proyecto_id; la de la ruta pide el lote completo.
    if (kw.fields?.length === 1 && kw.fields[0] === 'x_proyecto_id') return [{ x_proyecto_id: estado.proyectoDelLote }];
    return [{ id: 55, name: 'Lote', default_code: 'E01MZQ055P', list_price: 1000, x_statu: 'disponible' }];
  }),
}));

import { vaciarCacheAcceso } from '@/app/lib/accesoProyectos';
import { GET } from './route';

const llamar = () => GET(new Request('http://x/api/odoo/product/55') as never, { params: Promise.resolve({ id: '55' }) });

describe('GET /api/odoo/product/[id]', () => {
  beforeEach(() => {
    vaciarCacheAcceso();
    estado.sesion = { odooUid: 7, name: 'Vendedor', companyId: 1, isSystem: false };
    estado.acceso = { proyecto_acceso_todos: false, proyecto_ids: [1] };
    estado.proyectoDelLote = [2, 'Otro proyecto'];
  });
  afterEach(() => {
    delete process.env.ACCESO_PROYECTOS_MODO;
    vi.restoreAllMocks();
  });

  it('sin sesión responde 401 (antes respondía el lote a cualquiera)', async () => {
    estado.sesion = null;
    expect((await llamar()).status).toBe(401);
  });

  it('bloquear: un lote de OTRO proyecto responde 403 y no entrega precio ni estado', async () => {
    process.env.ACCESO_PROYECTOS_MODO = 'bloquear';
    const r = await llamar();
    expect(r.status).toBe(403);
    expect(JSON.stringify(await r.json())).not.toContain('list_price');
  });

  it('bloquear: un lote de un proyecto habilitado se entrega', async () => {
    process.env.ACCESO_PROYECTOS_MODO = 'bloquear';
    estado.proyectoDelLote = [1, 'Mi proyecto'];
    const r = await llamar();
    expect(r.status).toBe(200);
    expect((await r.json()).product.default_code).toBe('E01MZQ055P');
  });

  it('bloquear: un lote SIN proyecto (cuarentena) responde 403 a quien no ve todo', async () => {
    process.env.ACCESO_PROYECTOS_MODO = 'bloquear';
    estado.proyectoDelLote = false;
    expect((await llamar()).status).toBe(403);
  });

  it('bloquear: quien ve todos recibe cualquier lote', async () => {
    process.env.ACCESO_PROYECTOS_MODO = 'bloquear';
    estado.acceso = { proyecto_acceso_todos: true, proyecto_ids: [] };
    expect((await llamar()).status).toBe(200);
  });

  it('observar (por defecto): entrega el lote pero registra que lo habría bloqueado', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await llamar();
    expect(r.status).toBe(200);
    expect(aviso.mock.calls.some((c) => String(c[0]).includes('[acceso][observar]'))).toBe(true);
  });

  it('bloquear: si no se puede leer el acceso, niega (cerrado ante la duda)', async () => {
    process.env.ACCESO_PROYECTOS_MODO = 'bloquear';
    vi.spyOn(console, 'error').mockImplementation(() => {});
    estado.acceso = {};          // sin los campos de acceso = módulo de Odoo sin desplegar
    expect((await llamar()).status).toBe(403);
  });
});
