'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'theme';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    // El valor inicial real ya lo aplicó el script inline en <head> (antes del
    // primer paint, para evitar parpadeo) — acá solo se lee lo que ya quedó
    // en el DOM para que React y el DOM no queden desincronizados.
    const [theme, setTheme] = useState<Theme>('light');

    useEffect(() => {
        const isDark = document.documentElement.classList.contains('dark');
        setTheme(isDark ? 'dark' : 'light');
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme((prev) => {
            const next: Theme = prev === 'dark' ? 'light' : 'dark';
            document.documentElement.classList.toggle('dark', next === 'dark');
            try {
                localStorage.setItem(THEME_STORAGE_KEY, next);
            } catch {
                // Almacenamiento no disponible (modo privado, cuota llena, etc.)
                // — el tema sigue funcionando en memoria para esta sesión.
            }
            return next;
        });
    }, []);

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme(): ThemeContextType {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme debe usarse dentro de <ThemeProvider>');
    return ctx;
}
