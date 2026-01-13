import { Lot } from '@/app/data/lotsData';
import { X, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import Image from 'next/image';

interface LotDetailModalProps {
    lot: Lot | null;
    onClose: () => void;
}

export default function LotDetailModal({ lot, onClose }: LotDetailModalProps) {
    if (!lot) return null;

    const statusConfig = {
        available: { label: 'Disponible', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
        reserved: { label: 'Reservado', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: AlertCircle },
        sold: { label: 'Vendido', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
    };

    const config = statusConfig[lot.status] || { label: lot.status, color: 'bg-gray-100', icon: AlertCircle };
    const StatusIcon = config.icon;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
            <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-950 dark:border dark:border-zinc-800 flex flex-col max-h-[90vh]">

                {/* Header Image Area */}
                <div className="relative h-64 w-full shrink-0">
                    {lot.image ? (
                        <Image
                            src={lot.image}
                            alt={lot.name}
                            fill
                            className="object-cover"
                        />
                    ) : (
                        <div className="h-full w-full bg-zinc-200 dark:bg-zinc-900 flex items-center justify-center">
                            <span className="text-zinc-500">Imagen no disponible</span>
                        </div>
                    )}

                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 backdrop-blur-md transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>

                    <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                        <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-lg text-white">
                            <h2 className="text-2xl font-bold">{lot.name}</h2>
                            <p className="text-sm opacity-90">{lot.area.toLocaleString()} m² • ${lot.price.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto">
                    <div className="flex items-center gap-3 mb-6">
                        <div className={`px-4 py-2 rounded-lg flex items-center gap-2 font-medium ${config.color}`}>
                            <StatusIcon className="w-5 h-5" />
                            {config.label}
                        </div>
                        <div className="bg-zinc-100 dark:bg-zinc-900 px-4 py-2 rounded-lg text-zinc-600 dark:text-zinc-400 font-mono text-sm">
                            ID: {lot.id}
                        </div>
                    </div>

                    <div className="prose dark:prose-invert max-w-none mb-8">
                        <h3 className="text-lg font-semibold mb-2">Descripción</h3>
                        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            {lot.description || "No hay descripción detallada disponible para este lote."}
                        </p>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <div className="p-4 bg-zinc-50 rounded-xl border dark:bg-zinc-900/50 dark:border-zinc-800">
                            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Precio Total</p>
                            <p className="font-bold text-lg">${lot.price.toLocaleString()}</p>
                        </div>
                        <div className="p-4 bg-zinc-50 rounded-xl border dark:bg-zinc-900/50 dark:border-zinc-800">
                            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Area Total</p>
                            <p className="font-bold text-lg">{lot.area} m²</p>
                        </div>
                        <div className="p-4 bg-zinc-50 rounded-xl border dark:bg-zinc-900/50 dark:border-zinc-800">
                            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Precio / m²</p>
                            <p className="font-bold text-lg">${Math.round(lot.price / lot.area)}</p>
                        </div>
                        <div className="p-4 bg-zinc-50 rounded-xl border dark:bg-zinc-900/50 dark:border-zinc-800">
                            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Puntos</p>
                            <p className="font-bold text-lg">{lot.points.length}</p>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t dark:border-zinc-800">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50 font-medium transition-colors dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                            Cerrar
                        </button>
                        <button className="flex-1 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700">
                            Contactar Asesor
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
