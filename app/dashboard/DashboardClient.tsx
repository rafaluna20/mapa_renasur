'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
    DollarSign, TrendingUp, Users, Target, ArrowUpRight,
    MapPin, Clock, Loader2, Award, Zap, FileDown, RefreshCw
} from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { odooService } from '@/app/services/odooService';
import { generateEnterpriseReport, generateProjectGeneralReport, type ReportData } from '@/app/services/reportService';
import { useRouter } from 'next/navigation';
import { useDashboardData } from '@/app/hooks/useDashboardData';
import { usePersistedState } from '@/app/hooks/usePersistedState';
import DashboardSkeleton from '@/app/components/Dashboard/DashboardSkeleton';
import { InfoTooltip } from '@/app/components/UI/InfoTooltip';
import ReportPeriodModal from '@/app/components/UI/ReportPeriodModal';

// ── CRÍTICO: CustomTooltip DEBE estar fuera del componente padre.
// Si se define dentro del render, Recharts lo trata como un nuevo tipo en cada
// re-render y destruye la visualización del gráfico.
interface CustomTooltipProps {
    active?: boolean;
    payload?: { value: number; payload: { name: string } }[];
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900/95 border border-indigo-500/40 backdrop-blur-md p-3.5 rounded-xl shadow-2xl">
                <p className="text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-1">
                    {payload[0].payload.name} · 2026
                </p>
                <p className="text-base font-bold text-emerald-400">
                    S/ {payload[0].value.toLocaleString('es-PE')}
                </p>
            </div>
        );
    }
    return null;
};

export default function DashboardClient() {
    const { user: authUser, loading: authLoading, salesCount } = useAuth();
    const router = useRouter();

    // ✅ MEJORA 1: Usar hook personalizado con validación y polling automático
    const {
        stats,
        loading: loadingStats,
        error,
        lastUpdate,
        refresh
    } = useDashboardData({
        userId: authUser?.uid || 0,
        pollingInterval: 30000, // 30 segundos
        enablePolling: true,
    });

    // ✅ MEJORA 2: Persistir preferencias del usuario
    const [chartTimeframe, setChartTimeframe] = usePersistedState<'6m' | '12m'>(
        'dashboard-chart-timeframe',
        '6m'
    );
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [generatingGeneralPdf, setGeneratingGeneralPdf] = useState(false);
    const [reportModalType, setReportModalType] = useState<'individual' | 'general' | null>(null);

    // Handler para generar reporte PDF empresarial
    const handleDownloadReport = async (startDate?: string, endDate?: string, label?: string) => {
        if (!authUser || generatingPdf) return;
        setGeneratingPdf(true);
        try {
            // Obtener estadísticas específicas para el rango de fechas seleccionado
            const detailedStats = await odooService.getDetailedSalesStats(authUser.uid, startDate, endDate);

            const reportData: ReportData = {
                advisor: {
                    name: authUser.name,
                    username: authUser.username,
                },
                kpis: detailedStats.kpis,
                salesTrend: detailedStats.salesTrend,
                assignedLots: detailedStats.assignedLots,
                competedLots: detailedStats.competedLots,
                recentActivity: detailedStats.recentActivity,
                salesCount: detailedStats.assignedLots.filter(l => l.status === 'vendido').length || salesCount,
                dateRangeLabel: label,
            };
            await generateEnterpriseReport(reportData);
            setReportModalType(null);
        } catch (err) {
            console.error('Error generating PDF report:', err);
            alert('Error al generar el reporte PDF. Inténtelo de nuevo.');
        } finally {
            setGeneratingPdf(false);
        }
    };

    // Handler para generar reporte general del proyecto completo
    const handleDownloadGeneralReport = async (startDate?: string, endDate?: string, label?: string) => {
        if (!authUser || !authUser.is_system || generatingGeneralPdf) return;
        setGeneratingGeneralPdf(true);
        try {
            const generalStats = await odooService.getGeneralProjectStats(authUser.uid, authUser.is_system, startDate, endDate);
            await generateProjectGeneralReport({
                ...generalStats,
                dateRangeLabel: label
            });
            setReportModalType(null);
        } catch (err) {
            console.error('Error generating general PDF report:', err);
            alert('Error al generar el reporte general del proyecto. Inténtelo de nuevo.');
        } finally {
            setGeneratingGeneralPdf(false);
        }
    };

    // 1. Verify active salesperson session
    useEffect(() => {
        if (!authLoading && !authUser) {
            router.push('/login');
        }
    }, [authUser, authLoading, router]);

    // ✅ MEJORA 3: Usar skeleton loader mejorado en lugar de spinner simple
    if (authLoading || (loadingStats && !stats)) {
        return <DashboardSkeleton />;
    }

    // Error State - Solo mostrar si hay error y no tenemos datos en cache
    if (error && !stats) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-slate-950 p-4 text-center">
                <div className="bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-md w-full relative">
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-20 h-20 bg-red-950/80 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center shadow-xl">
                        <Clock size={36} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-100 mt-8 mb-2">Fallo en la Sincronización</h2>
                    <p className="text-slate-400 mb-6 text-sm leading-relaxed">{error}</p>
                    <button
                        onClick={refresh}
                        className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-indigo-950/50 hover:shadow-indigo-500/10"
                    >
                        Reintentar Conexión
                    </button>
                </div>
            </div>
        );
    }

    // Si no hay stats aún pero no hay error, mostrar skeleton
    if (!stats) {
        return <DashboardSkeleton />;
    }

    const currentUser = authUser!;

    // ✅ MEJORA 4: Memoizar cálculos complejos para mejor performance
    const displayedSalesTrend = useMemo(() => {
        if (!stats) return [];
        const currentMonthIndex = new Date().getMonth();
        const last6Start = Math.max(0, currentMonthIndex - 5);
        return chartTimeframe === '6m'
            ? stats.salesTrend.slice(last6Start, currentMonthIndex + 1)
            : stats.salesTrend;
    }, [stats, chartTimeframe]);

    const yAxisDomain = useMemo<[number, number]>(() => {
        if (!displayedSalesTrend.length) return [0, 100000];
        const maxSalesValue = Math.max(...displayedSalesTrend.map(d => d.ventas), 0);
        return maxSalesValue > 0
            ? [0, Math.ceil(maxSalesValue * 1.2)]
            : [0, 100000];
    }, [displayedSalesTrend]);

    const goalPercentage = useMemo(() => {
        if (!stats) return 0;
        return stats.kpis.monthlyGoal > 0
            ? Math.min(100, Math.round((stats.kpis.totalSales / stats.kpis.monthlyGoal) * 100))
            : 0;
    }, [stats]);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 relative overflow-hidden">
            {/* Background Decorative Blurs */}
            <div className="absolute top-[-100px] left-1/4 w-[450px] h-[450px] bg-indigo-500/10 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-[100px] right-1/4 w-[450px] h-[450px] bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none" />

            <div className="max-w-7xl mx-auto relative z-10 space-y-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-slate-900">
                    <div>
                        <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm mb-1">
                            <Award size={18} /> Asesor Comercial Terra Lima
                        </div>
                        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">
                            Hola, {currentUser.name} 👋
                        </h1>
                        <div className="flex items-center gap-3 mt-2">
                            <p className="text-sm text-slate-400">Supervisa tus ventas, comisiones y cotizaciones en curso.</p>
                            {/* ✅ MEJORA 5: Indicador de última actualización */}
                            {lastUpdate && (
                                <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-900/40 px-3 py-1.5 rounded-full border border-slate-800">
                                    <Clock size={12} />
                                    <span>
                                        Actualizado: {lastUpdate.toLocaleTimeString('es-PE', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            second: '2-digit'
                                        })}
                                    </span>
                                    <button
                                        onClick={refresh}
                                        className="text-indigo-400 hover:text-indigo-300 transition-colors ml-1"
                                        title="Actualizar datos manualmente"
                                    >
                                        <RefreshCw size={12} className={loadingStats ? 'animate-spin' : ''} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button 
                            onClick={() => router.push('/')} 
                            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-slate-100 px-5 py-2.5 rounded-xl font-semibold transition-all hover:scale-[1.02] active:scale-95 shadow-lg flex items-center gap-2"
                        >
                            <MapPin size={18} /> Volver al Mapa
                        </button>
                        <button 
                            onClick={() => setReportModalType('individual')}
                            disabled={generatingPdf || generatingGeneralPdf}
                            className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 disabled:from-indigo-800 disabled:to-indigo-900 disabled:cursor-wait text-white px-5 py-2.5 rounded-xl font-semibold transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-indigo-950/50 hover:shadow-indigo-500/10 flex items-center gap-2"
                        >
                            {generatingPdf ? (
                                <><Loader2 size={16} className="animate-spin" /> Generando PDF...</>
                            ) : (
                                <><FileDown size={16} /> Mi Reporte</>
                            )}
                        </button>
                        {authUser?.is_system && (
                            <button 
                                onClick={() => setReportModalType('general')}
                                disabled={generatingGeneralPdf || generatingPdf}
                                className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 disabled:from-purple-800 disabled:to-purple-900 disabled:cursor-wait text-white px-5 py-2.5 rounded-xl font-semibold transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-purple-950/50 hover:shadow-purple-500/10 flex items-center gap-2"
                            >
                                {generatingGeneralPdf ? (
                                    <><Loader2 size={16} className="animate-spin" /> Generando Proyecto...</>
                                ) : (
                                    <><Award size={16} /> Reporte del Proyecto</>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* KPI Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Ventas Totales KPI */}
                    <div className="bg-slate-900/40 border border-slate-850 hover:border-emerald-500/30 hover:shadow-[0_0_20px_rgba(16,185,129,0.05)] rounded-2xl p-6 relative overflow-hidden transition-all duration-300 group">
                        <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-emerald-500/5 to-transparent opacity-50" />
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-emerald-950/60 text-emerald-400 rounded-xl border border-emerald-500/20 group-hover:scale-110 transition-transform">
                                <DollarSign size={22} />
                            </div>
                            {/* Badge unificado: usa salesCount del contexto como contador de lotes rápido */}
                            <span className="flex items-center text-xs font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-500/10">
                                {salesCount} Lotes Vendidos
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Ventas {new Date().getFullYear()}</p>
                            <InfoTooltip
                                content="Suma total de todas las ventas confirmadas desde enero hasta la fecha. Se actualiza automáticamente cada 30 segundos."
                                side="top"
                            />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-100 mt-1">
                            S/ {stats.kpis.totalSales.toLocaleString('es-PE')}
                        </h3>
                        <p className="text-[10px] text-slate-500 mt-1">Enero – {new Date().toLocaleString('es-PE', { month: 'long' })} {new Date().getFullYear()}</p>
                    </div>

                    {/* Meta Mensual KPI */}
                    <div className="bg-slate-900/40 border border-slate-850 hover:border-amber-500/30 hover:shadow-[0_0_20px_rgba(245,158,11,0.05)] rounded-2xl p-6 relative overflow-hidden transition-all duration-300 group">
                        <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-amber-500/5 to-transparent opacity-50" />
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-amber-950/60 text-amber-400 rounded-xl border border-amber-500/20 group-hover:scale-110 transition-transform">
                                <Target size={22} />
                            </div>
                            <span className="text-xs font-bold text-slate-300 bg-amber-950/60 px-2.5 py-1 rounded-full border border-amber-500/10">
                                {goalPercentage}% de la Meta
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Meta Mensual</p>
                            <InfoTooltip
                                content="Objetivo de ventas establecido para el mes actual. La barra de progreso muestra tu avance hacia esta meta."
                                side="top"
                            />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-100 mt-1">
                            S/ {stats.kpis.monthlyGoal.toLocaleString()}
                        </h3>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full mt-4 overflow-hidden">
                            <div 
                                className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-1000"
                                style={{ width: `${goalPercentage}%` }}
                            />
                        </div>
                    </div>

                    {/* Comisión Estimada KPI */}
                    <div className="bg-slate-900/40 border border-slate-850 hover:border-indigo-500/30 hover:shadow-[0_0_20px_rgba(99,102,241,0.05)] rounded-2xl p-6 relative overflow-hidden transition-all duration-300 group">
                        <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-indigo-500/5 to-transparent opacity-50" />
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-indigo-950/60 text-indigo-400 rounded-xl border border-indigo-500/20 group-hover:scale-110 transition-transform">
                                <TrendingUp size={22} />
                            </div>
                            <span className="text-xs font-bold text-indigo-300 bg-indigo-950/60 px-2.5 py-1 rounded-full border border-indigo-500/10">
                                Tasa 6% Est.
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Comisión Devengada</p>
                            <InfoTooltip
                                content="Comisión calculada al 6% sobre el total de ventas confirmadas. Se devenga al momento de la venta pero se paga mensualmente según contrato."
                                side="top"
                            />
                        </div>
                        <h3 className="text-2xl font-bold text-indigo-300 mt-1">
                            S/ {stats.kpis.commission.toLocaleString()}
                        </h3>
                    </div>

                    {/* Prospectos Activos KPI */}
                    <div className="bg-slate-900/40 border border-slate-850 hover:border-blue-500/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.05)] rounded-2xl p-6 relative overflow-hidden transition-all duration-300 group">
                        <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-blue-500/5 to-transparent opacity-50" />
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-blue-950/60 text-blue-400 rounded-xl border border-blue-500/20 group-hover:scale-110 transition-transform">
                                <Users size={22} />
                            </div>
                            <span className="text-xs font-bold text-blue-300 bg-blue-950/60 px-2.5 py-1 rounded-full border border-blue-500/10">
                                En Borrador
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Cotizaciones Activas</p>
                            <InfoTooltip
                                content="Número de cotizaciones en estado borrador que aún no se han confirmado como ventas. Estas representan tu pipeline de oportunidades."
                                side="top"
                            />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-100 mt-1">
                            {stats.kpis.pendingLeads} {stats.kpis.pendingLeads === 1 ? 'Cotización' : 'Cotizaciones'}
                        </h3>
                    </div>
                </div>

                {/* Charts & Activity Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Recharts Area Chart Container */}
                    <div className="lg:col-span-2 bg-slate-900/30 border border-slate-900 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-100">Tendencia de Facturación</h3>
                                <p className="text-xs text-slate-400 mt-0.5">Suma de montos totales de ventas por mes.</p>
                            </div>
                            <div className="flex bg-slate-950 border border-slate-850 rounded-lg p-1">
                                <button 
                                    onClick={() => setChartTimeframe('6m')}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                                        chartTimeframe === '6m' 
                                            ? 'bg-indigo-600 text-white shadow-md' 
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    Últ. 6M
                                </button>
                                <button 
                                    onClick={() => setChartTimeframe('12m')}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                                        chartTimeframe === '12m' 
                                            ? 'bg-indigo-600 text-white shadow-md' 
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    Todo el Año
                                </button>
                            </div>
                        </div>
                        <div className="h-[350px] w-full">
                            {displayedSalesTrend.length === 0 ? (
                                <div className="flex h-full items-center justify-center text-slate-500 text-sm">
                                    Sin datos de ventas para mostrar.
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={displayedSalesTrend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" opacity={0.5} />
                                        <XAxis
                                            dataKey="name"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
                                            dy={10}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#64748b', fontSize: 10 }}
                                            tickFormatter={(value: number) =>
                                                value >= 1000 ? `S/${(value / 1000).toFixed(0)}k` : `S/${value}`
                                            }
                                            domain={yAxisDomain}
                                            width={60}
                                        />
                                        <Tooltip
                                            content={<CustomTooltip />}
                                            cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="ventas"
                                            stroke="#6366f1"
                                            strokeWidth={2.5}
                                            fillOpacity={1}
                                            fill="url(#colorSales)"
                                            dot={{ fill: '#6366f1', r: 3, strokeWidth: 0 }}
                                            activeDot={{ r: 5, fill: '#818cf8', strokeWidth: 2, stroke: '#312e81' }}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* Recent Activity List */}
                    <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-slate-100 mb-6 flex items-center gap-2">
                                <Clock size={18} className="text-indigo-400 animate-pulse" /> Actividad Reciente
                            </h3>
                            <div className="space-y-6 max-h-[310px] overflow-y-auto pr-1">
                                {stats.recentActivity.length === 0 ? (
                                    <div className="text-center py-8 text-slate-500 text-sm">
                                        No hay transacciones registradas.
                                    </div>
                                ) : (
                                    stats.recentActivity.map((activity, idx) => (
                                        <div key={activity.id || idx} className="flex gap-4 relative">
                                            <div className={`flex-shrink-0 w-3.5 h-3.5 mt-1.5 rounded-full ${
                                                activity.action === 'Venta' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' :
                                                activity.action === 'Reserva' ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]' :
                                                'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.3)]'
                                            } ring-4 ring-slate-950 z-10`} />

                                            {/* Vertical line indicator */}
                                            {idx < stats.recentActivity.length - 1 && (
                                                <div className="absolute left-[6px] top-4 bottom-[-24px] w-[1px] bg-slate-800" />
                                            )}

                                            <div className="flex-1">
                                                <p className="text-sm font-semibold text-slate-200">
                                                    {activity.action} - <span className="text-indigo-300 font-bold">{activity.lot}</span>
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

                        <button 
                            onClick={() => router.push('/')}
                            className="w-full mt-6 py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl transition-all"
                        >
                            Ver en el Mapa de Lotes
                        </button>
                    </div>
                </div>

                {/* COMPETED LOTS SECTION (Collision Alert Engine) */}
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
                                    <p className="text-xs text-slate-400">Propiedades con cotizaciones borrador paralelas creadas por diferentes asesores.</p>
                                </div>
                            </div>
                            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3.5 py-1 rounded-full text-xs font-bold tracking-wide">
                                {stats.competedLots.length} {stats.competedLots.length === 1 ? 'Lote' : 'Lotes'} en Conflicto
                            </span>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {stats.competedLots.map((item, idx) => (
                                <div key={idx} className="bg-slate-950/50 border border-slate-850 hover:border-amber-500/30 rounded-xl p-5 shadow-lg relative group transition-colors duration-250">
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
                                                    Hace {quote.hours}h
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 pt-3.5 border-t border-slate-850 text-center">
                                        <p className="text-[10px] text-amber-400 italic">
                                            ⚡ Primera reserva confirmada adquiere la propiedad.
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Assigned Lots Table */}
                <div className="bg-slate-900/30 border border-slate-900 rounded-2xl shadow-xl overflow-hidden">
                    <div className="p-6 border-b border-slate-900 flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-bold text-slate-100">Mis Lotes Operacionales</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Propiedades activas con transacciones a tu cargo en Odoo.</p>
                        </div>
                        <button 
                            onClick={() => router.push('/')}
                            className="text-indigo-400 hover:text-indigo-300 text-xs font-bold hover:underline"
                        >
                            Ver en Mapa
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-950/60 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-900">
                                    <th className="px-6 py-4.5 text-left">Lote</th>
                                    <th className="px-6 py-4.5 text-left">Asesorado (Cliente)</th>
                                    <th className="px-6 py-4.5 text-left">Estado en Odoo</th>
                                    <th className="px-6 py-4.5 text-left">Monto Negociado</th>
                                    <th className="px-6 py-4.5 text-right">Detalle</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900">
                                {stats.assignedLots.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500 text-sm">
                                            No tienes lotes asignados con órdenes asociadas.
                                        </td>
                                    </tr>
                                ) : (
                                    stats.assignedLots.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-900/20 transition-colors duration-150">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-indigo-950/50 text-indigo-400 border border-indigo-500/10 p-2.5 rounded-xl">
                                                        <MapPin size={16} />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-slate-200 text-sm">{item.lot}</p>
                                                        <p className="text-[10px] text-slate-400">{item.stage}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-bold border border-slate-700">
                                                        {item.client.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                                                    </div>
                                                    <span className="text-slate-300 text-sm">{item.client}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
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
                </div>

                {/* Nueva Sección: Mis Lotes Vendidos */}
                <div className="bg-gradient-to-br from-emerald-950/20 to-green-950/10 rounded-2xl border border-emerald-500/20 shadow-2xl overflow-hidden">
                    <div className="p-6 border-b border-emerald-500/10 bg-emerald-500/5 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-950/60 border border-emerald-500/20 text-emerald-400 rounded-xl">
                                <Award size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-emerald-300">🏆 Mis Lotes Vendidos</h3>
                                <p className="text-xs text-slate-400">Historial completo de ventas confirmadas en Odoo</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3.5 py-1 rounded-full text-xs font-bold tracking-wide">
                                {stats.assignedLots.filter(lot => lot.status === 'Vendido').length} Ventas Confirmadas
                            </span>
                            <button
                                onClick={() => router.push('/')}
                                className="text-emerald-400 hover:text-emerald-300 text-xs font-bold hover:underline"
                            >
                                Ver en Mapa
                            </button>
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-emerald-950/60 text-emerald-300 text-xs font-semibold uppercase tracking-wider border-b border-emerald-500/20">
                                    <th className="px-6 py-4.5 text-left">#</th>
                                    <th className="px-6 py-4.5 text-left">Lote</th>
                                    <th className="px-6 py-4.5 text-left">Cliente</th>
                                    <th className="px-6 py-4.5 text-left">Etapa/Manzana</th>
                                    <th className="px-6 py-4.5 text-right">Precio de Venta</th>
                                    <th className="px-6 py-4.5 text-right">Comisión (6%)</th>
                                    <th className="px-6 py-4.5 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-emerald-500/10">
                                {stats.assignedLots.filter(lot => lot.status === 'Vendido').length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-slate-500 text-sm">
                                            Aún no tienes lotes vendidos registrados en el sistema.
                                        </td>
                                    </tr>
                                ) : (
                                    stats.assignedLots
                                        .filter(lot => lot.status === 'Vendido')
                                        .map((item, idx) => (
                                            <tr key={idx} className="hover:bg-emerald-950/10 transition-colors duration-150 group">
                                                <td className="px-6 py-4">
                                                    <div className="w-8 h-8 rounded-full bg-emerald-950/50 text-emerald-400 border border-emerald-500/20 flex items-center justify-center text-xs font-bold group-hover:scale-110 transition-transform">
                                                        {idx + 1}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-emerald-950/50 text-emerald-400 border border-emerald-500/10 p-2.5 rounded-xl group-hover:scale-110 transition-transform">
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
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-950/30 text-emerald-300 border border-emerald-500/20">
                                                        {item.stage.split(' ')[0]} {/* Extraer etapa/manzana */}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="text-base font-bold text-emerald-200">
                                                        S/ {item.price.toLocaleString('es-PE')}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-sm font-bold text-emerald-400">
                                                            S/ {Math.round(item.price * 0.06).toLocaleString('es-PE')}
                                                        </span>
                                                        <span className="text-[10px] text-emerald-500/60">Tasa 6%</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <button
                                                        onClick={() => router.push('/')}
                                                        className="text-emerald-400 hover:text-emerald-300 transition-colors p-2 hover:bg-emerald-950/30 rounded-lg group-hover:scale-110 transition-transform"
                                                        title="Ver en mapa"
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
                                                .reduce((sum, lot) => sum + (lot.price * 0.06), 0))
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
            </div>

            {reportModalType && (
                <ReportPeriodModal
                    type={reportModalType}
                    onClose={() => setReportModalType(null)}
                    onGenerate={reportModalType === 'general' ? handleDownloadGeneralReport : handleDownloadReport}
                    generating={reportModalType === 'general' ? generatingGeneralPdf : generatingPdf}
                />
            )}
        </div>
    );
}
