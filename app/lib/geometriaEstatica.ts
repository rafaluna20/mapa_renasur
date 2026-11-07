import geometriesEnrichedRaw from '@/app/data/geometries-enriched.json';
import type { EnrichedGeometry } from '@/app/utils/dataMerger';

// ÚNICO punto de entrada a la geometría estática de lotes (P4 multiproyecto).
//
// Antes cuatro piezas importaban el JSON directamente (el mapa, la landing pública, los planos y la cotización), así que no
// había forma de dejar de usarlo sin tocar las cuatro a la vez. Ahora las cuatro pasan por aquí y un interruptor decide:
//
//   NEXT_PUBLIC_GEOMETRIA_ESTATICA = 'si' (por defecto)  se usa el JSON como respaldo de los lotes que Odoo aún no tiene
//   NEXT_PUBLIC_GEOMETRIA_ESTATICA = 'no'                 solo Odoo: lo que Odoo no tenga, no se dibuja
//
// Se apaga SOLO cuando Odoo ya tiene los 1,342 lotes con su geometría (P4.1 y P4.2 hechas en producción y comparadas).
// Cuando haya pasado un tiempo en «no» sin incidentes, se borra el JSON (P4.5). Reversa de cualquier paso: volver a «si».
// (Es NEXT_PUBLIC_ porque el mapa y la landing corren también en el navegador.)

export type GeometriaEstatica = Record<string, EnrichedGeometry>;

export function usarGeometriaEstatica(valor: string | undefined = process.env.NEXT_PUBLIC_GEOMETRIA_ESTATICA): boolean {
  return (valor ?? '').trim().toLowerCase() !== 'no';
}

const VACIA: GeometriaEstatica = Object.freeze({}) as GeometriaEstatica;

// Entradas del JSON que NO son lotes aparte (decisión del usuario, 2026-11-06/07): el mapa las dibujaba como «lote solo geometría».
//   E02MZU0221  forma parte del lote E02MZU021P (253.14 m² en Odoo = 141.14 + 112).
//   E02MZU0222  es la geometría del lote 22, que en Odoo se llama E02MZU022P (el usuario confirmó que ese código se queda).
export const GEOMETRIAS_ESTATICAS_DESCARTADAS: readonly string[] = ['E02MZU0221', 'E02MZU0222'];

let sinDescartadas: GeometriaEstatica | null = null;
function conDescartes(): GeometriaEstatica {
  if (!sinDescartadas) {
    const copia = { ...(geometriesEnrichedRaw as unknown as GeometriaEstatica) };
    for (const c of GEOMETRIAS_ESTATICAS_DESCARTADAS) delete copia[c];
    sinDescartadas = copia;
  }
  return sinDescartadas;
}

export function geometriasEstaticas(valor: string | undefined = process.env.NEXT_PUBLIC_GEOMETRIA_ESTATICA): GeometriaEstatica {
  return usarGeometriaEstatica(valor) ? conDescartes() : VACIA;
}
