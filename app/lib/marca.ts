import type { Proyecto } from '@/app/services/odooService';
import { elegirProyecto } from '@/app/venta/proyectoPublico';

// MARCA = NOMBRE DEL PROYECTO (decisión del usuario, 2026-11-06). Todo lo que antes decía «Terra Lima» escrito a mano (título de la
// app, cabecera, correos, reportes, PDF de cotización, asistente) sale del proyecto que corresponda:
//   · el del lote / la cotización, cuando hay uno;
//   · el que el usuario tiene elegido en el mapa;
//   · el PRINCIPAL, en lo que no pertenece a un solo proyecto (correos del portal, reportes globales, título de la app).
// Sin proyecto, o con un Odoo que aún no trae los campos de P5, queda la marca de siempre (Terra Lima): nada cambia hasta que
// Odoo tenga los datos.

export interface Marca {
  nombre: string;
  /** Para nombres de archivo: sin espacios ni tildes («ParqueIndustrialSur»). */
  slug: string;
  /** Ruta del sitio (/logo.png) o URL https; null = sin logo (se usa solo el nombre). */
  logoUrl: string | null;
}

export const MARCA_LEGADA: Marca = { nombre: 'Terra Lima', slug: 'TerraLima', logoUrl: '/terra-lima-logo.png' };

export function slugMarca(nombre: string): string {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join('');
  return limpio || 'Proyecto';
}

/** Solo una ruta del sitio o una URL https; cualquier otra cosa (protocolo relativo, data:, javascript:) se descarta. */
export function logoSeguro(url: string | null | undefined): string | null {
  if (typeof url !== 'string') return null;
  const u = url.trim();
  if (/^\/(?!\/)[A-Za-z0-9._~/%-]+$/.test(u)) return u;
  if (/^https:\/\/[^\s]+$/.test(u)) return u;
  return null;
}

export function marcaDeProyecto(proyecto?: Proyecto | null): Marca {
  if (!proyecto || proyecto.oferta === undefined) return MARCA_LEGADA; // sin proyecto o Odoo sin los campos de P5
  const nombre = (proyecto.urbanizacion || proyecto.nombre || '').trim();
  if (!nombre) return MARCA_LEGADA;
  return { nombre, slug: slugMarca(nombre), logoUrl: logoSeguro(proyecto.logoUrl) };
}

export interface MarcasDisponibles {
  /** La del proyecto principal: para lo que no pertenece a un solo proyecto. */
  principal: Marca;
  /** Por id de proyecto: para lo que sí (un lote, una cotización). */
  porId: Record<number, Marca>;
}

export const MARCAS_LEGADAS: MarcasDisponibles = { principal: MARCA_LEGADA, porId: {} };

export function marcasDeProyectos(proyectos: readonly Proyecto[]): MarcasDisponibles {
  const porId: Record<number, Marca> = {};
  for (const p of proyectos) porId[p.id] = marcaDeProyecto(p);
  return { principal: marcaDeProyecto(elegirProyecto(proyectos).proyecto), porId };
}

/** La marca de un proyecto por id; si no se conoce, la principal. */
export function marcaPorId(marcas: MarcasDisponibles, proyectoId?: number | null): Marca {
  return (proyectoId ? marcas.porId[proyectoId] : undefined) ?? marcas.principal;
}
