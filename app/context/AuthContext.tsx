'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { odooService, type OdooUser } from '@/app/services/odooService';
export type { OdooUser };

interface AuthContextType {
    user: OdooUser | null;
    salesCount: number;
    reservedCount: number;
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
    const [totalValue, setTotalValue] = useState(0);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    // Load user from localStorage on mount
    useEffect(() => {
        const storedUser = localStorage.getItem('odoo_user');
        if (storedUser) {
            try {
                const parsedUser = JSON.parse(storedUser);
                setUser(parsedUser);
                refreshStats(parsedUser);
            } catch (_e) {
                localStorage.removeItem('odoo_user');
            }
        }
        setLoading(false);
    }, []);

    const refreshStats = async (user: OdooUser) => {
        try {
            // Fetch stats from Odoo API
            const stats = await odooService.getSalesStats(user.uid);

            setSalesCount(stats.sold);
            setReservedCount(stats.reserved);
            setTotalValue(stats.totalValue);
        } catch (error) {
            console.error("Error refreshing stats", error);
        }
    };

    const login = async (loginStr: string, pass: string) => {
        try {
            const odooUser = await odooService.login(loginStr, pass);
            setUser(odooUser);
            localStorage.setItem('odoo_user', JSON.stringify(odooUser));

            // Fetch stats immediately
            await refreshStats(odooUser);

            router.push('/');
        } catch (_e) {
            router.push('/login');
        }
    };

    const logout = () => {
        setUser(null);
        setSalesCount(0);
        setReservedCount(0);
        setTotalValue(0);
        localStorage.removeItem('odoo_user');
        router.push('/login');
    };

    return (
        <AuthContext.Provider value={{ user, salesCount, reservedCount, totalValue, loading, login, logout }}>
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
