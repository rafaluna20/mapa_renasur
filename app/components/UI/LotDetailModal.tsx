import { Lot } from '@/app/data/lotsData';
import { X, User, FileText, Users, Receipt, Calendar, RotateCcw, AlertTriangle, CheckCircle, TrendingUp, DollarSign, Map, Download, Loader2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import ReservationModal from './ReservationModal';
import RefundModal from './RefundModal';
import { odooService, OdooUser } from '@/app/services/odooService';
import { SHADOW_FLOATING, BORDER_FLOATING } from '@/app/lib/designTokens';

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
    activeQuotes?: { count: number; quotes: { orderId: number; clientName: string; vendorName: string }[] };
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
    const [showRefundModal, setShowRefundModal] = useState(false);
    const [reservationOwner, setReservationOwner] = useState<{ id: number; name: string; partnerId?: number; clientName?: string; totalInstallments?: number; orderId?: number; separationAmount?: number | null } | null>(null);
    const [activeTab, setActiveTab] = useState<'info' | 'pagos'>('info');
    const [invoices, setInvoices] = useState<{ id: number; name: string; ref?: string; payment_reference?: string; invoice_date: string; invoice_date_due: string; amount_total: number; amount_residual: number; payment_state: string }[]>([]);
    const [loadingInvoices, setLoadingInvoices] = useState(false);

    // ─── Generación de Plano y Memoria Descriptiva (plan_pro) ───────────────
    const [planoState, setPlanoState] = useState<{
        status: 'idle' | 'generando' | 'pending' | 'processing' | 'completed' | 'failed';
        planoId?: string;
        pdfUrl?: string;
        dxfUrl?: string;
        error?: string;
    }>({ status: 'idle' });

    // 🎯 ENTERPRISE SOLUTION: Use refs to track current lot and prevent stale updates
    const currentLotIdRef = useRef<string | null>(null);
    const requestIdRef = useRef<number>(0);

    // 🔧 SOLUCIÓN ROBUSTA NIVEL ENTERPRISE
    useEffect(() => {
        // Generar ID único para este request
        const thisRequestId = ++requestIdRef.current;
        const lotId = lot?.id || null;
        
        // Logging detallado para debugging
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`🔵 [REQUEST #${thisRequestId}] INICIO - Lote: ${lot?.name || 'N/A'} (ID: ${lotId})`);
        console.log(`📊 Estado antes de reset:`, {
            invoicesCount: invoices.length,
            hasReservationOwner: !!reservationOwner,
            previousLotId: currentLotIdRef.current
        });

        // Actualizar ref con el ID del lote actual
        currentLotIdRef.current = lotId;

        // RESET COMPLETO E INMEDIATO - Esto garantiza que la UI se limpie
        setInvoices([]);
        setReservationOwner(null);
        setActiveTab('info');
        setLoadingInvoices(false);
        setPlanoState({ status: 'idle' });

        console.log(`🧹 [REQUEST #${thisRequestId}] Estado reseteado`);

        // Guard clause: Verificar que tenemos un lote válido
        if (!lot || !lot.default_code) {
            console.log(`⚠️ [REQUEST #${thisRequestId}] No hay lote o default_code - ABORTANDO`);
            return;
        }

        // Guard clause: Solo proceder si el lote está en estado que requiere mostrar pagos
        if (lot.x_statu !== 'separado' && lot.x_statu !== 'reservado' && lot.x_statu !== 'vendido') {
            console.log(`ℹ️ [REQUEST #${thisRequestId}] Lote en estado '${lot.x_statu}' - No requiere cargar pagos`);
            return;
        }

        // Función asíncrona para fetch secuencial con validación de vigencia
        const fetchData = async () => {
            try {
                console.log(`📡 [REQUEST #${thisRequestId}] Iniciando fetch de reservation owner...`);
                
                // 1. Obtener el owner del lote
                const ownerData = await odooService.getReservationOwner(lot.default_code!);
                
                // 🚨 VALIDACIÓN CRÍTICA: Verificar que seguimos en el mismo lote
                if (currentLotIdRef.current !== lotId) {
                    console.log(`❌ [REQUEST #${thisRequestId}] STALE DATA DETECTED - Lote cambió de ${lotId} a ${currentLotIdRef.current} - DESCARTANDO`);
                    return;
                }
                
                // Verificar que el request actual sigue siendo el más reciente
                if (thisRequestId !== requestIdRef.current) {
                    console.log(`❌ [REQUEST #${thisRequestId}] REQUEST OBSOLETO - Request actual es #${requestIdRef.current} - DESCARTANDO`);
                    return;
                }
                
                if (!ownerData) {
                    console.log(`⚠️ [REQUEST #${thisRequestId}] No se encontró owner para lote: ${lot.default_code}`);
                    return;
                }

                console.log(`✅ [REQUEST #${thisRequestId}] Owner encontrado:`, ownerData.ownerName, `(Partner ID: ${ownerData.partnerId})`);

                // Actualizar reservation owner solo si seguimos en el mismo lote
                setReservationOwner({
                    id: ownerData.ownerId,
                    name: ownerData.ownerName,
                    partnerId: ownerData.partnerId,
                    clientName: ownerData.clientName,
                    totalInstallments: ownerData.totalInstallments,
                    orderId: ownerData.orderId,
                    separationAmount: ownerData.separationAmount
                });

                // 2. Si hay partnerId, obtener facturas FILTRADAS POR ESTE LOTE
                if (ownerData.partnerId) {
                    console.log(`📡 [REQUEST #${thisRequestId}] Iniciando fetch de facturas para Partner ID: ${ownerData.partnerId} - Lote: ${lot.default_code}...`);
                    setLoadingInvoices(true);
                    
                    // 🔑 CLAVE: Pasar el productCode para filtrar solo facturas de este lote
                    const invoicesData = await odooService.getClientInvoices(
                        ownerData.partnerId,
                        lot.default_code // Filtrar por código del lote
                    );
                    
                    // 🚨 VALIDACIÓN CRÍTICA NUEVAMENTE
                    if (currentLotIdRef.current !== lotId) {
                        console.log(`❌ [REQUEST #${thisRequestId}] STALE INVOICES - Lote cambió - DESCARTANDO ${invoicesData?.length || 0} facturas`);
                        setLoadingInvoices(false);
                        return;
                    }
                    
                    if (thisRequestId !== requestIdRef.current) {
                        console.log(`❌ [REQUEST #${thisRequestId}] INVOICES OBSOLETAS - Request actual es #${requestIdRef.current} - DESCARTANDO`);
                        setLoadingInvoices(false);
                        return;
                    }
                    
                    const validInvoices = Array.isArray(invoicesData) ? invoicesData : [];
                    console.log(`✅ [REQUEST #${thisRequestId}] Facturas recibidas: ${validInvoices.length} para lote ${lot.name}`);
                    console.log(`📋 [REQUEST #${thisRequestId}] IDs de facturas:`, validInvoices.map((inv: any) => inv.id || inv.name).join(', '));
                    
                    setInvoices(validInvoices as any);
                    setLoadingInvoices(false);
                    
                    console.log(`🎉 [REQUEST #${thisRequestId}] COMPLETADO EXITOSAMENTE`);
                }
            } catch (error) {
                // Verificar vigencia incluso en error
                if (currentLotIdRef.current !== lotId || thisRequestId !== requestIdRef.current) {
                    console.log(`❌ [REQUEST #${thisRequestId}] Error en request obsoleto - IGNORANDO`);
                    return;
                }
                
                console.error(`💥 [REQUEST #${thisRequestId}] ERROR:`, error);
                setInvoices([]);
                setLoadingInvoices(false);
            }
        };

        fetchData();

        // Cleanup function
        return () => {
            console.log(`🧹 [REQUEST #${thisRequestId}] CLEANUP ejecutado`);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lot?.id]); // CRÍTICO: Solo dependencia en lot.id para evitar re-renders innecesarios

    const handleGenerarPlano = async () => {
        if (!lot?.default_code) return;
        setPlanoState({ status: 'generando' });
        try {
            const res = await fetch('/api/planos/generar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ defaultCode: lot.default_code }),
            });
            const data = await res.json();
            if (!data.success) {
                setPlanoState({ status: 'failed', error: data.error?.message || 'No se pudo iniciar la generación' });
                return;
            }
            setPlanoState({ status: 'pending', planoId: data.data.planoId });
        } catch (error) {
            setPlanoState({ status: 'failed', error: error instanceof Error ? error.message : 'Error de red' });
        }
    };

    // Polling del estado de generación mientras esté pending/processing
    useEffect(() => {
        if (planoState.status !== 'pending' && planoState.status !== 'processing') return;
        if (!planoState.planoId) return;

        const planoId = planoState.planoId;
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/planos/estado/${planoId}`);
                const data = await res.json();
                if (!data.success) return;

                const { status, pdfUrl, dxfUrl, errorMessage } = data.data;
                if (status === 'COMPLETED') {
                    setPlanoState({ status: 'completed', planoId, pdfUrl, dxfUrl });
                } else if (status === 'FAILED') {
                    setPlanoState({ status: 'failed', planoId, error: errorMessage || 'Falló la generación del plano' });
                } else if (status === 'PROCESSING') {
                    setPlanoState((prev) => (prev.planoId === planoId ? { ...prev, status: 'processing' } : prev));
                }
            } catch {
                // Error transitorio de red, seguimos intentando en el próximo tick
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [planoState.status, planoState.planoId]);

    if (!lot) return null;
    const config = STATUS_CONFIG[lot.x_statu?.toLowerCase()] || STATUS_CONFIG.libre;

    // Check if current user is the owner of the reservation
    const isReservationOwner = currentUser && reservationOwner && currentUser.uid === reservationOwner.id;

    const isLocked = lot.name.endsWith('5');
    const assignedClient = lot.x_cliente || "Sin asignar";

    const paidInvoices = invoices.filter(i => i.payment_state === 'paid').length;

    // Calculate total amount invoiced (sum of all paid invoices)
    const totalInvoiced = invoices
        .filter(i => i.payment_state === 'paid')
        .reduce((sum, inv) => sum + (inv.amount_total || 0), 0);

    // Formatter - Soles Peruanos
    const formatMoney = (amount: number) => `S/ ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // ─── Parser de referencia de factura (CONTRATOMANUAL-E01MZD148P-C013 / INIT) ────
    const parseCuotaLabel = (inv: { name: string; ref?: string; payment_reference?: string }): { label: string; isInitial: boolean; cuotaNum: number | null } => {
        // Buscar en ref primero, luego en payment_reference, luego en name
        const ref = inv.ref || inv.payment_reference || inv.name || '';
        // Detectar cuota inicial: -INIT
        if (/[-_]INIT(\b|$|-)/i.test(ref)) {
            return { label: 'Cuota Inicial', isInitial: true, cuotaNum: 0 };
        }
        // Detectar cuota numerada: -C013, -C13, -C001, etc.
        const cuotaMatch = ref.match(/[-_]C(\d+)(?:\b|$|-)/i);
        if (cuotaMatch) {
            const num = parseInt(cuotaMatch[1], 10);
            return { label: `Cuota N° ${num}`, isInitial: false, cuotaNum: num };
        }
        // Sin referencia reconocida — usar el nombre de la factura
        return { label: inv.name || 'Factura', isInitial: false, cuotaNum: null };
    };

    // ─── KPIs Financieros y Morosidad (Estado de Cuenta) ─────────────────────────
    const listPrice = lot.list_price || 0;
    const realTotalPaid = totalInvoiced;
    const pendingBalance = Math.max(0, listPrice - realTotalPaid);
    const financialProgress = listPrice > 0 ? Math.min(100, Math.round((realTotalPaid / listPrice) * 100)) : 0;

    const overdueInvoices = invoices.filter(inv => inv.payment_state !== 'paid' && inv.invoice_date_due && new Date(inv.invoice_date_due) < new Date());
    const isOverdue = overdueInvoices.length > 0;
    const totalOverdueAmount = overdueInvoices.reduce((sum, inv) => sum + (inv.amount_residual || 0), 0);

    const sortedInvoices = [...invoices].sort((a, b) => new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime());

    return (
        <>
            <div className={`fixed md:absolute bottom-6 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:bottom-auto md:top-4 md:right-4 w-[90%] md:w-96 bg-white rounded-2xl md:rounded-xl ${SHADOW_FLOATING} ${BORDER_FLOATING} overflow-hidden z-[1000] animate-in slide-in-from-bottom-12 md:slide-in-from-right-8 fade-in duration-300 origin-bottom md:origin-top-right scale-[0.95] md:scale-[0.85] flex flex-col max-h-[95vh]`}>

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
                        {/* DEBUG INFO */}
                        <div className="text-[9px] text-slate-400 mt-1 font-mono">
                            ID: {lot.id} | Code: {lot.default_code}
                        </div>
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

                        {/* Plano y Memoria Descriptiva — temporalmente solo para administradores
                            mientras se termina de afinar el generador */}
                        {currentUser?.is_system && (
                        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                            <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center gap-2">
                                <Map size={14} className="text-slate-500" />
                                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Plano y Memoria</span>
                            </div>
                            <div className="p-3">
                                {planoState.status === 'idle' && (
                                    <button
                                        onClick={handleGenerarPlano}
                                        className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-xs uppercase tracking-wide transition-colors flex items-center justify-center gap-2"
                                    >
                                        <FileText size={14} />
                                        Generar Plano y Memoria
                                    </button>
                                )}

                                {(planoState.status === 'generando' || planoState.status === 'pending' || planoState.status === 'processing') && (
                                    <div className="flex items-center justify-center gap-2 py-2.5 text-slate-500 text-xs font-medium">
                                        <Loader2 size={14} className="animate-spin" />
                                        {planoState.status === 'generando' ? 'Iniciando generación...' : 'Generando documentos, puede tardar un momento...'}
                                    </div>
                                )}

                                {planoState.status === 'failed' && (
                                    <div className="space-y-2">
                                        <div className="flex items-start gap-2 text-red-600 text-xs">
                                            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                            <span>{planoState.error || 'No se pudo generar el plano'}</span>
                                        </div>
                                        <button
                                            onClick={handleGenerarPlano}
                                            className="w-full py-2 border border-slate-300 hover:bg-slate-50 text-slate-600 rounded-lg font-medium text-xs"
                                        >
                                            Reintentar
                                        </button>
                                    </div>
                                )}

                                {planoState.status === 'completed' && (
                                    <div className="space-y-2">
                                        {planoState.pdfUrl && (
                                            <a
                                                href={planoState.pdfUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs uppercase tracking-wide transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Download size={14} />
                                                Descargar PDF
                                            </a>
                                        )}
                                        {planoState.dxfUrl && (
                                            <a
                                                href={planoState.dxfUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-full py-2 border border-slate-300 hover:bg-slate-50 text-slate-600 rounded-lg font-medium text-xs flex items-center justify-center gap-2"
                                            >
                                                <Download size={12} />
                                                Descargar DXF (CAD)
                                            </a>
                                        )}
                                        <button
                                            onClick={handleGenerarPlano}
                                            className="w-full text-center text-[10px] text-slate-400 hover:text-slate-600 pt-1"
                                        >
                                            Volver a generar
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                        )}

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
                                    {activeQuotes.quotes.map((quote) => (
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

                        {/* Summary Card - Financial Progress */}
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl"></div>
                            
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Resumen Financiero</p>
                            
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <p className="text-[10px] text-slate-500 font-semibold">Valor Total (Precio)</p>
                                    <p className="text-sm font-bold text-slate-800">{formatMoney(listPrice)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-slate-500 font-semibold">Saldo Deudor Pendiente</p>
                                    <p className="text-sm font-bold text-red-600">{formatMoney(pendingBalance)}</p>
                                </div>
                            </div>

                            <div className="flex justify-between items-end mb-1.5">
                                <div className="flex items-center gap-1.5">
                                    <DollarSign size={14} className="text-emerald-500" />
                                    <span className="text-xs font-bold text-emerald-700">Total Pagado: {formatMoney(realTotalPaid)}</span>
                                </div>
                                <div className="text-xs font-bold text-emerald-600">{financialProgress}%</div>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${financialProgress}%` }}></div>
                            </div>
                        </div>

                        {/* Estado de Morosidad */}
                        {isOverdue ? (
                            <div className="bg-red-50 border border-red-200 p-3 rounded-lg flex items-start gap-3">
                                <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs font-bold text-red-700 uppercase">Atraso Detectado ({overdueInvoices.length} facturas)</p>
                                    <p className="text-sm font-bold text-red-800 mt-0.5">Deuda Exigible: {formatMoney(totalOverdueAmount)}</p>
                                    <p className="text-[10px] text-red-600 mt-1">El cliente presenta pagos vencidos. Priorizar cobranza.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex items-center gap-3">
                                <CheckCircle size={18} className="text-emerald-500 shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-emerald-700 uppercase">Financiamiento Al Día</p>
                                    <p className="text-[10px] text-emerald-600">No hay facturas vencidas registradas.</p>
                                </div>
                            </div>
                        )}

                        {/* Invoice List (Timeline) */}
                        <div className="space-y-3">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1 mt-2">Historial de Cuotas y Pagos</p>

                            {loadingInvoices ? (
                                <div className="p-6 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-100">Cargando estado de cuenta...</div>
                            ) : sortedInvoices.length === 0 ? (
                                <div className="p-6 text-center bg-white rounded-xl border border-slate-100 shadow-sm text-slate-400 text-xs italic flex flex-col items-center">
                                    <Receipt size={24} className="mb-2 opacity-50" />
                                    Aún no hay cuotas facturadas.
                                </div>
                            ) : (
                                <div className="relative border-l-2 border-slate-200 ml-3 pl-4 space-y-4">
                                    {sortedInvoices.map((inv) => {
                                        const isPaid = inv.payment_state === 'paid';
                                        const isOverdueItem = !isPaid && inv.invoice_date_due && new Date(inv.invoice_date_due) < new Date();
                                        
                                        // Parsear referencia de la factura para etiquetar la cuota correctamente
                                        const { label: cuotaLabel, isInitial } = parseCuotaLabel(inv);

                                        return (
                                            <div key={inv.id} className="relative">
                                                {/* Timeline dot */}
                                                <div className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white ${isPaid ? 'bg-emerald-500' : isOverdueItem ? 'bg-red-500 animate-pulse' : 'bg-amber-400'}`}></div>
                                                
                                                <div className={`bg-white p-3 rounded-lg border ${isOverdueItem ? 'border-red-200 shadow-red-50' : 'border-slate-200 hover:border-blue-300'} shadow-sm transition-colors`}>
                                                    <div className="flex justify-between items-start mb-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-slate-700 text-xs">{cuotaLabel}</span>
                                                            {isPaid ?
                                                                <span className="bg-emerald-100 text-emerald-700 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">Pagado</span> :
                                                                isOverdueItem ?
                                                                    <span className="bg-red-100 text-red-700 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase animate-pulse">Mora</span> :
                                                                    <span className="bg-yellow-100 text-yellow-700 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">Pendiente</span>
                                                            }
                                                        </div>
                                                        <p className="font-bold text-slate-800 text-sm">{formatMoney(inv.amount_total)}</p>
                                                    </div>
                                                    
                                                    <div className="flex justify-between items-end mt-2">
                                                        <div className="space-y-0.5">
                                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                                                <FileText size={10} />
                                                                <span>{inv.name || inv.ref || 'S/N'}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                                                <Calendar size={10} />
                                                                <span>Vencimiento: {inv.invoice_date_due || inv.invoice_date}</span>
                                                            </div>
                                                        </div>
                                                        {!isPaid && (
                                                            <p className="text-[11px] text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-md">
                                                                Saldo: {formatMoney(inv.amount_residual)}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Action Buttons Contextuales */}
                        {isOverdue ? (
                            <button className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm shadow-lg shadow-red-200 flex items-center justify-center gap-2 transition-transform active:scale-95">
                                <AlertTriangle size={16} />
                                Reclamar Mora (WhatsApp)
                            </button>
                        ) : (
                            <button className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-transform active:scale-95">
                                <FileText size={16} />
                                Enviar Estado de Cuenta al Cliente
                            </button>
                        )}
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
                                    onClick={() => isReservationOwner && setShowRefundModal(true)}
                                    className={`border border-orange-300 text-orange-600 py-2 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-1.5 ${!isReservationOwner ? 'opacity-50 cursor-not-allowed' : 'hover:bg-orange-50'}`}
                                >
                                    <RotateCcw size={14} />
                                    Devolución
                                </button>
                            </>
                        )}

                        {(lot.x_statu === 'vendido') && (
                            <div className="col-span-2 text-center text-[10px] text-slate-400 italic">
                                Gestione la cobranza desde la pestaña &quot;Pagos&quot;
                            </div>
                        )}
                    </div>
                </div>
            )}
            </div>

            {showReservationModal && (
                <ReservationModal
                    lot={lot}
                    onClose={() => setShowReservationModal(false)}
                    onSuccess={() => { if (onUpdateStatus) onUpdateStatus(lot.id, 'separado'); }}
                />
            )}

            {showRefundModal && reservationOwner && (() => {
                // Calculate actual separation amount:
                // 1. Try Odoo custom field x_separacion
                // 2. Try sum of posted invoices
                // 3. Fallback to 1000
                const separationAmount = reservationOwner.separationAmount && reservationOwner.separationAmount > 0
                    ? reservationOwner.separationAmount
                    : (totalInvoiced > 0 ? totalInvoiced : 1000);

                return (
                    <RefundModal
                        lot={lot}
                        orderId={reservationOwner.orderId || reservationOwner.id}
                        reservedAmount={separationAmount}
                        listPrice={lot.list_price || 0}
                        clientName={reservationOwner.clientName || lot.x_cliente as string || 'Cliente'}
                        onClose={() => setShowRefundModal(false)}
                        onSuccess={(newStatus) => { if (onUpdateStatus) onUpdateStatus(lot.id, newStatus); }}
                    />
                );
            })()}
        </>
    );
}
