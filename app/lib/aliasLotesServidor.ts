import { fetchOdooPublic } from '@/app/services/odooPublicService';
import { mapaDeAlias, resolverCodigoViejo, type FilaAlias, type MapaAlias } from '@/app/lib/aliasLotes';

// Los alias de código de lote para el SERVIDOR (landing pública, enlaces viejos). Se leen con la cuenta pública y se guardan 5
// minutos en memoria. Si Odoo falla o no tiene el módulo 1.11.0, el mapa queda vacío: el código se usa tal cual y nada se rompe.

const TTL_MS = 5 * 60 * 1000;

let cache: { mapa: MapaAlias; vence: number } | null = null;

export function vaciarCacheAlias(): void {
  cache = null;
}

interface Opciones {
  leer?: () => Promise<FilaAlias[]>;
  ahora?: () => number;
}

async function leerDeOdoo(): Promise<FilaAlias[]> {
  return (await fetchOdooPublic('proyecto.lote.alias', 'search_read', [[]], { fields: ['alias', 'codigo_actual'], limit: 2000 })) as FilaAlias[];
}

export async function obtenerMapaAlias({ leer = leerDeOdoo, ahora = Date.now }: Opciones = {}): Promise<MapaAlias> {
  const t = ahora();
  if (cache && cache.vence > t) return cache.mapa;
  try {
    cache = { mapa: mapaDeAlias(await leer()), vence: t + TTL_MS };
  } catch {
    // modelo inexistente (Odoo sin 1.11.0) o caído: se sirve el último mapa bueno o uno vacío, por poco tiempo
    cache = { mapa: cache?.mapa ?? {}, vence: t + 60 * 1000 };
  }
  return cache.mapa;
}

/** El código vigente de un código que pudo haber cambiado. */
export async function resolverCodigoViejoEnServidor(texto: string | null | undefined, opciones?: Opciones): Promise<string | undefined> {
  if (!texto) return undefined;
  return resolverCodigoViejo(texto, await obtenerMapaAlias(opciones));
}
