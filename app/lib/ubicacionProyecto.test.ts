import { describe, expect, it } from 'vitest';
import type { Proyecto } from '@/app/services/odooService';
import { resolverProyecto } from './ubicacionProyecto';

const terra: Proyecto = {
  id: 2, codigo: 'terra-lima', nombre: 'Terra Lima', departamento: 'Lima', provincia: 'Lima',
  distrito: 'Pucusana', urbanizacion: 'Terra Lima', zonaUTM: '18', orden: 10,
} as Proyecto;
const otro: Proyecto = { ...terra, id: 1, codigo: 'p03154725', nombre: 'P03154725', distrito: 'Chilca', zonaUTM: '19' } as Proyecto;
const proyectos = [terra, otro];

describe('resolverProyecto', () => {
  it('resuelve por id y entrega la ubicación y la zona UTM de ESE proyecto', () => {
    const r = resolverProyecto({ x_proyectoId: 1 }, proyectos);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ubicacion.distrito).toBe('Chilca');
      expect(r.ubicacion.zonaUTM).toBe(19);
    }
  });

  it('el id manda sobre el código de texto', () => {
    const r = resolverProyecto({ x_proyectoId: 1, x_proyecto: 'terra-lima' }, proyectos);
    expect(r.ok && r.proyecto.id).toBe(1);
  });

  it('cae al código de texto si no hay id', () => {
    const r = resolverProyecto({ x_proyecto: ' terra-lima ' }, proyectos);
    expect(r.ok && r.proyecto.id).toBe(2);
  });

  it('un elemento urbano usa proyectoId', () => {
    const r = resolverProyecto({ proyectoId: 2 }, proyectos);
    expect(r.ok && r.proyecto.codigo).toBe('terra-lima');
  });

  it('SIN respaldo a Terra Lima: sin proyecto asignado falla', () => {
    for (const origen of [{}, { x_proyectoId: null, x_proyecto: '' }, { x_proyecto: '   ' }]) {
      const r = resolverProyecto(origen, proyectos);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.motivo).toBe('SIN_PROYECTO');
    }
  });

  it('un proyecto inactivo (no viene en la lista de activos) no se resuelve', () => {
    const r = resolverProyecto({ x_proyectoId: 3 }, proyectos);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.motivo).toBe('PROYECTO_NO_ENCONTRADO');
      expect(r.detalle).toContain('inactivo');
    }
  });

  it('con la lista de proyectos vacía (Odoo caído) falla en vez de inventar una ubicación', () => {
    const r = resolverProyecto({ x_proyectoId: 2 }, []);
    expect(r.ok).toBe(false);
  });

  it('una zona UTM ausente queda sin definir', () => {
    const r = resolverProyecto({ x_proyectoId: 5 }, [{ ...terra, id: 5, zonaUTM: '' } as Proyecto]);
    expect(r.ok && r.ubicacion.zonaUTM).toBeUndefined();
  });
});
