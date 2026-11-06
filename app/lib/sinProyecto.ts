// Cuenta lo que todavía no tiene proyecto asignado. Mientras un lote o un elemento no tenga proyecto, el mapa lo
// muestra solo con «Todos los proyectos» (desaparece al elegir uno) y no se puede generar su plano: el administrador
// debe verlo para asignarlos (en Odoo: Proyecto → «Asignar … sin proyecto»).

export interface ResumenSinProyecto {
  lotes: number;
  elementos: number;
  total: number;
}

export function contarSinProyecto(
  lotes: ReadonlyArray<{ x_proyectoId?: number | null }>,
  elementos: ReadonlyArray<{ proyectoId?: number | null }>,
): ResumenSinProyecto {
  const l = lotes.filter((x) => !x.x_proyectoId).length;
  const e = elementos.filter((x) => !x.proyectoId).length;
  return { lotes: l, elementos: e, total: l + e };
}

export function mensajeSinProyecto(r: ResumenSinProyecto): string | null {
  if (r.total === 0) return null;
  const partes: string[] = [];
  if (r.lotes) partes.push(`${r.lotes} lote${r.lotes === 1 ? '' : 's'}`);
  if (r.elementos) partes.push(`${r.elementos} elemento${r.elementos === 1 ? '' : 's'} urbano${r.elementos === 1 ? '' : 's'}`);
  return `${partes.join(' y ')} sin proyecto asignado: desaparecen al elegir un proyecto y no se pueden generar sus planos. Asígnalos en Odoo.`;
}
