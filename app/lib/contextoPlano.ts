import { calculateCentroid, calculateDistance } from '@/app/utils/geometryUtils';

// Qué elementos urbanos (calles, jardines, aportes…) se mandan a plan_pro como CONTEXTO del plano de un lote.
// Antes se mandaban TODOS, sin filtro de radio ni de proyecto («son pocos elementos por proyecto»). Con varios proyectos eso significa que el
// plano de un lote de otro proyecto llevaba los ~1,000 elementos del proyecto original, a 9 km de distancia (revisión P1–P9, 2026-11-07).
//
// Regla: los del MISMO proyecto del lote (como hasta ahora) y, de los que aún no tienen proyecto (o vienen del respaldo
// estático), solo los que caen cerca del lote. Es solo el dibujo del contexto: la clasificación de colindancias sigue usando todos.

export const RADIO_ELEMENTOS_SIN_PROYECTO_M = 1000;

type Punto = [number, number];
interface ConProyecto {
  proyectoId?: number;
  points?: ReadonlyArray<readonly number[]>;
}

export function elementosDelEntorno<T extends ConProyecto>(elementos: readonly T[], proyectoId: number | undefined, centro: Punto): T[] {
  // Sin proyecto resuelto no se puede decidir: se deja como antes (la ruta responde 422 de todos modos).
  if (!proyectoId) return [...elementos];
  return elementos.filter((e) => {
    if (e.proyectoId) return e.proyectoId === proyectoId;
    if (!e.points || e.points.length < 3) return false;
    const c = calculateCentroid(e.points as unknown as Punto[]);
    return calculateDistance(centro, c) <= RADIO_ELEMENTOS_SIN_PROYECTO_M;
  });
}
