'use client';

import { use, useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Download, Calculator, Calendar, Tag, DollarSign, Table, Loader2, Percent } from 'lucide-react';
import { lotsData, Lot } from '@/app/data/lotsData';
import { financeService, QuoteCalculations } from '@/app/services/financeService';
import Header from '@/app/components/UI/Header';
import { exportQuoteToPdf } from '@/app/utils/quotePdfExporter';
import geometriesJson from '@/app/data/geometries.json';
import { useAuth } from '@/app/context/AuthContext';

interface QuotePageProps {
    params: Promise<{ lotId: string }>;
}

export default function QuotePage({ params }: QuotePageProps) {
    const { user } = useAuth();
    const { lotId } = use(params);
    const router = useRouter();
    const [dynamicLot, setDynamicLot] = useState<Lot | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    // 1. Buscar el lote
    useEffect(() => {
        const idToFind = lotId.replace('local-', '').replace('fb-', '');
        const localMatch = lotsData.find(l => l.id === idToFind);

        if (localMatch) {
            setDynamicLot(localMatch);
            setLoading(false);
            return;
        }

        const fetchLot = async () => {
            try {
                const response = await fetch(`/api/odoo/product/${lotId}`);
                if (!response.ok) throw new Error("Error en red");
                const data = await response.json();

                if (data.success && data.product) {
                    const p = data.product;
                    const code = (p.default_code || '').toString();
                    const geometry = (geometriesJson as any)[code];

                    setDynamicLot({
                        id: p.id.toString(),
                        name: p.name,
                        x_statu: p.x_statu || 'libre',
                        list_price: p.list_price || 0,
                        x_area: p.x_area || (geometry?.measurements?.area || 0),
                        x_mz: p.x_mz || '',
                        x_etapa: p.x_etapa || '',
                        x_lote: p.x_lote || '',
                        default_code: code,
                        points: geometry?.coordinates || [],
                        measurements: geometry?.measurements
                    });
                }
            } catch (error) {
                console.error("Error fetching lot for quote:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchLot();
    }, [lotId]);

    const lot = dynamicLot;

    // 2. Estados del Formulario
    const [discountPercent, setDiscountPercent] = useState<number>(0);
    const [discountAmount, setDiscountAmount] = useState<number>(0);
    const [initialPayment, setInitialPayment] = useState<number>(0);
    const [numInstallments, setNumInstallments] = useState<number>(72);
    const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);

    // Sincronizar entradas de descuento
    const handleDiscountPercentChange = (val: number) => {
        setDiscountPercent(val);
        if (lot) {
            const amount = lot.list_price * (val / 100);
            setDiscountAmount(amount);
        }
    };

    const handleDiscountAmountChange = (val: number) => {
        setDiscountAmount(val);
        if (lot && lot.list_price > 0) {
            const percent = (val / lot.list_price) * 100;
            setDiscountPercent(parseFloat(percent.toFixed(2)));
        }
    };

    // 3. Cálculos en tiempo real
    const calculations: QuoteCalculations | null = useMemo(() => {
        if (!lot) return null;
        return financeService.calculateQuote(
            lot.list_price,
            discountPercent,
            initialPayment,
            numInstallments,
            new Date(startDate)
        );
    }, [lot, discountPercent, initialPayment, numInstallments, startDate]);

    if (loading) {
        return (
            <div className="flex flex-col h-screen items-center justify-center bg-slate-50 font-sans">
                <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
                <p className="text-slate-500 font-medium tracking-tight">Cargando detalles de cotización...</p>
            </div>
        );
    }

    if (!lot || !calculations) {
        return (
            <div className="flex flex-col h-screen items-center justify-center bg-slate-50 font-sans">
                <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200 border border-slate-100 flex flex-col items-center max-w-sm text-center">
                    <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6">
                        <Calculator size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Lote no encontrado</h2>
                    <p className="text-slate-500 mb-8 leading-relaxed">No pudimos recuperar la información del lote solicitado. Es posible que el ID sea incorrecto o el producto no esté activo.</p>
                    <button
                        onClick={() => router.push('/')}
                        className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-2 rounded-2xl transition-all active:scale-95"
                    >
                        <ChevronLeft size={20} /> Volver al Mapa
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans">
            <Header onSync={() => router.refresh()} />

            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-6xl mx-auto space-y-6">

                    {/* Navegación y Título */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/')}
                                className="group flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-xl border border-slate-200 shadow-sm transition-all active:scale-95 whitespace-nowrap"
                            >
                                <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                                <span className="text-xs font-bold uppercase tracking-wider">Volver al Mapa</span>
                            </button>
                            <div className="h-10 w-[1px] bg-slate-200 hidden md:block mx-1"></div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800">Cotización Preliminar</h1>
                                <p className="text-slate-500 font-medium">{lot.name} • {lot.x_mz} {lot.x_lote}</p>
                            </div>
                        </div>
                        <button
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                            onClick={() => exportQuoteToPdf(lot, calculations, user?.name || 'No especificado')}
                        >
                            <Download size={20} /> Exportar PDF
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* Panel de Configuración */}
                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                                    <Calculator size={16} /> Ajustes de Venta
                                </h2>

                                <div className="space-y-6">
                                    {/* Descuento Dual */}
                                    <div className="space-y-3">
                                        <label className="block text-sm font-bold text-slate-700">Descuento aplicado</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="relative">
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</div>
                                                <input
                                                    type="number"
                                                    value={discountPercent}
                                                    onChange={(e) => handleDiscountPercentChange(parseFloat(e.target.value) || 0)}
                                                    className="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800 transition-all text-sm"
                                                    placeholder="%"
                                                />
                                            </div>
                                            <div className="relative">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">S/</div>
                                                <input
                                                    type="number"
                                                    value={discountAmount}
                                                    onChange={(e) => handleDiscountAmountChange(parseFloat(e.target.value) || 0)}
                                                    className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800 transition-all text-sm"
                                                    placeholder="Monto"
                                                />
                                            </div>
                                        </div>
                                        <input
                                            type="range"
                                            min="0" max="25" step="0.5"
                                            value={discountPercent}
                                            onChange={(e) => handleDiscountPercentChange(parseFloat(e.target.value))}
                                            className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                        />
                                    </div>

                                    {/* Cuota Inicial */}
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Cuota Inicial (S/)</label>
                                        <div className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">S/</div>
                                            <input
                                                type="number"
                                                value={initialPayment}
                                                onChange={(e) => setInitialPayment(parseFloat(e.target.value) || 0)}
                                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800 transition-all"
                                            />
                                        </div>
                                    </div>

                                    {/* Cantidad de Cuotas Libres */}
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Plazo (Meses)</label>
                                        <div className="relative mb-3">
                                            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="number"
                                                min="1" max="180"
                                                value={numInstallments}
                                                onChange={(e) => setNumInstallments(parseInt(e.target.value) || 0)}
                                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800 transition-all"
                                            />
                                        </div>
                                        <div className="grid grid-cols-4 gap-2">
                                            {[12, 36, 60, 72].map(num => (
                                                <button
                                                    key={num}
                                                    onClick={() => setNumInstallments(num)}
                                                    className={`py-2 rounded-lg font-bold text-[10px] transition-all border ${numInstallments === num
                                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                                        : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-200'
                                                        }`}
                                                >
                                                    {num} m
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Fecha Inicial */}
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Fecha Cuota Inicial</label>
                                        <div className="relative">
                                            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="date"
                                                value={startDate}
                                                onChange={(e) => setStartDate(e.target.value)}
                                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-800"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Resumen de Valores */}
                            <div className="bg-slate-900 p-6 rounded-2xl shadow-xl text-white space-y-4">
                                <div className="flex justify-between items-center opacity-60 text-xs font-bold uppercase tracking-widest">
                                    <span>Resumen Financiero (S/)</span>
                                    <Tag size={14} />
                                </div>
                                <div className="space-y-3 pt-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="opacity-70">Precio Lista</span>
                                        <span className="font-mono">{financeService.formatCurrency(lot.list_price)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-emerald-400">
                                        <span>Descuento ({discountPercent}%)</span>
                                        <span className="font-mono">-{financeService.formatCurrency(calculations.discountAmount)}</span>
                                    </div>
                                    <div className="h-[1px] bg-white/10 my-2" />
                                    <div className="flex justify-between items-center">
                                        <span className="text-base font-bold">Precio Final</span>
                                        <span className="text-xl font-bold font-mono">{financeService.formatCurrency(calculations.discountedPrice)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm pt-4">
                                        <span className="opacity-70">Saldo a Financiar</span>
                                        <span className="font-mono">{financeService.formatCurrency(calculations.remainingBalance)}</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-white/10 p-3 rounded-xl border border-white/5">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold uppercase opacity-60">Cuota Mensual</span>
                                            <span className="text-lg font-bold font-mono text-indigo-400">{financeService.formatCurrency(calculations.monthlyInstallment)}</span>
                                        </div>
                                        <span className="text-xs font-bold opacity-60">{numInstallments} meses</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tabla de Amortización */}
                        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <h2 className="font-bold text-slate-700 flex items-center gap-2">
                                    <Table size={18} className="text-indigo-600" /> Cronograma de Pagos (Soles)
                                </h2>
                                <span className="text-[10px] font-bold px-2 py-1 bg-white border border-slate-200 rounded text-slate-500 uppercase tracking-tighter">
                                    PROYECCIÓN A {numInstallments} MESES
                                </span>
                            </div>

                            <div className="flex-1 overflow-auto max-h-[600px]">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-white shadow-sm z-10">
                                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                            <th className="px-6 py-4 border-b border-slate-100">#</th>
                                            <th className="px-6 py-4 border-b border-slate-100">Fecha de Pago</th>
                                            <th className="px-6 py-4 border-b border-slate-100 text-right">Monto Cuota</th>
                                            <th className="px-6 py-4 border-b border-slate-100 text-right">Saldo Restante</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {/* Fila de Cuota Inicial */}
                                        <tr className="bg-emerald-50/30 group">
                                            <td className="px-6 py-4 text-xs font-bold text-slate-400">0</td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-emerald-700">Cuota Inicial</span>
                                                    <span className="text-[10px] text-emerald-600 opacity-70 font-medium">Pago Inmediato</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-sm font-mono font-bold text-emerald-700">{financeService.formatCurrency(calculations.initialPayment)}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-sm font-mono font-medium text-slate-400">{financeService.formatCurrency(calculations.remainingBalance)}</span>
                                            </td>
                                        </tr>

                                        {/* Cuotas Mensuales */}
                                        {calculations.installments.map((inst) => (
                                            <tr key={inst.number} className="hover:bg-slate-50 transition-colors group">
                                                <td className="px-6 py-4 text-xs font-bold text-slate-400">{inst.number}</td>
                                                <td className="px-6 py-4">
                                                    <span className="text-sm font-medium text-slate-700">{financeService.formatDate(inst.date)}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="text-sm font-mono font-bold text-slate-900 italic opacity-80 group-hover:opacity-100">
                                                        {financeService.formatCurrency(inst.amount)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="text-sm font-mono text-slate-500">
                                                        {financeService.formatCurrency(inst.balance)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                                <p className="text-[10px] text-slate-400 font-medium italic">
                                    * Esta es una simulación preliminar en Soles y no constituye un compromiso legal hasta ser validada por administración.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
