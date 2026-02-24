/**
 * useClientSearch Hook
 * 
 * Hook personalizado para búsqueda inteligente de clientes en Odoo.
 * Incluye:
 * - Búsqueda con debounce optimizado
 * - Gestión de clientes recientes
 * - Caché de resultados
 * - Búsqueda desde el primer carácter
 * 
 * @author Sistema de Cotización TERRA LIMA
 * @version 1.0.0
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { odooService } from '@/app/services/odooService';

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

/**
 * Resultado de búsqueda de cliente con información enriquecida
 */
export interface ClientSearchResult {
    id: number;
    name: string;
    vat?: string;
    phone?: string;
    email?: string;
    // Campos adicionales opcionales
    street?: string;
    city?: string;
    lastPurchaseDate?: string;
    totalPurchases?: number;
}

/**
 * Opciones de configuración del hook
 */
export interface UseClientSearchOptions {
    minChars?: number;           // Mínimo de caracteres para buscar (default: 1)
    debounceMs?: number;          // Tiempo de debounce en ms (default: 400)
    maxResults?: number;          // Máximo de resultados a mostrar (default: 10)
    vendorId?: string;            // ID del vendedor para filtrar clientes
    enableRecent?: boolean;       // Habilitar clientes recientes (default: true)
    cacheResults?: boolean;       // Cachear resultados (default: true)
}

/**
 * Estado retornado por el hook
 */
export interface UseClientSearchReturn {
    // Estado de búsqueda
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    results: ClientSearchResult[];
    recentClients: ClientSearchResult[];
    isSearching: boolean;
    
    // Cliente seleccionado
    selectedClient: ClientSearchResult | null;
    selectClient: (client: ClientSearchResult) => void;
    clearSelection: () => void;
    
    // Utilidades
    hasResults: boolean;
    showRecentClients: boolean;
    displayResults: ClientSearchResult[];
}

// ============================================================================
// CONSTANTES
// ============================================================================

const STORAGE_KEY = 'terra_recent_clients';
const MAX_RECENT_CLIENTS = 10;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutos

// Cache simple en memoria
const searchCache = new Map<string, { results: ClientSearchResult[]; timestamp: number }>();

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

/**
 * Hook para búsqueda inteligente de clientes
 * 
 * @example
 * ```tsx
 * const {
 *   searchTerm,
 *   setSearchTerm,
 *   displayResults,
 *   selectedClient,
 *   selectClient
 * } = useClientSearch({ minChars: 1, debounceMs: 300 });
 * ```
 */
export function useClientSearch(options: UseClientSearchOptions = {}): UseClientSearchReturn {
    // Configuración con valores por defecto
    const {
        minChars = 1,
        debounceMs = 400,
        maxResults = 10,
        vendorId,
        enableRecent = true,
        cacheResults = true
    } = options;

    // ========================================================================
    // ESTADO
    // ========================================================================
    
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState<ClientSearchResult[]>([]);
    const [recentClients, setRecentClients] = useState<ClientSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedClient, setSelectedClient] = useState<ClientSearchResult | null>(null);

    // ========================================================================
    // EFECTOS
    // ========================================================================

    /**
     * Efecto 1: Cargar clientes recientes al montar el componente
     */
    useEffect(() => {
        if (enableRecent) {
            loadRecentClients();
        }
    }, [vendorId, enableRecent]);

    /**
     * Efecto 2: Búsqueda con debounce
     */
    useEffect(() => {
        // No buscar si:
        // - El término está vacío
        // - El término es muy corto
        // - Ya hay un cliente seleccionado
        if (!searchTerm || searchTerm.length < minChars || selectedClient) {
            setResults([]);
            return;
        }

        // Crear temporizador de debounce
        const timer = setTimeout(async () => {
            await performSearch(searchTerm);
        }, debounceMs);

        // Limpiar temporizador al desmontar o cuando cambie searchTerm
        return () => clearTimeout(timer);
    }, [searchTerm, minChars, debounceMs, selectedClient]);

    // ========================================================================
    // FUNCIONES
    // ========================================================================

    /**
     * Realiza la búsqueda de clientes
     */
    const performSearch = async (term: string) => {
        const normalizedTerm = term.trim();
        
        if (!normalizedTerm) {
            setResults([]);
            return;
        }

        // Verificar caché primero
        if (cacheResults) {
            const cached = getCachedResults(normalizedTerm);
            if (cached) {
                setResults(cached.slice(0, maxResults));
                return;
            }
        }

        setIsSearching(true);
        
        try {
            // Buscar en Odoo
            const searchResults = await odooService.searchPartners(normalizedTerm);
            
            // Limitar resultados
            const limitedResults = searchResults.slice(0, maxResults);
            
            // Guardar en caché
            if (cacheResults) {
                cacheSearchResults(normalizedTerm, limitedResults);
            }
            
            setResults(limitedResults);
        } catch (error) {
            console.error('Error al buscar clientes:', error);
            setResults([]);
            
            // Opcional: Podrías mostrar un toast o notificación de error
            // toast.error('Error al buscar clientes. Intenta nuevamente.');
        } finally {
            setIsSearching(false);
        }
    };

    /**
     * Carga los clientes recientes desde localStorage
     */
    const loadRecentClients = useCallback(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed: ClientSearchResult[] = JSON.parse(stored);
                
                // Filtrar por vendedor si se especificó
                const filtered = vendorId 
                    ? parsed.filter(c => (c as any).vendorId === vendorId)
                    : parsed;
                
                setRecentClients(filtered.slice(0, 5)); // Mostrar solo top 5
            }
        } catch (error) {
            console.error('Error al cargar clientes recientes:', error);
            setRecentClients([]);
        }
    }, [vendorId]);

    /**
     * Agrega un cliente a la lista de recientes
     */
    const addToRecent = useCallback((client: ClientSearchResult) => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            let recents: ClientSearchResult[] = stored ? JSON.parse(stored) : [];
            
            // Eliminar duplicados (por ID)
            recents = recents.filter(c => c.id !== client.id);
            
            // Agregar al inicio de la lista
            recents.unshift(client);
            
            // Limitar a MAX_RECENT_CLIENTS
            recents = recents.slice(0, MAX_RECENT_CLIENTS);
            
            // Guardar en localStorage
            localStorage.setItem(STORAGE_KEY, JSON.stringify(recents));
            
            // Actualizar estado
            setRecentClients(recents.slice(0, 5));
        } catch (error) {
            console.error('Error al guardar cliente reciente:', error);
        }
    }, []);

    /**
     * Selecciona un cliente
     */
    const selectClient = useCallback((client: ClientSearchResult) => {
        setSelectedClient(client);
        setSearchTerm(client.name);
        setResults([]);
        addToRecent(client);
    }, [addToRecent]);

    /**
     * Limpia la selección actual
     */
    const clearSelection = useCallback(() => {
        setSelectedClient(null);
        setSearchTerm('');
        setResults([]);
    }, []);

    /**
     * Obtiene resultados del caché
     */
    const getCachedResults = (term: string): ClientSearchResult[] | null => {
        const cached = searchCache.get(term.toLowerCase());
        
        if (!cached) return null;
        
        // Verificar si el caché expiró
        const isExpired = Date.now() - cached.timestamp > CACHE_DURATION_MS;
        
        if (isExpired) {
            searchCache.delete(term.toLowerCase());
            return null;
        }
        
        return cached.results;
    };

    /**
     * Guarda resultados en caché
     */
    const cacheSearchResults = (term: string, results: ClientSearchResult[]) => {
        searchCache.set(term.toLowerCase(), {
            results,
            timestamp: Date.now()
        });
        
        // Limpiar caché viejo (máximo 50 entradas)
        if (searchCache.size > 50) {
            const firstKey = searchCache.keys().next().value;
            if (firstKey) searchCache.delete(firstKey);
        }
    };

    // ========================================================================
    // VALORES COMPUTADOS
    // ========================================================================

    /**
     * Determina qué resultados mostrar:
     * - Si está buscando: resultados de búsqueda
     * - Si no hay búsqueda: clientes recientes
     */
    const displayResults = useMemo(() => {
        if (searchTerm.length >= minChars) {
            return results;
        }
        return enableRecent && searchTerm.length === 0 ? recentClients : [];
    }, [searchTerm, results, recentClients, minChars, enableRecent]);

    /**
     * Indica si hay resultados para mostrar
     */
    const hasResults = displayResults.length > 0;

    /**
     * Indica si se están mostrando clientes recientes
     */
    const showRecentClients = searchTerm.length === 0 && enableRecent && recentClients.length > 0;

    // ========================================================================
    // RETORNO
    // ========================================================================

    return {
        // Estado de búsqueda
        searchTerm,
        setSearchTerm,
        results,
        recentClients,
        isSearching,
        
        // Cliente seleccionado
        selectedClient,
        selectClient,
        clearSelection,
        
        // Utilidades
        hasResults,
        showRecentClients,
        displayResults
    };
}

// ============================================================================
// FUNCIONES AUXILIARES EXPORTADAS
// ============================================================================

/**
 * Limpia el caché de búsqueda
 */
export function clearSearchCache() {
    searchCache.clear();
}

/**
 * Limpia los clientes recientes del localStorage
 */
export function clearRecentClients() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.error('Error al limpiar clientes recientes:', error);
    }
}

/**
 * Obtiene el tamaño actual del caché
 */
export function getCacheSize(): number {
    return searchCache.size;
}

/**
 * Formatea un cliente para mostrar en la UI
 */
export function formatClientDisplay(client: ClientSearchResult): string {
    const parts = [client.name];
    
    if (client.vat) {
        parts.push(`(${client.vat})`);
    }
    
    if (client.city) {
        parts.push(`- ${client.city}`);
    }
    
    return parts.join(' ');
}

/**
 * Obtiene las iniciales de un cliente para avatar
 */
export function getClientInitials(clientName: string): string {
    if (!clientName) return '?';
    
    const words = clientName.trim().split(' ').filter(w => w.length > 0);
    
    if (words.length === 1) {
        return words[0].charAt(0).toUpperCase();
    }
    
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

/**
 * Genera un color consistente para un cliente basado en su ID
 */
export function getClientColor(clientId: number): string {
    const colors = [
        'bg-blue-100 text-blue-700',
        'bg-green-100 text-green-700',
        'bg-purple-100 text-purple-700',
        'bg-pink-100 text-pink-700',
        'bg-indigo-100 text-indigo-700',
        'bg-orange-100 text-orange-700',
        'bg-teal-100 text-teal-700',
        'bg-cyan-100 text-cyan-700'
    ];
    
    return colors[clientId % colors.length];
}
