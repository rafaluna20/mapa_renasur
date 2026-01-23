'use client';

import { Info, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

interface VoucherStatusAlertProps {
    status: 'pending' | 'approved' | 'rejected' | string;
    submittedAt?: string;
}

export default function VoucherStatusAlert({ status, submittedAt }: VoucherStatusAlertProps) {
    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('es-PE', {
            day: '2-digit',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    switch (status) {
        case 'pending':
            return (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-4">
                    <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Clock size={20} className="text-amber-600" />
                    </div>
                    <div>
                        <h4 className="font-bold text-amber-900">Pago en Revisión ⏳</h4>
                        <p className="text-sm text-amber-800 mt-1">
                            Tu comprobante subido el <span className="font-semibold">{formatDate(submittedAt)}</span> está siendo validado por nuestro equipo.
                        </p>
                        <p className="text-xs text-amber-700 mt-2 italic">
                            * El proceso puede demorar hasta 24 horas hábiles. Te avisaremos por correo.
                        </p>
                    </div>
                </div>
            );
        case 'approved':
            return (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-4">
                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 size={20} className="text-emerald-600" />
                    </div>
                    <div>
                        <h4 className="font-bold text-emerald-900">¡Pago Validado! ✅</h4>
                        <p className="text-sm text-emerald-800 mt-1">
                            ¡Excelentes noticias! Tu pago ha sido confirmado y procesado exitosamente. Todo está al día.
                        </p>
                    </div>
                </div>
            );
        case 'rejected':
            return (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-4">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <AlertCircle size={20} className="text-red-600" />
                    </div>
                    <div>
                        <h4 className="font-bold text-red-900">Comprobante Rechazado ❌</h4>
                        <p className="text-sm text-red-800 mt-1">
                            Hubo un inconveniente al validar tu comprobante. Por favor, verifica los datos e intenta subirlo de nuevo o contacta con soporte.
                        </p>
                    </div>
                </div>
            );
        default:
            return null;
    }
}
