'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { redirect } from 'next/navigation';
import { CreditCard, Building2, Calendar, DollarSign, Loader2, AlertCircle, CheckCircle2, Clock, FileText, Upload } from 'lucide-react';
import type { PendingInvoice } from '@/app/services/paymentService';
import NiubizPaymentModal from '@/app/components/Payments/NiubizPaymentModal';
import VoucherUploadModal from '@/app/components/Payments/VoucherUploadModal';
import VoucherStatusBadge from '@/app/components/Payments/VoucherStatusBadge';
import VoucherStatusAlert from '@/app/components/Payments/VoucherStatusAlert';
import VoucherTimeline from '@/app/components/Payments/VoucherTimeline';

export default function PaymentsPortal() {
    const { data: session, status } = useSession();
    const [invoices, setInvoices] = useState<PendingInvoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (status === 'unauthenticated') {
            redirect('/portal/login?callbackUrl=/portal/pagos');
        }

        if (status === 'authenticated') {
            loadInvoices();
        }
    }, [status]);

    const loadInvoices = async () => {
        try {
            const response = await fetch('/api/invoices/pending');
            const data = await response.json();

            if (data.success) {
                setInvoices(data.invoices);
            } else {
                setError(data.error || 'Error al cargar facturas');
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

    const overdueInvoices = invoices.filter(inv =>
        new Date(inv.invoice_date_due) < new Date()
    );
    const upcomingInvoices = invoices.filter(inv =>
        new Date(inv.invoice_date_due) >= new Date()
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-stone-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-6xl mx-auto px-6 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                                <div className="w-10 h-10 bg-[#A145F5] rounded-xl flex items-center justify-center">
                                    <Building2 size={20} className="text-white" />
                                </div>
                                Portal de Pagos
                            </h1>
                            <p className="text-sm text-slate-500 mt-1">
                                Bienvenido, <span className="font-semibold">{session?.user?.name}</span>
                            </p>
                        </div>
                        <button
                            onClick={() => window.location.href = '/portal/historial'}
                            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                        >
                            Ver Historial →
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-6xl mx-auto px-6 py-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-slate-500 font-medium">Total Pendiente</p>
                                <p className="text-xl font-bold text-slate-800 mt-1">
                                    S/ {invoices.reduce((sum, inv) => sum + inv.amount_residual, 0).toFixed(2)}
                                </p>
                            </div>
                            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                                <DollarSign size={20} className="text-amber-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-slate-500 font-medium">Vencidas</p>
                                <p className="text-xl font-bold text-red-600 mt-1">
                                    {overdueInvoices.length}
                                </p>
                            </div>
                            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                                <AlertCircle size={20} className="text-red-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-slate-500 font-medium">Por Vencer</p>
                                <p className="text-xl font-bold text-emerald-600 mt-1">
                                    {upcomingInvoices.length}
                                </p>
                            </div>
                            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                                <Clock size={20} className="text-emerald-600" />
                            </div>
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

                {/* Invoices List */}
                {invoices.length === 0 ? (
                    <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
                        <CheckCircle2 size={48} className="mx-auto text-emerald-500 mb-4" />
                        <h3 className="text-xl font-bold text-slate-800 mb-2">
                            ¡Todo al día!
                        </h3>
                        <p className="text-slate-500">
                            No tienes cuotas pendientes en este momento
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <h2 className="text-base font-bold text-slate-800">
                            Cuotas Pendientes ({invoices.length})
                        </h2>

                        {invoices.map((invoice) => (
                            <InvoiceCard
                                key={invoice.id}
                                invoice={invoice}
                                onPaymentComplete={loadInvoices}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function InvoiceCard({ invoice, onPaymentComplete }: {
    invoice: PendingInvoice;
    onPaymentComplete: () => void;
}) {
    const isOverdue = new Date(invoice.invoice_date_due) < new Date();
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showVoucherModal, setShowVoucherModal] = useState(false);

    return (
        <>
            <div className={`bg-white rounded-xl shadow-md p-4 border-2 transition-all hover:shadow-lg ${isOverdue ? 'border-red-300 bg-red-50/30' : 'border-slate-200'
                }`}>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex-1">
                        <div className="flex items-start gap-3 mb-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isOverdue ? 'bg-red-100' : 'bg-[#A145F5]/10'
                                }`}>
                                <FileText size={16} className={isOverdue ? 'text-red-600' : 'text-[#A145F5]'} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-800">
                                    {invoice.payment_reference}
                                </h3>
                                {invoice.lot_info && (
                                    <p className="text-xs text-slate-500">
                                        Etapa {invoice.lot_info.etapa} · {invoice.lot_info.manzana} · Lote {invoice.lot_info.lote}
                                        · Cuota {parseInt(invoice.lot_info.quota)}
                                    </p>
                                )}
                            </div>
                            {invoice.voucher_status && (
                                <VoucherStatusBadge status={invoice.voucher_status.status} />
                            )}
                        </div>

                        <div className="flex flex-wrap gap-4 text-xs">
                            <div className="flex items-center gap-2">
                                <Calendar size={14} className="text-slate-400" />
                                <span className={isOverdue ? 'text-red-600 font-bold' : 'text-slate-600'}>
                                    Vence: {new Date(invoice.invoice_date_due).toLocaleDateString('es-PE', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric'
                                    })}
                                </span>
                            </div>
                            {isOverdue && (
                                <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                                    VENCIDA
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col md:items-end gap-2">
                        <div className="text-right">
                            <span className="text-2xl font-bold text-[#A145F5]">
                                S/ {invoice.amount_residual.toFixed(2)}
                            </span>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowPaymentModal(true)}
                                className="flex-1 md:flex-none bg-[#A145F5] text-white px-5 py-2.5 rounded-lg font-bold hover:bg-[#8D32DF] transition-colors flex items-center justify-center gap-2 shadow-md text-sm"
                            >
                                <CreditCard size={16} />
                                <span>Pagar con Tarjeta</span>
                            </button>
                            <button
                                onClick={() => setShowVoucherModal(true)}
                                className="flex-1 md:flex-none bg-white border-2 border-[#A145F5] text-[#A145F5] px-5 py-2.5 rounded-lg font-bold hover:bg-[#A145F5]/10 transition-colors flex items-center justify-center gap-2 text-sm"
                            >
                                <Upload size={16} />
                                <span>Subir Comprobante</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Voucher Status Details */}
                {invoice.voucher_status && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                        <VoucherTimeline
                            status={invoice.voucher_status.status}
                            submittedAt={invoice.voucher_status.submitted_at}
                        />
                        <VoucherStatusAlert
                            status={invoice.voucher_status.status}
                            submittedAt={invoice.voucher_status.submitted_at}
                        />
                    </div>
                )}
            </div>

            {/* Modales funcionales */}
            {showPaymentModal && (
                <NiubizPaymentModal
                    invoiceId={invoice.id}
                    amount={invoice.amount_residual}
                    paymentReference={invoice.payment_reference}
                    onClose={() => setShowPaymentModal(false)}
                    onSuccess={onPaymentComplete}
                />
            )}

            {showVoucherModal && (
                <VoucherUploadModal
                    invoiceId={invoice.id}
                    paymentReference={invoice.payment_reference}
                    amount={invoice.amount_residual}
                    onClose={() => setShowVoucherModal(false)}
                    onSuccess={onPaymentComplete}
                />
            )}
        </>
    );
}
