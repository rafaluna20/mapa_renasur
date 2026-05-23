/**
 * Dashboard Data Validation Schemas
 * 
 * Schemas de validación con Zod para garantizar que los datos
 * del backend son válidos y prevenir errores silenciosos.
 */

import { z } from 'zod';

// Schema para KPIs
export const KPIsSchema = z.object({
    monthlyGoal: z.number().min(0).finite(),
    commission: z.number().min(0).finite(),
    pendingLeads: z.number().int().min(0),
    totalSales: z.number().min(0).finite(),
});

// Schema para tendencia de ventas
export const SalesTrendItemSchema = z.object({
    name: z.string().min(1),
    ventas: z.number().min(0).finite(),
    meta: z.number().min(0).finite().optional(),
    comision: z.number().min(0).finite().optional(),
});

export const SalesTrendSchema = z.array(SalesTrendItemSchema);

// Schema para actividad reciente
export const ActivityItemSchema = z.object({
    id: z.number(),
    action: z.string().min(1),
    lot: z.string().min(1),
    date: z.string().min(1),
});

export const RecentActivitySchema = z.array(ActivityItemSchema);

// Schema para cotizaciones competidas
export const QuoteSchema = z.object({
    client: z.string().min(1),
    advisor: z.string().min(1),
    hours: z.number().min(0),
});

export const CompetedLotSchema = z.object({
    lot: z.string().min(1),
    stage: z.string().min(1),
    quotes: z.array(QuoteSchema),
});

export const CompetedLotsSchema = z.array(CompetedLotSchema);

// Schema para lotes asignados
export const AssignedLotSchema = z.object({
    lot: z.string().min(1),
    stage: z.string().min(1),
    client: z.string().min(1),
    status: z.string().min(1),
    price: z.number().min(0).finite(),
    daysOpen: z.number().int().min(0).optional(),
});

export const AssignedLotsSchema = z.array(AssignedLotSchema);

// Schema principal para las estadísticas del dashboard
export const DashboardStatsSchema = z.object({
    kpis: KPIsSchema,
    salesTrend: SalesTrendSchema,
    recentActivity: RecentActivitySchema,
    competedLots: CompetedLotsSchema,
    assignedLots: AssignedLotsSchema,
});

// Types inferidos de los schemas
export type KPIs = z.infer<typeof KPIsSchema>;
export type SalesTrendItem = z.infer<typeof SalesTrendItemSchema>;
export type ActivityItem = z.infer<typeof ActivityItemSchema>;
export type Quote = z.infer<typeof QuoteSchema>;
export type CompetedLot = z.infer<typeof CompetedLotSchema>;
export type AssignedLot = z.infer<typeof AssignedLotSchema>;
export type DashboardStats = z.infer<typeof DashboardStatsSchema>;

/**
 * Función helper para validar y sanitizar datos del dashboard
 * 
 * @param data - Datos sin validar del backend
 * @returns Datos validados o lanza un error descriptivo
 * 
 * @example
 * try {
 *   const validData = validateDashboardData(rawData);
 *   setStats(validData);
 * } catch (error) {
 *   if (error instanceof z.ZodError) {
 *     console.error('Datos inválidos:', error.errors);
 *   }
 * }
 */
export function validateDashboardData(data: unknown): DashboardStats {
    return DashboardStatsSchema.parse(data);
}

/**
 * Versión "safe" que retorna un objeto con éxito/error
 * en lugar de lanzar excepciones
 */
export function validateDashboardDataSafe(data: unknown) {
    return DashboardStatsSchema.safeParse(data);
}
