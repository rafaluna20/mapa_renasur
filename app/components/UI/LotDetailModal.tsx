import { Lot } from '@/app/data/lotsData';
import { X, User, Ruler, FileText, Lock } from 'lucide-react';
import { useState } from 'react';
import ReservationModal from './ReservationModal';

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
    onQuotation?: (lot: Lot) => void;
}

const STATUS_CONFIG: Record<string, StatusConfigItem> = {
    libre: { color: "#10B981", label: "Disponible", bg: "bg-emerald-100", text: "text-emerald-800" },
    cotizacion: { color: "#FBBF24", label: "En Cotización", bg: "bg-yellow-100", text: "text-yellow-800" },
    separado: { color: "#F59E0B", label: "Reservado", bg: "bg-amber-100", text: "text-amber-800" },
    vendido: { color: "#EF4444", label: "Vendido", bg: "bg-red-100", text: "text-red-800" },
    reservado: { color: "#F59E0B", label: "Reservado", bg: "bg-amber-100", text: "text-amber-800" }, // Añadido para compatibilidad
    no_vender: { color: "#9CA3AF", label: "No Vender", bg: "bg-gray-200", text: "text-gray-800" }
};

export default function LotDetailModal({ lot, onClose, onUpdateStatus, onQuotation }: LotDetailModalProps) {
    const [showReservationModal, setShowReservationModal] = useState(false);

    if (!lot) return null;
    const config = STATUS_CONFIG[lot.x_statu] || STATUS_CONFIG.libre;

    // MOCK: Simulation of a locked lot (e.g. if lot name ends in '5')
    // This is just to demonstrate the UI to the user
    const isLocked = lot.name.endsWith('5');
    const lockedBy = "Carlos V.";

    // Determinar mensaje de cliente
    let assignedClient = lot.x_cliente || "Sin asignar";

    // MOCK: Fallback visual si no hay cliente real pero está en estado especial (solo para demo si falla datos)
    if (assignedClient === "Sin asignar" && (lot.x_statu === 'vendido' || lot.x_statu === 'separado')) {
        // Mantener "Sin asignar" o mostrar algo genérico si se prefiere. 
        // Por ahora confiamos en la data de Odoo.
    }

    return (
        <div className="fixed md:absolute bottom-6 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:bottom-auto md:top-4 md:right-4 w-[60%] md:w-80 bg-white rounded-2xl md:rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] md:shadow-2xl border border-slate-200 overflow-hidden z-[1000] animate-in slide-in-from-bottom-12 md:slide-in-from-right-8 fade-in duration-300 origin-bottom md:origin-top-right scale-[0.85] md:scale-[0.75] flex flex-col max-h-[95vh]">
            <div className={`h-18 md:h-24 ${config.bg} flex items-center justify-center relative shrink-0`}>
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

                {isLocked && lot.x_statu === 'libre' && (
                    <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-sm text-white px-2 py-1 rounded-full text-[10px] flex items-center gap-1 animate-pulse">
                        <Lock size={10} />
                        Gestionando: {lockedBy}
                    </div>
                )}
            </div>

            <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
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

                {/* Sección de Cliente Asignado (Estático) - Reemplaza Dimensiones */}
                <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                    <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <User size={14} className="text-slate-500" />
                            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Cliente Asignado</span>
                        </div>
                    </div>
                    <div className="p-3 text-center">
                        <p className={`font-bold text-sm leading-tight ${lot.x_statu !== 'libre' ? 'text-indigo-700' : 'text-slate-400 italic'}`}>
                            {assignedClient}
                        </p>
                    </div>
                </div>

                {lot.points && lot.points.length > 0 && (
                    <div className="hidden md:block text-xs text-slate-400 text-center font-mono">
                        UTM: {lot.points[0][0].toFixed(2)}, {lot.points[0][1].toFixed(2)}
                    </div>
                )}

            </div>

            <div className="p-4 border-t border-slate-100 bg-white shrink-0">
                <p className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider text-center">Acciones Rápidas</p>
                <div className="grid grid-cols-2 gap-2">
                    {/* FLUJO: Disponible -> Cotizar -> Reservar */}

                    {/* ESTADO: DISPONIBLE (Muestra COTIZAR) */}
                    {(lot.x_statu === 'libre' || lot.x_statu === 'disponible') && onUpdateStatus && (
                        <>
                            <button
                                onClick={() => onQuotation?.(lot)}
                                className="col-span-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                            >
                                <FileText size={18} />
                                COTIZAR LOTE
                            </button>
                            <p className="col-span-2 text-[10px] text-center text-slate-400 font-medium">
                                * Debe generar una cotización antes de reservar
                            </p>
                        </>
                    )}

                    {/* ESTADO: COTIZACIÓN (Muestra RESERVAR) */}
                    {lot.x_statu === 'cotizacion' && onUpdateStatus && (
                        <>
                            <button
                                onClick={() => {
                                    if (isLocked) return;
                                    setShowReservationModal(true);
                                }}
                                disabled={isLocked}
                                className={`col-span-2 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-lg font-bold text-sm transition-colors shadow-lg shadow-amber-200 flex items-center justify-center gap-2 ${isLocked ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                            >
                                <User size={18} />
                                {isLocked ? 'En Gestión' : 'FINALIZAR RESERVA'}
                            </button>
                            <button
                                onClick={() => onQuotation?.(lot)}
                                className="col-span-2 border border-slate-200 hover:bg-slate-50 text-slate-600 py-2 rounded-lg font-medium text-xs transition-colors"
                            >
                                Ver Cotización
                            </button>
                        </>
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
                    {/* Otros Estados */}
                    <button className="border border-slate-300 hover:bg-slate-50 text-slate-600 py-2 rounded-lg font-medium text-sm transition-colors">
                        Ver en Odoo
                    </button>
                </div>
            </div>


            {
                showReservationModal && (
                    <ReservationModal
                        lot={lot}
                        onClose={() => setShowReservationModal(false)}
                        onSuccess={() => {
                            // After successful reservation flow, trigger the status update locally to reflect changes immediately
                            // The actual API call happened inside the modal
                            if (onUpdateStatus) onUpdateStatus(lot.id, 'separado');
                        }}
                    />
                )
            }
        </div >
    );
}
