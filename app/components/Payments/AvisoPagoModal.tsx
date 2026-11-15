'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Upload, FileText, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { validateFileType } from '@/app/utils/fileValidation';
import { useFocusTrap } from '@/app/hooks/useFocusTrap';
import BankDetailsCard from './BankDetailsCard';
import { formatMoney, type CurrencyCode } from '@/app/utils/money';

/**
 * «Informar pago» de una cuota que todavía no tiene factura (contrato de facturación Manual). El comprobante de la factura
 * no aplica aquí porque aún no hay factura: el cliente deja su transferencia como AVISO y administración la verifica y emite
 * el comprobante cuando confirma el dinero. Ver app/api/avisos-pago/route.ts.
 */
interface AvisoPagoModalProps {
    contractId: number;
    quotaNumber: number;
    /** Monto de la cuota según el cronograma: es el valor que se sugiere. */
    amount: number;
    currency?: CurrencyCode;
    /** Texto de la cuota para mostrar ("Cuota N° 3"). */
    quotaLabel: string;
    onClose: () => void;
    onSuccess: () => void;
}

const hoyISO = () => {
    const d = new Date();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
};

export default function AvisoPagoModal({ contractId, quotaNumber, amount, currency = 'PEN', quotaLabel, onClose, onSuccess }: AvisoPagoModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [enviado, setEnviado] = useState<{ enObservacion: boolean } | null>(null);

    const [reportedAmount, setReportedAmount] = useState(String(amount));
    const [transferDate, setTransferDate] = useState(hoyISO());
    const [bankName, setBankName] = useState('');
    const [operationNumber, setOperationNumber] = useState('');
    const [note, setNote] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const modalRef = useFocusTrap<HTMLDivElement>();

    useEffect(() => {
        const alEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !loading) onClose();
        };
        window.addEventListener('keydown', alEscape);
        return () => window.removeEventListener('keydown', alEscape);
    }, [loading, onClose]);

    const montoNumero = parseFloat(reportedAmount);
    const montoDistinto = !Number.isNaN(montoNumero) && Math.abs(montoNumero - amount) > 0.01;

    const alElegirArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const elegido = e.target.files?.[0];
        if (!elegido) return;
        setError('');
        const validacion = await validateFileType(elegido);
        if (!validacion.isValid) {
            setError(validacion.error || 'Archivo no válido');
            return;
        }
        setFile(elegido);
    };

    const alEnviar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) {
            setError('Adjunte el comprobante de la transferencia.');
            return;
        }
        if (!operationNumber.trim()) {
            setError('Indique el número de operación.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('contract_id', String(contractId));
            formData.append('quota_number', String(quotaNumber));
            formData.append('amount', reportedAmount);
            formData.append('transfer_date', transferDate);
            formData.append('bank_name', bankName);
            formData.append('operation_number', operationNumber);
            formData.append('note', note);
            const respuesta = await fetch('/api/avisos-pago', { method: 'POST', body: formData });
            const datos = await respuesta.json().catch(() => ({}));
            if (!respuesta.ok || !datos.success) {
                setError(datos.error || 'No se pudo enviar el aviso. Inténtelo de nuevo.');
                return;
            }
            setEnviado({ enObservacion: datos.notice?.state === 'observed' });
            onSuccess();
        } catch {
            setError('No se pudo enviar el aviso. Revise su conexión e inténtelo de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="aviso-pago-titulo">
            <div ref={modalRef} className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-start justify-between p-5 border-b border-slate-100">
                    <div>
                        <h2 id="aviso-pago-titulo" className="text-base font-bold text-slate-800">Informar pago</h2>
                        <p className="text-xs text-slate-500 mt-0.5">{quotaLabel} · {formatMoney(amount, currency)}</p>
                    </div>
                    <button type="button" onClick={onClose} disabled={loading} aria-label="Cerrar" className="p-1 rounded-lg hover:bg-slate-100">
                        <X size={18} />
                    </button>
                </div>

                {enviado ? (
                    <div className="p-6 text-center space-y-3">
                        <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
                        <p className="font-bold text-slate-800">Aviso enviado</p>
                        <p className="text-sm text-slate-600">
                            Administración verificará su transferencia y, cuando confirme el dinero, emitirá su comprobante.
                            {enviado.enObservacion && ' Como el monto informado no coincide con la cuota, se comunicarán con usted.'}
                        </p>
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium">
                            Entendido
                        </button>
                    </div>
                ) : (
                    <form onSubmit={alEnviar} className="p-5 space-y-4">
                        <BankDetailsCard paymentReference={quotaLabel} amount={amount} currency={currency} />

                        <div className="grid grid-cols-2 gap-3">
                            <label className="text-xs font-semibold text-slate-600">
                                Monto transferido
                                <input type="number" step="0.01" min="0.01" required value={reportedAmount}
                                    onChange={(e) => setReportedAmount(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                            </label>
                            <label className="text-xs font-semibold text-slate-600">
                                Fecha de la transferencia
                                <input type="date" required max={hoyISO()} value={transferDate}
                                    onChange={(e) => setTransferDate(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                            </label>
                            <label className="text-xs font-semibold text-slate-600">
                                Banco (opcional)
                                <input type="text" maxLength={100} value={bankName} onChange={(e) => setBankName(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                            </label>
                            <label className="text-xs font-semibold text-slate-600">
                                N° de operación
                                <input type="text" required maxLength={100} value={operationNumber} onChange={(e) => setOperationNumber(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                            </label>
                        </div>

                        {montoDistinto && (
                            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2" role="status">
                                El monto ({formatMoney(montoNumero, currency)}) difiere de la cuota ({formatMoney(amount, currency)}). Puede
                                enviarlo igual: administración se comunicará con usted para resolverlo.
                            </p>
                        )}

                        <label className="block text-xs font-semibold text-slate-600">
                            Nota (opcional)
                            <textarea maxLength={500} rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                        </label>

                        <div>
                            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,application/pdf" onChange={alElegirArchivo} className="hidden" />
                            <button type="button" onClick={() => fileInputRef.current?.click()}
                                className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 p-4 text-sm text-slate-600 hover:border-blue-400">
                                {file ? <><FileText size={16} /> {file.name}</> : <><Upload size={16} /> Adjuntar comprobante (JPG, PNG o PDF, máx. 5 MB)</>}
                            </button>
                        </div>

                        {error && (
                            <p className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3" role="alert">
                                <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
                            </p>
                        )}

                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={onClose} disabled={loading}
                                className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700">
                                Cancelar
                            </button>
                            <button type="submit" disabled={loading}
                                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-60 flex items-center gap-2">
                                {loading && <Loader2 size={14} className="animate-spin" />} Enviar aviso
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
