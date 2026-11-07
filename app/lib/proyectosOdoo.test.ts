import { afterEach, describe, expect, it, vi } from 'vitest';
import { CAMPOS_BASE, CAMPOS_OFERTA, leerProyectosVia, mapearProyecto, type ProyectoCrudo } from './proyectosOdoo';

const basico: ProyectoCrudo = {
  id: 2, codigo: 'terra-lima', name: 'Terra Lima', departamento: 'Lima', provincia: 'Lima', distrito: 'Pucusana',
  urbanizacion: 'Terra Lima', zona_utm: '18', centro_este: false, centro_norte: false, secuencia: 10,
};
const conOferta: ProyectoCrudo = {
  ...basico, tipo: 'lotizacion', publicar_web: true, cuota_inicial: 18500, nro_cuotas: 84, whatsapp_numero: '51977684050',
  whatsapp_visible: '+51 977 684 050', distancia_referencia_km: 4.5, referencia_nombre: 'la playa',
  direccion_referencia: 'Panamericana Sur Km 55', servicios: 'agua, luz', frase_habilitacion: 'Lotes con habilitación urbana aprobada',
  resolucion_municipal: false, etiqueta_agrupador: 'Manzana', etiqueta_numero: 'Lote', color_primario: false, es_principal: true,
};

describe('mapearProyecto', () => {
  it('un Odoo viejo (sin los campos de P5) da un proyecto sin oferta: el resto de la app usa la de siempre', () => {
    const p = mapearProyecto(basico);
    expect(p.oferta).toBeUndefined();
    expect(p.publicarWeb).toBeUndefined();
    expect(p).toMatchObject({ id: 2, codigo: 'terra-lima', nombre: 'Terra Lima', zonaUTM: '18', orden: 10 });
  });

  it('con los campos nuevos mapea la oferta y convierte false en null', () => {
    const p = mapearProyecto(conOferta);
    expect(p.oferta).toMatchObject({ cuotaInicial: 18500, nroCuotas: 84, whatsappNumero: '51977684050', servicios: 'agua, luz' });
    expect(p.oferta?.resolucionMunicipal).toBeNull();
    expect(p.colorPrimario).toBeNull();
    expect(p).toMatchObject({ tipo: 'lotizacion', publicarWeb: true, esPrincipal: true, etiquetaAgrupador: 'Manzana', etiquetaNumero: 'Lote' });
  });

  it('un proyecto con los campos nuevos pero vacíos tiene oferta (vacía), distinto de «Odoo viejo»', () => {
    const p = mapearProyecto({ ...basico, cuota_inicial: false, nro_cuotas: false, publicar_web: false });
    expect(p.oferta).toBeDefined();
    expect(p.oferta?.cuotaInicial).toBeNull();
    expect(p.publicarWeb).toBe(false);
  });

  it('los textos se recortan y un texto vacío es null', () => {
    const p = mapearProyecto({ ...conOferta, servicios: '  agua y luz  ', frase_habilitacion: '   ' });
    expect(p.oferta?.servicios).toBe('agua y luz');
    expect(p.oferta?.fraseHabilitacion).toBeNull();
  });

  it('un número negativo o cero no es una oferta', () => {
    const p = mapearProyecto({ ...conOferta, cuota_inicial: -5, nro_cuotas: 0 });
    expect(p.oferta?.cuotaInicial).toBeNull();
    expect(p.oferta?.nroCuotas).toBeNull();
  });

  it('el centro del mapa solo se incluye si existe', () => {
    expect(mapearProyecto(basico)).not.toHaveProperty('centroEste');
    expect(mapearProyecto({ ...basico, centro_este: 308000, centro_norte: 8622000 })).toMatchObject({ centroEste: 308000, centroNorte: 8622000 });
  });
});

describe('leerProyectosVia', () => {
  afterEach(() => vi.restoreAllMocks());

  it('pide los campos básicos y los de oferta, solo proyectos activos', async () => {
    const rpc = vi.fn().mockResolvedValue([conOferta]);
    const r = await leerProyectosVia(rpc);
    expect(r).toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith('proyecto.inmobiliario', 'search_read', [[['active', '=', true]]],
      { fields: [...CAMPOS_BASE, ...CAMPOS_OFERTA] });
  });

  it('con un Odoo sin los campos nuevos cae a los básicos y NO se queda sin proyectos', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const rpc = vi.fn()
      .mockRejectedValueOnce(new Error("Invalid field 'cuota_inicial' on model 'proyecto.inmobiliario'"))
      .mockResolvedValueOnce([basico]);
    const r = await leerProyectosVia(rpc);
    expect(r).toHaveLength(1);
    expect(r[0].oferta).toBeUndefined();
    expect(rpc.mock.calls[1][3]).toEqual({ fields: CAMPOS_BASE });
  });

  it('si fallan las dos consultas devuelve [] sin lanzar', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const rpc = vi.fn().mockRejectedValue(new Error('Odoo caído'));
    expect(await leerProyectosVia(rpc)).toEqual([]);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('el aviso de la primera falla dice qué hacer', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const rpc = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce([]);
    await leerProyectosVia(rpc, 'prueba');
    expect(String(aviso.mock.calls[0][0])).toContain('[prueba]');
    expect(String(aviso.mock.calls[0][0])).toContain('1.10.0');
  });
});
