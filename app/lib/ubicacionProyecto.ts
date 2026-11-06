import type { Proyecto } from '@/app/services/odooService';

// Resolución de la ubicación administrativa (y zona UTM) de un lote o elemento contra los proyectos de Odoo.
//
// ANTES había un respaldo silencioso a «Terra Lima» para lotes sin proyecto, y un `undefined` con console.warn
// para los no resueltos: en un sistema multiproyecto eso pone la dirección y la zona UTM de OTRO proyecto en el
// plano de un cliente sin ningún aviso. AHORA no hay respaldo: si no se puede resolver, se devuelve la razón
// (el constructor de planos responde 422 con un mensaje claro).

export interface UbicacionProyecto {
  departamento: string;
  provincia: string;
  distrito: string;
  urbanizacion: string;
  zonaUTM?: number; // se envía siempre que el proyecto la tenga (plan_pro usa 18S si falta)
}

export type ResolucionProyecto =
  | { ok: true; proyecto: Proyecto; ubicacion: UbicacionProyecto }
  | { ok: false; motivo: 'SIN_PROYECTO' | 'PROYECTO_NO_ENCONTRADO'; detalle: string };

interface ConProyecto {
  x_proyectoId?: number | null;
  x_proyecto?: string | null;
  proyectoId?: number | null;
}

function aUbicacion(p: Proyecto): UbicacionProyecto {
  return {
    departamento: p.departamento,
    provincia: p.provincia,
    distrito: p.distrito,
    urbanizacion: p.urbanizacion,
    zonaUTM: p.zonaUTM ? Number(p.zonaUTM) : undefined,
  };
}

/**
 * `proyectos` debe ser la lista de proyectos ACTIVOS (fetchProyectos ya filtra active=true): un proyecto
 * desactivado no se encuentra, y el plano no se genera.
 * Orden: 1) id real (Many2one), 2) código en texto (x_proyecto, deprecado). Sin ninguno: SIN_PROYECTO.
 */
export function resolverProyecto(origen: ConProyecto, proyectos: Proyecto[]): ResolucionProyecto {
  const id = origen.x_proyectoId ?? origen.proyectoId ?? undefined;
  const codigo = origen.x_proyecto?.trim();

  if (!id && !codigo) {
    return { ok: false, motivo: 'SIN_PROYECTO', detalle: 'no tiene proyecto asignado' };
  }
  const proyecto =
    (id ? proyectos.find((p) => p.id === id) : undefined) ??
    (codigo ? proyectos.find((p) => p.codigo === codigo) : undefined);
  if (!proyecto) {
    return {
      ok: false,
      motivo: 'PROYECTO_NO_ENCONTRADO',
      detalle: `su proyecto (${id ? `id ${id}` : `código «${codigo}»`}) está inactivo, no existe o no se pudo consultar en Odoo`,
    };
  }
  return { ok: true, proyecto, ubicacion: aUbicacion(proyecto) };
}
