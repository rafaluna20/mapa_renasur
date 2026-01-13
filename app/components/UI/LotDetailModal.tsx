import { Lot } from '@/app/data/lotsData';
import { X, User, CheckCircle, AlertCircle, XCircle } from 'lucide-react';

interface LotDetailModalProps {
    lot: Lot | null;
    onClose: () => void;
    onUpdateStatus?: (id: string, status: 'available' | 'reserved' | 'sold') => void;
}

const STATUS_CONFIG = {
    available: { color: "#10B981", label: "Disponible", bg: "bg-emerald-100", text: "text-emerald-800" },
    reserved: { color: "#F59E0B", label: "Reservado", bg: "bg-amber-100", text: "text-amber-800" },
    sold: { color: "#EF4444", label: "Vendido", bg: "bg-red-100", text: "text-red-800" },
};

export default function LotDetailModal({ lot, onClose, onUpdateStatus }: LotDetailModalProps) {
    if (!lot) return null;
    const config = STATUS_CONFIG[lot.status] || STATUS_CONFIG.available;

    return (
        <div className="absolute top-4 right-4 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-[1000] animate-in fade-in slide-in-from-right-10 duration-200">
            <div className={`h-24 ${config.bg} flex items-center justify-center relative`}>
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 p-1 bg-white/50 hover:bg-white rounded-full transition-colors"
                >
                    <X size={16} className="text-slate-600" />
                </button>
                <div className="text-center">
                    <h2 className={`text-3xl font-bold ${config.text}`}>{lot.name}</h2>
                    <span className={`text-sm font-medium ${config.text} opacity-80 uppercase tracking-wide`}>{config.label}</span>
                </div>
            </div>

            <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-3 rounded-lg text-center">
                        <p className="text-xs text-slate-500 mb-1">Precio</p>
                        <p className="font-bold text-slate-800 text-lg">$ {lot.price.toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg text-center">
                        <p className="text-xs text-slate-500 mb-1">Área Aprox.</p>
                        <p className="font-bold text-slate-800 text-lg">{lot.area.toLocaleString()} m²</p>
                    </div>
                </div>

                {lot.points && lot.points.length > 0 && (
                    <div className="text-xs text-slate-400 text-center font-mono">
                        UTM: {lot.points[0][0].toFixed(2)}, {lot.points[0][1].toFixed(2)}
                    </div>
                )}

                {(lot.status === 'sold' || lot.status === 'reserved') && (
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
                        {lot.status === 'available' && onUpdateStatus && (
                            <button
                                onClick={() => onUpdateStatus(lot.id, 'reserved')}
                                className="bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-lg font-medium text-sm transition-colors"
                            >
                                Reservar
                            </button>
                        )}
                        {lot.status === 'reserved' && onUpdateStatus && (
                            <button
                                onClick={() => onUpdateStatus(lot.id, 'sold')}
                                className="bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium text-sm transition-colors"
                            >
                                Vender
                            </button>
                        )}
                        {(lot.status === 'reserved' || lot.status === 'sold') && onUpdateStatus && (
                            <button
                                onClick={() => onUpdateStatus(lot.id, 'available')}
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
