import { useState, useEffect } from 'react';

/**
 * Hook personalizado para aplicar debounce a un valor.
 * Útil para optimizar búsquedas en tiempo real y reducir re-renders innecesarios.
 * 
 * @param value - El valor que se quiere debounce
 * @param delay - Tiempo de espera en milisegundos (por defecto 300ms)
 * @returns El valor debounced
 * 
 * @example
 * const debouncedSearchQuery = useDebounce(searchQuery, 300);
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Crear un timer que actualiza el valor después del delay
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Limpiar el timer si el valor cambia antes del delay
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
