'use client';

import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, AreaChart, Area
} from 'recharts';
import {
    DollarSign, TrendingUp, Users, Target, ArrowUpRight,
    Calendar, MapPin, CheckCircle, Clock
} from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { OdooUser } from '@/app/services/odooService';

interface DashboardClientProps {
    user: OdooUser;
    stats: any; // Using any for mock data, strictly define later
}

export default function DashboardClient({ user, stats }: DashboardClientProps) {
    const { user: authUser, salesCount, totalValue } = useAuth();
    const currentUser = authUser || user;

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Hola, {currentUser.name} 👋</h1>
                    <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-2 text-xs bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
                            <div>
                                <span className="text-slate-400 mr-1">Cotizadas:</span>
                                <span className="bg-blue-500 text-white px-1.5 py-0.5 rounded font-bold">12</span>
                            </div>
                            <div>
                                <span className="text-slate-400 mr-1">Separadas:</span>
                                <span className="bg-amber-500 text-white px-1.5 py-0.5 rounded font-bold">3</span>
                            </div>
                            <div>
                                <span className="text-slate-400 mr-1">Ventas:</span>
                                <span className="bg-emerald-500 text-white px-1.5 py-0.5 rounded font-bold">{salesCount}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => window.location.href = '/'} className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-xl font-medium hover:bg-slate-50 transition-colors">
                        Volver al Mapa
                    </button>
                    <button className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
                        Descargar Reporte
                    </button>
                </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-indigo-50 to-transparent opacity-50" />
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                            <DollarSign size={24} />
                        </div>
                        <span className="flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                            +12.5% <ArrowUpRight size={12} className="ml-1" />
                        </span>
                    </div>
                    <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Ventas Totales</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">S/ {totalValue.toLocaleString()}</h3>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-amber-50 to-transparent opacity-50" />
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
                            <Target size={24} />
                        </div>
                        <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-full">
                            75% de la Meta
                        </span>
                    </div>
                    <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Meta Mensual</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">S/ {stats.kpis.monthlyGoal.toLocaleString()}</h3>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full w-[75%]" />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-emerald-50 to-transparent opacity-50" />
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
                            <TrendingUp size={24} />
                        </div>
                    </div>
                    <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Comisión Estimada</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">S/ {stats.kpis.commission.toLocaleString()}</h3>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-blue-50 to-transparent opacity-50" />
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                            <Users size={24} />
                        </div>
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                            {stats.kpis.pendingLeads} Nuevos
                        </span>
                    </div>
                    <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Prospectos Activos</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">24 Clientes</h3>
                </div>
            </div>

            {/* Charts & Activity Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-slate-800">Tendencia de Ventas (2024)</h3>
                        <select className="bg-slate-50 border border-slate-200 text-slate-600 text-sm rounded-lg px-3 py-1">
                            <option>Últimos 6 meses</option>
                            <option>Este año</option>
                        </select>
                    </div>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.salesTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ stroke: '#4F46E5', strokeWidth: 2 }}
                                />
                                <Area type="monotone" dataKey="ventas" stroke="#4F46E5" strokeWidth={3} fillOpacity={1} fill="url(#colorVentas)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Recent Activity List */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Actividad Reciente</h3>
                    <div className="space-y-6">
                        {stats.recentActivity.map((activity: any) => (
                            <div key={activity.id} className="flex gap-4 relative">
                                <div className={`flex-shrink-0 w-3 h-3 mt-2 rounded-full ${activity.action === 'Venta' ? 'bg-emerald-500' :
                                    activity.action === 'Reserva' ? 'bg-amber-500' : 'bg-blue-500'
                                    } ring-4 ring-white shadow-sm z-10`} />
                                {/* Timeline line */}
                                <div className="absolute left-[5px] top-4 bottom-[-24px] w-0.5 bg-slate-100 -z-0 last:hidden" />

                                <div>
                                    <p className="text-sm font-semibold text-slate-800">
                                        {activity.action} - <span className="text-slate-600">{activity.lot}</span>
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Clock size={12} className="text-slate-400" />
                                        <span className="text-xs text-slate-400">{activity.date}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button className="w-full mt-8 py-3 bg-slate-50 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-100 transition-colors">
                        Ver todas las actividades
                    </button>
                </div>
            </div>

            {/* COMPETED LOTS SECTION - Manager Dashboard */}
            <div className="mt-8 bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl border-2 border-orange-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-orange-200 bg-orange-100 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-200 rounded-lg">
                            <Users size={20} className="text-orange-700" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-orange-900">🔥 Lotes Competidos</h3>
                            <p className="text-xs text-orange-700">Propiedades con múltiples cotizaciones activas</p>
                        </div>
                    </div>
                    <span className="bg-orange-600 text-white px-3 py-1 rounded-full text-sm font-bold">3 Activos</span>
                </div>
                <div className="p-6 space-y-4">
                    {/* Demo Data - In production, fetch from API */}
                    {[
                        {
                            lot: 'Mz Q Lote 05', stage: 'Etapa 1', quotes: [
                                { client: 'María García', advisor: 'Carlos V.', hours: 2 },
                                { client: 'Pedro Sánchez', advisor: 'Ana M.', hours: 5 }
                            ]
                        },
                        {
                            lot: 'Mz R Lote 12', stage: 'Etapa 2', quotes: [
                                { client: 'Luis Fernández', advisor: 'Carlos V.', hours: 12 },
                                { client: 'Carmen Torres', advisor: 'Juan P.', hours: 18 },
                                { client: 'Rosa Medina', advisor: 'Ana M.', hours: 24 }
                            ]
                        },
                        {
                            lot: 'Mz B Lote 08', stage: 'Etapa 1', quotes: [
                                { client: 'Jorge Ramírez', advisor: 'Juan P.', hours: 3 },
                                { client: 'Elena Cruz', advisor: 'Carlos V.', hours: 8 }
                            ]
                        }
                    ].map((item, idx) => (
                        <div key={idx} className="bg-white p-4 rounded-xl border-2 border-orange-200">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <p className="font-bold text-slate-900">{item.lot}</p>
                                    <p className="text-xs text-slate-500">{item.stage}</p>
                                </div>
                                <span className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                                    {item.quotes.length} Candidatos
                                </span>
                            </div>
                            <div className="space-y-2">
                                {item.quotes.map((quote, qIdx) => (
                                    <div key={qIdx} className="flex justify-between items-center text-sm bg-slate-50 p-2 rounded">
                                        <div>
                                            <span className="font-semibold text-slate-700">{quote.client}</span>
                                            <span className="text-slate-400 text-xs ml-2">· {quote.advisor}</span>
                                        </div>
                                        <span className="text-xs text-orange-600 flex items-center gap-1">
                                            <Clock size={10} />
                                            Hace {quote.hours}h
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-3 pt-3 border-t border-orange-100">
                                <p className="text-xs text-orange-700 italic text-center">
                                    ⚡ Primera reserva confirmada gana
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Assigned Lots Table */}
            <div className="mt-8 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800">Mis Lotes Asignados</h3>
                    <button className="text-indigo-600 text-sm font-semibold hover:text-indigo-700">Ver todos</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Lote</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Precio</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {[1, 2, 3].map((i) => (
                                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-slate-100 p-2 rounded-lg">
                                                <MapPin size={16} className="text-slate-500" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-900">Mz C Lote {10 + i}</p>
                                                <p className="text-xs text-slate-500">Etapa 02</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">JP</div>
                                            <span className="text-sm text-slate-600">Juan Pérez</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                            Vendido
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">S/ 45,000</td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-slate-400 hover:text-indigo-600 transition-colors">
                                            <ArrowUpRight size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
