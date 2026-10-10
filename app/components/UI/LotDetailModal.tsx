import { Lot } from '@/app/data/lotsData';
import { X, User, FileText, Users, Receipt, Calendar, RotateCcw, AlertTriangle, CheckCircle, TrendingUp, DollarSign, Map, Download, Loader2, BarChart3 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import ReservationModal from './ReservationModal';
import RefundModal from './RefundModal';
import DescargasStatsModal from './DescargasStatsModal';
import { odooService, OdooUser } from '@/app/services/odooService';
import { formatMoney as formatMoneyWithCurrency, normalizeCurrency } from '@/app/utils/money';
import {
    buildStatementModel, installmentLabel, installmentStatus, lateFeeLabel, lateFeeNote, STATUS_LABEL,
} from '@/app/utils/statementModel';
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
    const [reservationOwner, setReservationOwner] = useState<{ id: number; name: string; partnerId?: number; clientName?: string; clientPhone?: string | null; clientEmail?: string | null; clientDni?: string | null; totalInstallments?: number; orderId?: number; separationAmount?: number | null } | null>(null);
    const [activeTab, setActiveTab] = useState<'info' | 'pagos'>('info');
    const [invoices, setInvoices] = useState<{ id: number; name: string; ref?: string; payment_reference?: string; invoice_date: string; invoice_date_due: string; amount_total: number; amount_residual: number; currency_id?: [number, string] | string | false; payment_state: string; is_late_fee?: boolean; late_fee_origin_id?: [number, string] | false; late_fee_days_late?: number; late_fee_percentage_applied?: number; late_fee_waived?: boolean; state?: string; invoice_payments_widget?: { content?: { date?: string; is_exchange?: boolean }[] } | false }[]>([]);
    const [loadingInvoices, setLoadingInvoices] = useState(false);
    const [downloadingStatement, setDownloadingStatement] = useState(false);
    // Moneda y precio pactado del contrato vigente (solo se consulta si las facturas están en moneda
    // extranjera): el precio de catálogo de `lot.list_price` está en soles y no sirve para un contrato en USD.
    const [lotContract, setLotContract] = useState<{ currency: string; finalPrice: number } | null>(null);

    // ─── Generación de Plano y Memoria Descriptiva (plan_pro) ───────────────
    const [planoState, setPlanoState] = useState<{
        status: 'idle' | 'generando' | 'pending' | 'processing' | 'completed' | 'failed';
        planoId?: string;
        pdfUrl?: string;
        dxfUrl?: string;
        error?: string;
    }>({ status: 'idle' });

    // Documento "resumen" (solo linderos + copia del plano) — disponible para
    // cualquier staff, no solo administradores. A diferencia de planoState,
    // no hay polling: plan_pro lo genera y responde en la misma request, así
    // que solo hace falta saber si está en curso o si falló.
    const [resumenState, setResumenState] = useState<{ status: 'idle' | 'generando' | 'error'; error?: string; colindanciasSinConfirmar?: number }>({ status: 'idle' });
    const [showStatsModal, setShowStatsModal] = useState(false);

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
        setLotContract(null);
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
                    clientPhone: ownerData.clientPhone,
                    clientEmail: ownerData.clientEmail,
                    clientDni: ownerData.clientDni,
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
                    
                    // Contrato en moneda extranjera -> traer su moneda/precio pactado para el resumen financiero
                    let contractData: { currency: string; finalPrice: number } | null = null;
                    if (validInvoices.some((inv: { currency_id?: unknown }) => normalizeCurrency(inv.currency_id) !== 'PEN')) {
                        contractData = await odooService.getLotContract(lot.default_code);
                        if (currentLotIdRef.current !== lotId || thisRequestId !== requestIdRef.current) {
                            setLoadingInvoices(false);
                            return;
                        }
                    }

                    setInvoices(validInvoices as any);
                    setLotContract(contractData);
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

    // Descarga directa del PDF "resumen": la ruta responde el binario en la
    // misma request (sin Plano/jobId que consultar), así que solo hace falta
    // convertirlo a blob y disparar la descarga en el navegador.
    const handleDescargarResumen = async () => {
        if (!lot?.default_code) return;
        setResumenState({ status: 'generando' });
        try {
            const res = await fetch('/api/planos/generar-resumen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ defaultCode: lot.default_code }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                setResumenState({ status: 'error', error: data?.error?.message || 'No se pudo generar el resumen' });
                return;
            }
            // Cuántos lados del documento quedaron con "Calle" genérica en
            // vez de un nombre real (ver X-Colindancias-Sin-Confirmar en la
            // ruta): no bloquea la descarga, pero el staff debería revisar
            // esos lados antes de entregar el documento — no es un dato
            // verificado, es un placeholder.
            const sinConfirmar = parseInt(res.headers.get('X-Colindancias-Sin-Confirmar') || '0', 10) || 0;
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `resumen_${lot.default_code}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setResumenState({ status: 'idle', colindanciasSinConfirmar: sinConfirmar });
        } catch (error) {
            setResumenState({ status: 'error', error: error instanceof Error ? error.message : 'Error de red' });
        }
    };

    if (!lot) return null;
    const config = STATUS_CONFIG[lot.x_statu?.toLowerCase()] || STATUS_CONFIG.libre;

    // Check if current user is the owner of the reservation
    const isReservationOwner = currentUser && reservationOwner && currentUser.uid === reservationOwner.id;

    const isLocked = lot.name.endsWith('5');
    const assignedClient = lot.x_cliente || "Sin asignar";

    // Moneda del lote = la de sus facturas (lo que realmente se le cobra al cliente). Todo monto de
    // facturas se muestra en ESA moneda: antes todo llevaba "S/" fijo y US$1,500 se veía como S/ 1,500.
    const lotCurrency = normalizeCurrency(invoices[0]?.currency_id);
    const isForeignCurrency = lotCurrency !== 'PEN';
    const formatMoney = (amount: number, currency = lotCurrency) => formatMoneyWithCurrency(amount, currency);

    // ─── KPIs Financieros y Morosidad (Estado de Cuenta) ─────────────────────────
    // Contrato en moneda extranjera: el valor total es el PRECIO PACTADO del contrato (en su moneda).
    // Restar cobros en dólares al precio de catálogo en soles daba un saldo sin sentido
    // (S/360,633.60 - US$1,500). Si aún no se pudo leer el contrato, no se inventa un número
    // en la moneda equivocada: la pantalla muestra "—".
    const priceKnown = !isForeignCurrency
        || (lotContract !== null && normalizeCurrency(lotContract.currency) === lotCurrency);
    const listPrice = isForeignCurrency
        ? (priceKnown ? (lotContract?.finalPrice || 0) : 0)
        : (lot.list_price || 0);
    // Modelo único (utils/statementModel.ts), el mismo del portal del cliente y del PDF: cuotas (capital) y cargos
    // por mora por separado; el capital pagado/avance/saldo son SOLO del capital; la mora condonada no se muestra.
    const model = buildStatementModel(invoices, listPrice);
    const now = new Date();

    // ─── Recordatorio de mora por WhatsApp ────────────────────────────────────
    // Normaliza a formato internacional para wa.me: quita todo lo que no sea
    // dígito y, si quedan los 9 dígitos típicos de un celular peruano (9...),
    // antepone el código de país 51. Best-effort: si el número ya viene con
    // código de país o en otro formato, se usa tal cual.
    function normalizarTelefonoPeru(raw: string): string {
        const digitos = raw.replace(/\D/g, '');
        if (digitos.length === 9 && digitos.startsWith('9')) return `51${digitos}`;
        return digitos;
    }

    function buildRecordatorioMoraLink(): string | null {
        if (!reservationOwner?.clientPhone) return null;
        const telefono = normalizarTelefonoPeru(reservationOwner.clientPhone);
        if (!telefono) return null;

        const lineasCuotas = [
            ...model.overdueInstallments
                .sort((x, y) => new Date(x.invoice_date_due as string).getTime() - new Date(y.invoice_date_due as string).getTime())
                .map((inv) => {
                    const fecha = new Date(inv.invoice_date_due as string).toLocaleDateString('es-PE');
                    return `• ${installmentLabel(inv)} — ${formatMoney(inv.amount_residual)} (venció ${fecha})`;
                }),
            ...model.lateFeesPending.map((fee) => `• ${lateFeeLabel(fee)} — ${formatMoney(fee.amount_residual)} (recargo por mora)`),
        ].join('\n');

        const nombreCliente = reservationOwner.clientName || 'estimado cliente';
        const codigoLote = lot?.default_code || '';
        const mensaje = `Hola ${nombreCliente}, le escribimos de Terra Lima para recordarle el estado de sus pagos del lote ${codigoLote}:\n\n${lineasCuotas}\n\nTotal a regularizar: ${formatMoney(model.totalToRegularize)}\n\nQuedamos atentos para coordinar el pago.`;

        return `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
    }

    const recordatorioMoraLink = buildRecordatorioMoraLink();

    // Mismo PDF "Estado de Cuenta" que puede bajar el cliente desde
    // /portal/pagos (una sola fuente de verdad en reportService.ts) — así
    // lo que el staff reenvía a un cliente es idéntico a lo que ese cliente
    // vería si lo bajara él mismo.
    async function handleDownloadStatement() {
        if (downloadingStatement) return;
        setDownloadingStatement(true);
        try {
            const { generateClientStatementReport } = await import('@/app/services/reportService');
            await generateClientStatementReport({
                clientName: reservationOwner?.clientName || (lot?.x_cliente as string) || 'Cliente',
                clientDni: reservationOwner?.clientDni,
                clientEmail: reservationOwner?.clientEmail,
                clientPhone: reservationOwner?.clientPhone,
                lots: [{
                    label: `Etapa ${lot?.x_etapa || '?'} Mz ${lot?.x_mz || '?'} Lote ${lot?.x_lote || '?'}`,
                    mz: lot?.x_mz || null,
                    etapa: lot?.x_etapa || null,
                    numeroLote: lot?.x_lote || null,
                    listPrice,
                    currency: lotCurrency,
                    invoices,
                }],
            });
        } catch (error) {
            console.error('Error generando PDF de estado de cuenta:', error);
            alert('No se pudo generar el PDF. Inténtalo de nuevo.');
        } finally {
            setDownloadingStatement(false);
        }
    }

    return (
        <>
            <div className={`fixed md:absolute bottom-6 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:bottom-auto md:top-4 md:right-4 w-[90%] md:w-96 bg-white dark:bg-slate-900 rounded-2xl md:rounded-xl ${SHADOW_FLOATING} ${BORDER_FLOATING} dark:border-slate-700 overflow-hidden z-[1000] animate-in slide-in-from-bottom-12 md:slide-in-from-right-8 fade-in duration-300 origin-bottom md:origin-top-right scale-[0.95] md:scale-[0.85] flex flex-col max-h-[95vh]`}>

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
            <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0 bg-slate-50/50 dark:bg-slate-900">

                {/* --- TAB: INFO --- */}
                {activeTab === 'info' && (
                    <div className="space-y-4 animate-in slide-in-from-left-4 fade-in duration-300">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white dark:bg-slate-800 p-3 rounded-lg text-center border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-center">
                                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Precio Lista</p>
                                <p className="font-bold text-slate-800 dark:text-slate-100 text-base">{formatMoney(lot.list_price, 'PEN')}</p>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-3 rounded-lg text-center border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-center">
                                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Área Total</p>
                                <p className="font-bold text-blue-700 dark:text-blue-400 text-base">{Number(lot.x_area).toFixed(2)} m²</p>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                            <div className="bg-slate-50 dark:bg-slate-800/60 px-3 py-2 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <User size={14} className="text-slate-500 dark:text-slate-400" />
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Cliente Asignado</span>
                                </div>
                            </div>
                            <div className="p-3 text-center">
                                <p className={`font-bold text-sm leading-tight ${lot.x_statu !== 'libre' ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-400 italic'}`}>
                                    {assignedClient}
                                </p>
                            </div>
                        </div>

                        {/* Plano y Memoria Descriptiva: el expediente completo sigue siendo
                            solo para administradores mientras se termina de afinar el
                            generador; el documento "resumen" (linderos + copia del plano)
                            está disponible para cualquier staff con sesión. */}
                        {currentUser && (
                        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                            <div className="bg-slate-50 dark:bg-slate-800/60 px-3 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <Map size={14} className="text-slate-500 dark:text-slate-400" />
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Plano y Memoria</span>
                                </div>
                                {currentUser.is_system && (
                                    <button
                                        onClick={() => setShowStatsModal(true)}
                                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                        title="Ver estadísticas de descargas"
                                    >
                                        <BarChart3 size={14} />
                                    </button>
                                )}
                            </div>
                            <div className="p-3 space-y-3">
                                {currentUser.is_system && (
                                <div>
                                {planoState.status === 'idle' && (
                                    <button
                                        onClick={handleGenerarPlano}
                                        className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-lg font-bold text-xs uppercase tracking-wide transition-colors flex items-center justify-center gap-2"
                                    >
                                        <FileText size={14} />
                                        Generar Plano y Memoria
                                    </button>
                                )}

                                {(planoState.status === 'generando' || planoState.status === 'pending' || planoState.status === 'processing') && (
                                    <div className="flex items-center justify-center gap-2 py-2.5 text-slate-500 dark:text-slate-400 text-xs font-medium">
                                        <Loader2 size={14} className="animate-spin" />
                                        {planoState.status === 'generando' ? 'Iniciando generación...' : 'Generando documentos, puede tardar un momento...'}
                                    </div>
                                )}

                                {planoState.status === 'failed' && (
                                    <div className="space-y-2">
                                        <div className="flex items-start gap-2 text-red-600 dark:text-red-400 text-xs">
                                            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                            <span>{planoState.error || 'No se pudo generar el plano'}</span>
                                        </div>
                                        <button
                                            onClick={handleGenerarPlano}
                                            className="w-full py-2 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg font-medium text-xs"
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
                                                className="w-full py-2 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg font-medium text-xs flex items-center justify-center gap-2"
                                            >
                                                <Download size={12} />
                                                Descargar DXF (CAD)
                                            </a>
                                        )}
                                        <button
                                            onClick={handleGenerarPlano}
                                            className="w-full text-center text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 pt-1"
                                        >
                                            Volver a generar
                                        </button>
                                    </div>
                                )}
                                </div>
                                )}

                                {/* Resumen (linderos + copia del plano): visible para todo staff.
                                    El admin también la ve, para poder probarla. */}
                                <div className={currentUser.is_system ? 'pt-3 border-t border-slate-200 dark:border-slate-700' : ''}>
                                    {currentUser.is_system && (
                                        <p className="text-[10px] text-slate-400 uppercase font-bold mb-1.5">Resumen (linderos + copia)</p>
                                    )}
                                    <button
                                        onClick={handleDescargarResumen}
                                        disabled={resumenState.status === 'generando'}
                                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/60 disabled:cursor-not-allowed text-white rounded-lg font-bold text-xs uppercase tracking-wide transition-colors flex items-center justify-center gap-2"
                                    >
                                        {resumenState.status === 'generando' ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                            <Download size={14} />
                                        )}
                                        {resumenState.status === 'generando' ? 'Generando resumen...' : 'Descargar Resumen (Linderos)'}
                                    </button>
                                    {resumenState.status === 'error' && (
                                        <div className="flex items-start gap-2 text-red-600 dark:text-red-400 text-xs mt-2">
                                            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                            <span>{resumenState.error}</span>
                                        </div>
                                    )}
                                    {resumenState.status === 'idle' && (resumenState.colindanciasSinConfirmar ?? 0) > 0 && (
                                        <div className="flex items-start gap-2 text-amber-600 dark:text-amber-400 text-xs mt-2">
                                            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                            <span>
                                                {resumenState.colindanciasSinConfirmar} lado{resumenState.colindanciasSinConfirmar === 1 ? '' : 's'} del documento
                                                {resumenState.colindanciasSinConfirmar === 1 ? ' quedó' : ' quedaron'} como &quot;Calle&quot; genérica (sin
                                                una calle real digitalizada que coincida) — revisá antes de entregarlo.
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        )}

                        {showStatsModal && (
                            <DescargasStatsModal onClose={() => setShowStatsModal(false)} />
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
                                        <div key={quote.orderId} className="bg-white dark:bg-slate-800 p-2 rounded border border-orange-100 dark:border-orange-900/40 text-xs shadow-sm">
                                            <p className="font-bold text-slate-700 dark:text-slate-200">{quote.clientName}</p>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400">Asesor: {quote.vendorName}</p>
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
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl"></div>

                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Resumen Financiero</p>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Valor Total (Precio)</p>
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{priceKnown ? formatMoney(listPrice) : '—'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Saldo Deudor Pendiente</p>
                                    <p className="text-sm font-bold text-red-600 dark:text-red-400">{priceKnown ? formatMoney(model.pendingBalance) : '—'}</p>
                                </div>
                            </div>

                            <div className="flex justify-between items-end mb-1.5">
                                <div className="flex items-center gap-1.5">
                                    <DollarSign size={14} className="text-emerald-500" />
                                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Total Pagado: {formatMoney(model.capitalPaid)}</span>
                                </div>
                                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{model.financialProgress}%</div>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                                <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${model.financialProgress}%` }}></div>
                            </div>
                        </div>

                        {/* Estado de Morosidad */}
                        {model.hasDebt ? (
                            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 p-3 rounded-lg flex items-start gap-3">
                                <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs font-bold text-red-700 dark:text-red-400 uppercase">
                                        {model.hasOverdueInstallments
                                            ? `Atraso Detectado (${model.overdueInstallments.length} ${model.overdueInstallments.length === 1 ? 'cuota' : 'cuotas'})`
                                            : 'Mora pendiente de pago'}
                                    </p>
                                    <p className="text-sm font-bold text-red-800 dark:text-red-300 mt-0.5">
                                        {model.hasOverdueInstallments
                                            ? `Deuda Exigible: ${formatMoney(model.overdueInstallmentsAmount)}`
                                            : `Mora: ${formatMoney(model.lateFeesPendingAmount)}`}
                                    </p>
                                    {model.hasOverdueInstallments && model.lateFeesPending.length > 0 && (
                                        <p className="text-[11px] font-semibold text-red-700 dark:text-red-300 mt-0.5">
                                            Cuotas {formatMoney(model.overdueInstallmentsAmount)} + Mora {formatMoney(model.lateFeesPendingAmount)} = Total a regularizar {formatMoney(model.totalToRegularize)}
                                        </p>
                                    )}
                                    <p className="text-[10px] text-red-600 dark:text-red-400 mt-1">El cliente presenta pagos vencidos. Priorizar cobranza.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-3 rounded-lg flex items-center gap-3">
                                <CheckCircle size={18} className="text-emerald-500 shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">Financiamiento Al Día</p>
                                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400">No hay facturas vencidas registradas.</p>
                                </div>
                            </div>
                        )}

                        {/* Invoice List (Timeline) */}
                        <div className="space-y-3">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1 mt-2">Historial de Cuotas y Pagos</p>

                            {loadingInvoices ? (
                                <div className="p-6 text-center text-slate-400 text-xs bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">Cargando estado de cuenta...</div>
                            ) : model.installments.length === 0 ? (
                                <div className="p-6 text-center bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm text-slate-400 text-xs italic flex flex-col items-center">
                                    <Receipt size={24} className="mb-2 opacity-50" />
                                    Aún no hay cuotas facturadas.
                                </div>
                            ) : (
                                <div className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-3 pl-4 space-y-4">
                                    {model.installments.map((inv) => {
                                        const status = installmentStatus(inv, now);
                                        const isPaid = status === 'paid';
                                        const isOverdueItem = status === 'overdue';
                                        const cuotaLabel = installmentLabel(inv);

                                        return (
                                            <div key={inv.id} className="relative">
                                                {/* Timeline dot */}
                                                <div className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${isPaid ? 'bg-emerald-500' : isOverdueItem ? 'bg-red-500 animate-pulse' : 'bg-amber-400'}`}></div>

                                                <div className={`bg-white dark:bg-slate-800 p-3 rounded-lg border ${isOverdueItem ? 'border-red-200 dark:border-red-900/50 shadow-red-50 dark:shadow-none' : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700'} shadow-sm transition-colors`}>
                                                    <div className="flex justify-between items-start mb-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-slate-700 dark:text-slate-200 text-xs">{cuotaLabel}</span>
                                                            {isPaid ?
                                                                <span className="bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">Pagado</span> :
                                                                isOverdueItem ?
                                                                    <span className="bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase animate-pulse">{STATUS_LABEL.overdue}</span> :
                                                                    <span className="bg-yellow-100 dark:bg-yellow-950/50 text-yellow-700 dark:text-yellow-300 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">Pendiente</span>
                                                            }
                                                        </div>
                                                        <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{formatMoney(inv.amount_total)}</p>
                                                    </div>

                                                    <div className="flex justify-between items-end mt-2">
                                                        <div className="space-y-0.5">
                                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                                                                <FileText size={10} />
                                                                <span>{inv.name || inv.ref || 'S/N'}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                                                                <Calendar size={10} />
                                                                <span>Vencimiento: {inv.invoice_date_due || inv.invoice_date}</span>
                                                            </div>
                                                        </div>
                                                        {!isPaid && (
                                                            <p className="text-[11px] text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded-md">
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

                        {/* Cargos por mora: bloque propio, nunca mezclado con las cuotas (las condonadas no se muestran) */}
                        {!loadingInvoices && model.hasLateFees && (
                            <div className="space-y-3">
                                <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider ml-1 mt-2">Cargos por Mora</p>
                                <div className="bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-900/50 shadow-sm divide-y divide-amber-100 dark:divide-amber-900/30">
                                    {model.lateFees.map((fee) => {
                                        const feePaid = fee.payment_state === 'paid';
                                        return (
                                            <div key={fee.id} className="p-3 flex justify-between items-start gap-3">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-amber-700 dark:text-amber-400 text-xs">{lateFeeLabel(fee)}</span>
                                                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${feePaid ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300' : 'bg-yellow-100 dark:bg-yellow-950/50 text-yellow-700 dark:text-yellow-300'}`}>
                                                            {feePaid ? STATUS_LABEL.paid : STATUS_LABEL.pending}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                                                        {typeof fee.late_fee_days_late === 'number' ? `${fee.late_fee_days_late} días de atraso` : ''}
                                                        {fee.late_fee_percentage_applied ? ` · ${fee.late_fee_percentage_applied}% aplicado` : ''}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{formatMoney(fee.amount_total)}</p>
                                                    {!feePaid && (
                                                        <p className="text-[11px] text-red-600 dark:text-red-400 font-bold">Saldo: {formatMoney(fee.amount_residual)}</p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 px-1">{lateFeeNote(model.lateFees)}</p>
                            </div>
                        )}

                        {/* Action Buttons Contextuales — Descargar Estado de Cuenta
                            siempre visible; junto a Recordar (WhatsApp) cuando hay
                            mora (ambas acciones son relevantes a la vez), sola
                            cuando el cliente está al día. */}
                        <div className={model.hasDebt ? 'flex gap-2' : ''}>
                            <button
                                onClick={handleDownloadStatement}
                                disabled={downloadingStatement}
                                className={`${model.hasDebt ? 'flex-1' : 'w-full'} py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-transform active:scale-95`}
                            >
                                {downloadingStatement ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                Descargar Estado de Cuenta
                            </button>

                            {model.hasDebt && (
                                recordatorioMoraLink ? (
                                    <a
                                        href={recordatorioMoraLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm shadow-lg shadow-red-200 flex items-center justify-center gap-2 transition-transform active:scale-95"
                                    >
                                        <AlertTriangle size={16} />
                                        Recordar (WhatsApp)
                                    </a>
                                ) : (
                                    <button
                                        disabled
                                        title="El cliente no tiene teléfono registrado en Odoo"
                                        className="flex-1 py-3 bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-lg font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed"
                                    >
                                        <AlertTriangle size={16} />
                                        Sin teléfono
                                    </button>
                                )
                            )}
                        </div>
                    </div>
                )}

            </div>

            {/* FOOTER ACTIONS (Only on Info Tab) */}
            {activeTab === 'info' && (
                <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0">
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
                    : ((model.capitalPaid + model.lateFeePaid) > 0 ? (model.capitalPaid + model.lateFeePaid) : 1000);

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
