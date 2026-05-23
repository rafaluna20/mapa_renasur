/**
 * useDashboardData Hook
 * 
 * Hook personalizado que encapsula la lógica de carga de datos del dashboard
 * con validación, polling automático y manejo de errores.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { odooService } from '@/app/services/odooService';
import { validateDashboardData, type DashboardStats } from '@/app/types/dashboardSchemas';
import { z } from 'zod';

interface UseDashboardDataOptions {
    userId: number;
    pollingInterval?: number; // Intervalo en milisegundos (default: 30000 = 30s)
    enablePolling?: boolean; // Habilitar polling automático (default: true)
}

interface UseDashboardDataReturn {
    stats: DashboardStats | null;
    loading: boolean;
    error: string | null;
    lastUpdate: Date | null;
    refresh: () => Promise<void>;
}

export function useDashboardData({
    userId,
    pollingInterval = 30000,
    enablePolling = true,
}: UseDashboardDataOptions): UseDashboardDataReturn {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    
    // Ref para evitar múltiples requests simultáneos
    const isFetchingRef = useRef(false);
    
    // Función para cargar datos con validación
    const fetchData = useCallback(async () => {
        // Prevenir múltiples requests simultáneos
        if (isFetchingRef.current) {
            return;
        }
        
        isFetchingRef.current = true;
        
        try {
            setError(null);
            
            // Obtener datos del backend
            const rawData = await odooService.getDetailedSalesStats(userId);
            
            // Validar datos con Zod
            try {
                const validatedData = validateDashboardData(rawData);
                setStats(validatedData);
                setLastUpdate(new Date());
            } catch (validationError) {
                if (validationError instanceof z.ZodError) {
                    console.error('❌ Datos inválidos recibidos del backend:', validationError.issues);
                    setError('Los datos recibidos no son válidos. Contacta a soporte técnico.');
                } else {
                    throw validationError;
                }
            }
        } catch (err: unknown) {
            console.error('Error fetching dashboard statistics:', err);
            setError(
                err instanceof Error 
                    ? `Error al cargar datos: ${err.message}`
                    : 'Error al cargar los datos del panel. Por favor intente más tarde.'
            );
        } finally {
            setLoading(false);
            isFetchingRef.current = false;
        }
    }, [userId]);
    
    // Función expuesta para refrescar manualmente
    const refresh = useCallback(async () => {
        setLoading(true);
        await fetchData();
    }, [fetchData]);
    
    // Efecto para carga inicial y polling
    useEffect(() => {
        // Carga inicial
        fetchData();
        
        // Configurar polling si está habilitado
        if (enablePolling && pollingInterval > 0) {
            const interval = setInterval(() => {
                fetchData();
            }, pollingInterval);
            
            return () => clearInterval(interval);
        }
    }, [fetchData, enablePolling, pollingInterval]);
    
    return {
        stats,
        loading,
        error,
        lastUpdate,
        refresh,
    };
}

/**
 * Hook simplificado sin polling para casos donde solo se necesita
 * carga inicial (ej: reportes estáticos)
 */
export function useDashboardDataOnce(userId: number) {
    return useDashboardData({
        userId,
        enablePolling: false,
    });
}
