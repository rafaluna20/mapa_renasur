import { beforeEach, describe, expect, it, vi } from 'vitest';

// P7: el plano lleva el NOMBRE del proyecto de su lote (no «Terra Lima» fijo) y, si el proyecto es industrial, su perfil, sus
// etiquetas y el frente y la potencia del lote. El perfil de siempre (habilitación urbana) no manda `config`.

const odoo = vi.hoisted(() => ({
  productos: [] as Record<string, unknown>[],
  proyectos: [] as Record<string, unknown>[],
}));

vi.mock('@/app/services/odooService', () => ({
  fetchOdoo: vi.fn(async () => odoo.productos),
  fetchElementosUrbanos: vi.fn(async () => []),
  fetchProyectos: vi.fn(async () => odoo.proyectos),
}));

import { construirPayloadPlano, configDeProyecto, metadatosDeProyecto } from './planoPayloadBuilder';

const CODIGO = 'E03MZL006P'; // lote con geometría en el JSON estático
const OFERTA = { cuotaInicial: null, nroCuotas: null, whatsappNumero: null, whatsappVisible: null, distanciaReferenciaKm: null, referenciaNombre: null, direccionReferencia: null, servicios: null, fraseHabilitacion: null, resolucionMunicipal: null };
const base = { departamento: 'Lima', provincia: 'Lima', distrito: 'Pucusana', zonaUTM: '18', orden: 10, oferta: OFERTA, tipo: 'lotizacion' };
const terra = { ...base, id: 2, codigo: 'terra-lima', nombre: 'Terra Lima', urbanizacion: 'Terra Lima', etiquetaAgrupador: 'Manzana', etiquetaNumero: 'Lote' };
const industrial = {
  ...base, id: 5, codigo: 'parque-sur', nombre: 'Parque Industrial Sur', urbanizacion: 'Parque Industrial Sur', distrito: 'Chilca',
  etiquetaAgrupador: 'Sector', etiquetaNumero: 'Módulo', perfilPlano: 'INDUSTRIAL',
};

const producto = (extra: Record<string, unknown>) => ({
  id: 9001, name: CODIGO, default_code: CODIGO, list_price: 1, qty_available: 1, x_statu: 'disponible',
  x_area: 100, x_mz: 'L', x_etapa: '3', x_lote: '006', ...extra,
});

type Cuerpo = { lote: Record<string, unknown>; config?: Record<string, unknown> };
async function payloadDe(): Promise<Cuerpo> {
  const r = await construirPayloadPlano(CODIGO);
  if (!r.ok) throw new Error('no se armó el payload: ' + r.response.status);
  return r.payload as unknown as Cuerpo;
}

describe('construirPayloadPlano: proyecto, perfil y atributos del lote', () => {
  beforeEach(() => {
    odoo.productos = [];
    odoo.proyectos = [terra, industrial];
  });

  it('un lote de habilitación urbana lleva el nombre de su proyecto y NO manda config ni atributos industriales', async () => {
    odoo.productos = [producto({ x_proyecto_id: [2, 'Terra Lima'], x_frente: 30, x_potencia_kw: 250 })];
    const p = await payloadDe();
    expect(p.lote.proyectoNombre).toBe('Terra Lima');
    expect(p.config).toBeUndefined();
    for (const k of ['etiquetaAgrupador', 'etiquetaNumero', 'frenteM', 'potenciaKw']) expect(p.lote, k).not.toHaveProperty(k);
  });

  it('un lote industrial manda su proyecto, sus etiquetas, el frente y la potencia, y el perfil INDUSTRIAL', async () => {
    odoo.productos = [producto({ x_proyecto_id: [5, 'Parque Industrial Sur'], x_frente: 30, x_potencia_kw: 250 })];
    const p = await payloadDe();
    expect(p.lote).toMatchObject({ proyectoNombre: 'Parque Industrial Sur', etiquetaAgrupador: 'Sector', etiquetaNumero: 'Módulo', frenteM: 30, potenciaKw: 250 });
    expect(p.config).toEqual({ perfil: 'INDUSTRIAL' });
  });

  it('frente y potencia vacíos (Odoo manda 0) no se envían', async () => {
    odoo.productos = [producto({ x_proyecto_id: [5, 'Parque Industrial Sur'], x_frente: 0, x_potencia_kw: false })];
    const p = await payloadDe();
    expect(p.lote).not.toHaveProperty('frenteM');
    expect(p.lote).not.toHaveProperty('potenciaKw');
    expect(p.config).toEqual({ perfil: 'INDUSTRIAL' });
  });

  it('con un Odoo viejo (proyectos sin oferta) queda la marca de siempre y ningún perfil', async () => {
    const { oferta, ...viejo } = terra;
    void oferta;
    odoo.proyectos = [viejo];
    odoo.productos = [producto({ x_proyecto_id: [2, 'Terra Lima'] })];
    const p = await payloadDe();
    expect(p.lote.proyectoNombre).toBe('Terra Lima');
    expect(p.config).toBeUndefined();
  });
});

describe('metadatosDeProyecto / configDeProyecto', () => {
  it('el perfil de habilitación urbana, el de predio sin perfil y el desconocido', () => {
    expect(configDeProyecto({ ...terra, perfilPlano: 'HABILITACION_URBANA' } as never)).toEqual({});
    expect(configDeProyecto(terra as never)).toEqual({});
    expect(configDeProyecto({ ...terra, perfilPlano: 'PREDIO' } as never)).toEqual({ config: { perfil: 'PREDIO' } });
  });

  it('las etiquetas y los atributos industriales solo viajan con el perfil industrial', () => {
    expect(metadatosDeProyecto(terra as never, { x_frente: 30 })).toEqual({ proyectoNombre: 'Terra Lima' });
    expect(metadatosDeProyecto(industrial as never, { x_frente: 30, x_potencia_kw: 250 })).toMatchObject({ frenteM: 30, potenciaKw: 250, etiquetaAgrupador: 'Sector' });
  });
});
