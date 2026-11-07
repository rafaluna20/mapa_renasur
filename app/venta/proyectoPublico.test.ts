import { describe, expect, it } from 'vitest';
import type { Proyecto } from '@/app/services/odooService';
import { elegirProyecto, esPublicable, filtrarPorProyecto, proyectosPublicables } from './proyectoPublico';

const base = { departamento: 'Lima', provincia: 'Lima', distrito: 'Pucusana', urbanizacion: 'X', zonaUTM: '18' };
const oferta = {
  cuotaInicial: null, nroCuotas: null, whatsappNumero: null, whatsappVisible: null, distanciaReferenciaKm: null,
  referenciaNombre: null, direccionReferencia: null, servicios: null, fraseHabilitacion: null, resolucionMunicipal: null,
};
const p = (id: number, codigo: string, orden: number, extra: Partial<Proyecto> = {}): Proyecto =>
  ({ id, codigo, nombre: codigo, orden, ...base, oferta, tipo: 'lotizacion', publicarWeb: true, ...extra }) as Proyecto;

const terra = p(2, 'terra-lima', 10);
const industrial = p(5, 'industrial', 20);
const chilca = p(3, 'plataforma-chilca', 5, { tipo: 'trabajo_externo', publicarWeb: false });
const sinPublicar = p(7, 'borrador', 30, { publicarWeb: false });

describe('proyectos publicables', () => {
  it('solo los marcados «publicar», que no sean trabajo externo, ordenados por Orden', () => {
    expect(proyectosPublicables([industrial, chilca, terra, sinPublicar]).map((x) => x.codigo)).toEqual(['terra-lima', 'industrial']);
  });

  it('un trabajo externo no se publica aunque tenga «publicar» marcado', () => {
    expect(esPublicable(p(9, 'externo', 1, { tipo: 'trabajo_externo', publicarWeb: true }))).toBe(false);
  });

  it('con un Odoo viejo (sin los campos de P5) todos son publicables, como antes', () => {
    const viejo = { id: 1, codigo: 'x', nombre: 'x', orden: 1, ...base } as Proyecto;
    expect(esPublicable(viejo)).toBe(true);
  });
});

describe('elegirProyecto: el principal', () => {
  // Los proyectos reales tienen TODOS el mismo Orden (10): sin un principal explícito, el desempate por id elegiría uno sin lotes.
  const a = p(1, 'p03154725', 10);
  const b = p(2, 'terra-lima', 10, { esPrincipal: true });

  it('el marcado como principal gana aunque su id sea mayor y el Orden esté empatado', () => {
    expect(elegirProyecto([a, b]).proyecto?.codigo).toBe('terra-lima');
    expect(elegirProyecto([b, a]).proyecto?.codigo).toBe('terra-lima');
  });

  it('un principal NO publicable no se muestra: cae al primero publicable', () => {
    const sinPublicar = p(2, 'terra-lima', 10, { esPrincipal: true, publicarWeb: false });
    expect(elegirProyecto([a, sinPublicar]).proyecto?.codigo).toBe('p03154725');
  });

  it('sin ningún principal marcado cae al primero por Orden', () => {
    expect(elegirProyecto([p(3, 'x', 20), p(4, 'y', 5)]).proyecto?.codigo).toBe('y');
  });

  it('con un Odoo SIN los campos de P5 no se filtra nada: proyecto null (la landing de siempre)', () => {
    const viejos = [
      { id: 1, codigo: 'p03154725', nombre: 'a', orden: 10, ...base } as Proyecto,
      { id: 2, codigo: 'terra-lima', nombre: 'b', orden: 10, ...base } as Proyecto,
    ];
    expect(elegirProyecto(viejos).proyecto).toBeNull();
    expect(filtrarPorProyecto([{ p: 1 }, { p: 2 }, { p: null }], elegirProyecto(viejos), (l) => l.p, viejos)).toHaveLength(3);
  });
});

describe('elegirProyecto', () => {
  const todos = [terra, industrial, chilca, sinPublicar];

  it('sin ?proyecto muestra el principal (el primero por Orden)', () => {
    const s = elegirProyecto(todos);
    expect(s.proyecto?.codigo).toBe('terra-lima');
    expect(s.esPrincipal).toBe(true);
  });

  it('con ?proyecto válido muestra ese (sin importar mayúsculas)', () => {
    const s = elegirProyecto(todos, 'Industrial');
    expect(s.proyecto?.codigo).toBe('industrial');
    expect(s.esPrincipal).toBe(false);
  });

  it('un proyecto NO publicable pedido por la URL cae al principal: nunca se muestra', () => {
    for (const codigo of ['plataforma-chilca', 'borrador', 'no-existe']) {
      expect(elegirProyecto(todos, codigo).proyecto?.codigo, codigo).toBe('terra-lima');
    }
  });

  it('sin proyectos publicables devuelve null (la landing sigue como antes)', () => {
    expect(elegirProyecto([chilca, sinPublicar]).proyecto).toBeNull();
    expect(elegirProyecto([]).proyecto).toBeNull();
  });
});

describe('filtrarPorProyecto', () => {
  const todos = [terra, industrial, chilca];
  const lotes = [
    { c: 'T1', p: 2 }, { c: 'T2', p: 2 }, { c: 'I1', p: 5 }, { c: 'CH1', p: 3 }, { c: 'S1', p: null },
  ];
  const idDe = (l: { p: number | null }) => l.p;

  it('el principal muestra lo suyo y lo que no tiene proyecto (transitorio), no lo de otros ni el externo', () => {
    const r = filtrarPorProyecto(lotes, elegirProyecto(todos), idDe, todos);
    expect(r.map((l) => l.c)).toEqual(['T1', 'T2', 'S1']);
  });

  it('otro proyecto muestra SOLO lo suyo: lo que no tiene proyecto no se le cuela', () => {
    const r = filtrarPorProyecto(lotes, elegirProyecto(todos, 'industrial'), idDe, todos);
    expect(r.map((l) => l.c)).toEqual(['I1']);
  });

  it('los lotes de un trabajo externo no se publican en ninguna landing', () => {
    for (const cod of [undefined, 'industrial']) {
      const r = filtrarPorProyecto(lotes, elegirProyecto(todos, cod), idDe, todos);
      expect(r.map((l) => l.c)).not.toContain('CH1');
    }
  });

  it('sin proyectos publicables no se filtra nada (comportamiento anterior)', () => {
    const r = filtrarPorProyecto(lotes, elegirProyecto([chilca]), idDe, [chilca]);
    expect(r).toHaveLength(5);
  });

  it('no modifica la lista original', () => {
    const copia = [...lotes];
    filtrarPorProyecto(lotes, elegirProyecto(todos), idDe, todos);
    expect(lotes).toEqual(copia);
  });
});
