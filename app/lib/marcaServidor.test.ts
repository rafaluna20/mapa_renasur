import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Proyecto } from '@/app/services/odooService';

vi.mock('@/app/services/odooPublicService', () => ({ getPublicProyectos: vi.fn() }));

import { MARCA_LEGADA } from './marca';
import { obtenerMarcas, obtenerProyectosPublicos, vaciarCacheMarcas } from './marcaServidor';

const base = { departamento: 'Lima', provincia: 'Lima', distrito: 'Chilca', zonaUTM: '18' };
const oferta = {
  cuotaInicial: null, nroCuotas: null, whatsappNumero: null, whatsappVisible: null, distanciaReferenciaKm: null,
  referenciaNombre: null, direccionReferencia: null, servicios: null, fraseHabilitacion: null, resolucionMunicipal: null,
};
const proyecto = (id: number, urbanizacion: string, extra: Partial<Proyecto> = {}): Proyecto =>
  ({ id, codigo: 'p' + id, nombre: 'N' + id, orden: 10, urbanizacion, ...base, oferta, tipo: 'lotizacion', publicarWeb: true, esPrincipal: true, ...extra }) as Proyecto;

describe('obtenerMarcas', () => {
  beforeEach(() => vaciarCacheMarcas());
  afterEach(() => vi.restoreAllMocks());

  it('lee los proyectos y arma la marca principal y la de cada proyecto', async () => {
    const leer = vi.fn().mockResolvedValue([proyecto(5, 'Parque Industrial Sur')]);
    const m = await obtenerMarcas({ leer });
    expect(m.principal.nombre).toBe('Parque Industrial Sur');
    expect(m.porId[5].slug).toBe('ParqueIndustrialSur');
  });

  it('guarda en memoria 5 minutos', async () => {
    const leer = vi.fn().mockResolvedValue([proyecto(5, 'Industrial')]);
    let t = 1_000;
    await obtenerMarcas({ leer, ahora: () => t });
    t += 5 * 60 * 1000 - 1;
    await obtenerMarcas({ leer, ahora: () => t });
    expect(leer).toHaveBeenCalledTimes(1);
    t += 2;
    await obtenerMarcas({ leer, ahora: () => t });
    expect(leer).toHaveBeenCalledTimes(2);
  });

  it('si Odoo falla y no hay nada guardado: la marca de siempre, sin lanzar', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const m = await obtenerMarcas({ leer: vi.fn().mockRejectedValue(new Error('Odoo caído')) });
    expect(m.principal).toBe(MARCA_LEGADA);
  });

  it('si Odoo falla DESPUÉS de una lectura buena: sigue la última conocida', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let t = 0;
    await obtenerMarcas({ leer: vi.fn().mockResolvedValue([proyecto(5, 'Industrial')]), ahora: () => t });
    t += 10 * 60 * 1000;
    const m = await obtenerMarcas({ leer: vi.fn().mockRejectedValue(new Error('x')), ahora: () => t });
    expect(m.principal.nombre).toBe('Industrial');
  });

  it('una lectura vacía (Odoo caído en silencio) no pisa una buena anterior', async () => {
    let t = 0;
    await obtenerMarcas({ leer: vi.fn().mockResolvedValue([proyecto(5, 'Industrial')]), ahora: () => t });
    t += 10 * 60 * 1000;
    const m = await obtenerMarcas({ leer: vi.fn().mockResolvedValue([]), ahora: () => t });
    expect(m.principal.nombre).toBe('Industrial');
  });

  it('obtenerProyectosPublicos devuelve los mismos proyectos que se leyeron', async () => {
    const p = proyecto(5, 'Industrial');
    expect(await obtenerProyectosPublicos({ leer: vi.fn().mockResolvedValue([p]) })).toEqual([p]);
  });
});
