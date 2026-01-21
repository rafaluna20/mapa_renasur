import { X, FileText, Check, Search, User, Loader2, Plus, Calculator, Calendar } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Lot } from '@/app/data/lotsData';
import { odooService } from '@/app/services/odooService';
import { useAuth } from '@/app/context/AuthContext';

interface QuotationModalProps {
    lot: Lot;
    onClose: () => void;
    onSuccess: () => void;
}

export default function QuotationModal({ lot, onClose, onSuccess }: QuotationModalProps) {
    const { user } = useAuth();

    // --- Client Search State (Reused logic) ---
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<{ id: number; name: string }[]>([]);
    const [selectedClient, setSelectedClient] = useState<{ id: number; name: string } | null>(null);
    const [isSearching, setIsSearching] = useState(false);

    // --- New Client State ---
    const [showCreateClient, setShowCreateClient] = useState(false);
    const [newClientData, setNewClientData] = useState({ name: '', vat: '', phone: '', email: '' });
    const [isCreatingClient, setIsCreatingClient] = useState(false);

    // --- Quotation Details State ---
    const [installments, setInstallments] = useState(72);
    const [downPayment, setDownPayment] = useState<number>(0); // Cuota Inicial
    const [discount, setDiscount] = useState<number>(0); // Descuento
    const [firstDate, setFirstDate] = useState<string>(new Date().toISOString().split('T')[0]); // Today by default
    const [notes, setNotes] = useState('');

    // --- Processing State ---
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Helper: Debounce search
    useEffect(() => {
        if (showCreateClient || selectedClient) return;
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.length > 2) {
                setIsSearching(true);
                try {
                    const results = await odooService.searchPartners(searchTerm);
                    setSearchResults(results);
                } catch (e) {
                    console.error(e);
                } finally {
                    setIsSearching(false);
                }
            } else {
                setSearchResults([]);
            }
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, selectedClient, showCreateClient]);

    // Helper: Select Client
    const selectClient = (client: { id: number; name: string }) => {
        setSelectedClient(client);
        setSearchTerm(client.name);
        setSearchResults([]);
    };

    // Helper: Create Client
    const handleCreateClient = async () => {
        if (!newClientData.name || !newClientData.vat) return;
        setIsCreatingClient(true);
        try {
            const newClient = await odooService.createPartner(newClientData);
            selectClient(newClient);
            setShowCreateClient(false);
        } catch (error) {
            console.error(error);
            alert('Error al crear el cliente.');
        } finally {
            setIsCreatingClient(false);
        }
    };

    // Calculation Logic
    const listPrice = lot.list_price || 0;
    const finalPrice = listPrice - discount;
    const financedAmount = finalPrice - downPayment;
    const monthlyPayment = installments > 0 ? financedAmount / installments : 0;

    // Validation
    const isValidFinancials = (downPayment + discount) <= listPrice;
    const isFormValid = selectedClient && isValidFinancials && installments > 0;

    const handleSubmit = async () => {
        if (!isFormValid || !selectedClient) return;

        setIsSubmitting(true);
        try {
            // IMPORTANTE: Enviamos el precio COMPLETO (list_price) a Odoo
            // El descuento se guarda por separado en x_discount_amount
            // El módulo de contratos recurrentes calculará: 
            // Precio Neto = list_price - x_discount_amount - x_down_payment
            await odooService.confirmLocalQuote(
                lot.default_code,
                { id: selectedClient.id, name: selectedClient.name },
                lot.list_price,  // ⬅️ Precio SIN modificar (antes era finalPrice)
                notes,
                {
                    installments,
                    downPayment,
                    discount,
                    firstInstallmentDate: firstDate
                },
                undefined, // No PDF file yet in this flow
                user?.uid
            );

            onSuccess();
            onClose();
        } catch (error: any) {
            console.error("Quotation Error:", error);
            alert(`Error al crear la cotización: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatMoney = (amount: number) => `$ ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1100] animate-in fade-in duration-200 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white shrink-0">
                    <div>
                        <h2 className="font-bold text-lg flex items-center gap-2">
                            <Calculator size={20} />
                            Cotizador Comercial
                        </h2>
                        <p className="text-indigo-200 text-xs">Lote {lot.name} • {lot.x_mz} • {lot.x_etapa}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* 1. SECTION: CLIENT */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-2">
                            <User size={16} className="text-indigo-600" /> 1. Datos del Cliente
                        </h3>

                        {!showCreateClient ? (
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Buscar cliente (Nombre o DNI)..."
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        if (selectedClient && e.target.value !== selectedClient.name) setSelectedClient(null);
                                    }}
                                    className={`w-full px-4 py-3 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${selectedClient ? 'border-indigo-500 bg-indigo-50 text-indigo-900 font-bold' : 'border-slate-300'}`}
                                />
                                {selectedClient && <Check className="absolute right-3 top-3.5 text-indigo-600" size={18} />}
                                {isSearching && <Loader2 className="absolute right-3 top-3.5 animate-spin text-slate-400" size={18} />}

                                {/* Results Dropdown */}
                                {searchResults.length > 0 && (
                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                                        {searchResults.map((client) => (
                                            <button
                                                key={client.id}
                                                onClick={() => selectClient(client)}
                                                className="w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 border-b border-slate-100 last:border-0"
                                            >
                                                {client.name}
                                            </button>
                                        ))}
                                        <button onClick={() => setShowCreateClient(true)} className="w-full text-left px-4 py-3 text-sm text-indigo-600 font-bold bg-slate-50 hover:bg-indigo-50 flex items-center gap-2">
                                            <Plus size={16} /> Crear Nuevo Cliente
                                        </button>
                                    </div>
                                )}

                                {searchTerm.length > 2 && !isSearching && searchResults.length === 0 && !selectedClient && (
                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-2">
                                        <button onClick={() => setShowCreateClient(true)} className="w-full text-center py-2 text-sm text-indigo-600 font-bold hover:bg-indigo-50 rounded-md">
                                            + Crear "{searchTerm}"
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3 animate-in fade-in">
                                <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase">
                                    <span>Nuevo Cliente</span>
                                    <button onClick={() => setShowCreateClient(false)}><X size={14} /></button>
                                </div>
                                <input className="w-full p-2 text-sm border rounded" placeholder="Nombre Completo" value={newClientData.name} onChange={e => setNewClientData({ ...newClientData, name: e.target.value })} />
                                <input className="w-full p-2 text-sm border rounded" placeholder="DNI / RUC" value={newClientData.vat} onChange={e => setNewClientData({ ...newClientData, vat: e.target.value })} />
                                <button
                                    onClick={handleCreateClient}
                                    disabled={!newClientData.name || !newClientData.vat || isCreatingClient}
                                    className="w-full py-2 bg-slate-800 text-white rounded text-xs font-bold hover:bg-black disabled:opacity-50"
                                >
                                    {isCreatingClient ? 'Guardando...' : 'Guardar Cliente'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* 2. SECTION: FINANCIALS */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-2">
                            <Calculator size={16} className="text-indigo-600" /> 2. Condiciones Financieras
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Plazo */}
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-xs font-bold text-slate-500 mb-1">PLAZO (Meses)</label>
                                <select
                                    value={installments}
                                    onChange={(e) => setInstallments(Number(e.target.value))}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    {[12, 24, 36, 48, 60, 72].map(m => (
                                        <option key={m} value={m}>{m} Meses</option>
                                    ))}
                                </select>
                            </div>

                            {/* Fecha 1ra Cuota */}
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-xs font-bold text-slate-500 mb-1">1RA CUOTA</label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        min={new Date().toISOString().split('T')[0]}
                                        value={firstDate}
                                        onChange={(e) => setFirstDate(e.target.value)}
                                        className="w-full p-2.5 pl-9 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                    <Calendar className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                </div>
                            </div>

                            {/* Cuota Inicial */}
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-xs font-bold text-slate-500 mb-1">CUOTA INICIAL</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-slate-400 text-sm">$</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="100"
                                        value={downPayment || ''}
                                        onChange={(e) => setDownPayment(Number(e.target.value))}
                                        placeholder="0.00"
                                        className="w-full p-2.5 pl-7 bg-white border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Descuento */}
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-xs font-bold text-slate-500 mb-1">DESCUENTO</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-slate-400 text-sm">$</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="100"
                                        value={discount || ''}
                                        onChange={(e) => setDiscount(Number(e.target.value))}
                                        placeholder="0.00"
                                        className="w-full p-2.5 pl-7 bg-white border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none text-green-600"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Summary Box */}
                        <div className="mt-4 bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                            <div className="flex justify-between text-xs text-slate-600 mb-1">
                                <span>Precio Lista:</span>
                                <span>{formatMoney(listPrice)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-green-600 mb-1 font-bold">
                                <span>- Descuento:</span>
                                <span>{formatMoney(discount)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-slate-600 mb-2 border-b border-indigo-200 pb-2">
                                <span>- Inicial:</span>
                                <span>{formatMoney(downPayment)}</span>
                            </div>

                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">CUOTA MENSUAL (ESTIMADA)</p>
                                    <p className="text-2xl font-bold text-indigo-700">{formatMoney(monthlyPayment)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-indigo-600">{installments} Cuotas</p>
                                    <p className="text-[10px] text-indigo-400">Desde: {firstDate}</p>
                                </div>
                            </div>

                            {!isValidFinancials && (
                                <div className="mt-2 text-[10px] text-red-500 font-bold flex items-center gap-1">
                                    <X size={10} />
                                    El descuento + inicial no pueden superar el precio total.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">NOTAS INTERNAS</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full p-2 text-sm border border-slate-200 rounded-lg h-20 resize-none outline-none focus:border-indigo-400"
                            placeholder="Comentarios adicionales para administración..."
                        ></textarea>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !isFormValid}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            'Confirmar Cotización'
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
}
