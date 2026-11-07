import type { Proyecto } from '@/app/services/odooService';

// Qué proyecto muestra la landing pública /venta (P5 multiproyecto): /venta?proyecto=<código>.
//
// REGLAS
//  · Solo se ofrecen proyectos PUBLICABLES: activos (la consulta ya trae solo activos), que no sean «trabajo externo» y que
//    tengan «Publicar en la web» marcado en Odoo. Si Odoo todavía no trae esos campos (proyecto_inmobiliario < 1.10.0), no hay
//    forma de distinguir: se tratan todos como publicables, igual que antes de P5.
//  · Sin ?proyecto, o con un código que no es publicable: el PRINCIPAL (el marcado «Proyecto principal» en Odoo; si ninguno lo
//    está, el primero por «Orden»). Nunca se muestra un proyecto no publicable aunque se pida por la URL. Ojo: los proyectos
//    actuales tienen el mismo Orden, por eso el principal es un campo explícito y no depende del orden ni del id.
//  · Con un Odoo que aún no trae los campos de P5 NO se filtra nada (comportamiento de siempre): sin ellos no se sabe qué
//    proyecto es cuál y se vaciaría la landing.
//  · TRANSITORIO: un lote o elemento SIN proyecto asignado se muestra en el proyecto PRINCIPAL (así la landing de hoy no pierde
//    lotes mientras se les asigna proyecto, P2). Cuando no queden huérfanos, esa excepción se quita.
//  · Los lotes de un proyecto no publicable (p. ej. un trabajo externo) no se publican en ninguna landing.

export function esPublicable(p: Proyecto): boolean {
  if (p.oferta === undefined && p.publicarWeb === undefined) return true; // Odoo viejo: sin distinción
  return p.tipo !== 'trabajo_externo' && p.publicarWeb === true;
}

export function proyectosPublicables(proyectos: readonly Proyecto[]): Proyecto[] {
  return proyectos.filter(esPublicable).sort((a, b) => a.orden - b.orden || a.id - b.id);
}

export interface SeleccionProyecto {
  proyecto: Proyecto | null;
  /** true si es el proyecto principal (el que se muestra sin ?proyecto). */
  esPrincipal: boolean;
  publicables: Proyecto[];
}

export function elegirProyecto(proyectos: readonly Proyecto[], codigoSolicitado?: string | null): SeleccionProyecto {
  // Odoo sin los campos de P5 (ningún proyecto trae `oferta`): no hay forma de distinguir proyectos; no se filtra.
  if (!proyectos.some((p) => p.oferta !== undefined)) return { proyecto: null, esPrincipal: true, publicables: [] };
  const publicables = proyectosPublicables(proyectos);
  if (publicables.length === 0) return { proyecto: null, esPrincipal: true, publicables };
  const principal = publicables.find((p) => p.esPrincipal) ?? publicables[0];
  const pedido = (codigoSolicitado ?? '').trim().toLowerCase();
  const elegido = pedido ? publicables.find((p) => p.codigo.toLowerCase() === pedido) : undefined;
  const proyecto = elegido ?? principal;
  return { proyecto, esPrincipal: proyecto.id === principal.id, publicables };
}

/**
 * Deja solo lo que pertenece al proyecto elegido. `idDe` devuelve el id de proyecto de cada elemento (null = sin proyecto).
 * Con `seleccion.proyecto === null` (no hay proyectos, o Odoo sin el módulo) no se filtra: comportamiento de siempre.
 */
export function filtrarPorProyecto<T>(
  items: readonly T[],
  seleccion: SeleccionProyecto,
  idDe: (item: T) => number | null | undefined,
  todosLosProyectos: readonly Proyecto[],
): T[] {
  if (!seleccion.proyecto) return [...items];
  const publicables = new Set(seleccion.publicables.map((p) => p.id));
  const noPublicables = new Set(todosLosProyectos.filter((p) => !publicables.has(p.id)).map((p) => p.id));
  return items.filter((item) => {
    const id = idDe(item);
    if (!id) return seleccion.esPrincipal; // sin proyecto: solo en el principal (transitorio)
    if (noPublicables.has(id)) return false;
    return id === seleccion.proyecto!.id;
  });
}
