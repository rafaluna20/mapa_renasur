'use client';

import { useState } from 'react';
import { X, FileText, Download, Loader2, AlertTriangle } from 'lucide-react';
import { ElementoUrbano } from '@/app/data/elementosUrbanos';
import { SHADOW_FLOATING, BORDER_FLOATING } from '@/app/lib/designTokens';

interface MatrizPlanoModalProps {
    elemento: ElementoUrbano;
    onClose: () => void;
}

/**
 * Modal para generar el Plano Perimétrico de una MATRIZ (el predio original
 * completo antes de la subdivisión en lotes) — solo administradores, ver el
 * gate en MapArea.tsx (onMatrizClick solo se pasa cuando currentUser.is_system).
 * Mismo patrón de descarga que "Descargar Resumen" en LotDetailModal.tsx:
 * la ruta responde el PDF directo en la misma request, sin polling.
 */
export default function MatrizPlanoModal({ elemento, onClose }: MatrizPlanoModalProps) {
    const [state, setState] = useState<{ status: 'idle' | 'generando' | 'error'; error?: string }>({ status: 'idle' });

    const handleDescargar = async () => {
        setState({ status: 'generando' });
        try {
            const res = await fetch('/api/planos/generar-matriz', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ codigo: elemento.codigo }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                setState({ status: 'error', error: data?.error?.message || 'No se pudo generar el plano de la matriz' });
                return;
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `matriz_${elemento.codigo}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setState({ status: 'idle' });
        } catch (error) {
            setState({ status: 'error', error: error instanceof Error ? error.message : 'Error de red' });
        }
    };

    return (
        <div
            className="fixed inset-0 z-[2000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className={`bg-white dark:bg-slate-900 rounded-2xl ${SHADOW_FLOATING} ${BORDER_FLOATING} dark:border-slate-700 overflow-hidden max-w-sm w-full animate-in zoom-in-95 fade-in duration-200`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 min-w-0">
                        <FileText size={16} className="text-red-500 shrink-0" />
                        <span className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{elemento.nombre}</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0"
                        aria-label="Cerrar"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-4 space-y-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Genera el Plano Perimétrico completo de la matriz (predio original antes de la subdivisión en lotes), con su copia.
                    </p>
                    <button
                        onClick={handleDescargar}
                        disabled={state.status === 'generando'}
                        className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-600/60 disabled:cursor-not-allowed text-white rounded-lg font-bold text-xs uppercase tracking-wide transition-colors flex items-center justify-center gap-2"
                    >
                        {state.status === 'generando' ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <Download size={14} />
                        )}
                        {state.status === 'generando' ? 'Generando plano...' : 'Generar Plano Perimétrico'}
                    </button>
                    {state.status === 'error' && (
                        <div className="flex items-start gap-2 text-red-600 dark:text-red-400 text-xs">
                            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                            <span>{state.error}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
