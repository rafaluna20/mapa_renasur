import { Lot } from '@/app/data/lotsData';
import { X, User, Ruler, FileText, Lock, Users, Clock, Receipt, CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';
import ReservationModal from './ReservationModal';
import { odooService, OdooUser } from '@/app/services/odooService';

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
    activeQuotes?: { count: number; quotes: any[] };
    currentUser?: OdooUser | null;
}

const STATUS_CONFIG: Record<string, StatusConfigItem> = {
    libre: { color: "#34D399", label: "Disponible", bg: "bg-emerald-100", text: "text-emerald-800" },
    disponible: { color: "#34D399", label: "Disponible", bg: "bg-emerald-100", text: "text-emerald-800" },
    cotizacion: { color: "#FDE047", label: "En Cotización", bg: "bg-yellow-100", text: "text-yellow-800" },
    separado: { color: "#C084FC", label: "Reservado", bg: "bg-purple-100", text: "text-purple-800" },
    reservado: { color: "#C084FC", label: "Reservado", bg: "bg-purple-100", text: "text-purple-800" },
    vendido: { color: "#F87171", label: "Vendido", bg: "bg-red-100", text: "text-red-800" },
    'no vender': { color: "#94A3B8", label: "No Vender", bg: "bg-slate-100", text: "text-slate-800" },
    no_vender: { color: "#94A3B8", label: "No Vender", bg: "bg-slate-100", text: "text-slate-800" }
};

export default function LotDetailModal({ lot, onClose, onUpdateStatus, onQuotation, activeQuotes, currentUser }: LotDetailModalProps) {
    const [showReservationModal, setShowReservationModal] = useState(false);
    const [reservationOwner, setReservationOwner] = useState<{ id: number; name: string; partnerId?: number; totalInstallments?: number } | null>(null);
    const [activeTab, setActiveTab] = useState<'info' | 'pagos'>('info');
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loadingInvoices, setLoadingInvoices] = useState(false);

    // Fetch reservation owner if status is Separado/Reservado/Vendido
    useEffect(() => {
        if (lot && (lot.x_statu === 'separado' || lot.x_statu === 'reservado' || lot.x_statu === 'vendido') && lot.default_code) {
            odooService.getReservationOwner(lot.default_code).then(res => {
                if (res) {
                    setReservationOwner({
                        id: res.ownerId,
                        name: res.ownerName,
                        partnerId: res.partnerId,
                        totalInstallments: res.totalInstallments
                    });
                }
            });
        } else {
            setReservationOwner(null);
            setInvoices([]);
        }
    }, [lot]);

    // Fetch Invoices if partnerId is available
    useEffect(() => {
        if (reservationOwner?.partnerId) {
            setLoadingInvoices(true);
            odooService.getClientInvoices(reservationOwner.partnerId).then(inv => {
                setInvoices(inv);
                setLoadingInvoices(false);
            });
        }
    }, [reservationOwner]);

    if (!lot) return null;
    const config = STATUS_CONFIG[lot.x_statu?.toLowerCase()] || STATUS_CONFIG.libre;

    // Check if current user is the owner of the reservation
    const isReservationOwner = currentUser && reservationOwner && currentUser.uid === reservationOwner.id;

    const isLocked = lot.name.endsWith('5');
    const lockedBy = "Carlos V.";
    let assignedClient = lot.x_cliente || "Sin asignar";

    // Computed Invoice Stats
    const totalInvoices = invoices.length;
    const paidInvoices = invoices.filter(i => i.payment_state === 'paid').length;

    // Total Installments from Odoo (Contract) or Default 72
    const totalPlan = reservationOwner?.totalInstallments || 72;

    const progress = Math.min(100, Math.round((paidInvoices / totalPlan) * 100));

    // Formatter
    const formatMoney = (amount: number) => `$ ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    return (
        <div className="fixed md:absolute bottom-6 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:bottom-auto md:top-4 md:right-4 w-[90%] md:w-96 bg-white rounded-2xl md:rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] md:shadow-2xl border border-slate-200 overflow-hidden z-[1000] animate-in slide-in-from-bottom-12 md:slide-in-from-right-8 fade-in duration-300 origin-bottom md:origin-top-right scale-[0.95] md:scale-[0.85] flex flex-col max-h-[95vh]">

            {/* Header */}
            <div className={`h-22 md:h-24 ${config.bg} relative shrink-0 flex flex-col`}>
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 p-1 bg-white/50 hover:bg-white rounded-full transition-colors z-10"
                >
                    <X size={16} className="text-slate-600" />
                </button>

                <div className="flex-1 flex items-center justify-center text-center px-4 pt-2">
                    <div>
                        <h2 className={`text-lg md:text-2xl font-bold ${config.text} capitalize truncate w-full`}>{lot.name}</h2>
                        <span className={`text-[10px] md:text-sm font-medium ${config.text} opacity-80 uppercase tracking-wide`}>{config.label}</span>
                    </div>
                </div>

                {/* TABS NAVIGATION (Solo si está vendido/reservado) */}
                {(lot.x_statu === 'vendido' || lot.x_statu === 'reservado' || lot.x_statu === 'separado') && (
                    <div className="flex px-4 gap-4 text-xs font-bold text-slate-500 uppercase tracking-wide">
                        <button
                            onClick={() => setActiveTab('info')}
                            className={`pb-2 border-b-2 transition-colors ${activeTab === 'info' ? `border-${config.text.split('-')[1]}-600 text-slate-800` : 'border-transparent hover:text-slate-700'}`}
                        >
                            Información
                        </button>
                        <button
                            onClick={() => setActiveTab('pagos')}
                            className={`pb-2 border-b-2 transition-colors flex items-center gap-1 ${activeTab === 'pagos' ? `border-${config.text.split('-')[1]}-600 text-slate-800` : 'border-transparent hover:text-slate-700'}`}
                        >
                            <Receipt size={12} />
                            Pagos ({invoices.length})
                        </button>
                    </div>
                )}
            </div>

            {/* BODY CONTENT */}
            <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0 bg-slate-50/50">

                {/* --- TAB: INFO --- */}
                {activeTab === 'info' && (
                    <div className="space-y-4 animate-in slide-in-from-left-4 fade-in duration-300">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white p-3 rounded-lg text-center border border-slate-100 shadow-sm flex flex-col justify-center">
                                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Precio Lista</p>
                                <p className="font-bold text-slate-800 text-base">{formatMoney(lot.list_price)}</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg text-center border border-slate-100 shadow-sm flex flex-col justify-center">
                                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Área Total</p>
                                <p className="font-bold text-blue-700 text-base">{Number(lot.x_area).toFixed(2)} m²</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                            <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex justify-between items-center">
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

                        {/* Reservation Owner Info */}
                        {reservationOwner && currentUser && reservationOwner.id !== currentUser.uid && (
                            <div className="bg-purple-50 rounded-lg border border-purple-100 p-2 text-center">
                                <p className="text-[10px] text-purple-600 uppercase font-bold">Vendido por</p>
                                <p className="text-xs font-medium text-purple-800">{reservationOwner.name}</p>
                            </div>
                        )}

                        {/* Cotizaciones Activas */}
                        {activeTab === 'info' && activeQuotes && activeQuotes.count > 0 && (
                            <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg border-2 border-orange-200 overflow-hidden">
                                <div className="bg-orange-100 px-3 py-2 border-b border-orange-200 flex items-center gap-2">
                                    <Users size={14} className="text-orange-600" />
                                    <span className="text-xs font-bold text-orange-700 uppercase tracking-wider">
                                        🔥 {activeQuotes.count} Cotizaciones
                                    </span>
                                </div>
                                <div className="p-2 space-y-2 max-h-32 overflow-y-auto">
                                    {activeQuotes.quotes.map((quote: any) => (
                                        <div key={quote.orderId} className="bg-white p-2 rounded border border-orange-100 text-xs shadow-sm">
                                            <p className="font-bold text-slate-700">{quote.clientName}</p>
                                            <p className="text-[10px] text-slate-500">Asesor: {quote.vendorName}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* --- TAB: PAGOS (ACCOUNT STATEMENT) --- */}
                {activeTab === 'pagos' && (
                    <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">

                        {/* Summary Card */}
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase">Progreso de Pago</p>
                                    <p className="text-xl font-bold text-slate-800">{paidInvoices} <span className="text-sm font-normal text-slate-400">/ {totalPlan} Cuotas</span></p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-emerald-600">{progress}% Pagado</p>
                                </div>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                            </div>
                        </div>

                        {/* Invoice List */}
                        <div className="space-y-2">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Historial de Facturas</p>

                            {loadingInvoices ? (
                                <div className="p-4 text-center text-slate-400 text-xs">Cargando facturas...</div>
                            ) : invoices.length === 0 ? (
                                <div className="p-4 text-center bg-slate-100 rounded-lg text-slate-400 text-xs italic">
                                    No se encontraron facturas registradas.
                                </div>
                            ) : (
                                invoices.map((inv) => {
                                    const isPaid = inv.payment_state === 'paid';
                                    const isOverdue = !isPaid && new Date(inv.invoice_date_due) < new Date();
                                    return (
                                        <div key={inv.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex justify-between items-center group hover:border-blue-300 transition-colors">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-slate-700 text-xs">{inv.name || inv.ref || 'Factura'}</p>
                                                    {isPaid ?
                                                        <span className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded font-bold">PAGADO</span> :
                                                        isOverdue ?
                                                            <span className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 rounded font-bold animate-pulse">VENCIDO</span> :
                                                            <span className="bg-yellow-100 text-yellow-700 text-[10px] px-1.5 py-0.5 rounded font-bold">PENDIENTE</span>
                                                    }
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Calendar size={10} className="text-slate-400" />
                                                    <p className="text-[10px] text-slate-500">{inv.invoice_date}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-slate-800 text-sm">{formatMoney(inv.amount_total)}</p>
                                                {!isPaid && (
                                                    <p className="text-[10px] text-red-500 font-medium">Saldo: {formatMoney(inv.amount_residual)}</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Action: Contact for Collection */}
                        <button className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-transform active:scale-95">
                            Enviar Recordatorio de Pago (WhatsApp)
                        </button>
                    </div>
                )}

            </div>

            {/* FOOTER ACTIONS (Only on Info Tab) */}
            {activeTab === 'info' && (
                <div className="p-4 border-t border-slate-100 bg-white shrink-0">
                    <div className="grid grid-cols-2 gap-2">
                        {/* ... Existing Action Buttons Logic ... */}

                        {(lot.x_statu === 'libre' || lot.x_statu === 'disponible' || lot.x_statu === 'cotizacion') && onUpdateStatus && (
                            <>
                                <button
                                    onClick={() => onQuotation?.(lot)}
                                    className="col-span-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                                >
                                    <FileText size={18} />
                                    COTIZAR LOTE
                                </button>
                            </>
                        )}

                        {lot.x_statu === 'cotizacion' && onUpdateStatus && (
                            <button
                                onClick={() => { if (!isLocked) setShowReservationModal(true); }}
                                disabled={isLocked}
                                className={`col-span-2 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-lg font-bold text-sm transition-colors shadow-lg shadow-amber-200 flex items-center justify-center gap-2 ${isLocked ? 'opacity-50' : ''}`}
                            >
                                <User size={18} />
                                FINALIZAR RESERVA
                            </button>
                        )}

                        {lot.x_statu === 'separado' && onUpdateStatus && (
                            <>
                                <button
                                    disabled={!isReservationOwner}
                                    onClick={() => isReservationOwner && onUpdateStatus(lot.id, 'vendido')}
                                    className={`bg-green-600 text-white py-2 rounded-lg font-medium text-sm transition-colors shadow-sm ${!isReservationOwner ? 'opacity-50 cursor-not-allowed bg-slate-300 text-slate-500' : 'hover:bg-green-700'}`}
                                >
                                    Vender
                                </button>
                                <button
                                    disabled={!isReservationOwner}
                                    onClick={() => isReservationOwner && onUpdateStatus(lot.id, 'libre')}
                                    className={`border border-slate-300 text-slate-600 py-2 rounded-lg font-medium text-sm transition-colors ${!isReservationOwner ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50'}`}
                                >
                                    Liberar
                                </button>
                            </>
                        )}

                        {(lot.x_statu === 'vendido') && (
                            <div className="col-span-2 text-center text-[10px] text-slate-400 italic">
                                Gestione la cobranza desde la pestaña "Pagos"
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showReservationModal && (
                <ReservationModal
                    lot={lot}
                    onClose={() => setShowReservationModal(false)}
                    onSuccess={() => { if (onUpdateStatus) onUpdateStatus(lot.id, 'separado'); }}
                />
            )}
        </div>
    );
}
