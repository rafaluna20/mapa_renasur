import { describe, expect, it } from 'vitest';
import type { OfertaCruda, Proyecto } from '@/app/services/odooService';
import {
  OFERTA,
  OFERTA_LEGADA,
  mensajeWhatsApp,
  ofertaDeProyecto,
  tituloAvisoLegal,
  urlWhatsApp,
} from './ofertaComercial';

const base = { departamento: 'Lima', provincia: 'Lima', distrito: 'Chilca', urbanizacion: 'Parque Industrial Sur', zonaUTM: '18' };
const vacia: OfertaCruda = {
  cuotaInicial: null, nroCuotas: null, whatsappNumero: null, whatsappVisible: null, distanciaReferenciaKm: null,
  referenciaNombre: null, direccionReferencia: null, servicios: null, fraseHabilitacion: null, resolucionMunicipal: null,
};
const industrial = (oferta: Partial<OfertaCruda> = {}): Proyecto =>
  ({ id: 5, codigo: 'industrial', nombre: 'Industrial', orden: 20, ...base, oferta: { ...vacia, ...oferta } }) as Proyecto;

describe('ofertaDeProyecto', () => {
  it('sin proyecto, o con un Odoo viejo (sin oferta): la de siempre (Terra Lima)', () => {
    expect(ofertaDeProyecto()).toBe(OFERTA_LEGADA);
    expect(ofertaDeProyecto(null)).toBe(OFERTA_LEGADA);
    expect(ofertaDeProyecto({ id: 1, codigo: 'x', nombre: 'x', orden: 1, ...base } as Proyecto)).toBe(OFERTA_LEGADA);
  });

  it('la oferta legada es exactamente lo que decía el código', () => {
    expect(OFERTA_LEGADA).toMatchObject({
      nombre: 'Terra Lima', lugar: 'Pucusana', cuotaInicial: OFERTA.cuotaInicial, nroCuotas: OFERTA.nroCuotas,
      whatsappNumero: OFERTA.whatsappNumero, distanciaKm: OFERTA.distanciaPlayaKm, servicios: OFERTA.servicios,
    });
  });

  it('un proyecto con su oferta usa la suya, con su nombre y su distrito', () => {
    const o = ofertaDeProyecto(industrial({
      cuotaInicial: 30000, nroCuotas: 36, whatsappNumero: '51900111222', whatsappVisible: '+51 900 111 222',
      distanciaReferenciaKm: 12, referenciaNombre: 'la Panamericana', servicios: 'agua y luz trifásica',
      fraseHabilitacion: 'Habilitación industrial aprobada',
    }));
    expect(o).toMatchObject({ nombre: 'Parque Industrial Sur', lugar: 'Chilca', cuotaInicial: 30000, nroCuotas: 36, distanciaKm: 12 });
    expect(o.whatsappNumero).toBe('51900111222');
  });

  it('un proyecto SIN dato no toma prestado el de Terra Lima: lo deja vacío', () => {
    const o = ofertaDeProyecto(industrial());
    expect(o.cuotaInicial).toBeNull();
    expect(o.nroCuotas).toBeNull();
    expect(o.servicios).toBeNull();
    expect(o.distanciaKm).toBeNull();
    expect(o.fraseHabilitacion).toBeNull();
    expect(o.nombre).not.toContain('Terra Lima');
  });

  it('el WhatsApp sí cae a la línea comercial de la empresa si el proyecto no tiene la suya', () => {
    const o = ofertaDeProyecto(industrial());
    expect(o.whatsappNumero).toBe(OFERTA.whatsappNumero);
    expect(o.whatsappVisible).toBe(OFERTA.whatsappVisible);
  });

  it('con número propio y sin texto visible, se muestra con «+»', () => {
    expect(ofertaDeProyecto(industrial({ whatsappNumero: '51900111222' })).whatsappVisible).toBe('+51900111222');
  });
});

describe('mensajes de WhatsApp por proyecto', () => {
  it('sin oferta dicen lo de siempre (Terra Lima en Pucusana)', () => {
    expect(mensajeWhatsApp({ codigoLote: 'E01MZQ055P' })).toBe('Hola, quiero separar el lote E01MZQ055P de Terra Lima en Pucusana.');
    expect(mensajeWhatsApp()).toBe('Hola, quiero más información sobre los lotes de Terra Lima en Pucusana.');
  });

  it('con la oferta de otro proyecto nombran ese proyecto y su lugar', () => {
    const oferta = ofertaDeProyecto(industrial({ whatsappNumero: '51900111222' }));
    expect(mensajeWhatsApp({ codigoLote: 'P02E01MZA001P', area: 1200, oferta }))
      .toBe('Hola, quiero separar el lote P02E01MZA001P (1200 m²) de Parque Industrial Sur en Chilca.');
    expect(mensajeWhatsApp({ oferta })).toContain('Parque Industrial Sur en Chilca');
    expect(mensajeWhatsApp({ oferta })).not.toContain('Terra Lima');
  });

  it('el enlace usa el número del proyecto', () => {
    const oferta = ofertaDeProyecto(industrial({ whatsappNumero: '51900111222' }));
    expect(urlWhatsApp({ oferta })).toMatch(/^https:\/\/wa\.me\/51900111222\?text=/);
    expect(urlWhatsApp()).toMatch(/^https:\/\/wa\.me\/51977684050\?text=/);
  });

  it('un proyecto sin distrito no deja «en» colgando', () => {
    const oferta = { ...OFERTA_LEGADA, nombre: 'Predio Sur', lugar: '' };
    expect(mensajeWhatsApp({ oferta })).toBe('Hola, quiero más información sobre los lotes de Predio Sur.');
  });
});

describe('tituloAvisoLegal', () => {
  it('con la frase cargada agrega el punto; sin frase no dice nada (nunca promete una habilitación que no se cargó)', () => {
    expect(tituloAvisoLegal()).toBe('Lotes con habilitación urbana aprobada.');
    expect(tituloAvisoLegal(ofertaDeProyecto(industrial()))).toBeNull();
    expect(tituloAvisoLegal(ofertaDeProyecto(industrial({ fraseHabilitacion: 'Habilitación en trámite' })))).toBe('Habilitación en trámite.');
  });
});
