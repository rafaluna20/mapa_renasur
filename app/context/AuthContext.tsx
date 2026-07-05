'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { odooService, type OdooUser } from '@/app/services/odooService';
export type { OdooUser };

interface AuthContextType {
    user: OdooUser | null;
    salesCount: number;
    reservedCount: number;
    quotesCount: number;
    totalValue: number;
    loading: boolean;
    login: (login: string, pass: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<OdooUser | null>(null);
    const [salesCount, setSalesCount] = useState(0);
    const [reservedCount, setReservedCount] = useState(0);
    const [quotesCount, setQuotesCount] = useState(0);
    const [totalValue, setTotalValue] = useState(0);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const refreshStats = useCallback(async (currentUser: OdooUser) => {
        try {
            // Fetch stats from Odoo API
            const stats = await odooService.getSalesStats(currentUser.uid);

            setSalesCount(stats.sold);
            setReservedCount(stats.reserved);
            setQuotesCount(stats.draft);
            setTotalValue(stats.totalValue);
        } catch (error) {
            console.error("Error refreshing stats", error);
        }
    }, []);

    // Load user from localStorage on mount
    useEffect(() => {
        const init = async () => {
            const storedUser = localStorage.getItem('odoo_user');
            if (storedUser) {
                try {
                    const parsedUser: OdooUser = JSON.parse(storedUser);
                    setUser(parsedUser);
                    await refreshStats(parsedUser);
                } catch {
                    localStorage.removeItem('odoo_user');
                }
            }
            setLoading(false);
        };
        init();
    }, [refreshStats]);



    const login = async (loginStr: string, pass: string) => {
        try {
            const odooUser = await odooService.login(loginStr, pass);
            setUser(odooUser);
            localStorage.setItem('odoo_user', JSON.stringify(odooUser));

            // Fetch stats immediately
            await refreshStats(odooUser);

            router.push('/');
        } catch {
            router.push('/login');
        }
    };

    const logout = () => {
        setUser(null);
        setSalesCount(0);
        setReservedCount(0);
        setQuotesCount(0);
        setTotalValue(0);
        localStorage.removeItem('odoo_user');
        // Limpia también la cookie de sesión de staff que valida el servidor
        fetch('/api/auth/staff-logout', { method: 'POST' }).catch(() => {});
        router.push('/login');
    };

    return (
        <AuthContext.Provider value={{ user, salesCount, reservedCount, quotesCount, totalValue, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
