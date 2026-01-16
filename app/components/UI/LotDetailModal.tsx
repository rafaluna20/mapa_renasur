import { Lot } from '@/app/data/lotsData';
import { X, User } from 'lucide-react';

interface StatusConfigItem {
    color: string;
    label: string;
    bg: string;
    text: string;
}

interface LotDetailModalProps {
    lot: Lot | null;
    onClose: () => void;
    onUpdateStatus?: (id: string, status: string) => void;
}

const STATUS_CONFIG: Record<string, StatusConfigItem> = {
    libre: { color: "#10B981", label: "Disponible", bg: "bg-emerald-100", text: "text-emerald-800" },
    separado: { color: "#F59E0B", label: "Reservado", bg: "bg-amber-100", text: "text-amber-800" },
    vendido: { color: "#EF4444", label: "Vendido", bg: "bg-red-100", text: "text-red-800" },
};

export default function LotDetailModal({ lot, onClose, onUpdateStatus }: LotDetailModalProps) {
    if (!lot) return null;
    const config = STATUS_CONFIG[lot.x_statu] || STATUS_CONFIG.libre;

    return (
        <div className="fixed md:absolute bottom-0 left-0 md:left-auto md:bottom-auto md:top-4 md:right-4 w-full md:w-80 bg-white rounded-t-2xl md:rounded-xl shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.2)] md:shadow-2xl border-t md:border border-slate-200 overflow-hidden z-[1000] animate-in slide-in-from-bottom-12 md:slide-in-from-right-8 fade-in duration-300 md:origin-top-right md:scale-[0.7]">
            <div className={`h-24 ${config.bg} flex items-center justify-center relative`}>
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 p-1 bg-white/50 hover:bg-white rounded-full transition-colors"
                >
                    <X size={16} className="text-slate-600" />
                </button>
                <div className="text-center">
                    <h2 className={`text-2xl font-bold ${config.text} capitalize px-4`}>{lot.name}</h2>
                    <span className={`text-sm font-medium ${config.text} opacity-80 uppercase tracking-wide`}>{config.label}</span>
                </div>
            </div>

            <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-3 rounded-lg text-center">
                        <p className="text-xs text-slate-500 mb-1">Precio</p>
                        <p className="font-bold text-slate-800 text-lg">$ {lot.list_price.toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg text-center">
                        <p className="text-xs text-slate-500 mb-1">Área Aprox.</p>
                        <p className="font-bold text-slate-800 text-lg">{Number(lot.x_area).toFixed(2)} m²</p>
                    </div>
                </div>

                {lot.points && lot.points.length > 0 && (
                    <div className="text-xs text-slate-400 text-center font-mono">
                        UTM: {lot.points[0][0].toFixed(2)}, {lot.points[0][1].toFixed(2)}
                    </div>
                )}

                {(lot.x_statu === 'vendido' || lot.x_statu === 'separado') && (
                    <div className="flex items-center gap-3 p-3 bg-blue-50 text-blue-800 rounded-lg border border-blue-100">
                        <User size={20} />
                        <div>
                            <p className="text-xs opacity-70">Cliente Asignado</p>
                            <p className="font-semibold">{lot.image ? 'Cliente VIP' : 'Cliente Ejemplo'}</p>
                        </div>
                    </div>
                )}

                <div className="pt-4 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-400 mb-2 uppercase">Acciones Rápidas</p>
                    <div className="grid grid-cols-2 gap-2">
                        {lot.x_statu === 'libre' && onUpdateStatus && (
                            <button
                                onClick={() => onUpdateStatus(lot.id, 'separado')}
                                className="bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-lg font-medium text-sm transition-colors"
                            >
                                Reservar
                            </button>
                        )}
                        {lot.x_statu === 'separado' && onUpdateStatus && (
                            <button
                                onClick={() => onUpdateStatus(lot.id, 'vendido')}
                                className="bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium text-sm transition-colors"
                            >
                                Vender
                            </button>
                        )}
                        {(lot.x_statu === 'separado' || lot.x_statu === 'vendido') && onUpdateStatus && (
                            <button
                                onClick={() => onUpdateStatus(lot.id, 'libre')}
                                className="border border-slate-300 hover:bg-slate-50 text-slate-600 py-2 rounded-lg font-medium text-sm transition-colors"
                            >
                                Liberar
                            </button>
                        )}
                        <button className="border border-slate-300 hover:bg-slate-50 text-slate-600 py-2 rounded-lg font-medium text-sm transition-colors">
                            Ver en Odoo
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
