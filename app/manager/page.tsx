'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { odooService } from '@/app/services/odooService';
import {
    CheckCircle,
    XCircle,
    FileText,
    Clock,
    User,
    DollarSign,
    ArrowLeft,
    ShieldCheck,
    AlertCircle
} from 'lucide-react';

export default function ManagerDashboard() {
    const router = useRouter();
    const [pendingReservations, setPendingReservations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<number | null>(null);

    useEffect(() => {
        loadReservations();
    }, []);

    const loadReservations = async () => {
        try {
            const data = await odooService.getPendingReservations();
            setPendingReservations(data);
        } catch (error) {
            console.error("Error loading pending reservations:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id: number) => {
        if (!confirm('¿Estás seguro de aprobar esta reserva? Se notificará al asesor.')) return;

        setProcessingId(id);
        try {
            await odooService.approveReservation(id);
            // Remove from list
            setPendingReservations(prev => prev.filter(r => r.id !== id));
        } catch (error) {
            alert('Error al aprobar la reserva');
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (id: number) => {
        const reason = prompt('Motivo del rechazo (opcional):');
        if (reason === null) return; // Cancelled

        setProcessingId(id);
        try {
            await odooService.rejectReservation(id, reason || "Sin motivo especificado");
            // Remove from list
            setPendingReservations(prev => prev.filter(r => r.id !== id));
        } catch (error) {
            alert('Error al rechazar la reserva');
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
            {/* Header */}
            <div className="bg-slate-900 text-white sticky top-0 z-10 shadow-lg">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                <ShieldCheck className="text-emerald-400" />
                                Panel de Gerencia
                            </h1>
                            <p className="text-xs text-slate-400">Validación de Reservas y Pagos</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        Reservas Pendientes
                        <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full border border-amber-200">
                            {pendingReservations.length}
                        </span>
                    </h2>
                    <button
                        onClick={loadReservations}
                        className="text-sm text-slate-500 hover:text-slate-800 underline"
                    >
                        Actualizar
                    </button>
                </div>

                {loading ? (
                    <div className="space-y-4">
                        {[1, 2].map(i => (
                            <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 animate-pulse h-48"></div>
                        ))}
                    </div>
                ) : pendingReservations.length === 0 ? (
                    <div className="bg-white rounded-xl p-12 shadow-sm border border-slate-100 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle size={32} className="text-emerald-500" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">¡Todo al día!</h3>
                        <p className="text-slate-500">No hay reservas pendientes de aprobación por el momento.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {pendingReservations.map((res) => (
                            <div
                                key={res.id}
                                className={`bg-white rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] ring-1 ring-slate-100 overflow-hidden transition-all duration-300 ${processingId === res.id ? 'opacity-50 pointer-events-none' : 'hover:shadow-lg'}`}
                            >
                                <div className="grid grid-cols-1 md:grid-cols-3">
                                    {/* Evidence View */}
                                    <div className="h-48 md:h-auto bg-slate-100 relative group cursor-pointer overflow-hidden border-b md:border-b-0 md:border-r border-slate-100">
                                        <img
                                            src={res.evidenceUrl}
                                            alt="Comprobante"
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <span className="text-white text-sm font-medium border border-white/50 px-3 py-1 rounded-full backdrop-blur-sm">
                                                Ver Completo
                                            </span>
                                        </div>
                                        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur text-xs font-bold px-2 py-1 rounded shadow-sm flex items-center gap-1">
                                            <FileText size={12} className="text-slate-500" />
                                            Evidencia
                                        </div>
                                    </div>

                                    {/* Details */}
                                    <div className="col-span-2 p-5 flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h3 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2">
                                                        Lote {res.lotName}
                                                        <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded border border-amber-200 uppercase tracking-wide">
                                                            Pendiente
                                                        </span>
                                                    </h3>
                                                    <div className="flex items-center gap-4 text-sm text-slate-500">
                                                        <span className="flex items-center gap-1">
                                                            <Clock size={14} /> {res.date}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <DollarSign size={14} /> Pago: ${(res.amount / 1000).toFixed(1)}k
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Cliente</p>
                                                    <p className="text-sm font-bold text-slate-700">{res.customer}</p>
                                                </div>
                                            </div>

                                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 mb-4">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                                                        <User size={12} /> Asesor
                                                    </span>
                                                    <span className="text-xs text-slate-400">ID: {res.id}</span>
                                                </div>
                                                <p className="font-medium text-slate-800">{res.advisor}</p>
                                            </div>
                                        </div>

                                        <div className="flex gap-3 pt-2">
                                            <button
                                                onClick={() => handleReject(res.id)}
                                                className="flex-1 px-4 py-2.5 bg-white border border-red-200 text-red-600 font-bold rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center gap-2 text-sm"
                                            >
                                                <XCircle size={18} />
                                                Rechazar
                                            </button>
                                            <button
                                                onClick={() => handleApprove(res.id)}
                                                className="flex-1 px-4 py-2.5 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600 transition-colors shadow-sm shadow-emerald-200 flex items-center justify-center gap-2 text-sm"
                                            >
                                                <CheckCircle size={18} />
                                                Aprobar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
