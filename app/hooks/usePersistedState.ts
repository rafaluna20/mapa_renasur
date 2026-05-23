/**
 * usePersistedState Hook
 * 
 * Custom hook que persiste el estado en localStorage,
 * permitiendo que las preferencias del usuario se mantengan
 * entre sesiones y recargas de página.
 * 
 * @example
 * const [theme, setTheme] = usePersistedState('app-theme', 'dark');
 * const [chartView, setChartView] = usePersistedState('dashboard-chart-view', '6m');
 */

import { useState, useEffect } from 'react';

export function usePersistedState<T>(
    key: string,
    defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
    // Inicializar estado desde localStorage o usar valor por defecto
    const [state, setState] = useState<T>(() => {
        // Server-side rendering check
        if (typeof window === 'undefined') {
            return defaultValue;
        }

        try {
            const item = localStorage.getItem(key);
            return item ? (JSON.parse(item) as T) : defaultValue;
        } catch (error) {
            console.warn(`Error loading persisted state for key "${key}":`, error);
            return defaultValue;
        }
    });

    // Persistir cambios en localStorage
    useEffect(() => {
        if (typeof window === 'undefined') return;

        try {
            localStorage.setItem(key, JSON.stringify(state));
        } catch (error) {
            console.warn(`Error persisting state for key "${key}":`, error);
        }
    }, [key, state]);

    return [state, setState];
}

/**
 * Hook para limpiar estados persistidos
 * Útil para logout o reset de configuración
 */
export function useClearPersistedStates() {
    const clearAll = (keys?: string[]) => {
        if (typeof window === 'undefined') return;

        try {
            if (keys && keys.length > 0) {
                // Limpiar solo claves específicas
                keys.forEach(key => localStorage.removeItem(key));
            } else {
                // Limpiar todo localStorage (usar con precaución)
                localStorage.clear();
            }
        } catch (error) {
            console.warn('Error clearing persisted states:', error);
        }
    };

    return { clearAll };
}
