import { useMemo } from 'react';
import { useDebounce } from './useDebounce';
import { normalizeText, safeString } from '@/app/utils/textNormalization';

/**
 * Opciones de configuración para la búsqueda inteligente
 */
export interface SearchOptions {
  /** Consulta de búsqueda textual */
  query: string;
  /** Rango de precios [min, max] */
  priceRange?: [number | null, number | null];
  /** Rango de área [min, max] */
  areaRange?: [number | null, number | null];
  /** Tiempo de debounce en milisegundos */
  debounceMs?: number;
  /** Filtro de estado */
  statusFilter?: string;
  /** Filtro de manzana */
  manzanaFilter?: string;
  /** Filtro de etapa */
  etapaFilter?: string;
}

/**
 * Resultado de la búsqueda inteligente
 */
export interface SearchResult<T> {
  /** Items filtrados */
  results: T[];
  /** Query después del debounce */
  query: string;
  /** Cantidad de resultados */
  count: number;
  /** Indica si hay filtros activos */
  hasActiveFilters: boolean;
  /** Cantidad de resultados solo por búsqueda textual */
  searchMatchCount: number;
}

/**
 * Hook personalizado para búsqueda inteligente multi-campo con debounce.
 * 
 * Características:
 * - Búsqueda en múltiples campos
 * - Normalización automática (tildes, espacios, puntuación)
 * - Debounce para optimizar performance
 * - Filtros por rangos (precio, área)
 * - Filtros categóricos (estado, manzana, etapa)
 * 
 * @param items - Array de items a filtrar
 * @param searchFields - Nombres de los campos donde buscar
 * @param options - Opciones de búsqueda y filtros
 * @returns Objeto con resultados filtrados y metadata
 * 
 * @example
 * const { results, count, hasActiveFilters } = useSmartSearch(
 *   lots,
 *   ['name', 'default_code', 'x_lote', 'x_mz'],
 *   {
 *     query: searchQuery,
 *     priceRange: [50000, 100000],
 *     statusFilter: 'libre',
 *     debounceMs: 300
 *   }
 * );
 */
export function useSmartSearch<T extends Record<string, any>>(
  items: T[],
  searchFields: (keyof T)[],
  options: SearchOptions
): SearchResult<T> {
  // Aplicar debounce solo a la query textual
  const debouncedQuery = useDebounce(options.query, options.debounceMs || 300);

  // Determinar si hay filtros activos
  const hasActiveFilters = useMemo(() => {
    const hasQuery = debouncedQuery.trim().length > 0;
    const hasPriceFilter = !!(options.priceRange &&
      (options.priceRange[0] !== null || options.priceRange[1] !== null));
    const hasAreaFilter = !!(options.areaRange &&
      (options.areaRange[0] !== null || options.areaRange[1] !== null));
    const hasStatusFilter = !!(options.statusFilter && options.statusFilter !== 'all');
    const hasManzanaFilter = !!(options.manzanaFilter && options.manzanaFilter !== 'all');
    const hasEtapaFilter = !!(options.etapaFilter && options.etapaFilter !== 'all');
    
    return hasQuery || hasPriceFilter || hasAreaFilter ||
           hasStatusFilter || hasManzanaFilter || hasEtapaFilter;
  }, [debouncedQuery, options]);

  // Filtrado inteligente
  const { results, searchMatchCount } = useMemo(() => {
    const normalizedQuery = normalizeText(debouncedQuery);
    let searchMatches = 0;

    const filtered = items.filter(item => {
      // 1. BÚSQUEDA TEXTUAL MULTI-CAMPO
      if (normalizedQuery) {
        const matchesSearch = searchFields.some(field => {
          const value = item[field];
          const normalizedValue = normalizeText(safeString(value));
          return normalizedValue.includes(normalizedQuery);
        });
        
        if (matchesSearch) {
          searchMatches++;
        } else {
          return false; // No coincide con la búsqueda, descartar
        }
      }

      // 2. FILTRO POR RANGO DE PRECIO
      if (options.priceRange) {
        const [min, max] = options.priceRange;
        const price = Number(item.list_price) || 0;
        
        if (min !== null && price < min) return false;
        if (max !== null && price > max) return false;
      }

      // 3. FILTRO POR RANGO DE ÁREA
      if (options.areaRange) {
        const [min, max] = options.areaRange;
        const area = Number(item.x_area) || 0;
        
        if (min !== null && area < min) return false;
        if (max !== null && area > max) return false;
      }

      // 4. FILTRO POR ESTADO
      if (options.statusFilter && options.statusFilter !== 'all') {
        if (item.x_statu !== options.statusFilter) return false;
      }

      // 5. FILTRO POR MANZANA
      if (options.manzanaFilter && options.manzanaFilter !== 'all') {
        if (item.x_mz !== options.manzanaFilter) return false;
      }

      // 6. FILTRO POR ETAPA
      if (options.etapaFilter && options.etapaFilter !== 'all') {
        if (String(item.x_etapa) !== options.etapaFilter) return false;
      }

      return true; // Pasó todos los filtros
    });

    return {
      results: filtered,
      searchMatchCount: normalizedQuery ? searchMatches : filtered.length
    };
  }, [
    items,
    searchFields,
    debouncedQuery,
    options.priceRange,
    options.areaRange,
    options.statusFilter,
    options.manzanaFilter,
    options.etapaFilter
  ]);

  return {
    results,
    query: debouncedQuery,
    count: results.length,
    hasActiveFilters,
    searchMatchCount
  };
}
