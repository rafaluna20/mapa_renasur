'use client';

import { SessionProvider } from 'next-auth/react';
import { AuthProvider } from '@/app/context/AuthContext';
import { ThemeProvider } from '@/app/context/ThemeContext';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <ThemeProvider>
                <AuthProvider>
                    {children}
                </AuthProvider>
            </ThemeProvider>
        </SessionProvider>
    );
}
