'use client';

import { Clock, CheckCircle2, AlertCircle } from 'lucide-react';

interface VoucherStatusBadgeProps {
    status: 'pending' | 'approved' | 'rejected' | string;
    className?: string;
}

export default function VoucherStatusBadge({ status, className = '' }: VoucherStatusBadgeProps) {
    const getStatusConfig = () => {
        switch (status) {
            case 'pending':
                return {
                    label: 'En Revisión',
                    icon: <Clock size={12} />,
                    classes: 'bg-amber-50 text-amber-700 border-amber-200'
                };
            case 'approved':
                return {
                    label: 'Validado',
                    icon: <CheckCircle2 size={12} />,
                    classes: 'bg-emerald-50 text-emerald-700 border-emerald-200'
                };
            case 'rejected':
                return {
                    label: 'Rechazado',
                    icon: <AlertCircle size={12} />,
                    classes: 'bg-red-50 text-red-700 border-red-200'
                };
            default:
                return {
                    label: 'Desconocido',
                    icon: <Clock size={12} />,
                    classes: 'bg-slate-50 text-slate-700 border-slate-200'
                };
        }
    };

    const config = getStatusConfig();

    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${config.classes} ${className}`}
            role="status"
            aria-live="polite"
        >
            {config.icon}
            {config.label}
        </span>
    );
}
