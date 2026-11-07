import { getPublicProyectos } from '@/app/services/odooPublicService';
import type { Proyecto } from '@/app/services/odooService';
import { MARCAS_LEGADAS, marcasDeProyectos, type MarcasDisponibles } from '@/app/lib/marca';

// Las marcas (nombre y logo de cada proyecto) para el SERVIDOR: título de la app, correos, asistente, imagen del lote, y el
// contexto que reparte la marca a los componentes. Se leen con la cuenta pública (son datos públicos: el nombre y el logo del
// proyecto) y se guardan en memoria 5 minutos. Si Odoo falla se sirve la última conocida o, si no hay, la de siempre
// (Terra Lima): una caída de Odoo nunca deja la página sin título ni rompe un correo.

const TTL_MS = 5 * 60 * 1000;

let cache: { marcas: MarcasDisponibles; proyectos: Proyecto[]; vence: number } | null = null;

export function vaciarCacheMarcas(): void {
  cache = null;
}

interface Opciones {
  leer?: () => Promise<Proyecto[]>;
  ahora?: () => number;
}

async function cargar({ leer = getPublicProyectos, ahora = Date.now }: Opciones = {}) {
  const t = ahora();
  if (cache && cache.vence > t) return cache;
  try {
    const proyectos = await leer();
    // [] = Odoo caído o módulo sin desplegar: no pisar una lectura buena anterior con «nada».
    if (proyectos.length === 0 && cache) return cache;
    cache = { marcas: marcasDeProyectos(proyectos), proyectos, vence: t + TTL_MS };
  } catch (error) {
    console.warn('[marca] No se pudieron leer los proyectos; se usa la última marca conocida:', error instanceof Error ? error.message : error);
    if (!cache) return { marcas: MARCAS_LEGADAS, proyectos: [], vence: 0 };
  }
  return cache;
}

export async function obtenerMarcas(opciones?: Opciones): Promise<MarcasDisponibles> {
  return (await cargar(opciones)).marcas;
}

export async function obtenerProyectosPublicos(opciones?: Opciones): Promise<Proyecto[]> {
  return (await cargar(opciones)).proyectos;
}
