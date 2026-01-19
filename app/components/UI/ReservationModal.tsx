import { X, Upload, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { useState, useRef } from 'react';
import { Lot } from '@/app/data/lotsData';
import { odooService } from '@/app/services/odooService';
import { useAuth } from '@/app/context/AuthContext';

interface ReservationModalProps {
    lot: Lot;
    onClose: () => void;
    onSuccess: () => void;
}

export default function ReservationModal({ lot, onClose, onSuccess }: ReservationModalProps) {
    const { user } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
        }
    };

    const handleSubmit = async () => {
        if (!file) {
            setError('Por favor adjunta el comprobante de pago.');
            return;
        }

        if (!user) {
            setError('Sesión no válida. Por favor recarga la página.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            // 1. Simular carga de archivo (Evidence Upload)
            // En el futuro esto subirá el archivo real a Odoo/S3
            await new Promise(resolve => setTimeout(resolve, 1500)); // Simulating network delay

            // 2. Realizar la reserva en Odoo (o cambio de estado)
            // Usamos un nuevo método específico para reservar con evidencia
            await odooService.reserveLotWithEvidence(lot.id, user.uid, file, notes);

            onSuccess();
            onClose();
        } catch (err) {
            console.error(err);
            setError('Hubo un error al procesar la reserva. Intenta nuevamente.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[95vh]">
                {/* Header */}
                <div className="bg-amber-500 p-4 flex justify-between items-center text-white">
                    <h2 className="font-bold text-lg flex items-center gap-2">
                        <FileText size={20} />
                        Confirmar Reserva
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 overflow-y-auto">
                    <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm text-amber-800 flex gap-2">
                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                        <p>Para reservar el lote <strong>{lot.name}</strong>, es necesario adjuntar la constancia de pago.</p>
                    </div>

                    {/* File Upload */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 block">Comprobante de Pago</label>
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${file ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
                                }`}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*,.pdf"
                                onChange={handleFileChange}
                            />
                            {file ? (
                                <>
                                    <div className="bg-emerald-100 p-2 rounded-full text-emerald-600 mb-2">
                                        <FileText size={24} />
                                    </div>
                                    <p className="text-sm font-medium text-emerald-700 truncate max-w-full text-center px-4">
                                        {file.name}
                                    </p>
                                    <p className="text-xs text-emerald-600 mt-1">Clic para cambiar archivo</p>
                                </>
                            ) : (
                                <>
                                    <div className="bg-slate-100 p-3 rounded-full text-slate-400 mb-2">
                                        <Upload size={24} />
                                    </div>
                                    <p className="text-sm font-medium text-slate-600">Haz clic para subir imagen o PDF</p>
                                    <p className="text-xs text-slate-400 mt-1">Máximo 5MB</p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 block">Notas Adicionales (Opcional)</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Ej: Cliente depositará el saldo mañana..."
                            className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none resize-none h-24"
                        />
                    </div>

                    {/* Error Message */}
                    {error && (
                        <p className="text-sm text-red-600 font-medium flex items-center gap-2 animate-in slide-in-from-top-2">
                            <AlertCircle size={14} />
                            {error}
                        </p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2 pb-2">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="flex-1 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors shadow-lg shadow-amber-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Procesando...
                                </>
                            ) : (
                                'Confirmar Reserva'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
