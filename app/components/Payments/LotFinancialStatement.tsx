'use client';

import { DollarSign, AlertTriangle, CheckCircle, Receipt, FileText, Calendar } from 'lucide-react';
import { formatMoney as formatMoneyWithCurrency, normalizeCurrency, type CurrencyCode } from '@/app/utils/money';
import {
    buildStatementModel, installmentLabel, installmentStatus, lateFeeLabel, lateFeeNote, quotaOrderKey, STATUS_LABEL,
    unbilledQuotaLabel, type ScheduleLineLike, type StatementInvoiceLike, type UnbilledQuota,
} from '@/app/utils/statementModel';
import { avisoPorCuota, etiquetaAviso, type AvisoPago } from '@/app/lib/avisoPago';

export interface StatementInvoice {
    id: number;
    name: string;
    ref?: string;
    payment_reference?: string;
    invoice_date: string;
    invoice_date_due: string;
    amount_total: number;
    amount_residual: number;
    /** Moneda de la factura ([id, 'USD'] de Odoo o el código). Vacío = soles. */
    currency_id?: [number, string] | string | false;
    payment_state: string;
    /** Mora (simple_recurring_contract >= 3.18): se muestra en su propio bloque, no como cuota. */
    is_late_fee?: boolean;
    late_fee_origin_id?: [number, string] | false;
    late_fee_days_late?: number;
    late_fee_percentage_applied?: number;
    late_fee_waived?: boolean;
    state?: string;
    // Fecha real de pago (usada por el PDF de Estado de Cuenta, no en pantalla).
    invoice_payments_widget?: { content?: { date?: string; is_exchange?: boolean }[] } | false;
}

interface LotFinancialStatementProps {
    /** Ej. "Etapa 01 Mz D Lote 148" — se muestra como encabezado. Omitir si
     * el contexto ya deja claro de qué lote se trata (ej. un solo lote). */
    lotLabel?: string;
    /** Manzana / etapa / número de lote — a diferencia de lotLabel (que solo
     *  se muestra con más de un lote), esta fila se muestra siempre: el
     *  cliente quiere identificar de qué lote es el estado de cuenta aunque
     *  solo tenga uno. */
    mz?: string | null;
    etapa?: string | null;
    numeroLote?: string | null;
    /** Valor total en la moneda del lote (precio pactado del contrato si es en dólares; 0 = no disponible). */
    listPrice: number;
    /** Moneda del lote; si falta se deduce de sus facturas (y en su defecto, soles). */
    currency?: CurrencyCode;
    invoices: StatementInvoice[];
    /** Cronograma del contrato (solo contratos de facturación Manual): cuotas vencidas que aún no tienen factura. */
    scheduleLines?: ScheduleLineLike[];
    /** Avisos de pago ya enviados por el cliente para las cuotas sin factura de este lote. */
    avisos?: AvisoPago[];
    /** Si se pasa, cada cuota vencida sin factura (y sin aviso en revisión) ofrece «Informar pago». */
    onInformarPago?: (cuota: { sequence: number; amount: number; currency: CurrencyCode }) => void;
    loading?: boolean;
}

/** Fila del historial: una cuota con factura o una cuota vencida del cronograma que todavía no la tiene. */
type FilaHistorial =
    | { tipo: 'factura'; orden: number; inv: StatementInvoiceLike & StatementInvoice }
    | { tipo: 'sinFactura'; orden: number; q: UnbilledQuota };

// Mismo formateador y parser de referencia que ya usa el modal de staff
// (LotDetailModal.tsx) — duplicado a propósito, no extraído a un módulo
// compartido: ese archivo tiene mucha lógica propia alrededor (mensaje de
// WhatsApp de mora, etc.) y no vale el riesgo de tocarlo para ahorrar
// ~100 líneas. Si diverge con el tiempo, no es grave — es solo formato.
// (El formateador ahora lleva la moneda: US$ para contratos en dólares, S/ para soles.)

export default function LotFinancialStatement({ lotLabel, mz, etapa, numeroLote, listPrice, currency, invoices, scheduleLines, avisos, onInformarPago, loading }: LotFinancialStatementProps) {
    // Todos los montos de este estado de cuenta se muestran en la moneda del lote.
    const lotCurrency: CurrencyCode = currency ?? normalizeCurrency(invoices[0]?.currency_id);
    const priceKnown = lotCurrency === 'PEN' || listPrice > 0;
    const formatMoney = (amount: number) => formatMoneyWithCurrency(amount, lotCurrency);
    // Modelo único (utils/statementModel.ts): cuotas (capital) y cargos por mora por separado. El capital pagado,
    // el avance y el saldo deudor se calculan SOLO sobre las cuotas; la mora condonada no se muestra.
    const model = buildStatementModel(invoices, listPrice, new Date(), scheduleLines);
    const now = new Date();
    // Historial en orden de cuota: las facturadas y las vencidas aún sin factura, mezcladas por número.
    const filas: FilaHistorial[] = [
        ...model.installments.map((inv): FilaHistorial => ({ tipo: 'factura', orden: quotaOrderKey(inv), inv: inv as StatementInvoiceLike & StatementInvoice })),
        ...model.unbilledOverdue.map((q): FilaHistorial => ({ tipo: 'sinFactura', orden: q.sequence, q })),
    ].sort((a, b) => a.orden - b.orden);

    const metadataChips = [
        etapa && `Etapa ${etapa}`,
        mz && `Mz ${mz}`,
        numeroLote && `Lote ${numeroLote}`,
    ].filter(Boolean) as string[];

    return (
        <div className="space-y-4">
            {lotLabel && (
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">{lotLabel}</h3>
            )}

            {metadataChips.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {metadataChips.map((chip) => (
                        <span
                            key={chip}
                            className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md"
                        >
                            {chip}
                        </span>
                    ))}
                </div>
            )}

            {/* Resumen Financiero */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl" />

                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Resumen Financiero</p>

                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <p className="text-[10px] text-slate-500 font-semibold">Valor Total (Precio)</p>
                        <p className="text-sm font-bold text-slate-800">{priceKnown ? formatMoney(listPrice) : '—'}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-slate-500 font-semibold">Saldo Deudor Pendiente</p>
                        <p className="text-sm font-bold text-red-600">{priceKnown ? formatMoney(model.pendingBalance) : '—'}</p>
                    </div>
                </div>

                <div className="flex justify-between items-end mb-1.5">
                    <div className="flex items-center gap-1.5">
                        <DollarSign size={14} className="text-emerald-500" />
                        <span className="text-xs font-bold text-emerald-700">Total Pagado: {formatMoney(model.capitalPaid)}</span>
                    </div>
                    <div className="text-xs font-bold text-emerald-600">{model.financialProgress}%</div>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${model.financialProgress}%` }}
                    />
                </div>
            </div>

            {/* Estado de Morosidad */}
            {model.hasDebt ? (
                <div className="bg-red-50 border border-red-200 p-3 rounded-lg flex items-start gap-3">
                    <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-xs font-bold text-red-700 uppercase">
                            {model.hasOverdueInstallments
                                ? `Atraso Detectado (${model.overdueQuotaCount} ${model.overdueQuotaCount === 1 ? 'cuota' : 'cuotas'})`
                                : 'Mora pendiente de pago'}
                        </p>
                        <p className="text-sm font-bold text-red-800 mt-0.5">
                            {model.hasOverdueInstallments
                                ? `Deuda Exigible: ${formatMoney(model.overdueQuotaAmount)}`
                                : `Mora: ${formatMoney(model.lateFeesPendingAmount)}`}
                        </p>
                        {model.hasOverdueInstallments && model.lateFeesPending.length > 0 && (
                            <p className="text-[11px] font-semibold text-red-700 mt-0.5">
                                Cuotas {formatMoney(model.overdueQuotaAmount)} + Mora {formatMoney(model.lateFeesPendingAmount)} = Total a regularizar {formatMoney(model.totalToRegularize)}
                            </p>
                        )}
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
                ) : filas.length === 0 ? (
                    <div className="p-6 text-center bg-white rounded-xl border border-slate-100 shadow-sm text-slate-400 text-xs italic flex flex-col items-center">
                        <Receipt size={24} className="mb-2 opacity-50" />
                        Aún no hay cuotas facturadas.
                    </div>
                ) : (
                    <div className="relative border-l-2 border-slate-200 ml-3 pl-4 space-y-4">
                        {filas.map((fila) => {
                            if (fila.tipo === 'sinFactura') {
                                return (
                                    <div key={`sin-${fila.q.sequence}`} className="relative">
                                        <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white bg-red-500 animate-pulse" />
                                        <div className="bg-white p-3 rounded-lg border border-red-200 shadow-sm">
                                            <div className="flex justify-between items-start mb-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-700 text-xs">{unbilledQuotaLabel(fila.q)}</span>
                                                    <span className="bg-red-100 text-red-700 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase animate-pulse">
                                                        {STATUS_LABEL.overdue}
                                                    </span>
                                                </div>
                                                <p className="font-bold text-slate-800 text-sm">{formatMoney(fila.q.amount)}</p>
                                            </div>
                                            <div className="flex justify-between items-end mt-2">
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                                        <FileText size={10} />
                                                        <span>El comprobante se emite al registrar el pago</span>
                                                    </div>
                                                    {(() => {
                                                        const aviso = avisoPorCuota(avisos, fila.q.sequence);
                                                        const etiqueta = aviso ? etiquetaAviso(aviso) : null;
                                                        return etiqueta ? (
                                                            <div className="text-[10px] font-semibold text-slate-600">
                                                                {etiqueta.texto}{etiqueta.detalle ? ` · ${etiqueta.detalle}` : ''}
                                                            </div>
                                                        ) : null;
                                                    })()}
                                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                                        <Calendar size={10} />
                                                        <span>Vencimiento: {fila.q.date}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <p className="text-[11px] text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-md">
                                                        Saldo: {formatMoney(fila.q.amount)}
                                                    </p>
                                                    {onInformarPago && (() => {
                                                        const aviso = avisoPorCuota(avisos, fila.q.sequence);
                                                        const puede = !aviso || etiquetaAviso(aviso).permiteReinformar;
                                                        return puede ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => onInformarPago({ sequence: fila.q.sequence, amount: fila.q.amount, currency: lotCurrency })}
                                                                className="text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-md"
                                                            >
                                                                {aviso ? 'Informar de nuevo' : 'Informar pago'}
                                                            </button>
                                                        ) : null;
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }
                            const inv = fila.inv;
                            const status = installmentStatus(inv, now);
                            const isPaid = status === 'paid';
                            const isOverdueItem = status === 'overdue';
                            const cuotaLabel = installmentLabel(inv);

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
                                                        {STATUS_LABEL.overdue}
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

            {/* Cargos por mora: bloque propio, nunca mezclado con las cuotas (las condonadas no se muestran) */}
            {!loading && model.hasLateFees && (
                <div className="space-y-3">
                    <p className="text-xs font-bold text-amber-600 uppercase tracking-wider ml-1 mt-2">Cargos por Mora</p>
                    <div className="bg-white rounded-xl border border-amber-200 shadow-sm divide-y divide-amber-100">
                        {model.lateFees.map((fee) => {
                            const feePaid = fee.payment_state === 'paid';
                            return (
                                <div key={fee.id} className="p-3 flex justify-between items-start gap-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-amber-700 text-xs">{lateFeeLabel(fee)}</span>
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${feePaid ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                {feePaid ? STATUS_LABEL.paid : STATUS_LABEL.pending}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-1">
                                            {typeof fee.late_fee_days_late === 'number' ? `${fee.late_fee_days_late} días de atraso` : ''}
                                            {fee.late_fee_percentage_applied ? ` · ${fee.late_fee_percentage_applied}% aplicado` : ''}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-slate-800 text-sm">{formatMoney(fee.amount_total)}</p>
                                        {!feePaid && (
                                            <p className="text-[11px] text-red-600 font-bold">Saldo: {formatMoney(fee.amount_residual)}</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-[10px] text-slate-500 px-1">{lateFeeNote(model.lateFees)}</p>
                </div>
            )}
        </div>
    );
}
