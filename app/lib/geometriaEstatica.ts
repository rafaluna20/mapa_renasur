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

export function geometriasEstaticas(valor: string | undefined = process.env.NEXT_PUBLIC_GEOMETRIA_ESTATICA): GeometriaEstatica {
  return usarGeometriaEstatica(valor) ? (geometriesEnrichedRaw as unknown as GeometriaEstatica) : VACIA;
}
