'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    ComposedChart, Line, Bar, Brush, Legend
} from 'recharts';
import {
    DollarSign, TrendingUp, Users, Target, ArrowUpRight, ArrowDownRight,
    MapPin, Clock, Loader2, Award, Zap, FileDown, Calendar, Filter,
    AlertTriangle, Sparkles, TrendingDown, Activity, BarChart3
} from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { odooService } from '@/app/services/odooService';
import { generateEnterpriseReport, generateProjectGeneralReport, type ReportData } from '@/app/services/reportService';
import { useRouter } from 'next/navigation';

// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS Y CONFIGURACIONES
// ═══════════════════════════════════════════════════════════════════════════════

interface EnhancedStats {
    kpis: {
        monthlyGoal: number;
        commission: number;
        commissionRate: number;
        pendingLeads: number;
        totalSales: number;
        // Nuevos KPIs
        avgTicket: number;
        conversionRate: number;
        pipelineValue: number;
        salesVelocity: number;
    };
    salesTrend: { name: string; ventas: number; meta?: number; comision?: number }[];
    recentActivity: { id: number; action: string; lot: string; date: string }[];
    competedLots: { lot: string; stage: string; quotes: { client: string; advisor: string; hours: number }[] }[];
    assignedLots: { lot: string; stage: string; client: string; status: string; price: number; daysOpen?: number }[];
    comparison: {
        totalSales: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
        commission: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
        salesCount: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
    };
}

const formatToDDMMYY = (dateStr?: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const [y, m, d] = parts;
        return `${d}/${m}/${y.slice(-2)}`;
    }
    return dateStr;
};

// Formatea montos del eje Y del gráfico eligiendo la unidad según la
// escala real del valor — antes dividía siempre por 1000 sin decimales,
// así que cualquier valor bajo (frecuente en cuentas nuevas/de prueba)
// colapsaba a "S/0k" en las 4 etiquetas del eje.
const formatAxisCurrency = (value: number): string => {
    if (value >= 1_000_000) return `S/${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `S/${(value / 1_000).toFixed(1)}k`;
    return `S/${Math.round(value)}`;
};

// Convierte horas transcurridas a un texto relativo legible — antes se
// mostraba el número crudo de horas (ej. "Hace 1473h" en vez de "Hace 2 meses").
const formatHoursElapsed = (hours: number): string => {
    if (hours < 24) return `Hace ${hours}h`;
    const days = Math.round(hours / 24);
    if (days < 30) return `Hace ${days}d`;
    const months = Math.round(days / 30);
    if (months < 12) return `Hace ${months} ${months === 1 ? 'mes' : 'meses'}`;
    const years = Math.round(months / 12);
    return `Hace ${years} ${years === 1 ? 'año' : 'años'}`;
};

// "En Proceso" = cotización activa o reservado (Separado) — NO cualquier
// cosa que no sea "Vendido". Antes usaba `status !== 'Vendido'`, así que
// un lote cuya cotización quedó vieja y hoy volvió a estar "Disponible"
// en Odoo (la reserva se liberó, o la cotización nunca se confirmó)
// seguía apareciendo acá como si tuviera algo activo encima.
const isLotEnProceso = (status: string): boolean => status === 'Cotización' || status === 'Separado';

type PeriodFilter = '7d' | '30d' | '90d' | '180d' | 'ytd' | 'custom';
type ChartView = 'simple' | 'detailed';

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTES AUXILIARES
// ═══════════════════════════════════════════════════════════════════════════════

// Tooltip mejorado con más información
interface EnhancedTooltipProps {
    active?: boolean;
    payload?: any[];
    label?: string;
}

const EnhancedTooltip = ({ active, payload, label }: EnhancedTooltipProps) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900/95 border border-indigo-500/40 backdrop-blur-md p-4 rounded-xl shadow-2xl">
                <p className="text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-2">
                    {label} · 2026
                </p>
                {payload.map((entry, index) => (
                    <div key={index} className="flex items-center justify-between gap-4 mb-1">
                        <span className="text-xs text-slate-300">{entry.name}:</span>
                        <span className="text-sm font-bold" style={{ color: entry.color }}>
                            S/ {entry.value.toLocaleString('es-PE')}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

// KPI Card mejorado con comparativas y sparkline
interface KPICardProps {
    label: string;
    value: string | number;
    icon: React.ReactNode;
    color: 'emerald' | 'amber' | 'indigo' | 'blue' | 'purple';
    change?: number;
    trend?: 'up' | 'down' | 'stable';
    subtitle?: string;
    sparklineData?: number[];
}

const KPICard = ({ label, value, icon, color, change, trend, subtitle, sparklineData }: KPICardProps) => {
    const colorMap = {
        emerald: {
            bg: 'bg-emerald-950/60',
            text: 'text-emerald-400',
            border: 'border-emerald-500/20',
            gradient: 'from-emerald-500/5',
            hover: 'hover:border-emerald-500/30 hover:shadow-[0_0_20px_rgba(16,185,129,0.05)]'
        },
        amber: {
            bg: 'bg-amber-950/60',
            text: 'text-amber-400',
            border: 'border-amber-500/20',
            gradient: 'from-amber-500/5',
            hover: 'hover:border-amber-500/30 hover:shadow-[0_0_20px_rgba(245,158,11,0.05)]'
        },
        indigo: {
            bg: 'bg-indigo-950/60',
            text: 'text-indigo-400',
            border: 'border-indigo-500/20',
            gradient: 'from-indigo-500/5',
            hover: 'hover:border-indigo-500/30 hover:shadow-[0_0_20px_rgba(99,102,241,0.05)]'
        },
        blue: {
            bg: 'bg-blue-950/60',
            text: 'text-blue-400',
            border: 'border-blue-500/20',
            gradient: 'from-blue-500/5',
            hover: 'hover:border-blue-500/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.05)]'
        },
        purple: {
            bg: 'bg-purple-950/60',
            text: 'text-purple-400',
            border: 'border-purple-500/20',
            gradient: 'from-purple-500/5',
            hover: 'hover:border-purple-500/30 hover:shadow-[0_0_20px_rgba(168,85,247,0.05)]'
        }
    };

    const colors = colorMap[color];
    const trendIcon = trend === 'up' ? <ArrowUpRight size={14} /> : trend === 'down' ? <ArrowDownRight size={14} /> : null;
    const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-slate-400';

    return (
        <div className={`bg-slate-900/40 border border-slate-850 ${colors.hover} rounded-2xl p-6 relative overflow-hidden transition-all duration-300 group`}>
            <div className={`absolute right-0 top-0 h-full w-24 bg-gradient-to-l ${colors.gradient} to-transparent opacity-50`} />
            
            <div className="flex justify-between items-start mb-4 relative z-10">
                <div className={`p-3 ${colors.bg} ${colors.text} rounded-xl border ${colors.border} group-hover:scale-110 transition-transform`}>
                    {icon}
                </div>
                
                {change !== undefined && (
                    <div className={`flex items-center gap-1 text-xs font-bold ${trendColor} bg-slate-950/60 px-2.5 py-1 rounded-full border ${colors.border}`}>
                        {trendIcon}
                        <span>{change > 0 ? '+' : ''}{change}%</span>
                    </div>
                )}
            </div>
            
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">{label}</p>
            <h3 className="text-2xl font-bold text-slate-100">{value}</h3>
            
            {subtitle && (
                <p className="text-[10px] text-slate-500 mt-1">{subtitle}</p>
            )}
            
            {/* Mini sparkline si hay datos */}
            {sparklineData && sparklineData.length > 0 && (
                <div className="mt-3 h-8 -mx-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={sparklineData.map((v, i) => ({ value: v }))}>
                            <defs>
                                <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={colors.text.replace('text-', '#')} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={colors.text.replace('text-', '#')} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Area 
                                type="monotone" 
                                dataKey="value" 
                                stroke={colors.text.replace('text-', '#')} 
                                strokeWidth={1.5}
                                fill={`url(#gradient-${color})`} 
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
};

// Panel de Insights
interface InsightProps {
    type: 'success' | 'warning' | 'info';
    icon: React.ReactNode;
    children: React.ReactNode;
}

const Insight = ({ type, icon, children }: InsightProps) => {
    const typeMap = {
        success: 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300',
        warning: 'bg-amber-950/20 border-amber-500/30 text-amber-300',
        info: 'bg-blue-950/20 border-blue-500/30 text-blue-300'
    };

    return (
        <div className={`${typeMap[type]} border rounded-xl p-3 flex items-start gap-3`}>
            <div className="mt-0.5">{icon}</div>
            <p className="text-sm leading-relaxed">{children}</p>
        </div>
    );
};

// Skeletons de alta fidelidad para carga progresiva
const KPICardSkeleton = () => (
    <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-6 relative overflow-hidden animate-pulse">
        <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 bg-slate-800 rounded-xl" />
            <div className="w-12 h-5 bg-slate-800 rounded-full" />
        </div>
        <div className="w-24 h-3 bg-slate-800 rounded mb-2" />
        <div className="w-36 h-7 bg-slate-800/60 rounded mb-2" />
        <div className="w-20 h-2 bg-slate-800 rounded" />
    </div>
);

const ChartSkeleton = () => (
    <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 shadow-xl animate-pulse">
        <div className="flex justify-between items-center mb-6">
            <div>
                <div className="w-36 h-5 bg-slate-800 rounded mb-2" />
                <div className="w-48 h-3 bg-slate-800 rounded" />
            </div>
            <div className="w-24 h-7 bg-slate-800 rounded-lg" />
        </div>
        <div className="w-full h-[350px] bg-slate-800/10 rounded-xl flex items-end justify-between p-4 gap-2">
            {[...Array(12)].map((_, i) => (
                <div 
                    key={i} 
                    className="bg-slate-800/30 rounded-t-lg w-full" 
                    style={{ height: `${20 + (i * 7) % 70}%` }}
                />
            ))}
        </div>
    </div>
);

const RecentActivitySkeleton = () => (
    <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 flex flex-col animate-pulse">
        <div className="w-40 h-5 bg-slate-800 rounded mb-6" />
        <div className="space-y-6 flex-1">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-4">
                    <div className="w-3.5 h-3.5 rounded-full bg-slate-800 mt-1" />
                    <div className="flex-1 space-y-2">
                        <div className="w-2/3 h-4 bg-slate-800 rounded" />
                        <div className="w-1/3 h-3 bg-slate-800 rounded" />
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const LotTableSkeleton = ({ title, subtitle }: { title: string, subtitle: string }) => (
    <div className="bg-slate-900/30 border border-slate-900 rounded-2xl shadow-xl overflow-hidden animate-pulse">
        <div className="p-6 border-b border-slate-900 flex justify-between items-center">
            <div>
                <h3 className="text-lg font-bold text-slate-100">{title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
            </div>
            <div className="w-24 h-7 bg-slate-800 rounded-full" />
        </div>
        <div className="p-6 space-y-4">
            {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-900/40 last:border-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-800 rounded-xl" />
                        <div className="space-y-2">
                            <div className="w-24 h-4 bg-slate-800 rounded" />
                            <div className="w-16 h-3 bg-slate-800 rounded" />
                        </div>
                    </div>
                    <div className="w-32 h-4 bg-slate-800 rounded" />
                    <div className="w-20 h-6 bg-slate-800 rounded-full" />
                    <div className="w-12 h-5 bg-slate-800 rounded" />
                </div>
            ))}
        </div>
    </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL MEJORADO
// ═══════════════════════════════════════════════════════════════════════════════

export default function DashboardClientImproved() {
    const { user: authUser, loading: authLoading, salesCount } = useAuth();
    const router = useRouter();

    // Estados
    const [stats, setStats] = useState<EnhancedStats | null>(null);
    const [loadingStats, setLoadingStats] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('ytd');
    const [chartView, setChartView] = useState<ChartView>('simple');
    const [showFilters, setShowFilters] = useState(false);
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [generatingGeneralPdf, setGeneratingGeneralPdf] = useState(false);
    const [generatingInvoicesPdf, setGeneratingInvoicesPdf] = useState(false);
    
    // Filtro de fechas personalizadas
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>('');
    // Estado separado para evitar re-fetches en cada tecla
    const [appliedCustomDates, setAppliedCustomDates] = useState<{start: string, end: string}>({start: '', end: ''});
    // Almacenamos las fechas calculadas para pasarlas a los reportes PDF
    const [activeDateRange, setActiveDateRange] = useState<{start?: string, end?: string}>({});

    // Verificar sesión
    useEffect(() => {
        if (!authLoading && !authUser) {
            router.push('/login');
        }
    }, [authUser, authLoading, router]);

    // Cargar datos del dashboard
    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!authUser) return;
            try {
                setLoadingStats(true);
                setError(null);
                
                let startDate: string | undefined = undefined;
                let endDate: string | undefined = undefined;

                const today = new Date();
                const year = today.getFullYear();
                
                const formatDate = (date: Date) => {
                    const y = date.getFullYear();
                    const m = String(date.getMonth() + 1).padStart(2, '0');
                    const d = String(date.getDate()).padStart(2, '0');
                    return `${y}-${m}-${d}`;
                };

                if (periodFilter === '7d') {
                    const date = new Date();
                    date.setDate(today.getDate() - 7);
                    startDate = formatDate(date);
                    endDate = formatDate(today);
                } else if (periodFilter === '30d') {
                    const date = new Date();
                    date.setDate(today.getDate() - 30);
                    startDate = formatDate(date);
                    endDate = formatDate(today);
                } else if (periodFilter === '90d') {
                    const date = new Date();
                    date.setDate(today.getDate() - 90);
                    startDate = formatDate(date);
                    endDate = formatDate(today);
                } else if (periodFilter === '180d') {
                    const date = new Date();
                    date.setDate(today.getDate() - 180);
                    startDate = formatDate(date);
                    endDate = formatDate(today);
                } else if (periodFilter === 'ytd') {
                    startDate = `${year}-01-01`;
                    endDate = formatDate(today);
                } else if (periodFilter === 'custom') {
                    startDate = appliedCustomDates.start || undefined;
                    endDate = appliedCustomDates.end || undefined;
                }
                
                setActiveDateRange({ start: startDate, end: endDate });

                // Aquí se llamaría a una versión mejorada del servicio
                const data = await odooService.getDetailedSalesStats(authUser.uid, startDate, endDate);
                
                let monthsDivisor = 1;
                if (periodFilter === '30d') {
                    monthsDivisor = 1;
                } else if (periodFilter === '90d') {
                    monthsDivisor = 3;
                } else if (periodFilter === '180d') {
                    monthsDivisor = 6;
                } else if (periodFilter === 'ytd') {
                    monthsDivisor = Math.max(1, new Date().getMonth() + 1);
                }

                // Datos reales del backend (ver app/api/odoo/stats/detailed/route.ts):
                // conversionRate/pipelineValue ya no dependen de crm.lead (no existe
                // en este Odoo) y comparison ya no es un +15%/+12%/+8% fijo — ambos
                // se calculan ahí con datos reales de sale.order.
                const enhancedData: EnhancedStats = {
                    ...data,
                    kpis: {
                        ...data.kpis,
                        avgTicket: data.kpis.totalSales / (salesCount || 1),
                        salesVelocity: salesCount / monthsDivisor
                    },
                    comparison: data.comparison
                };
                
                setStats(enhancedData);
            } catch (err: unknown) {
                console.error("Error fetching dashboard statistics:", err);
                setError("Error al cargar los datos del panel. Por favor intente más tarde.");
            } finally {
                setLoadingStats(false);
            }
        };

        fetchDashboardData();
    }, [authUser, periodFilter, appliedCustomDates, salesCount]);

    // Manejadores de eventos
    const handleDownloadReport = useCallback(async () => {
        if (!stats || !authUser || generatingPdf) return;
        setGeneratingPdf(true);
        try {
            // Igual que handleDownloadGeneralReport: el PDF individual del
            // asesor antes nunca decía qué período estaba mostrando (el
            // filtro sí afectaba los números vía `stats`, pero el reporte
            // no dejaba constancia de cuál era el rango). La plantilla
            // (reportService.ts) ya soporta `dateRangeLabel` -- solo faltaba
            // llenarlo acá.
            let dateRangeLabel: string | undefined;
            if (activeDateRange.start || activeDateRange.end) {
                const startLabel = formatToDDMMYY(activeDateRange.start) || 'Inicio';
                const endLabel = formatToDDMMYY(activeDateRange.end) || 'Hoy';
                dateRangeLabel = `${startLabel} al ${endLabel}`;
            }

            const reportData: ReportData = {
                advisor: {
                    name: authUser.name,
                    username: authUser.username,
                },
                kpis: stats.kpis,
                salesTrend: stats.salesTrend,
                assignedLots: stats.assignedLots,
                competedLots: stats.competedLots,
                recentActivity: stats.recentActivity,
                salesCount,
                dateRangeLabel,
                comparison: stats.comparison,
            };
            await generateEnterpriseReport(reportData);
        } catch (err) {
            console.error('Error generating PDF report:', err);
            alert('Error al generar el reporte PDF. Inténtelo de nuevo.');
        } finally {
            setGeneratingPdf(false);
        }
    }, [stats, authUser, generatingPdf, salesCount, activeDateRange]);

    const handleDownloadGeneralReport = useCallback(async () => {
        if (!authUser || !authUser.is_system || generatingGeneralPdf) return;
        setGeneratingGeneralPdf(true);
        try {
            let url = '/api/odoo/stats/general';
            if (activeDateRange.start || activeDateRange.end) {
                const params = new URLSearchParams();
                if (activeDateRange.start) params.append('startDate', activeDateRange.start);
                if (activeDateRange.end) params.append('endDate', activeDateRange.end);
                url += `?${params.toString()}`;
            }

            // 'x-user-id'/'x-is-system' ya no se envían: el servidor los
            // ignoraba desde que estas rutas migraron a requireStaffSession
            // (cookie httpOnly firmada) — mandarlos era código muerto que
            // sugería una autorización que ya no depende de ahí.
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.success && data.stats) {
                // Agregar etiqueta de fecha si existe filtro usando formato dd/mm/yy
                if (activeDateRange.start || activeDateRange.end) {
                    const startLabel = formatToDDMMYY(activeDateRange.start) || 'Inicio';
                    const endLabel = formatToDDMMYY(activeDateRange.end) || 'Hoy';
                    data.stats.dateRangeLabel = `${startLabel} al ${endLabel}`;
                }
                const { generateProjectGeneralReport } = await import('@/app/services/reportService');
                await generateProjectGeneralReport(data.stats);
            } else {
                throw new Error(data.error || 'Failed to fetch general stats');
            }
        } catch (err) {
            console.error('Error generating general PDF report:', err);
            alert('Error al generar el reporte general del proyecto. Inténtelo de nuevo.');
        } finally {
            setGeneratingGeneralPdf(false);
        }
    }, [authUser, generatingGeneralPdf, activeDateRange]);

    const handleDownloadInvoicesReport = useCallback(async () => {
        if (!authUser || !authUser.is_system || generatingInvoicesPdf) return;
        setGeneratingInvoicesPdf(true);
        try {
            let url = '/api/odoo/stats/invoices';
            if (activeDateRange.start || activeDateRange.end) {
                const params = new URLSearchParams();
                if (activeDateRange.start) params.append('startDate', activeDateRange.start);
                if (activeDateRange.end) params.append('endDate', activeDateRange.end);
                url += `?${params.toString()}`;
            }

            // 'x-user-id'/'x-is-system' ya no se envían: el servidor los
            // ignoraba desde que estas rutas migraron a requireStaffSession
            // (cookie httpOnly firmada) — mandarlos era código muerto que
            // sugería una autorización que ya no depende de ahí.
            const response = await fetch(url);
            const data = await response.json();
            if (data.success && data.data) {
                // Forzar la etiqueta de fecha también para facturas
                if (activeDateRange.start || activeDateRange.end) {
                    const startLabel = formatToDDMMYY(activeDateRange.start) || 'Inicio';
                    const endLabel = formatToDDMMYY(activeDateRange.end) || 'Hoy';
                    data.data.dateRangeLabel = `${startLabel} al ${endLabel}`;
                }
                const { generatePaidInvoicesReport } = await import('@/app/services/reportService');
                await generatePaidInvoicesReport(data.data);
            } else {
                throw new Error(data.error || 'Failed to fetch invoices');
            }
        } catch (err) {
            console.error('Error generating invoices PDF report:', err);
            alert('Error al generar el reporte de recaudación. Inténtelo de nuevo.');
        } finally {
            setGeneratingInvoicesPdf(false);
        }
    }, [authUser, generatingInvoicesPdf, activeDateRange]);

    // Cálculos memoizados
    const displayedSalesTrend = useMemo(() => {
        if (!stats) return [];
        return stats.salesTrend;
    }, [stats]);

    const goalPercentage = useMemo(() => {
        if (!stats) return 0;
        return stats.kpis.monthlyGoal > 0
            ? Math.min(100, Math.round((stats.kpis.totalSales / stats.kpis.monthlyGoal) * 100))
            : 0;
    }, [stats]);

    // Insights inteligentes
    const insights = useMemo(() => {
        if (!stats) return [];
        
        const result = [];
        
        // Insight de rendimiento
        if (stats.comparison.totalSales.change > 10) {
            result.push({
                type: 'success' as const,
                icon: <Sparkles size={18} />,
                message: `¡Excelente! Vas ${stats.comparison.totalSales.change}% arriba vs. período anterior. Mantén este ritmo.`
            });
        }
        
        // Insight de cotizaciones pendientes
        if (stats.kpis.pendingLeads > 5) {
            result.push({
                type: 'warning' as const,
                icon: <AlertTriangle size={18} />,
                message: `Tienes ${stats.kpis.pendingLeads} cotizaciones activas. Considera priorizar seguimiento para maximizar conversión.`
            });
        }
        
        // Insight de meta
        const remaining = stats.kpis.monthlyGoal - stats.kpis.totalSales;
        if (remaining > 0 && remaining < stats.kpis.monthlyGoal * 0.2) {
            result.push({
                type: 'info' as const,
                icon: <Target size={18} />,
                message: `Estás cerca de tu meta. Solo ${(remaining / stats.kpis.avgTicket).toFixed(0)} lotes más para alcanzar el objetivo.`
            });
        }
        
        return result;
    }, [stats]);

    // Estados de carga — carga inicial (sin datos): desplegar Skeleton Layout completo
    if (authLoading || (loadingStats && !stats)) {
        return (
            <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 relative overflow-hidden">
                <div className="absolute top-[-100px] left-1/4 w-[450px] h-[450px] bg-indigo-500/10 rounded-full blur-[140px] pointer-events-none" />
                <div className="absolute bottom-[100px] right-1/4 w-[450px] h-[450px] bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none" />
                <div className="max-w-7xl mx-auto relative z-10 space-y-8">
                    {/* Header Skeleton */}
                    <div className="flex justify-between items-center pb-6 border-b border-slate-900 animate-pulse">
                        <div className="space-y-2">
                            <div className="w-40 h-3 bg-slate-800 rounded" />
                            <div className="w-72 h-9 bg-slate-800 rounded-lg" />
                            <div className="w-56 h-3 bg-slate-800 rounded" />
                        </div>
                        <div className="flex gap-3">
                            <div className="w-24 h-10 bg-slate-800 rounded-xl" />
                            <div className="w-24 h-10 bg-slate-800 rounded-xl" />
                            <div className="w-28 h-10 bg-slate-800 rounded-xl" />
                        </div>
                    </div>
                    {/* KPI Skeletons */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        <KPICardSkeleton />
                        <KPICardSkeleton />
                        <KPICardSkeleton />
                        <KPICardSkeleton />
                    </div>
                    {/* Chart + Activity Skeletons */}
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                        <div className="xl:col-span-2"><ChartSkeleton /></div>
                        <RecentActivitySkeleton />
                    </div>
                    {/* Table Skeletons */}
                    <LotTableSkeleton title="Mis Lotes Vendidos" subtitle="Cargando operaciones..." />
                    <LotTableSkeleton title="Mis Lotes Operacionales" subtitle="Cargando lotes activos..." />
                </div>
            </div>
        );
    }

    if (error || !stats) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-slate-950 p-4 text-center">
                <div className="bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-md w-full relative">
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-20 h-20 bg-red-950/80 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center shadow-xl">
                        <Clock size={36} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-100 mt-8 mb-2">Error de Conexión</h2>
                    <p className="text-slate-400 mb-6 text-sm leading-relaxed">{error || "No se pudieron cargar las estadísticas."}</p>
                    <button 
                        onClick={() => window.location.reload()} 
                        className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold py-3 px-6 rounded-xl transition-all"
                    >
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    const currentUser = authUser!;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 relative overflow-hidden">
            {/* SWR Revalidation Top Bar — sutil indicador cuando hay datos previos y se recarga */}
            {loadingStats && stats && (
                <div className="fixed top-0 left-0 right-0 z-50 h-[3px] overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-[shimmer_1.5s_ease-in-out_infinite] bg-[length:200%_100%]" />
                </div>
            )}
            {/* Background Decorative Blurs */}
            <div className="absolute top-[-100px] left-1/4 w-[450px] h-[450px] bg-indigo-500/10 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-[100px] right-1/4 w-[450px] h-[450px] bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none" />

            <div className="max-w-7xl mx-auto relative z-10 space-y-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-slate-900">
                    <div>
                        <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm mb-1">
                            <Award size={18} /> Dashboard Ejecutivo Mejorado
                            {/* Micro-spinner SWR junto al título durante recarga silenciosa */}
                            {loadingStats && stats && (
                                <span className="ml-2 flex items-center gap-1.5 text-xs text-slate-500 font-normal">
                                    <Loader2 size={12} className="animate-spin" /> Actualizando...
                                </span>
                            )}
                        </div>
                        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">
                            Hola, {currentUser.name} 👋
                        </h1>
                        <p className="text-sm text-slate-400 mt-1">Panel de control con métricas avanzadas y análisis inteligente</p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button 
                            onClick={() => setShowFilters(!showFilters)}
                            className={`${showFilters ? 'bg-indigo-600' : 'bg-slate-900'} hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-slate-100 px-5 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2`}
                        >
                            <Filter size={18} /> Filtros
                        </button>
                        
                        <button 
                            onClick={() => router.push('/')} 
                            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-slate-100 px-5 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2"
                        >
                            <MapPin size={18} /> Mapa
                        </button>
                        
                        <button 
                            onClick={handleDownloadReport}
                            disabled={generatingPdf}
                            className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 disabled:from-indigo-800 disabled:to-indigo-900 disabled:cursor-wait text-white px-5 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2"
                        >
                            {generatingPdf ? (
                                <><Loader2 size={16} className="animate-spin" /> Generando...</>
                            ) : (
                                <><FileDown size={16} /> Reporte</>
                            )}
                        </button>

                        {authUser?.is_system && (
                            <>
                                <button 
                                    onClick={handleDownloadGeneralReport}
                                    disabled={generatingGeneralPdf}
                                    className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 disabled:from-purple-800 disabled:to-purple-900 text-white px-5 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2"
                                >
                                    {generatingGeneralPdf ? (
                                        <><Loader2 size={16} className="animate-spin" /> Generando...</>
                                    ) : (
                                        <><Award size={16} /> Proyecto</>
                                    )}
                                </button>
                                <button 
                                    onClick={handleDownloadInvoicesReport}
                                    disabled={generatingInvoicesPdf}
                                    className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 disabled:from-emerald-800 disabled:to-emerald-900 text-white px-5 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2"
                                >
                                    {generatingInvoicesPdf ? (
                                        <><Loader2 size={16} className="animate-spin" /> Generando...</>
                                    ) : (
                                        <><DollarSign size={16} /> Recaudación</>
                                    )}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Filtros de Período (Collapsible) */}
                {showFilters && (
                    <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-6 animate-in slide-in-from-top-2 duration-200">
                        <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                            <Calendar size={16} className="text-indigo-400" />
                            Período de Análisis
                        </h3>
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { value: '7d' as PeriodFilter, label: 'Últimos 7 Días' },
                                    { value: '30d' as PeriodFilter, label: 'Último Mes' },
                                    { value: '90d' as PeriodFilter, label: 'Último Trimestre' },
                                    { value: '180d' as PeriodFilter, label: 'Últimos 6 Meses' },
                                    { value: 'ytd' as PeriodFilter, label: 'Año Actual' },
                                    { value: 'custom' as PeriodFilter, label: 'Rango Personalizado' },
                                ].map((period) => (
                                    <button
                                        key={period.value}
                                        onClick={() => setPeriodFilter(period.value)}
                                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                            periodFilter === period.value
                                                ? 'bg-indigo-600 text-white shadow-lg'
                                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                        }`}
                                    >
                                        {period.label}
                                    </button>
                                ))}
                            </div>

                            {periodFilter === 'custom' && (
                                <div className="flex items-center gap-3 bg-slate-800/50 p-2 rounded-xl border border-slate-700/50">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-400 font-medium">Desde:</span>
                                        <input 
                                            type="date" 
                                            value={customStartDate}
                                            onChange={(e) => setCustomStartDate(e.target.value)}
                                            style={{ colorScheme: 'dark' }}
                                            className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-500 w-36 cursor-pointer"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-400 font-medium">Hasta:</span>
                                        <input 
                                            type="date" 
                                            value={customEndDate}
                                            onChange={(e) => setCustomEndDate(e.target.value)}
                                            style={{ colorScheme: 'dark' }}
                                            className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-500 w-36 cursor-pointer"
                                        />
                                    </div>
                                    <button
                                        onClick={() => setAppliedCustomDates({ start: customStartDate, end: customEndDate })}
                                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition-all shadow-md"
                                    >
                                        Aplicar
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* KPI Cards Grid Mejorado - Ahora con 6 KPIs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <KPICard
                        label="Ventas Totales"
                        value={`S/ ${stats.kpis.totalSales.toLocaleString('es-PE')}`}
                        icon={<DollarSign size={22} />}
                        color="emerald"
                        change={stats.comparison.totalSales.change}
                        trend={stats.comparison.totalSales.trend}
                        subtitle={`${salesCount} lotes vendidos · ${new Date().getFullYear()}`}
                    />
                    
                    <KPICard
                        label="Ticket Promedio"
                        value={`S/ ${Math.round(stats.kpis.avgTicket).toLocaleString('es-PE')}`}
                        icon={<BarChart3 size={22} />}
                        color="indigo"
                        subtitle="Valor promedio por lote"
                    />
                    
                    <KPICard
                        label="Comisión Acumulada"
                        value={`S/ ${stats.kpis.commission.toLocaleString('es-PE')}`}
                        icon={<TrendingUp size={22} />}
                        color="purple"
                        change={stats.comparison.commission.change}
                        trend={stats.comparison.commission.trend}
                        subtitle={`Tasa ${Math.round(stats.kpis.commissionRate * 100)}% sobre ventas`}
                    />
                    
                    <KPICard
                        label="Pipeline Value"
                        value={`S/ ${Math.round(stats.kpis.pipelineValue).toLocaleString('es-PE')}`}
                        icon={<Activity size={22} />}
                        color="blue"
                        subtitle={`${stats.kpis.pendingLeads} cotizaciones activas`}
                    />
                    
                    <KPICard
                        label="Tasa de Conversión"
                        value={`${stats.kpis.conversionRate}%`}
                        icon={<Target size={22} />}
                        color="amber"
                        subtitle="Cotizaciones → Ventas"
                    />
                    
                    <KPICard
                        label="Velocidad de Ventas"
                        value={`${stats.kpis.salesVelocity.toFixed(1)} lotes/mes`}
                        icon={<Zap size={22} />}
                        color="emerald"
                        subtitle="Promedio último trimestre"
                    />
                </div>

                {/* Panel de Insights Inteligentes */}
                {insights.length > 0 && (
                    <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 space-y-3">
                        <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
                            <Sparkles size={18} className="text-indigo-400" /> Insights Inteligentes
                        </h3>
                        {insights.map((insight, idx) => (
                            <Insight key={idx} type={insight.type} icon={insight.icon}>
                                {insight.message}
                            </Insight>
                        ))}
                    </div>
                )}

                {/* Sección de Gráficos Mejorada */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Gráfico Principal Mejorado */}
                    <div className="lg:col-span-2 bg-slate-900/30 border border-slate-900 rounded-2xl p-6 shadow-xl">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-100">Análisis de Ventas</h3>
                                <p className="text-xs text-slate-400 mt-0.5">Ventas, metas y comisiones por mes</p>
                            </div>
                            <div className="flex bg-slate-950 border border-slate-850 rounded-lg p-1">
                                <button 
                                    onClick={() => setChartView('simple')}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                                        chartView === 'simple' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    Simple
                                </button>
                                <button 
                                    onClick={() => setChartView('detailed')}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                                        chartView === 'detailed' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    Detallado
                                </button>
                            </div>
                        </div>
                        <div className="h-[400px] w-full">
                            {chartView === 'simple' ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={displayedSalesTrend} margin={{ top: 10, right: 10, left: 10, bottom: 40 }}>
                                        <defs>
                                            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" opacity={0.5} />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={formatAxisCurrency} width={60} />
                                        <Tooltip content={<EnhancedTooltip />} cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                        <Area type="monotone" dataKey="ventas" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSales)" dot={{ fill: '#6366f1', r: 3 }} activeDot={{ r: 5, fill: '#818cf8' }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={displayedSalesTrend} margin={{ top: 10, right: 10, left: 10, bottom: 40 }}>
                                        <defs>
                                            <linearGradient id="colorSalesDetailed" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" opacity={0.5} />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={formatAxisCurrency} width={60} />
                                        <Tooltip content={<EnhancedTooltip />} />
                                        <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                                        <Area type="monotone" dataKey="ventas" name="Ventas" stroke="#6366f1" strokeWidth={2} fill="url(#colorSalesDetailed)" />
                                        <Line type="monotone" dataKey="meta" name="Meta" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: '#f59e0b', r: 3 }} />
                                        <Bar dataKey="comision" name="Comisión" fill="#10b981" opacity={0.6} />
                                        <Brush dataKey="name" height={30} stroke="#6366f1" fill="#0f172a" />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* Actividad Reciente */}
                    <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 flex flex-col">
                        <h3 className="text-lg font-bold text-slate-100 mb-6 flex items-center gap-2">
                            <Clock size={18} className="text-indigo-400 animate-pulse" /> Actividad Reciente
                        </h3>
                        <div className="space-y-6 max-h-[350px] overflow-y-auto flex-1 pr-1">
                            {stats.recentActivity.length === 0 ? (
                                <div className="text-center py-8 text-slate-500 text-sm">
                                    No hay actividad registrada
                                </div>
                            ) : (
                                stats.recentActivity.map((activity, idx) => (
                                    <div key={activity.id || idx} className="flex gap-4 relative">
                                        <div className={`flex-shrink-0 w-3.5 h-3.5 mt-1.5 rounded-full ${
                                            activity.action === 'Venta' ? 'bg-emerald-500' :
                                            activity.action === 'Reserva' ? 'bg-amber-500' : 'bg-indigo-500'
                                        } ring-4 ring-slate-950 z-10`} />
                                        {idx < stats.recentActivity.length - 1 && (
                                            <div className="absolute left-[6px] top-4 bottom-[-24px] w-[1px] bg-slate-800" />
                                        )}
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold text-slate-200">
                                                {activity.action} - <span className="text-indigo-300">{activity.lot}</span>
                                            </p>
                                            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-400">
                                                <Clock size={11} />
                                                <span>{activity.date}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Lotes Competidos - código existente */}
                {stats.competedLots.length > 0 && (
                    <div className="bg-gradient-to-br from-amber-950/20 to-red-950/10 rounded-2xl border border-amber-500/20 shadow-2xl overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />
                        <div className="p-6 border-b border-amber-500/10 bg-amber-500/5 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-amber-950/60 border border-amber-500/20 text-amber-400 rounded-xl animate-pulse">
                                    <Zap size={20} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-bold text-amber-300">⚡ Lotes Competidos en Caliente</h3>
                                        <span className="flex h-2.5 w-2.5 relative">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400">Propiedades con cotizaciones borrador paralelas</p>
                                </div>
                            </div>
                            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3.5 py-1 rounded-full text-xs font-bold tracking-wide">
                                {stats.competedLots.length} {stats.competedLots.length === 1 ? 'Lote' : 'Lotes'}
                            </span>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {stats.competedLots.map((item, idx) => (
                                <div key={idx} className="bg-slate-950/50 border border-slate-850 hover:border-amber-500/30 rounded-xl p-5 shadow-lg relative group transition-colors">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="text-base font-bold text-slate-100">{item.lot}</p>
                                            <p className="text-xs text-slate-400">{item.stage}</p>
                                        </div>
                                        <span className="bg-red-500/10 text-red-400 border border-red-500/25 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                                            {item.quotes.length} Cotizaciones
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        {item.quotes.map((quote, qIdx) => (
                                            <div key={qIdx} className="flex justify-between items-center text-xs bg-slate-900/60 p-2.5 rounded-lg border border-slate-850">
                                                <div>
                                                    <span className="font-semibold text-slate-200">{quote.client}</span>
                                                    <span className="text-slate-400 text-[10px] ml-1.5 block sm:inline">· {quote.advisor}</span>
                                                </div>
                                                <span className="text-[10px] text-amber-400 flex items-center gap-1 font-medium bg-amber-950/20 px-2 py-0.5 rounded border border-amber-500/10">
                                                    <Clock size={9} />
                                                    {formatHoursElapsed(quote.hours)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Nueva Sección: Mis Lotes Vendidos */}
                <div className="bg-gradient-to-br from-emerald-950/20 to-green-950/10 rounded-2xl border border-emerald-500/20 shadow-2xl overflow-hidden">
                    <div className="p-6 border-b border-emerald-500/10 bg-emerald-500/5 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-950/60 border border-emerald-500/20 text-emerald-400 rounded-xl">
                                <Award size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-emerald-300">🏆 Mis Lotes Vendidos</h3>
                                <p className="text-xs text-slate-400">Historial completo de ventas confirmadas</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3.5 py-1 rounded-full text-xs font-bold">
                                {stats.assignedLots.filter(lot => lot.status === 'Vendido').length} Ventas
                            </span>
                            <button
                                onClick={() => router.push('/')}
                                className="text-emerald-400 hover:text-emerald-300 text-xs font-bold hover:underline"
                            >
                                Ver en Mapa
                            </button>
                        </div>
                    </div>
                    
                    {/* Vista Desktop: tabla */}
                    <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-emerald-950/60 text-emerald-300 text-xs font-semibold uppercase tracking-wider border-b border-emerald-500/20">
                                    <th className="px-6 py-4 text-left">#</th>
                                    <th className="px-6 py-4 text-left">Lote</th>
                                    <th className="px-6 py-4 text-left">Cliente</th>
                                    <th className="px-6 py-4 text-right">Precio Venta</th>
                                    <th className="px-6 py-4 text-right">Comisión {Math.round(stats.kpis.commissionRate * 100)}%</th>
                                    <th className="px-6 py-4 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-emerald-500/10">
                                {stats.assignedLots.filter(lot => lot.status === 'Vendido').length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500 text-sm">
                                            Aún no tienes lotes vendidos registrados.
                                        </td>
                                    </tr>
                                ) : (
                                    stats.assignedLots
                                        .filter(lot => lot.status === 'Vendido')
                                        .map((item, idx) => (
                                            <tr key={idx} className="hover:bg-emerald-950/10 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="w-8 h-8 rounded-full bg-emerald-950/50 text-emerald-400 border border-emerald-500/20 flex items-center justify-center text-xs font-bold">
                                                        {idx + 1}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-emerald-950/50 text-emerald-400 border border-emerald-500/10 p-2 rounded-xl">
                                                            <MapPin size={16} />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-emerald-200 text-sm">{item.lot}</p>
                                                            <p className="text-[10px] text-emerald-400/60">{item.stage}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-7 h-7 rounded-full bg-emerald-950/50 text-emerald-300 flex items-center justify-center text-[10px] font-bold border border-emerald-500/20">
                                                            {item.client.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                                                        </div>
                                                        <span className="text-slate-200 text-sm font-medium">{item.client}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="text-base font-bold text-emerald-200">
                                                        S/ {item.price.toLocaleString('es-PE')}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-sm font-bold text-emerald-400">
                                                            S/ {Math.round(item.price * stats.kpis.commissionRate).toLocaleString('es-PE')}
                                                        </span>
                                                        <span className="text-[10px] text-emerald-500/60">Tasa {Math.round(stats.kpis.commissionRate * 100)}%</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <button
                                                        onClick={() => router.push('/')}
                                                        className="text-emerald-400 hover:text-emerald-300 transition-colors p-2 hover:bg-emerald-950/30 rounded-lg"
                                                    >
                                                        <ArrowUpRight size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Vista Mobile: tarjetas adaptadas */}
                    <div className="block sm:hidden divide-y divide-emerald-500/10">
                        {stats.assignedLots.filter(lot => lot.status === 'Vendido').length === 0 ? (
                            <p className="p-6 text-center text-slate-500 text-sm">Aún no tienes lotes vendidos registrados.</p>
                        ) : (
                            stats.assignedLots.filter(lot => lot.status === 'Vendido').map((item, idx) => (
                                <div key={idx} className="p-4 hover:bg-emerald-950/10 transition-colors">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-emerald-950/50 text-emerald-300 border border-emerald-500/20 flex items-center justify-center text-xs font-bold shrink-0">
                                                {item.client.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                                            </div>
                                            <div>
                                                <p className="font-bold text-emerald-200 text-sm leading-tight">{item.lot}</p>
                                                <p className="text-xs text-slate-400 mt-0.5">{item.client}</p>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-sm font-bold text-emerald-300">S/ {item.price.toLocaleString('es-PE')}</p>
                                            <p className="text-[10px] text-emerald-500 mt-0.5">Com. S/ {Math.round(item.price * stats.kpis.commissionRate).toLocaleString('es-PE')}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between mt-3">
                                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400/60">
                                            <MapPin size={10}/> {item.stage}
                                        </span>
                                        <button onClick={() => router.push('/')} className="text-[10px] text-emerald-400 font-bold hover:underline flex items-center gap-1">
                                            Ver en mapa <ArrowUpRight size={11}/>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    
                    {/* Resumen de ventas */}
                    {stats.assignedLots.filter(lot => lot.status === 'Vendido').length > 0 && (
                        <div className="p-6 border-t border-emerald-500/10 bg-emerald-950/20">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="flex items-center justify-between p-4 bg-emerald-950/30 rounded-xl border border-emerald-500/20">
                                    <div>
                                        <p className="text-[10px] text-emerald-400/60 uppercase font-bold mb-1">Total Vendido</p>
                                        <p className="text-lg font-bold text-emerald-300">
                                            S/ {stats.assignedLots
                                                .filter(lot => lot.status === 'Vendido')
                                                .reduce((sum, lot) => sum + lot.price, 0)
                                                .toLocaleString('es-PE')}
                                        </p>
                                    </div>
                                    <DollarSign className="text-emerald-400/40" size={32} />
                                </div>
                                
                                <div className="flex items-center justify-between p-4 bg-emerald-950/30 rounded-xl border border-emerald-500/20">
                                    <div>
                                        <p className="text-[10px] text-emerald-400/60 uppercase font-bold mb-1">Comisión Total</p>
                                        <p className="text-lg font-bold text-emerald-300">
                                            S/ {Math.round(stats.assignedLots
                                                .filter(lot => lot.status === 'Vendido')
                                                .reduce((sum, lot) => sum + (lot.price * stats.kpis.commissionRate), 0))
                                                .toLocaleString('es-PE')}
                                        </p>
                                    </div>
                                    <TrendingUp className="text-emerald-400/40" size={32} />
                                </div>
                                
                                <div className="flex items-center justify-between p-4 bg-emerald-950/30 rounded-xl border border-emerald-500/20">
                                    <div>
                                        <p className="text-[10px] text-emerald-400/60 uppercase font-bold mb-1">Ticket Promedio</p>
                                        <p className="text-lg font-bold text-emerald-300">
                                            S/ {Math.round(stats.assignedLots
                                                .filter(lot => lot.status === 'Vendido')
                                                .reduce((sum, lot) => sum + lot.price, 0) /
                                                Math.max(stats.assignedLots.filter(lot => lot.status === 'Vendido').length, 1))
                                                .toLocaleString('es-PE')}
                                        </p>
                                    </div>
                                    <Target className="text-emerald-400/40" size={32} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Lotes Operacionales - Solo EN PROCESO (no vendidos) */}
                <div className="bg-slate-900/30 border border-slate-900 rounded-2xl shadow-xl overflow-hidden">
                    <div className="p-6 border-b border-slate-900 flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-bold text-slate-100">Mis Lotes Operacionales (En Proceso)</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Cotizaciones y reservas activas que aún no se han completado</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3.5 py-1 rounded-full text-xs font-bold tracking-wide">
                                {stats.assignedLots.filter(lot => isLotEnProceso(lot.status)).length} En Proceso
                            </span>
                            <button
                                onClick={() => router.push('/')}
                                className="text-indigo-400 hover:text-indigo-300 text-xs font-bold hover:underline"
                            >
                                Ver en Mapa
                            </button>
                        </div>
                    </div>
                    {/* Vista Desktop: tabla */}
                    <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-950/60 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-900">
                                    <th className="px-6 py-4 text-left">Lote</th>
                                    <th className="px-6 py-4 text-left">Cliente</th>
                                    <th className="px-6 py-4 text-left">Estado</th>
                                    <th className="px-6 py-4 text-left">Monto</th>
                                    <th className="px-6 py-4 text-right">Detalle</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900">
                                {stats.assignedLots.filter(lot => isLotEnProceso(lot.status)).length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500 text-sm">
                                            No tienes lotes en proceso. ¡Todas tus transacciones están completadas!
                                        </td>
                                    </tr>
                                ) : (
                                    stats.assignedLots
                                        .filter(lot => isLotEnProceso(lot.status))
                                        .map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-900/20 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-indigo-950/50 text-indigo-400 border border-indigo-500/10 p-2 rounded-xl">
                                                        <MapPin size={16} />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-slate-200 text-sm">{item.lot}</p>
                                                        <p className="text-[10px] text-slate-400">{item.stage}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-slate-300 text-sm">{item.client}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold border ${
                                                    item.status === 'Vendido' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20' :
                                                    item.status === 'Separado' ? 'bg-amber-950/40 text-amber-400 border-amber-500/20' :
                                                    'bg-indigo-950/40 text-indigo-400 border-indigo-500/20'
                                                }`}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-semibold text-slate-200">
                                                S/ {item.price.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => router.push('/')}
                                                    className="text-slate-400 hover:text-indigo-400 transition-colors p-1.5 hover:bg-slate-900 rounded-lg"
                                                >
                                                    <ArrowUpRight size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Vista Mobile: tarjetas adaptadas */}
                    <div className="block sm:hidden divide-y divide-slate-900">
                        {stats.assignedLots.filter(lot => isLotEnProceso(lot.status)).length === 0 ? (
                            <p className="p-6 text-center text-slate-500 text-sm">No tienes lotes en proceso activos.</p>
                        ) : (
                            stats.assignedLots.filter(lot => isLotEnProceso(lot.status)).map((item, idx) => (
                                <div key={idx} className="p-4 hover:bg-slate-900/20 transition-colors">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-indigo-950/50 text-indigo-400 border border-indigo-500/20 p-2.5 rounded-xl shrink-0">
                                                <MapPin size={16}/>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-200 text-sm leading-tight">{item.lot}</p>
                                                <p className="text-xs text-slate-400 mt-0.5">{item.client}</p>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-sm font-bold text-slate-100">S/ {item.price.toLocaleString()}</p>
                                            <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                                item.status === 'Separado' ? 'bg-amber-950/40 text-amber-400 border-amber-500/20' :
                                                'bg-indigo-950/40 text-indigo-400 border-indigo-500/20'
                                            }`}>{item.status}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between mt-3">
                                        <span className="text-[10px] text-slate-500">{item.stage}</span>
                                        <button onClick={() => router.push('/')} className="text-[10px] text-indigo-400 font-bold hover:underline flex items-center gap-1">
                                            Ver en mapa <ArrowUpRight size={11}/>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
