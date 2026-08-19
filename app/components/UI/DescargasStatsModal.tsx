import { X, BarChart3, Loader2, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

interface StatsData {
    totalResumenDescargas: number;
    totalCompletosGenerados: number;
    porUsuario: { staffUid: number | null; staffNombre: string | null; resumenDescargas: number }[];
}

interface DescargasStatsModalProps {
    onClose: () => void;
}

/**
 * Estadísticas de descargas del documento "resumen" (linderos + copia del
 * plano) por usuario, y el total de expedientes completos generados. Solo
 * visible para administradores (ver botón "Ver estadísticas" en
 * LotDetailModal, gate is_system).
 */
export default function DescargasStatsModal({ onClose }: DescargasStatsModalProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<StatsData | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch('/api/planos/descargas-stats');
                const json = await res.json();
                if (cancelled) return;
                if (!json.success) {
                    setError(json.error?.message || 'No se pudieron cargar las estadísticas');
                    return;
                }
                setData(json.data);
            } catch (e) {
                if (!cancelled) setError(e instanceof Error ? e.message : 'Error de red');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1200] animate-in fade-in duration-200 flex items-center justify-center px-3 pt-10 pb-4">
            <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200" style={{ maxHeight: 'min(85dvh, 590px)' }}>
                <div className="bg-slate-800 px-4 py-3 flex justify-between items-center text-white shrink-0 rounded-t-xl">
                    <h2 className="font-bold text-[15px] flex items-center gap-2">
                        <BarChart3 size={18} />
                        Descargas de Planos
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
                    {loading && (
                        <div className="flex items-center justify-center gap-2 py-8 text-slate-500 dark:text-slate-400 text-sm">
                            <Loader2 size={16} className="animate-spin" />
                            Cargando...
                        </div>
                    )}

                    {!loading && error && (
                        <div className="flex items-start gap-2 text-red-600 dark:text-red-400 text-sm py-4">
                            <AlertCircle size={16} className="shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {!loading && data && (
                        <>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{data.totalResumenDescargas}</p>
                                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold mt-1">Resúmenes descargados</p>
                                </div>
                                <div className="bg-slate-100 dark:bg-slate-700 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-slate-700 dark:text-slate-200">{data.totalCompletosGenerados}</p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold mt-1">Expedientes completos</p>
                                </div>
                            </div>

                            <div>
                                <p className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">Resúmenes por usuario</p>
                                {data.porUsuario.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">Todavía no hay descargas registradas.</p>
                                ) : (
                                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                        {data.porUsuario.map((row, i) => (
                                            <div
                                                key={`${row.staffUid ?? 'sin-uid'}-${i}`}
                                                className={`flex justify-between items-center px-3 py-2 text-sm ${i % 2 === 1 ? 'bg-slate-50 dark:bg-slate-700/40' : ''}`}
                                            >
                                                <span className="text-slate-700 dark:text-slate-200">{row.staffNombre || 'Desconocido'}</span>
                                                <span className="font-bold text-slate-800 dark:text-slate-100">{row.resumenDescargas}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
