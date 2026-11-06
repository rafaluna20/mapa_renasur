import { beforeEach, describe, expect, it, vi } from 'vitest';

// P1 multiproyecto: el plano NUNCA se genera con la ubicación de otro proyecto (antes: respaldo silencioso a
// «Terra Lima») ni sin ubicación. Un proyecto inactivo o inexistente → 422 con mensaje claro.

const odoo = vi.hoisted(() => ({
  productos: [] as Record<string, unknown>[],
  proyectos: [] as Record<string, unknown>[],
}));

vi.mock('@/app/services/odooService', () => ({
  fetchOdoo: vi.fn(async () => odoo.productos),
  fetchElementosUrbanos: vi.fn(async () => []),
  fetchProyectos: vi.fn(async () => odoo.proyectos),
}));

import { construirPayloadPlano } from './planoPayloadBuilder';

const CODIGO = 'E03MZL006P'; // lote con geometría en el JSON estático
const terra = {
  id: 2, codigo: 'terra-lima', nombre: 'Terra Lima', departamento: 'Lima', provincia: 'Lima',
  distrito: 'Pucusana', urbanizacion: 'Terra Lima', zonaUTM: '18', orden: 10,
};
const chilca = { ...terra, id: 3, codigo: 'chilca', distrito: 'Chilca', urbanizacion: 'Chilca', zonaUTM: '19' };

const producto = (extra: Record<string, unknown>) => ({
  id: 9001, name: CODIGO, default_code: CODIGO, list_price: 1, qty_available: 1, x_statu: 'disponible',
  x_area: 100, x_mz: 'L', x_etapa: '3', x_lote: '006', ...extra,
});

async function cuerpo(r: Awaited<ReturnType<typeof construirPayloadPlano>>) {
  if (r.ok) return { status: 200, json: null as unknown };
  return { status: r.response.status, json: await r.response.json() };
}

describe('construirPayloadPlano: proyecto del lote', () => {
  beforeEach(() => {
    odoo.productos = [];
    odoo.proyectos = [terra, chilca];
  });

  it('con proyecto activo usa la ubicación y la zona UTM de ESE proyecto', async () => {
    odoo.productos = [producto({ x_proyecto_id: [3, 'Chilca'] })];
    const r = await construirPayloadPlano(CODIGO);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const ubic = (r.payload as { lote: { ubicacion: Record<string, unknown> } }).lote.ubicacion;
      expect(ubic.distrito).toBe('Chilca');
      expect(ubic.zonaUTM).toBe(19);
    }
  });

  it('un lote SIN proyecto ya no cae en Terra Lima: responde 422', async () => {
    odoo.productos = [producto({ x_proyecto_id: false })];
    const { status, json } = await cuerpo(await construirPayloadPlano(CODIGO));
    expect(status).toBe(422);
    expect((json as { error: { code: string; message: string } }).error.code).toBe('PROYECTO_NO_RESUELTO');
    expect((json as { error: { message: string } }).error.message).toContain('no tiene proyecto');
  });

  it('un lote que ni siquiera existe en Odoo (solo en el JSON estático) también responde 422', async () => {
    odoo.productos = [];
    const { status } = await cuerpo(await construirPayloadPlano(CODIGO));
    expect(status).toBe(422);
  });

  it('un proyecto INACTIVO (no está en la lista de activos) responde 422', async () => {
    odoo.productos = [producto({ x_proyecto_id: [3, 'Chilca'] })];
    odoo.proyectos = [terra]; // chilca desactivado
    const { status, json } = await cuerpo(await construirPayloadPlano(CODIGO));
    expect(status).toBe(422);
    expect((json as { error: { message: string } }).error.message).toContain('inactivo');
  });

  it('si no se pudo consultar proyectos (lista vacía) no inventa una ubicación', async () => {
    odoo.productos = [producto({ x_proyecto_id: [2, 'Terra Lima'] })];
    odoo.proyectos = [];
    const { status } = await cuerpo(await construirPayloadPlano(CODIGO));
    expect(status).toBe(422);
  });
});
