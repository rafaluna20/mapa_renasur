import { useEffect, useRef } from 'react';

/**
 * Hook para atrapar el foco dentro de un modal (accesibilidad)
 * Evita que el usuario pueda tabular fuera del modal
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>() {
    const elementRef = useRef<T>(null);

    useEffect(() => {
        const element = elementRef.current;
        if (!element) return;

        // Guardar el elemento que tenía el foco antes de abrir el modal
        const previouslyFocusedElement = document.activeElement as HTMLElement;

        // Obtener todos los elementos enfocables dentro del modal
        const getFocusableElements = () => {
            const focusableSelectors = [
                'a[href]',
                'button:not([disabled])',
                'textarea:not([disabled])',
                'input:not([disabled])',
                'select:not([disabled])',
                '[tabindex]:not([tabindex="-1"])'
            ].join(', ');

            return Array.from(
                element.querySelectorAll<HTMLElement>(focusableSelectors)
            ).filter(el => {
                return el.offsetParent !== null; // Solo elementos visibles
            });
        };

        // Enfocar el primer elemento enfocable
        const focusableElements = getFocusableElements();
        if (focusableElements.length > 0) {
            focusableElements[0].focus();
        }

        // Manejar la tecla Tab para ciclar el foco
        const handleTabKey = (e: KeyboardEvent) => {
            const focusableElements = getFocusableElements();
            if (focusableElements.length === 0) return;

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    // Shift + Tab: ir hacia atrás
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    // Tab: ir hacia adelante
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            }
        };

        element.addEventListener('keydown', handleTabKey);

        // Limpiar al desmontar: devolver foco al elemento original
        return () => {
            element.removeEventListener('keydown', handleTabKey);
            if (previouslyFocusedElement) {
                previouslyFocusedElement.focus();
            }
        };
    }, []);

    return elementRef;
}
