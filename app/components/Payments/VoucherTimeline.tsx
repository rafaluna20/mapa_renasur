'use client';

import { Check, Clock, ShieldCheck, ArrowRight } from 'lucide-react';

interface VoucherTimelineProps {
    status: 'pending' | 'approved' | 'rejected' | string;
    submittedAt?: string;
}

export default function VoucherTimeline({ status, submittedAt }: VoucherTimelineProps) {
    const isApproved = status === 'approved';
    const isPending = status === 'pending';
    const isRejected = status === 'rejected';

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '---';
        return new Date(dateStr).toLocaleDateString('es-PE', {
            day: '2-digit',
            month: 'short'
        });
    };

    return (
        <div className="relative py-4">
            <div className="flex items-center justify-between">
                {/* Step 1: Uploaded */}
                <div className="flex flex-col items-center gap-2 relative z-10">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white ring-4 ring-white shadow-sm">
                        <Check size={16} />
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Paso 1</p>
                        <p className="text-xs font-bold text-slate-800">Subido</p>
                        <p className="text-[10px] text-slate-500">{formatDate(submittedAt)}</p>
                    </div>
                </div>

                {/* Connecting Line 1 */}
                <div className={`flex-1 h-0.5 mx-2 bg-slate-200 relative -mt-8`}>
                    <div className={`absolute inset-0 bg-emerald-600 transition-all duration-700 ${isApproved || isPending ? 'w-full' : 'w-0'}`} />
                </div>

                {/* Step 2: Review */}
                <div className="flex flex-col items-center gap-2 relative z-10">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ring-4 ring-white shadow-sm transition-colors ${isApproved ? 'bg-emerald-600 text-white' :
                            isRejected ? 'bg-red-500 text-white' :
                                'bg-amber-100 text-amber-600 animate-pulse'
                        }`}>
                        {isApproved ? <Check size={16} /> : isRejected ? <Check size={16} /> : <Clock size={16} />}
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Paso 2</p>
                        <p className={`text-xs font-bold ${isPending ? 'text-amber-600' : isRejected ? 'text-red-600' : 'text-slate-800'}`}>
                            {isRejected ? 'Rechazado' : 'En Revisión'}
                        </p>
                    </div>
                </div>

                {/* Connecting Line 2 */}
                <div className={`flex-1 h-0.5 mx-2 bg-slate-200 relative -mt-8`}>
                    <div className={`absolute inset-0 bg-emerald-600 transition-all duration-700 ${isApproved ? 'w-full' : 'w-0'}`} />
                </div>

                {/* Step 3: Validated */}
                <div className="flex flex-col items-center gap-2 relative z-10">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ring-4 ring-white shadow-sm transition-colors ${isApproved ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'
                        }`}>
                        <ShieldCheck size={16} />
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Paso 3</p>
                        <p className={`text-xs font-bold ${isApproved ? 'text-emerald-600' : 'text-slate-400'}`}>Validado</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
