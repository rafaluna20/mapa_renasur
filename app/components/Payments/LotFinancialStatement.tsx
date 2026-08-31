'use client';

import { DollarSign, AlertTriangle, CheckCircle, Receipt, FileText, Calendar } from 'lucide-react';

export interface StatementInvoice {
    id: number;
    name: string;
    ref?: string;
    payment_reference?: string;
    invoice_date: string;
    invoice_date_due: string;
    amount_total: number;
    amount_residual: number;
    payment_state: string;
}

interface LotFinancialStatementProps {
    /** Ej. "Etapa 01 Mz D Lote 148" — se muestra como encabezado. Omitir si
     * el contexto ya deja claro de qué lote se trata (ej. un solo lote). */
    lotLabel?: string;
    listPrice: number;
    invoices: StatementInvoice[];
    loading?: boolean;
}

// Mismo formateador y parser de referencia que ya usa el modal de staff
// (LotDetailModal.tsx) — duplicado a propósito, no extraído a un módulo
// compartido: ese archivo tiene mucha lógica propia alrededor (mensaje de
// WhatsApp de mora, etc.) y no vale el riesgo de tocarlo para ahorrar
// ~100 líneas. Si diverge con el tiempo, no es grave — es solo formato.
const formatMoney = (amount: number) =>
    `S/ ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function parseCuotaLabel(inv: { name: string; ref?: string; payment_reference?: string }): { label: string; isInitial: boolean } {
    const ref = inv.ref || inv.payment_reference || inv.name || '';
    if (/[-_]INIT(\b|$|-)/i.test(ref)) {
        return { label: 'Cuota Inicial', isInitial: true };
    }
    const cuotaMatch = ref.match(/[-_]C(\d+)(?:\b|$|-)/i);
    if (cuotaMatch) {
        return { label: `Cuota N° ${parseInt(cuotaMatch[1], 10)}`, isInitial: false };
    }
    return { label: inv.name || 'Factura', isInitial: false };
}

export default function LotFinancialStatement({ lotLabel, listPrice, invoices, loading }: LotFinancialStatementProps) {
    const realTotalPaid = invoices
        .filter((i) => i.payment_state === 'paid')
        .reduce((sum, inv) => sum + (inv.amount_total || 0), 0);
    const pendingBalance = Math.max(0, listPrice - realTotalPaid);
    const financialProgress = listPrice > 0 ? Math.min(100, Math.round((realTotalPaid / listPrice) * 100)) : 0;

    const overdueInvoices = invoices.filter(
        (inv) => inv.payment_state !== 'paid' && inv.invoice_date_due && new Date(inv.invoice_date_due) < new Date()
    );
    const isOverdue = overdueInvoices.length > 0;
    const totalOverdueAmount = overdueInvoices.reduce((sum, inv) => sum + (inv.amount_residual || 0), 0);

    const sortedInvoices = [...invoices].sort(
        (a, b) => new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime()
    );

    return (
        <div className="space-y-4">
            {lotLabel && (
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">{lotLabel}</h3>
            )}

            {/* Resumen Financiero */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl" />

                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Resumen Financiero</p>

                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <p className="text-[10px] text-slate-500 font-semibold">Valor Total (Precio)</p>
                        <p className="text-sm font-bold text-slate-800">{formatMoney(listPrice)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-slate-500 font-semibold">Saldo Deudor Pendiente</p>
                        <p className="text-sm font-bold text-red-600">{formatMoney(pendingBalance)}</p>
                    </div>
                </div>

                <div className="flex justify-between items-end mb-1.5">
                    <div className="flex items-center gap-1.5">
                        <DollarSign size={14} className="text-emerald-500" />
                        <span className="text-xs font-bold text-emerald-700">Total Pagado: {formatMoney(realTotalPaid)}</span>
                    </div>
                    <div className="text-xs font-bold text-emerald-600">{financialProgress}%</div>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${financialProgress}%` }}
                    />
                </div>
            </div>

            {/* Estado de Morosidad */}
            {isOverdue ? (
                <div className="bg-red-50 border border-red-200 p-3 rounded-lg flex items-start gap-3">
                    <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-xs font-bold text-red-700 uppercase">
                            Atraso Detectado ({overdueInvoices.length} {overdueInvoices.length === 1 ? 'cuota' : 'cuotas'})
                        </p>
                        <p className="text-sm font-bold text-red-800 mt-0.5">Deuda Exigible: {formatMoney(totalOverdueAmount)}</p>
                        <p className="text-[10px] text-red-600 mt-1">
                            Regulariza cuanto antes para evitar recargos. Podés subir tu comprobante abajo.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex items-center gap-3">
                    <CheckCircle size={18} className="text-emerald-500 shrink-0" />
                    <div>
                        <p className="text-xs font-bold text-emerald-700 uppercase">Financiamiento Al Día</p>
                        <p className="text-[10px] text-emerald-600">No tenés cuotas vencidas registradas.</p>
                    </div>
                </div>
            )}

            {/* Historial de Cuotas y Pagos */}
            <div className="space-y-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1 mt-2">Historial de Cuotas y Pagos</p>

                {loading ? (
                    <div className="p-6 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-100">
                        Cargando estado de cuenta...
                    </div>
                ) : sortedInvoices.length === 0 ? (
                    <div className="p-6 text-center bg-white rounded-xl border border-slate-100 shadow-sm text-slate-400 text-xs italic flex flex-col items-center">
                        <Receipt size={24} className="mb-2 opacity-50" />
                        Aún no hay cuotas facturadas.
                    </div>
                ) : (
                    <div className="relative border-l-2 border-slate-200 ml-3 pl-4 space-y-4">
                        {sortedInvoices.map((inv) => {
                            const isPaid = inv.payment_state === 'paid';
                            const isOverdueItem = !isPaid && inv.invoice_date_due && new Date(inv.invoice_date_due) < new Date();
                            const { label: cuotaLabel } = parseCuotaLabel(inv);

                            return (
                                <div key={inv.id} className="relative">
                                    <div
                                        className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                                            isPaid ? 'bg-emerald-500' : isOverdueItem ? 'bg-red-500 animate-pulse' : 'bg-amber-400'
                                        }`}
                                    />

                                    <div
                                        className={`bg-white p-3 rounded-lg border ${
                                            isOverdueItem ? 'border-red-200' : 'border-slate-200 hover:border-blue-300'
                                        } shadow-sm transition-colors`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-700 text-xs">{cuotaLabel}</span>
                                                {isPaid ? (
                                                    <span className="bg-emerald-100 text-emerald-700 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">
                                                        Pagado
                                                    </span>
                                                ) : isOverdueItem ? (
                                                    <span className="bg-red-100 text-red-700 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase animate-pulse">
                                                        Mora
                                                    </span>
                                                ) : (
                                                    <span className="bg-yellow-100 text-yellow-700 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">
                                                        Pendiente
                                                    </span>
                                                )}
                                            </div>
                                            <p className="font-bold text-slate-800 text-sm">{formatMoney(inv.amount_total)}</p>
                                        </div>

                                        <div className="flex justify-between items-end mt-2">
                                            <div className="space-y-0.5">
                                                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                                    <FileText size={10} />
                                                    <span>{inv.name || inv.ref || 'S/N'}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                                    <Calendar size={10} />
                                                    <span>Vencimiento: {inv.invoice_date_due || inv.invoice_date}</span>
                                                </div>
                                            </div>
                                            {!isPaid && (
                                                <p className="text-[11px] text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-md">
                                                    Saldo: {formatMoney(inv.amount_residual)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
