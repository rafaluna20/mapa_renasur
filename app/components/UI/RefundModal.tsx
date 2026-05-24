'use client';

import { X, AlertTriangle, RotateCcw, Loader2, FileText, DollarSign, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { Lot } from '@/app/data/lotsData';
import { odooService } from '@/app/services/odooService';

interface RefundModalProps {
    lot: Lot;
    orderId: number;
    reservedAmount: number;
    listPrice?: number;
    clientName: string;
    onClose: () => void;
    onSuccess: (newStatus: string) => void;
}

const REFUND_REASONS = [
    'Cliente desistió de la compra',
    'No calificó para crédito hipotecario',
    'Error en la reserva',
    'Otro motivo',
];

export default function RefundModal({ lot, orderId, reservedAmount, listPrice, clientName, onClose, onSuccess }: RefundModalProps) {
    const [refundAmount, setRefundAmount] = useState<number>(reservedAmount);
    const [reason, setReason] = useState('');
    const [customReason, setCustomReason] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [step, setStep] = useState<'form' | 'confirm'>('form');

    const finalReason = reason === 'Otro motivo' ? customReason : reason;
    const isRetention = refundAmount < reservedAmount;
    const retentionAmount = reservedAmount - refundAmount;
    const retentionPct = reservedAmount > 0 ? ((retentionAmount / reservedAmount) * 100).toFixed(1) : '0';

    const canProceed = reason.length > 0 && (reason !== 'Otro motivo' || customReason.length > 5) && refundAmount >= 0 && refundAmount <= reservedAmount;

    const handleConfirm = async () => {
        setIsProcessing(true);
        try {
            // 1. Process refund in Odoo (cancel order or create credit note)
            const result = await odooService.processRefund(orderId, refundAmount, finalReason);

            if (!result.success) {
                throw new Error(result.error || 'Error al procesar la devolución en Odoo');
            }

            // 2. Release the lot to the correct status:
            //    - 'cotizacion' if other vendors still have active quotes
            //    - 'libre' if no quotes remain
            const newStatus = result.newLotStatus || 'libre';
            await odooService.updateLotStatus(lot.id as unknown as number, newStatus);

            console.log(`✅ Refund processed: ${result.action}, lot ${lot.name} → ${newStatus}`);
            onSuccess(newStatus);
            onClose();
        } catch (error: unknown) {
            console.error('Refund error:', error);
            alert(`Error al procesar la devolución: ${error instanceof Error ? error.message : 'Intente nuevamente'}`);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[1200] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-red-500 px-5 py-4 flex justify-between items-center text-white">
                    <div className="flex items-center gap-2">
                        <RotateCcw size={18} />
                        <h2 className="font-bold text-[15px]">Procesar Devolución</h2>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {step === 'form' ? (
                    <div className="p-5 space-y-4">
                        {/* Lot & Client Info */}
                        <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 space-y-1">
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-500">Lote</span>
                                <span className="font-bold text-slate-800">{lot.name}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-500">Cliente</span>
                                <span className="font-bold text-slate-800">{clientName}</span>
                            </div>
                            {listPrice && (
                                <div className="flex justify-between text-xs border-b border-orange-100/50 pb-1 mb-1">
                                    <span className="text-slate-500">Precio Lista Lote</span>
                                    <span className="font-semibold text-slate-600">
                                        {new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(listPrice)}
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between text-xs pt-0.5">
                                <span className="text-slate-500">Monto Separación</span>
                                <span className="font-bold text-orange-700">
                                    {new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(reservedAmount)}
                                </span>
                            </div>
                        </div>

                        {/* Refund Amount */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                <DollarSign size={13} className="text-slate-400" />
                                Monto a Devolver (S/)
                            </label>
                            <input
                                type="number"
                                min={0}
                                max={reservedAmount}
                                step={0.01}
                                value={refundAmount}
                                onChange={e => setRefundAmount(parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none font-bold text-slate-800"
                            />
                            {isRetention && (
                                <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
                                    <AlertTriangle size={13} className="text-amber-500 shrink-0" />
                                    <p className="text-[11px] text-amber-700">
                                        Retención: <strong>S/ {retentionAmount.toFixed(2)}</strong> ({retentionPct}%) por gastos administrativos
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Reason */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                <MessageSquare size={13} className="text-slate-400" />
                                Motivo de Devolución
                            </label>
                            <div className="space-y-1.5">
                                {REFUND_REASONS.map(r => (
                                    <button
                                        key={r}
                                        onClick={() => setReason(r)}
                                        className={`w-full text-left px-3 py-2 text-xs rounded-lg border transition-all ${reason === r ? 'border-orange-400 bg-orange-50 text-orange-800 font-semibold' : 'border-slate-200 text-slate-600 hover:border-orange-200 hover:bg-slate-50'}`}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                            {reason === 'Otro motivo' && (
                                <textarea
                                    placeholder="Describa el motivo..."
                                    value={customReason}
                                    onChange={e => setCustomReason(e.target.value)}
                                    className="mt-2 w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-400 outline-none h-16 resize-none"
                                />
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-1">
                            <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-medium rounded-xl text-sm hover:bg-slate-50 transition-colors">
                                Cancelar
                            </button>
                            <button
                                disabled={!canProceed}
                                onClick={() => setStep('confirm')}
                                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Continuar
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Confirmation Step */
                    <div className="p-5 space-y-4">
                        <div className="flex flex-col items-center text-center py-2">
                            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-3">
                                <AlertTriangle size={28} className="text-red-500" />
                            </div>
                            <h3 className="font-bold text-slate-800 text-base">¿Confirmar Devolución?</h3>
                            <p className="text-xs text-slate-500 mt-1">Esta acción no se puede deshacer fácilmente</p>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Lote a liberar</span>
                                <span className="font-bold text-slate-800">{lot.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Cliente</span>
                                <span className="font-bold text-slate-800">{clientName}</span>
                            </div>
                            <div className="border-t border-slate-200 pt-2 flex justify-between">
                                <span className="text-slate-500">Devolución</span>
                                <span className="font-bold text-green-700 text-sm">
                                    {new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(refundAmount)}
                                </span>
                            </div>
                            {isRetention && (
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Retención ({retentionPct}%)</span>
                                    <span className="font-bold text-amber-700">
                                        S/ {retentionAmount.toFixed(2)}
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between items-start border-t border-slate-200 pt-2">
                                <span className="text-slate-500">Motivo</span>
                                <span className="font-medium text-slate-700 text-right max-w-[60%]">{finalReason}</span>
                            </div>
                        </div>

                        <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex gap-2 items-start">
                            <FileText size={13} className="text-blue-500 mt-0.5 shrink-0" />
                            <p className="text-[11px] text-blue-700">
                                Se generará automáticamente una <strong>nota de crédito o cancelación de orden</strong> en Odoo según el estado de facturación.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setStep('form')} className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-medium rounded-xl text-sm hover:bg-slate-50 transition-colors">
                                Atrás
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={isProcessing}
                                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isProcessing ? (
                                    <><Loader2 size={16} className="animate-spin" /> Procesando...</>
                                ) : (
                                    'Confirmar Devolución'
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
