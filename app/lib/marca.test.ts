import { describe, expect, it } from 'vitest';
import type { Proyecto } from '@/app/services/odooService';
import { MARCA_LEGADA, logoSeguro, marcaDeProyecto, marcaPorId, marcasDeProyectos, slugMarca } from './marca';

const base = { departamento: 'Lima', provincia: 'Lima', distrito: 'Chilca', zonaUTM: '18' };
const oferta = {
  cuotaInicial: null, nroCuotas: null, whatsappNumero: null, whatsappVisible: null, distanciaReferenciaKm: null,
  referenciaNombre: null, direccionReferencia: null, servicios: null, fraseHabilitacion: null, resolucionMunicipal: null,
};
const p = (id: number, urbanizacion: string, extra: Partial<Proyecto> = {}): Proyecto =>
  ({ id, codigo: 'c' + id, nombre: 'N' + id, orden: 10, urbanizacion, ...base, oferta, tipo: 'lotizacion', publicarWeb: true, ...extra }) as Proyecto;

describe('slugMarca', () => {
  it('quita espacios, tildes y símbolos', () => {
    expect(slugMarca('Terra Lima')).toBe('TerraLima');
    expect(slugMarca('Parque Industrial Sur')).toBe('ParqueIndustrialSur');
    expect(slugMarca('El Nuevo Amanecer – Etapa 2')).toBe('ElNuevoAmanecerEtapa2');
    expect(slugMarca('Cañete Ñandú')).toBe('CaneteNandu');
  });
  it('un nombre sin letras ni dígitos no da un archivo vacío', () => {
    expect(slugMarca('---')).toBe('Proyecto');
    expect(slugMarca('')).toBe('Proyecto');
  });
  it('no puede colar rutas en un nombre de archivo', () => {
    expect(slugMarca('../../etc/passwd')).toBe('EtcPasswd');
  });
});

describe('logoSeguro', () => {
  it('acepta una ruta del sitio y una URL https', () => {
    expect(logoSeguro('/terra-lima-logo.png')).toBe('/terra-lima-logo.png');
    expect(logoSeguro('https://cdn.ejemplo.com/logo.svg')).toBe('https://cdn.ejemplo.com/logo.svg');
  });
  it('descarta lo peligroso o ambiguo', () => {
    for (const malo of ['//evil.com/l.png', 'javascript:alert(1)', 'data:image/png;base64,AAA', 'http://x.com/l.png', 'logo.png', '/con espacio.png', '', null, undefined]) {
      expect(logoSeguro(malo as string | null | undefined), String(malo)).toBeNull();
    }
  });
});

describe('marcaDeProyecto', () => {
  it('sin proyecto, o con un Odoo viejo (sin los campos de P5): la marca de siempre', () => {
    expect(marcaDeProyecto()).toBe(MARCA_LEGADA);
    expect(marcaDeProyecto(null)).toBe(MARCA_LEGADA);
    expect(marcaDeProyecto({ id: 1, codigo: 'x', nombre: 'x', orden: 1, urbanizacion: 'X', ...base } as Proyecto)).toBe(MARCA_LEGADA);
  });

  it('la marca ES el nombre del proyecto, con su logo', () => {
    expect(marcaDeProyecto(p(5, 'Parque Industrial Sur', { logoUrl: '/industrial.png' }))).toEqual({
      nombre: 'Parque Industrial Sur', slug: 'ParqueIndustrialSur', logoUrl: '/industrial.png',
    });
  });

  it('un proyecto sin logo no toma el de Terra Lima', () => {
    expect(marcaDeProyecto(p(5, 'Parque Industrial Sur')).logoUrl).toBeNull();
  });

  it('un logo inseguro se descarta', () => {
    expect(marcaDeProyecto(p(5, 'X', { logoUrl: '//evil.com/x.png' })).logoUrl).toBeNull();
  });

  it('sin urbanización usa el nombre; sin ninguno de los dos, la de siempre', () => {
    expect(marcaDeProyecto(p(5, '', { nombre: 'Predio Sur' })).nombre).toBe('Predio Sur');
    expect(marcaDeProyecto(p(5, '', { nombre: '' }))).toBe(MARCA_LEGADA);
  });
});

describe('marcasDeProyectos', () => {
  const terra = p(2, 'Terra Lima', { esPrincipal: true, logoUrl: '/terra-lima-logo.png' });
  const industrial = p(5, 'Parque Industrial Sur');
  const chilca = p(3, 'Plataforma Chilca', { tipo: 'trabajo_externo', publicarWeb: false });

  it('la principal es la del proyecto principal; cada proyecto tiene la suya (también los no publicables)', () => {
    const m = marcasDeProyectos([industrial, terra, chilca]);
    expect(m.principal.nombre).toBe('Terra Lima');
    expect(m.porId[5].nombre).toBe('Parque Industrial Sur');
    expect(m.porId[3].nombre).toBe('Plataforma Chilca');
  });

  it('marcaPorId: la del proyecto si se conoce; si no, la principal', () => {
    const m = marcasDeProyectos([industrial, terra]);
    expect(marcaPorId(m, 5).nombre).toBe('Parque Industrial Sur');
    expect(marcaPorId(m, 999).nombre).toBe('Terra Lima');
    expect(marcaPorId(m, null).nombre).toBe('Terra Lima');
    expect(marcaPorId(m).nombre).toBe('Terra Lima');
  });

  it('sin proyectos (o con Odoo viejo) todo queda como siempre', () => {
    expect(marcasDeProyectos([]).principal).toBe(MARCA_LEGADA);
    expect(marcasDeProyectos([{ id: 1, codigo: 'a', nombre: 'a', orden: 1, urbanizacion: 'A', ...base } as Proyecto]).principal).toBe(MARCA_LEGADA);
  });
});
