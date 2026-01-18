import { Lot } from '@/app/data/lotsData';
import { X, User, Ruler, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

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
        <div className="fixed md:absolute bottom-6 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:bottom-auto md:top-4 md:right-4 w-[90%] md:w-80 bg-white rounded-2xl md:rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] md:shadow-2xl border border-slate-200 overflow-hidden z-[1000] animate-in slide-in-from-bottom-12 md:slide-in-from-right-8 fade-in duration-300 origin-bottom md:origin-top-right scale-[0.8] md:scale-[0.7]">
            <div className={`h-20 md:h-24 ${config.bg} flex items-center justify-center relative`}>
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 p-1 bg-white/50 hover:bg-white rounded-full transition-colors"
                >
                    <X size={16} className="text-slate-600" />
                </button>
                <div className="text-center">
                    <h2 className={`text-lg md:text-2xl font-bold ${config.text} capitalize px-4 truncate w-full`}>{lot.name}</h2>
                    <span className={`text-[10px] md:text-sm font-medium ${config.text} opacity-80 uppercase tracking-wide`}>{config.label}</span>
                </div>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto max-h-[70vh] md:max-h-none">
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 p-2 md:p-3 rounded-lg text-center border border-slate-100 flex flex-col justify-center">
                        <p className="text-[9px] md:text-[10px] uppercase font-bold text-slate-400 mb-1">Precio</p>
                        <p className="font-bold text-slate-800 text-sm md:text-base">$ {lot.list_price.toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-50 p-2 md:p-3 rounded-lg text-center border border-slate-100 flex flex-col justify-center">
                        <p className="text-[9px] md:text-[10px] uppercase font-bold text-slate-400 mb-1">Área Total</p>
                        <p className="font-bold text-blue-700 text-sm md:text-base">{Number(lot.x_area).toFixed(2)} m²</p>
                    </div>
                </div>

                {/* Dimensiones Detalladas - Visibles solo en Desktop para ahorrar espacio en móvil */}
                {lot.measurements && (
                    <div className="hidden md:block bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                        <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Ruler size={14} className="text-slate-500" />
                                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Dimensiones</span>
                            </div>
                            <span className="text-[10px] font-bold bg-white text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                P: {lot.measurements.perimeter.toFixed(2)}m
                            </span>
                        </div>
                        <div className="p-2 grid grid-cols-2 gap-2">
                            {lot.measurements.sides.map((side, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-white p-1.5 rounded border border-slate-100 shadow-sm">
                                    <span className="text-[10px] text-slate-400 font-medium">Lado {idx + 1}</span>
                                    <span className="text-[11px] font-bold text-slate-700">{side.toFixed(2)}m</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {lot.points && lot.points.length > 0 && (
                    <div className="hidden md:block text-xs text-slate-400 text-center font-mono">
                        UTM: {lot.points[0][0].toFixed(2)}, {lot.points[0][1].toFixed(2)}
                    </div>
                )}

                {(lot.x_statu === 'vendido' || lot.x_statu === 'separado') && (
                    <div className="flex items-center gap-3 p-3 bg-blue-50 text-blue-900 rounded-lg border border-blue-100 shadow-sm">
                        <div className="bg-blue-600 p-1.5 rounded-full text-white shadow-md">
                            <User size={16} />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-bold opacity-60">Cliente Asignado</p>
                            <p className="font-bold text-sm leading-tight text-blue-900">{lot.image ? 'Cliente VIP' : 'Cliente Ejemplo'}</p>
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
