import { codigoLegado } from '@/app/lib/codigoLote';

// P6: un lote que cambió de código (E01MZD129P pasó a E01MZD1293) deja su código viejo como ALIAS en Odoo (proyecto.lote.alias).
// Los enlaces ya enviados (/venta?lote=E01MZD129P), los mensajes y las referencias viejas siguen funcionando: el código viejo
// se traduce al vigente. Las facturas y los contratos NO se reescriben.

/** código viejo → código vigente (los dos en formato E01MZD129P, sin proyecto). */
export type MapaAlias = Record<string, string>;

export interface FilaAlias {
  alias?: string | false;
  codigo_actual?: string | false;
}

/** Arma el mapa desde las filas de Odoo. Un alias repetido (dos lotes lo reclaman) se descarta: no se adivina. */
export function mapaDeAlias(filas: readonly FilaAlias[]): MapaAlias {
  const mapa: MapaAlias = {};
  const ambiguos = new Set<string>();
  for (const f of filas) {
    const viejo = codigoLegado(f.alias);
    const actual = codigoLegado(f.codigo_actual);
    if (!viejo || !actual || viejo === actual) continue;
    if (viejo in mapa && mapa[viejo] !== actual) ambiguos.add(viejo);
    mapa[viejo] = actual;
  }
  for (const a of ambiguos) delete mapa[a];
  return mapa;
}

/**
 * El código vigente de un texto: si es el alias de un lote, el código al que pasó; si no, el mismo código en su forma de siempre.
 * Un texto que no es código de lote se devuelve igual (no es asunto de este módulo). Si se pasó con proyecto (P01-…), se conserva.
 */
export function resolverCodigoViejo(texto: string | null | undefined, mapa: MapaAlias): string | undefined {
  if (!texto) return undefined;
  const legado = codigoLegado(texto);
  if (!legado) return texto;
  const vigente = mapa[legado];
  if (!vigente) return texto;
  const prefijo = /^(P\d{2,3})-/i.exec(texto.trim());
  return prefijo ? `${prefijo[1].toUpperCase()}-${vigente}` : vigente;
}
