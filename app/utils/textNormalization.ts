/**
 * Utilidades para normalización de texto en búsquedas.
 * Maneja tildes, eñes, espacios múltiples y caracteres especiales.
 */

/**
 * Normaliza un texto para búsquedas insensibles a tildes, eñes y puntuación.
 * 
 * @param text - Texto a normalizar
 * @returns Texto normalizado en minúsculas sin tildes ni caracteres especiales
 * 
 * @example
 * normalizeText("Manzaña D - Lote 100") // "manzana d lote 100"
 * normalizeText("Etápa 1") // "etapa 1"
 */
export function normalizeText(text: any): string {
  if (!text || text === false || text === null || text === undefined) return '';
  
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD') // Descompone caracteres con tildes
    .replace(/[\u0300-\u036f]/g, '') // Elimina marcas diacríticas (tildes)
    .replace(/[^\w\s]/g, ' ') // Reemplaza puntuación con espacios
    .replace(/\s+/g, ' ') // Normaliza espacios múltiples a uno solo
    .trim();
}

/**
 * Verifica si un texto contiene una consulta de búsqueda (normalizado).
 * 
 * @param text - Texto donde buscar
 * @param query - Consulta de búsqueda
 * @returns true si el texto contiene la consulta
 * 
 * @example
 * containsQuery("Manzana D", "manzaña") // true
 * containsQuery("Lote 100", "lote") // true
 */
export function containsQuery(text: string | null | undefined | false, query: string): boolean {
  if (!text || !query) return false;
  return normalizeText(text).includes(normalizeText(query));
}

/**
 * Destaca los términos de búsqueda en un texto (para UI).
 * 
 * @param text - Texto original
 * @param query - Término a destacar
 * @returns Texto con marcado HTML <mark>
 * 
 * @example
 * highlightMatch("Lote 100", "lote") // "<mark>Lote</mark> 100"
 */
export function highlightMatch(text: string, query: string): string {
  if (!query.trim()) return text;
  
  try {
    // Escapar caracteres especiales de regex
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 px-0.5 rounded">$1</mark>');
  } catch {
    return text;
  }
}

/**
 * Convierte un valor de Odoo (que puede ser false, null, undefined) a string seguro.
 * 
 * @param value - Valor potencialmente nulo de Odoo
 * @returns String seguro para búsqueda
 */
export function safeString(value: any): string {
  if (value === false || value === null || value === undefined) return '';
  return String(value).trim();
}
