'use client';

import { useState, useRef } from 'react';
import { X, Upload, FileText, Loader2, AlertCircle, CheckCircle2, Calendar, Building2, Hash } from 'lucide-react';

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

    // Form data
    const [reportedAmount, setReportedAmount] = useState(amount.toString());
    const [transferDate, setTransferDate] = useState('');
    const [bankName, setBankName] = useState('');
    const [operationNumber, setOperationNumber] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];

        if (!selectedFile) return;

        // Validar tamaño (5MB máx)
        if (selectedFile.size > 5 * 1024 * 1024) {
            setError('El archivo no debe exceder 5MB');
            return;
        }

        // Validar tipo
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        if (!allowedTypes.includes(selectedFile.type)) {
            setError('Solo se permiten imágenes (JPG, PNG) o PDF');
            return;
        }

        setError('');
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!file) {
            setError('Debes seleccionar un archivo');
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
                setError(data.error || 'Error al subir comprobante');
            }
        } catch (err: any) {
            setError(err.message || 'Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
                            <Upload size={20} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">Subir Comprobante</h3>
                            <p className="text-sm text-slate-500">Transferencia Bancaria</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        disabled={loading}
                    >
                        <X size={20} className="text-slate-600" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {!success ? (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Payment Info */}
                            <div className="bg-slate-50 rounded-xl p-4">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-slate-500">Referencia:</span>
                                        <p className="font-mono font-bold text-slate-800 text-xs mt-1">{paymentReference}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-slate-500">Monto:</span>
                                        <p className="text-xl font-bold text-[#A145F5] mt-1">S/ {amount.toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Alert */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <p className="text-sm text-blue-800">
                                    <strong>Importante:</strong> Al transferir, incluye la referencia{' '}
                                    <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-xs">{paymentReference}</code>
                                    {' '}en el concepto para agilizar la validación.
                                </p>
                            </div>

                            {error && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                                    <AlertCircle size={18} className="text-red-600 mt-0.5" />
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            )}

                            {/* Bank Details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        <Building2 size={14} className="inline mr-1" />
                                        Banco
                                    </label>
                                    <select
                                        value={bankName}
                                        onChange={(e) => setBankName(e.target.value)}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#A145F5] focus:border-transparent outline-none"
                                        required
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
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        <Calendar size={14} className="inline mr-1" />
                                        Fecha de Transferencia
                                    </label>
                                    <input
                                        type="date"
                                        value={transferDate}
                                        onChange={(e) => setTransferDate(e.target.value)}
                                        max={new Date().toISOString().split('T')[0]}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#A145F5] focus:border-transparent outline-none"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        <Hash size={14} className="inline mr-1" />
                                        Nro. de Operación
                                    </label>
                                    <input
                                        type="text"
                                        value={operationNumber}
                                        onChange={(e) => setOperationNumber(e.target.value)}
                                        placeholder="Ej: 001234567890"
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#A145F5] focus:border-transparent outline-none"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        Monto Transferido (S/)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={reportedAmount}
                                        onChange={(e) => setReportedAmount(e.target.value)}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#A145F5] focus:border-transparent outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            {/* File Upload */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    Comprobante (JPG, PNG o PDF)
                                </label>

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/jpg,application/pdf"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />

                                {!file ? (
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full border-2 border-dashed border-slate-300 rounded-xl p-8 hover:border-[#A145F5] hover:bg-[#A145F5]/5 transition-colors"
                                    >
                                        <Upload size={40} className="mx-auto text-slate-400 mb-2" />
                                        <p className="text-slate-600 font-medium">Haz clic para seleccionar archivo</p>
                                        <p className="text-sm text-slate-400 mt-1">Máximo 5MB</p>
                                    </button>
                                ) : (
                                    <div className="border border-slate-200 rounded-xl p-4">
                                        {preview ? (
                                            <img src={preview} alt="Preview" className="w-full rounded-lg mb-4" />
                                        ) : (
                                            <div className="flex items-center justify-center p-8 bg-slate-50 rounded-lg">
                                                <FileText size={48} className="text-slate-400" />
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between mt-4">
                                            <div className="flex items-center gap-2">
                                                <FileText size={20} className="text-slate-600" />
                                                <span className="text-sm font-medium text-slate-700">{file.name}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFile(null);
                                                    setPreview(null);
                                                }}
                                                className="text-sm text-red-600 hover:text-red-700 font-medium"
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
                                disabled={loading || !file}
                                className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                        <div className="text-center py-12">
                            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 size={40} className="text-emerald-600" />
                            </div>
                            <h4 className="text-2xl font-bold text-emerald-600 mb-2">¡Comprobante Enviado!</h4>
                            <p className="text-slate-600">Te notificaremos cuando sea validado</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
