'use client';

import { use, useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Download, Calculator, Calendar, Tag, DollarSign, Table, Loader2, Percent, User, Search, Check, Plus, X, Save, Send, CheckCircle, Map } from 'lucide-react';
import { lotsData, Lot } from '@/app/data/lotsData';
import { financeService, QuoteCalculations } from '@/app/services/financeService';
import Header from '@/app/components/UI/Header';
import { exportQuoteToPdf } from '@/app/utils/quotePdfExporter';
import geometriesJson from '@/app/data/geometries.json';
import { useAuth } from '@/app/context/AuthContext';
import { odooService } from '@/app/services/odooService';
import { localQuoteService } from '@/app/services/localQuoteService';
import { LocalQuote } from '@/app/types/localQuote';

interface QuotePageProps {
    params: Promise<{ lotId: string }>;
}

export default function QuotePage({ params }: QuotePageProps) {
    const { user } = useAuth();
    const { lotId } = use(params);
    const router = useRouter();
    const [dynamicLot, setDynamicLot] = useState<Lot | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    // 1. Buscar el lote
    useEffect(() => {
        const idToFind = lotId.replace('local-', '').replace('fb-', '');
        const localMatch = lotsData.find(l => l.id === idToFind);

        if (localMatch) {
            setDynamicLot(localMatch);
            setLoading(false);
            return;
        }

        const fetchLot = async () => {
            try {
                const response = await fetch(`/api/odoo/product/${lotId}`);
                if (!response.ok) throw new Error("Error en red");
                const data = await response.json();

                if (data.success && data.product) {
                    const p = data.product;
                    const code = (p.default_code || '').toString();
                    const geometry = (geometriesJson as any)[code];

                    setDynamicLot({
                        id: p.id.toString(),
                        name: p.name,
                        x_statu: p.x_statu || 'libre',
                        list_price: p.list_price || 0,
                        x_area: p.x_area || (geometry?.measurements?.area || 0),
                        x_mz: p.x_mz || '',
                        x_etapa: p.x_etapa || '',
                        x_lote: p.x_lote || '',
                        default_code: code,
                        points: geometry?.coordinates || [],
                        measurements: geometry?.measurements
                    });
                }
            } catch (error) {
                console.error("Error fetching lot for quote:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchLot();
    }, [lotId]);

    const lot = dynamicLot;

    // 2. Estados del Formulario
    const [discountPercent, setDiscountPercent] = useState<number>(0);
    const [discountAmount, setDiscountAmount] = useState<number>(0);
    const [initialPayment, setInitialPayment] = useState<number>(0);
    const [numInstallments, setNumInstallments] = useState<number>(72);
    const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);

    // Cliente (Búsqueda de Odoo)
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<{ id: number; name: string }[]>([]);
    const [selectedClient, setSelectedClient] = useState<{ id: number; name: string } | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [showCreateClient, setShowCreateClient] = useState(false);
    const [isCreatingClient, setIsCreatingClient] = useState(false);
    const [newClientData, setNewClientData] = useState({ name: '', vat: '', phone: '', email: '' });

    // Local Quote State
    const [currentQuoteId, setCurrentQuoteId] = useState<string | null>(null);
    const [isSavingQuote, setIsSavingQuote] = useState(false);
    const [isConfirmingQuote, setIsConfirmingQuote] = useState(false);
    const [quoteConfirmed, setQuoteConfirmed] = useState(false);

    // Debounced client search
    useEffect(() => {
        if (!searchTerm || selectedClient) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const results = await odooService.searchPartners(searchTerm);
                setSearchResults(results || []);
            } catch (error) {
                console.error('Error searching partners:', error);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchTerm, selectedClient]);

    const selectClient = (client: { id: number; name: string }) => {
        setSelectedClient(client);
        setSearchTerm(client.name);
        setSearchResults([]);
    };

    const handleCreateClient = async () => {
        if (!newClientData.name || !newClientData.vat) return;

        setIsCreatingClient(true);
        try {
            const newClient = await odooService.createPartner({
                name: newClientData.name,
                vat: newClientData.vat,
                phone: newClientData.phone,
                email: newClientData.email
            });

            selectClient(newClient);
            setShowCreateClient(false);
            setNewClientData({ name: '', vat: '', phone: '', email: '' });
        } catch (error) {
            console.error('Error creating client:', error);
            alert('Error al crear el cliente. Intente nuevamente.');
        } finally {
            setIsCreatingClient(false);
        }
    };

    // Sincronizar entradas de descuento - porcentaje con 6 decimales
    const handleDiscountPercentChange = (val: number) => {
        // Redondear a 6 decimales para máxima precisión en el porcentaje
        const roundedPercent = Math.round(val * 1000000) / 1000000;
        setDiscountPercent(roundedPercent);
        if (lot) {
            // Calcular monto con 4 decimales (suficiente para soles)
            const amount = Math.round(lot.list_price * (roundedPercent / 100) * 10000) / 10000;
            setDiscountAmount(amount);
        }
    };



    // Save Quote Locally & Export PDF
    const handleSaveQuote = async () => {
        if (!lot || !calculations) return;

        setIsSavingQuote(true);
        try {
            // 1. Create Quote Object
            const quote: LocalQuote = {
                id: currentQuoteId || localQuoteService.generateId(), // Reuse ID if updating
                lotId: lot.id,
                lotDefaultCode: lot.default_code || '',
                lotName: lot.name,
                clientData: selectedClient ? {
                    name: selectedClient.name,
                    // If we had more client data, we'd put it here
                } : null,
                terms: {
                    originalPrice: lot.list_price,
                    discountPercent,
                    discountAmount,
                    discountedPrice: calculations.discountedPrice,
                    initialPayment,
                    numInstallments,
                    monthlyInstallment: calculations.monthlyInstallment,
                    remainingBalance: calculations.remainingBalance,
                    startDate
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                status: 'draft_local',
                vendorName: user?.name || 'Vendedor'
            };

            // 2. Save to LocalStorage
            localQuoteService.saveQuote(quote);
            setCurrentQuoteId(quote.id);

            // 3. Export PDF
            exportQuoteToPdf(
                lot,
                calculations,
                user?.name || 'No especificado',
                selectedClient?.name
            );

            // Notify Success (could use a toast)
            console.log("Quote saved locally:", quote.id);

        } catch (error) {
            console.error("Error saving quote:", error);
            alert("Error al guardar la cotización");
        } finally {
            setIsSavingQuote(false);
        }
    };

    // Confirm Quote in Odoo
    const handleConfirmQuote = async () => {
        if (!lot || !calculations || !currentQuoteId || !selectedClient) {
            alert("Debe guardar la cotización y seleccionar un cliente antes de confirmar.");
            return;
        }

        setIsConfirmingQuote(true);
        try {
            // Confirm via OdooService
            // Note: odooService.confirmLocalQuote handles Partner creation/finding if VAT is provided
            // But here we already have 'selectedClient' (which is minimal {id, name}).
            // If the client was selected from search, we have the ID.

            // We pass the data to confirmLocalQuote.
            // If selectedClient has an ID, we use it directly?
            // confirmLocalQuote expects clientData + lot + terms.

            // Generate PDF Blob for upload to Odoo
            const pdfBlob = await exportQuoteToPdf(
                lot,
                calculations,
                user?.name || 'Vendedor',
                selectedClient.name,
                true // Request Blob return instead of download
            );

            if (!pdfBlob) {
                throw new Error('Failed to generate PDF quote');
            }

            const pdfFile = new File([pdfBlob as Blob], `Cotizacion_${lot.name.replace(/\s+/g, '_')}.pdf`, {
                type: 'application/pdf'
            });

            const result = await odooService.confirmLocalQuote(
                lot.default_code || '',
                {
                    id: selectedClient.id,
                    name: selectedClient.name,
                },
                lot.list_price, // Use full list price
                `Cotización para ${lot.name}. Inicial: ${initialPayment}. Plazo: ${numInstallments} meses.`,
                {
                    installments: numInstallments,
                    downPayment: initialPayment,
                    discount: discountAmount,
                    firstInstallmentDate: startDate
                },
                pdfFile, // Pass the generated PDF file
                user?.uid // Pass the logged-in user's ID
            );

            // If success
            // result contains { orderId, partnerId }
            localQuoteService.markAsConfirmed(currentQuoteId, result.orderId, result.partnerId);
            setQuoteConfirmed(true);
            alert("Cotización confirmada exitosamente en Odoo. Lote pasado a estado 'Cotización'.");
            router.push('/');

        } catch (error: any) {
            console.error("Confirmation error:", error);
            alert(`Error al confirmar en Odoo: ${error.message}`);
        } finally {
            setIsConfirmingQuote(false);
        }
    };

    const handleDiscountAmountChange = (val: number) => {
        // Redondear a 4 decimales para montos (suficiente para soles)
        const roundedAmount = Math.round(val * 10000) / 10000;
        setDiscountAmount(roundedAmount);
        if (lot && lot.list_price > 0) {
            // Calcular porcentaje con 6 decimales de precisión
            const percent = (roundedAmount / lot.list_price) * 100;
            setDiscountPercent(Math.round(percent * 1000000) / 1000000);
        }
    };

    // 3. Cálculos en tiempo real
    const calculations: QuoteCalculations | null = useMemo(() => {
        if (!lot) return null;
        return financeService.calculateQuote(
            lot.list_price,
            discountPercent,
            initialPayment,
            numInstallments,
            new Date(startDate)
        );
    }, [lot, discountPercent, initialPayment, numInstallments, startDate]);

    if (loading) {
        return (
            <div className="flex flex-col h-screen items-center justify-center bg-slate-50 font-sans">
                <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
                <p className="text-slate-500 font-medium tracking-tight">Cargando detalles de cotización...</p>
            </div>
        );
    }

    if (!lot || !calculations) {
        return (
            <div className="flex flex-col h-screen items-center justify-center bg-slate-50 font-sans">
                <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200 border border-slate-100 flex flex-col items-center max-w-sm text-center">
                    <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6">
                        <Calculator size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Lote no encontrado</h2>
                    <p className="text-slate-500 mb-8 leading-relaxed">No pudimos recuperar la información del lote solicitado. Es posible que el ID sea incorrecto o el producto no esté activo.</p>
                    <button
                        onClick={() => router.push('/')}
                        className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-2 rounded-2xl transition-all active:scale-95"
                    >
                        <ChevronLeft size={20} /> Volver al Mapa
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans">
            <Header onSync={() => router.refresh()} />

            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-6xl mx-auto space-y-6">

                    {/* Navegación y Título */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/')}
                                className="group flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-600 px-3 py-2 md:px-4 md:py-2 rounded-xl border border-slate-200 shadow-sm transition-all active:scale-95 whitespace-nowrap"
                            >
                                {/* Mobile: Map Icon */}
                                <Map size={20} className="md:hidden" />

                                {/* Desktop: Chevron + Text */}
                                <ChevronLeft size={20} className="hidden md:block group-hover:-translate-x-1 transition-transform" />
                                <span className="hidden md:block text-xs font-bold uppercase tracking-wider">Volver al Mapa</span>
                            </button>
                            <div className="h-10 w-[1px] bg-slate-200 hidden md:block mx-1"></div>
                            <div>
                                <h1 className="text-xl md:text-2xl font-bold text-slate-800">Cotización TERRA-LIMA</h1>
                                <p className="text-slate-500 font-medium">{lot.name} • {lot.x_mz} {lot.x_lote}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Guardar / Exportar */}
                            <button
                                onClick={handleSaveQuote}
                                disabled={isSavingQuote || quoteConfirmed}
                                className={`
                                    px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 text-sm
                                    ${quoteConfirmed
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
                                    }
                                `}
                            >
                                {isSavingQuote ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                {currentQuoteId ? 'Guardar y Recalcular' : 'Guardar Cotización'}
                            </button>

                            {/* Confirmar en Odoo */}
                            <button
                                onClick={handleConfirmQuote}
                                disabled={!currentQuoteId || !selectedClient || isConfirmingQuote || quoteConfirmed}
                                className={`
                                    px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 text-sm
                                    ${(!currentQuoteId || !selectedClient || quoteConfirmed)
                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
                                    }
                                `}
                            >
                                {isConfirmingQuote ? <Loader2 size={18} className="animate-spin" /> :
                                    quoteConfirmed ? <CheckCircle size={18} /> : <Send size={18} />}
                                {quoteConfirmed ? 'Enviado' : 'Confirmar en Odoo'}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

                        {/* LEFT COLUMN: RESUMEN FINANCIERO (Sticky) */}
                        <div className="lg:col-span-1 lg:sticky lg:top-8 space-y-6">

                            {/* Resumen de Valores (Moved here as the main item of the left column) */}
                            <div className="bg-slate-900 p-6 rounded-2xl shadow-xl text-white space-y-4">
                                <div className="flex justify-between items-center opacity-60 text-xs font-bold uppercase tracking-widest">
                                    <span>Resumen Financiero (S/)</span>
                                    <Tag size={14} />
                                </div>
                                <div className="space-y-3 pt-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="opacity-70">Precio Lista</span>
                                        <span className="font-mono">{financeService.formatCurrency(lot.list_price)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-emerald-400">
                                        <span>Descuento ({discountPercent.toFixed(2)}%)</span>
                                        <span className="font-mono">-{financeService.formatCurrency(calculations.discountAmount)}</span>
                                    </div>
                                    <div className="h-[1px] bg-white/10 my-2" />
                                    <div className="flex justify-between items-center">
                                        <span className="text-base font-bold">Precio Final</span>
                                        <span className="text-xl font-bold font-mono">{financeService.formatCurrency(calculations.discountedPrice)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm pt-4">
                                        <span className="opacity-70">Saldo a Financiar</span>
                                        <span className="font-mono">{financeService.formatCurrency(calculations.remainingBalance)}</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-white/10 p-3 rounded-xl border border-white/5">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold uppercase opacity-60">Cuota Mensual</span>
                                            <span className="text-lg font-bold font-mono text-indigo-400">{financeService.formatCurrency(calculations.monthlyInstallment)}</span>
                                        </div>
                                        <span className="text-xs font-bold opacity-60">{numInstallments} meses</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: AJUSTES + CRONOGRAMA */}
                        <div className="lg:col-span-2 space-y-6">

                            {/* Panel de Configuración (Moved to Top of Right Column) */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                                    <Calculator size={16} /> Ajustes de Venta
                                </h2>

                                <div className="space-y-6">
                                    {/* CLIENT SEARCH */}
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-2">
                                            <User size={14} className="text-slate-400" />
                                            Cliente (Comprador)
                                        </label>

                                        {!showCreateClient ? (
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    placeholder="Buscar cliente por nombre o DNI..."
                                                    value={searchTerm}
                                                    onChange={(e) => {
                                                        setSearchTerm(e.target.value);
                                                        if (selectedClient && e.target.value !== selectedClient.name) {
                                                            setSelectedClient(null);
                                                        }
                                                    }}
                                                    className={`w-full px-3 py-2 text-sm text-black border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all ${selectedClient ? 'border-blue-500 bg-blue-50 text-blue-900 font-semibold' : 'border-slate-200'}`}
                                                />
                                                {selectedClient && (
                                                    <div className="absolute right-3 top-2.5 text-blue-600">
                                                        <Check size={16} />
                                                    </div>
                                                )}
                                                {isSearching && (
                                                    <div className="absolute right-3 top-2.5 animate-spin">
                                                        <Search size={16} className="text-slate-400" />
                                                    </div>
                                                )}

                                                {/* Dropdown Results */}
                                                {searchResults.length > 0 ? (
                                                    <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-300 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto ring-1 ring-black/5">
                                                        {searchResults.map((client, index) => (
                                                            <button
                                                                key={client.id}
                                                                onClick={() => selectClient(client)}
                                                                className={`w-full text-left px-4 py-3 text-sm hover:bg-blue-50 transition-colors flex items-center gap-3 ${index !== searchResults.length - 1 ? 'border-b border-slate-100' : ''}`}
                                                            >
                                                                <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                                                                    {client.name.charAt(0).toUpperCase()}
                                                                </div>
                                                                <span className="font-bold text-slate-700">{client.name}</span>
                                                            </button>
                                                        ))}
                                                        {/* Always show option to create at the bottom of valid results too */}
                                                        <button
                                                            onClick={() => setShowCreateClient(true)}
                                                            className="w-full text-left px-4 py-3 text-sm bg-slate-50 text-blue-700 hover:bg-blue-100 transition-colors flex items-center gap-2 border-t border-slate-200 font-medium"
                                                        >
                                                            <div className="w-8 h-8 flex items-center justify-center">
                                                                <Plus size={16} />
                                                            </div>
                                                            Crear Nuevo Cliente
                                                        </button>
                                                    </div>
                                                ) : searchTerm.length > 0 && !isSearching && !selectedClient && (
                                                    <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-300 rounded-xl shadow-2xl z-50 p-4 text-center">
                                                        <p className="text-xs text-slate-500 mb-3 font-medium">No se encontraron resultados para "{searchTerm}"</p>
                                                        <button
                                                            onClick={() => setShowCreateClient(true)}
                                                            className="w-full py-2 bg-blue-100 text-blue-800 rounded-lg text-xs font-bold hover:bg-blue-200 transition-colors flex items-center justify-center gap-2"
                                                        >
                                                            <Plus size={14} /> Crear Nuevo Cliente
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 animate-in fade-in slide-in-from-top-2">
                                                <div className="flex justify-between items-center mb-3 text-xs font-bold text-slate-500 uppercase">
                                                    <span>Nuevo Cliente</span>
                                                    <button onClick={() => setShowCreateClient(false)} className="text-slate-400 hover:text-slate-600">
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                                <div className="space-y-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Nombre Completo (Obligatorio)"
                                                        className="w-full px-2 py-1.5 text-sm border rounded placeholder:text-slate-500"
                                                        value={newClientData.name}
                                                        onChange={e => setNewClientData({ ...newClientData, name: e.target.value })}
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="DNI / RUC (Obligatorio)"
                                                        className="w-full px-2 py-1.5 text-sm border rounded placeholder:text-slate-500"
                                                        value={newClientData.vat}
                                                        onChange={e => setNewClientData({ ...newClientData, vat: e.target.value })}
                                                    />
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="tel"
                                                            placeholder="Teléfono"
                                                            className="w-full px-2 py-1.5 text-sm border rounded placeholder:text-slate-500"
                                                            value={newClientData.phone}
                                                            onChange={e => setNewClientData({ ...newClientData, phone: e.target.value })}
                                                        />
                                                        <input
                                                            type="email"
                                                            placeholder="Email"
                                                            className="w-full px-2 py-1.5 text-sm border rounded placeholder:text-slate-500"
                                                            value={newClientData.email}
                                                            onChange={e => setNewClientData({ ...newClientData, email: e.target.value })}
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={handleCreateClient}
                                                        disabled={!newClientData.name || !newClientData.vat || isCreatingClient}
                                                        className="w-full py-2 bg-slate-800 text-white rounded text-xs font-bold hover:bg-black transition-colors disabled:opacity-50"
                                                    >
                                                        {isCreatingClient ? 'Guardando...' : 'Guardar Cliente'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Descuento Dual */}
                                    <div className="space-y-3">
                                        <label className="block text-sm font-bold text-slate-700">Descuento aplicado</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="relative">
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</div>
                                                <input
                                                    type="number"
                                                    step="0.000001"
                                                    value={discountPercent}
                                                    onChange={(e) => handleDiscountPercentChange(parseFloat(e.target.value) || 0)}
                                                    className="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800 transition-all text-sm"
                                                    placeholder="%"
                                                />
                                            </div>
                                            <div className="relative">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">S/</div>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={discountAmount}
                                                    onChange={(e) => handleDiscountAmountChange(parseFloat(e.target.value) || 0)}
                                                    className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800 transition-all text-sm"
                                                    placeholder="Monto"
                                                />
                                            </div>
                                        </div>
                                        <input
                                            type="range"
                                            min="0" max="25" step="0.5"
                                            value={discountPercent}
                                            onChange={(e) => handleDiscountPercentChange(parseFloat(e.target.value))}
                                            className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                        />
                                    </div>

                                    {/* Cuota Inicial */}
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Cuota Inicial (S/)</label>
                                        <div className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">S/</div>
                                            <input
                                                type="number"
                                                value={initialPayment}
                                                onChange={(e) => setInitialPayment(parseFloat(e.target.value) || 0)}
                                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800 transition-all"
                                            />
                                        </div>
                                    </div>

                                    {/* Cantidad de Cuotas Libres */}
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Plazo (Meses)</label>
                                        <div className="relative">
                                            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="number"
                                                min="1" max="180"
                                                value={numInstallments}
                                                onChange={(e) => setNumInstallments(parseInt(e.target.value) || 0)}
                                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800 transition-all"
                                            />
                                        </div>
                                    </div>

                                    {/* Fecha Inicial */}
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Fecha Cuota Inicial</label>
                                        <div className="relative">
                                            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="date"
                                                value={startDate}
                                                onChange={(e) => setStartDate(e.target.value)}
                                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-800"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Tabla de Amortización (Kept in Right Column) */}
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                    <h2 className="font-bold text-slate-700 flex items-center gap-2">
                                        <Table size={18} className="text-indigo-600" /> Cronograma de Pagos (Soles)
                                    </h2>
                                    <span className="text-[10px] font-bold px-2 py-1 bg-white border border-slate-200 rounded text-slate-500 uppercase tracking-tighter">
                                        PROYECCIÓN A {numInstallments} MESES
                                    </span>
                                </div>

                                <div className="flex-1 overflow-auto max-h-[600px]">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="sticky top-0 bg-white shadow-sm z-10">
                                            <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                <th className="px-6 py-4 border-b border-slate-100">#</th>
                                                <th className="px-6 py-4 border-b border-slate-100">Fecha de Pago</th>
                                                <th className="px-6 py-4 border-b border-slate-100 text-right">Monto Cuota</th>
                                                <th className="px-6 py-4 border-b border-slate-100 text-right">Saldo Restante</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {/* Fila de Cuota Inicial */}
                                            <tr className="bg-emerald-50/30 group">
                                                <td className="px-6 py-4 text-xs font-bold text-slate-400">0</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-emerald-700">Cuota Inicial</span>
                                                        <span className="text-[10px] text-emerald-600 opacity-70 font-medium">Pago Inmediato</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="text-sm font-mono font-bold text-emerald-700">{financeService.formatCurrency(calculations.initialPayment)}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="text-sm font-mono font-medium text-slate-400">{financeService.formatCurrency(calculations.remainingBalance)}</span>
                                                </td>
                                            </tr>

                                            {/* Cuotas Mensuales */}
                                            {calculations.installments.map((inst) => (
                                                <tr key={inst.number} className="hover:bg-slate-50 transition-colors group">
                                                    <td className="px-6 py-4 text-xs font-bold text-slate-400">{inst.number}</td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-sm font-medium text-slate-700">{financeService.formatDate(inst.date)}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className="text-sm font-mono font-bold text-slate-900 italic opacity-80 group-hover:opacity-100">
                                                            {financeService.formatCurrency(inst.amount)}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className="text-sm font-mono text-slate-500">
                                                            {financeService.formatCurrency(inst.balance)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                                    <p className="text-[10px] text-slate-400 font-medium italic">
                                        * Esta es una simulación COTIZACION en Soles y no constituye un compromiso legal hasta ser validada por administración.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
