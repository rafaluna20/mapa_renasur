'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { redirect } from 'next/navigation';
import { History, Loader2, AlertCircle, CheckCircle2, XCircle, Clock, FileText, CreditCard } from 'lucide-react';
import type { PaymentHistory } from '@/app/services/paymentService';

export default function PaymentHistoryPage() {
    const { data: session, status } = useSession();
    const [payments, setPayments] = useState<PaymentHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (status === 'unauthenticated') {
            redirect('/portal/login?callbackUrl=/portal/historial');
        }

        if (status === 'authenticated') {
            loadPayments();
        }
    }, [status]);

    const loadPayments = async () => {
        try {
            const response = await fetch('/api/invoices/history');
            const data = await response.json();

            if (data.success) {
                setPayments(data.payments);
            } else {
                setError(data.error || 'Error al cargar historial');
            }
        } catch (err) {
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    if (status === 'loading' || loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 size={40} className="animate-spin text-[#A145F5]" />
            </div>
        );
    }

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-stone-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-6xl mx-auto px-6 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                                <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center">
                                    <History size={24} className="text-white" />
                                </div>
                                Historial de Pagos
                            </h1>
                            <p className="text-slate-500 mt-1">
                                Todos tus pagos realizados
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => window.location.href = '/portal/pagos'}
                                className="px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                ← Volver a Pagos
                            </button>
                            <button
                                onClick={() => window.location.href = '/'}
                                className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg font-bold hover:bg-slate-300 transition-colors"
                            >
                                Ir al Mapa
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-6xl mx-auto px-6 py-8">
                {/* Summary Card */}
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500 font-medium">Total Pagado</p>
                            <p className="text-3xl font-bold text-emerald-600 mt-1">
                                S/ {totalPaid.toFixed(2)}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-slate-500 font-medium">Transacciones</p>
                            <p className="text-3xl font-bold text-slate-800 mt-1">
                                {payments.length}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Error State */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
                        <AlertCircle size={20} className="text-red-600 mt-0.5" />
                        <div>
                            <p className="font-bold text-red-900">Error</p>
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    </div>
                )}

                {/* Payments List */}
                {payments.length === 0 ? (
                    <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
                        <History size={48} className="mx-auto text-slate-300 mb-4" />
                        <h3 className="text-xl font-bold text-slate-800 mb-2">
                            Sin pagos registrados
                        </h3>
                        <p className="text-slate-500 mb-6">
                            Aún no has realizado ningún pago
                        </p>
                        <button
                            onClick={() => window.location.href = '/portal/pagos'}
                            className="px-6 py-3 bg-[#A145F5] text-white rounded-xl font-bold hover:bg-[#8D32DF] transition-colors"
                        >
                            Ver Cuotas Pendientes
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold text-slate-800">
                            Últimos Pagos ({payments.length})
                        </h2>

                        <div className="grid gap-4">
                            {payments.map((payment) => (
                                <PaymentCard key={payment.id} payment={payment} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function PaymentCard({ payment }: { payment: PaymentHistory }) {
    const getStatusIcon = () => {
        switch (payment.state) {
            case 'posted':
                return <CheckCircle2 size={20} className="text-emerald-600" />;
            case 'draft':
                return <Clock size={20} className="text-amber-600" />;
            case 'cancelled':
                return <XCircle size={20} className="text-red-600" />;
            default:
                return <FileText size={20} className="text-slate-600" />;
        }
    };

    const getStatusColor = () => {
        switch (payment.state) {
            case 'posted':
                return 'bg-emerald-50 border-emerald-200 text-emerald-700';
            case 'draft':
                return 'bg-amber-50 border-amber-200 text-amber-700';
            case 'cancelled':
                return 'bg-red-50 border-red-200 text-red-700';
            default:
                return 'bg-slate-50 border-slate-200 text-slate-700';
        }
    };

    const getStatusLabel = () => {
        switch (payment.state) {
            case 'posted':
                return 'Confirmado';
            case 'draft':
                return 'Borrador';
            case 'cancelled':
                return 'Cancelado';
            default:
                return payment.state;
        }
    };

    const paymentMethod = payment.payment_method_id[1] || 'Transferencia';
    const journal = payment.journal_id[1] || 'Banco';

    return (
        <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200 hover:shadow-lg transition-shadow">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                    <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            {getStatusIcon()}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 mb-1">
                                {payment.name}
                            </h3>
                            {payment.ref && (
                                <p className="text-sm font-mono text-slate-500">
                                    Ref: {payment.ref}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <CreditCard size={16} className="text-slate-400" />
                            <span className="text-slate-600">{paymentMethod}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <FileText size={16} className="text-slate-400" />
                            <span className="text-slate-600">{journal}</span>
                        </div>
                        <div>
                            <span className="text-slate-500">Fecha:</span>
                            <span className="ml-2 text-slate-700 font-medium">
                                {new Date(payment.date).toLocaleDateString('es-PE', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                })}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col md:items-end gap-3">
                    <div className="text-right">
                        <span className="text-3xl font-bold text-emerald-600">
                            S/ {payment.amount.toFixed(2)}
                        </span>
                    </div>

                    <span className={`px-4 py-2 rounded-full text-xs font-bold border ${getStatusColor()}`}>
                        {getStatusLabel()}
                    </span>
                </div>
            </div>
        </div>
    );
}
