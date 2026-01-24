'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Upload, FileText, Loader2, AlertCircle, CheckCircle2, Calendar, Building2, Hash, Clock } from 'lucide-react';
import { validateFileType } from '@/app/utils/fileValidation';
import { useFocusTrap } from '@/app/hooks/useFocusTrap';
import BankDetailsCard from './BankDetailsCard';

interface VoucherUploadModalProps {
    invoiceId: number;
    paymentReference: string;
    amount: number;
    onClose: () => void;
    onSuccess: () => void;
}

export default function VoucherUploadModal({
    invoiceId,
    paymentReference,
    amount,
    onClose,
    onSuccess
}: VoucherUploadModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [amountWarning, setAmountWarning] = useState('');

    // Form data
    const [reportedAmount, setReportedAmount] = useState(amount.toString());
    const [transferDate, setTransferDate] = useState('');
    const [bankName, setBankName] = useState('');
    const [operationNumber, setOperationNumber] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const modalRef = useFocusTrap<HTMLDivElement>();

    // ✅ Manejar tecla Escape para cerrar
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !loading) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [loading, onClose]);

    // ✅ Validación mejorada de archivos con magic bytes
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];

        if (!selectedFile) return;

        setError('');

        // Validar con magic bytes
        const validation = await validateFileType(selectedFile);
        
        if (!validation.isValid) {
            setError(validation.error || 'Archivo no válido');
            return;
        }

        setFile(selectedFile);

        // Generar preview si es imagen
        if (selectedFile.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => setPreview(e.target?.result as string);
            reader.readAsDataURL(selectedFile);
        } else {
            setPreview(null);
        }
    };

    // ✅ Validación de monto en tiempo real
    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setReportedAmount(value);

        const numValue = parseFloat(value);
        const tolerance = 0.01;

        if (!isNaN(numValue) && Math.abs(numValue - amount) > tolerance) {
            setAmountWarning(
                `⚠️ El monto ingresado (S/ ${numValue.toFixed(2)}) difiere del monto de la factura (S/ ${amount.toFixed(2)})`
            );
        } else {
            setAmountWarning('');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!file) {
            setError('Debes seleccionar un archivo');
            return;
        }

        // ✅ Validar monto antes de enviar
        const numAmount = parseFloat(reportedAmount);
        if (Math.abs(numAmount - amount) > 0.01) {
            setError('El monto debe coincidir con el monto de la factura');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('invoice_id', invoiceId.toString());
            formData.append('amount', reportedAmount);
            formData.append('transfer_date', transferDate);
            formData.append('bank_name', bankName);
            formData.append('operation_number', operationNumber);

            const response = await fetch('/api/vouchers/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                setSuccess(true);
                setTimeout(() => {
                    onSuccess();
                    onClose();
                }, 2000);
            } else {
                // ✅ Mensajes de error mejorados
                if (response.status === 429) {
                    setError('Has alcanzado el límite de intentos. Por favor, espera unos minutos antes de intentar nuevamente.');
                } else if (response.status === 409) {
                    setError(data.error || 'Ya existe un comprobante pendiente para esta factura.');
                } else {
                    setError(data.error || 'Error al subir comprobante. Por favor, verifica tu conexión e intenta nuevamente.');
                }
                console.error('[VOUCHER_UPLOAD] Error:', data.error);
            }
        } catch (err: any) {
            console.error('[VOUCHER_UPLOAD] Network error:', err);
            setError('No pudimos conectar con el servidor. Verifica tu conexión a internet e intenta nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
            <div 
                ref={modalRef}
                className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
                            <Upload size={20} className="text-white" />
                        </div>
                        <div>
                            <h3 id="modal-title" className="text-xl font-bold text-slate-800">Subir Comprobante</h3>
                            <p className="text-sm text-slate-500">Transferencia Bancaria</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        disabled={loading}
                        aria-label="Cerrar modal"
                    >
                        <X size={20} className="text-slate-600" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {!success ? (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* ✅ Bank Details Card with Copy Buttons */}
                            <BankDetailsCard 
                                paymentReference={paymentReference}
                                amount={amount}
                            />

                            {error && (
                                <div 
                                    className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2"
                                    role="alert"
                                    aria-live="assertive"
                                >
                                    <AlertCircle size={18} className="text-red-600 mt-0.5 flex-shrink-0" />
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            )}

                            {/* Bank Details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="bank-name" className="block text-sm font-bold text-slate-700 mb-2">
                                        <Building2 size={14} className="inline mr-1" />
                                        Banco Origen
                                    </label>
                                    <select
                                        id="bank-name"
                                        value={bankName}
                                        onChange={(e) => setBankName(e.target.value)}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#A145F5] focus:border-transparent outline-none"
                                        required
                                        aria-required="true"
                                    >
                                        <option value="">Seleccionar...</option>
                                        <option value="BCP">BCP</option>
                                        <option value="Interbank">Interbank</option>
                                        <option value="BBVA">BBVA</option>
                                        <option value="Scotiabank">Scotiabank</option>
                                        <option value="Banbif">Banbif</option>
                                        <option value="Otro">Otro</option>
                                    </select>
                                </div>

                                <div>
                                    <label htmlFor="transfer-date" className="block text-sm font-bold text-slate-700 mb-2">
                                        <Calendar size={14} className="inline mr-1" />
                                        Fecha de Transferencia
                                    </label>
                                    <input
                                        id="transfer-date"
                                        type="date"
                                        value={transferDate}
                                        onChange={(e) => setTransferDate(e.target.value)}
                                        max={new Date().toISOString().split('T')[0]}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#A145F5] focus:border-transparent outline-none"
                                        required
                                        aria-required="true"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="operation-number" className="block text-sm font-bold text-slate-700 mb-2">
                                        <Hash size={14} className="inline mr-1" />
                                        Nro. de Operación
                                    </label>
                                    <input
                                        id="operation-number"
                                        type="text"
                                        value={operationNumber}
                                        onChange={(e) => setOperationNumber(e.target.value)}
                                        placeholder="Ej: 001234567890"
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#A145F5] focus:border-transparent outline-none"
                                        required
                                        aria-required="true"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="reported-amount" className="block text-sm font-bold text-slate-700 mb-2">
                                        Monto Transferido (S/)
                                    </label>
                                    <input
                                        id="reported-amount"
                                        type="number"
                                        step="0.01"
                                        value={reportedAmount}
                                        onChange={handleAmountChange}
                                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#A145F5] focus:border-transparent outline-none ${
                                            amountWarning ? 'border-amber-400' : 'border-slate-300'
                                        }`}
                                        required
                                        aria-required="true"
                                        aria-describedby={amountWarning ? 'amount-warning' : undefined}
                                    />
                                </div>
                            </div>

                            {/* ✅ Amount Warning */}
                            {amountWarning && (
                                <div 
                                    id="amount-warning"
                                    className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2"
                                    role="alert"
                                    aria-live="polite"
                                >
                                    <AlertCircle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
                                    <p className="text-sm text-amber-800">{amountWarning}</p>
                                </div>
                            )}

                            {/* File Upload */}
                            <div>
                                <label htmlFor="file-upload" className="block text-sm font-bold text-slate-700 mb-2">
                                    Comprobante (JPG, PNG o PDF)
                                </label>

                                <input
                                    id="file-upload"
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/jpg,application/pdf"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                    aria-describedby="file-help"
                                />

                                {!file ? (
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full border-2 border-dashed border-slate-300 rounded-xl p-8 hover:border-[#A145F5] hover:bg-[#A145F5]/5 transition-colors"
                                        aria-label="Seleccionar archivo de comprobante"
                                    >
                                        <Upload size={40} className="mx-auto text-slate-400 mb-2" />
                                        <p className="text-slate-600 font-medium">Haz clic para seleccionar archivo</p>
                                        <p id="file-help" className="text-sm text-slate-400 mt-1">Máximo 5MB · JPG, PNG o PDF</p>
                                    </button>
                                ) : (
                                    <div className="border border-slate-200 rounded-xl p-4">
                                        {preview ? (
                                            <img src={preview} alt="Vista previa del comprobante" className="w-full rounded-lg mb-4" />
                                        ) : (
                                            <div className="flex items-center justify-center p-8 bg-slate-50 rounded-lg">
                                                <FileText size={48} className="text-slate-400" />
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between mt-4">
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <FileText size={20} className="text-slate-600 flex-shrink-0" />
                                                <span className="text-sm font-medium text-slate-700 truncate">{file.name}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFile(null);
                                                    setPreview(null);
                                                }}
                                                className="text-sm text-red-600 hover:text-red-700 font-medium ml-2 flex-shrink-0"
                                                aria-label="Eliminar archivo seleccionado"
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={loading || !file || !!amountWarning}
                                className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                aria-label={loading ? 'Subiendo comprobante...' : 'Enviar comprobante'}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        Subiendo...
                                    </>
                                ) : (
                                    <>
                                        <Upload size={20} />
                                        Enviar Comprobante
                                    </>
                                )}
                            </button>

                            <p className="text-xs text-slate-500 text-center">
                                Tu comprobante será validado en las próximas 24 horas hábiles
                            </p>
                        </form>
                    ) : (
                        <div className="text-center py-12" role="status" aria-live="polite">
                            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                                <Clock size={40} className="text-amber-600" />
                            </div>
                            <h4 className="text-2xl font-bold text-amber-600 mb-2">¡Comprobante en Revisión! ⏳</h4>
                            <p className="text-slate-600 max-w-sm mx-auto">
                                Hemos recibido tu comprobante. Nuestro equipo lo validará en las próximas 24 horas hábiles.
                            </p>
                            <div className="mt-6 p-4 bg-slate-50 rounded-xl text-xs text-slate-500 italic">
                                Recibirás una notificación por correo una vez que tu pago sea confirmado.
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
