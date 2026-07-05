import { X, Upload, FileText, AlertCircle, Check, Search, User, Loader2, Plus, DollarSign } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Lot } from '@/app/data/lotsData';
import { odooService } from '@/app/services/odooService';
import { useAuth } from '@/app/context/AuthContext';
import { useDniRucLookup } from '@/app/hooks/useDniRucLookup';

interface ReservationModalProps {
    lot: Lot;
    onClose: () => void;
    onSuccess: () => void;
}

export default function ReservationModal({ lot, onClose, onSuccess }: ReservationModalProps) {
    const { user } = useAuth();
    const [files, setFiles] = useState<File[]>([]);
    const [notes, setNotes] = useState('');
    const [separationAmount, setSeparationAmount] = useState<number | ''>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<{ id: number; name: string }[]>([]);
    const [selectedClient, setSelectedClient] = useState<{ id: number; name: string } | null>(null);
    const [isSearching, setIsSearching] = useState(false);

    // New Client Form State
    const [showCreateClient, setShowCreateClient] = useState(false);
    const [newClientData, setNewClientData] = useState({ name: '', vat: '', phone: '', email: '' });
    const [isCreatingClient, setIsCreatingClient] = useState(false);

    // Autocompletar nombre por DNI/RUC (RENIEC/SUNAT) al crear cliente nuevo
    const { lookup: lookupDoc, result: docLookup, isLoading: isLookingUpDoc, error: docLookupError, reset: resetDocLookup } = useDniRucLookup();
    useEffect(() => {
        if (!docLookup) return;
        setNewClientData(prev => ({ ...prev, name: docLookup.name }));
    }, [docLookup]);

    // Active Quotes State (for lot.x_statu === 'cotizacion')
    const [activeQuotes, setActiveQuotes] = useState<any[]>([]);
    const [selectedQuoteId, setSelectedQuoteId] = useState<number | null>(null);
    const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);

    // Fetch active quotes if lot is in cotizacion
    useEffect(() => {
        if (lot.x_statu === 'cotizacion') {
            const fetchQuotes = async () => {
                setIsLoadingQuotes(true);
                try {
                    // Pass user.uid to filter only THIS vendor's quotes
                    const data = await odooService.getActiveQuotesByLot(lot.default_code, user?.uid);
                    if (data && data.quotes) {
                        setActiveQuotes(data.quotes);
                        if (data.quotes.length === 1) {
                            setSelectedQuoteId(Number(data.quotes[0].orderId) || null);
                        }
                    }
                } catch (e) {
                    console.error("Error fetching quotes:", e);
                } finally {
                    setIsLoadingQuotes(false);
                }
            };
            fetchQuotes();
        }
    }, [lot.default_code, lot.x_statu, user?.uid]);

    // Debounce search
    useEffect(() => {
        // Skip search if we are in create mode or selected
        if (showCreateClient || selectedClient) return;

        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.length > 0) {
                setIsSearching(true);
                try {
                    const results = await odooService.searchPartners(searchTerm);
                    const formatted = results.map((r:any) => ({
                      id: Number(r.id),
                      name: String(r.name),
                    }));
                    setSearchResults(formatted);
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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setFiles(prev => {
                const combined = [...prev, ...newFiles];
                if (combined.length > 3) {
                    alert("Solo puedes subir un máximo de 3 archivos.");
                    return combined.slice(0, 3);
                }
                return combined;
            });
        }
    };

    const removeFile = (indexToRemove: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setFiles(prev => prev.filter((_, index) => index !== indexToRemove));
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = async () => {
        if (files.length === 0) {
            alert("Por favor suba al menos un comprobante de pago");
            return;
        }

        if (lot.x_statu === 'cotizacion' && !selectedQuoteId) {
            alert("Por favor seleccione una cotización activa para asociar la reserva");
            return;
        }

        if (lot.x_statu !== 'cotizacion' && !selectedClient) {
            alert("Por favor seleccione un cliente");
            return;
        }

        setIsSubmitting(true);
        try {
            if (lot.x_statu === 'cotizacion') {
                // Flow for already quoted lots: Confirm the selected specific order
                await odooService.reserveQuotedLot(selectedQuoteId!, files, notes, user?.uid, separationAmount === '' ? 0 : separationAmount);
            } else {
                // Flow for direct reservation (legacy or admin override): Create Order -> Attach -> Status
                if (!selectedClient) return; 
                await odooService.processReservationLevel2(
                    lot.default_code,
                    selectedClient.id,
                    lot.list_price,
                    files,
                    notes,
                    separationAmount === '' ? 0 : separationAmount
                );
            }

            onSuccess();
            onClose();
        } catch (error: unknown) {
            console.error('Error reserving lot:', error);
            alert(`Error al procesar la reserva: ${error instanceof Error ? error.message : 'Intente nuevamente'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

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

            // Auto-select the new client
            selectClient(newClient);
            setShowCreateClient(false);
        } catch (error) {
            console.error(error);
            alert('Error al crear el cliente. Verifique los datos.');
        } finally {
            setIsCreatingClient(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1100] animate-in fade-in duration-200 flex items-center justify-center px-3 pt-10 pb-4">
            <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200" style={{ maxHeight: 'min(85dvh, 590px)' }}>
                {/* Header — never shrinks */}
                <div className="bg-blue-600 px-4 py-3 flex justify-between items-center text-white shrink-0 rounded-t-xl">
                    <h2 className="font-bold text-[15px] flex items-center gap-2">
                        <FileText size={18} />
                        Confirmar Reserva
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Content — scrolls, takes remaining space */}
                <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0 bg-white">
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-[13px] text-blue-800 flex gap-2">
                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                        <p>Para reservar el lote <strong>{lot.name}</strong>, es necesario crear una orden y adjuntar el pago.</p>
                    </div>

                    {/* Client Selection (Level 2) OR Quote Selection */}
                    {lot.x_statu === 'cotizacion' ? (
                        <div className="space-y-2">
                            <label className="block text-[13px] font-bold text-slate-700 flex items-center gap-2">
                                <FileText size={14} className="text-slate-400" />
                                Seleccionar Cotización ({activeQuotes.length})
                            </label>
                            
                            {isLoadingQuotes ? (
                                <div className="p-4 text-center bg-slate-50 border border-slate-200 rounded-lg animate-pulse text-xs text-slate-500">
                                    Cargando cotizaciones...
                                </div>
                            ) : activeQuotes.length === 0 ? (
                                <div className="p-4 text-center bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs">
                                    Error: Lote en cotización pero no se encontraron órdenes activas.
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                    {activeQuotes.map(quote => (
                                        <button
                                            key={quote.orderId}
                                            onClick={() => setSelectedQuoteId(quote.orderId)}
                                            className={`w-full text-left p-3 border rounded-lg transition-all flex items-center gap-3 ${selectedQuoteId === quote.orderId ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-500 shadow-sm' : 'border-slate-200 hover:border-amber-300 hover:bg-slate-50'}`}
                                        >
                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${selectedQuoteId === quote.orderId ? 'border-amber-500' : 'border-slate-300'}`}>
                                                {selectedQuoteId === quote.orderId && <div className="w-2 h-2 rounded-full bg-amber-500" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-800 truncate">{quote.clientName}</p>
                                                <div className="flex justify-between items-center mt-1">
                                                    <p className="text-[10px] text-slate-500 flex items-center gap-1"><User size={10}/> {quote.vendorName}</p>
                                                    <p className="text-[11px] font-bold text-slate-700">{new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(quote.amount)}</p>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div>
                            <label className="block text-[13px] font-bold text-slate-700 mb-1.5 flex items-center gap-2">
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
                                            <p className="text-xs text-slate-500 mb-3 font-medium">No se encontraron resultados para &quot;{searchTerm}&quot;</p>
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
                                        <div>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    maxLength={11}
                                                    placeholder="DNI (8) / RUC (11) - Obligatorio"
                                                    className="w-full px-2 py-1.5 text-sm border rounded bg-white text-slate-800 placeholder:text-slate-300"
                                                    value={newClientData.vat}
                                                    onChange={e => {
                                                        setNewClientData({ ...newClientData, vat: e.target.value.replace(/\D/g, '') });
                                                        resetDocLookup();
                                                    }}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            lookupDoc(newClientData.vat);
                                                        }
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => lookupDoc(newClientData.vat)}
                                                    disabled={isLookingUpDoc}
                                                    className="shrink-0 px-2.5 py-1.5 text-xs font-bold bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition-colors disabled:opacity-50 flex items-center gap-1"
                                                >
                                                    {isLookingUpDoc ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                                                    Buscar
                                                </button>
                                            </div>
                                            {isLookingUpDoc && (
                                                <p className="text-[11px] text-slate-400 mt-0.5">Buscando en RENIEC/SUNAT...</p>
                                            )}
                                            {!isLookingUpDoc && docLookupError && (
                                                <p className="text-[11px] text-amber-600 mt-0.5">{docLookupError}. Completa el nombre manualmente.</p>
                                            )}
                                            {!isLookingUpDoc && docLookup && (
                                                <p className="text-[11px] text-emerald-600 mt-0.5">✓ {docLookup.name}</p>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Nombre Completo (Obligatorio)"
                                            className="w-full px-2 py-1.5 text-sm border rounded bg-white text-slate-800 placeholder:text-slate-400"
                                            value={newClientData.name}
                                            onChange={e => setNewClientData({ ...newClientData, name: e.target.value })}
                                        />
                                        <div className="flex gap-2">
                                            <input
                                                type="tel"
                                                placeholder="Teléfono"
                                                className="w-full px-2 py-1.5 text-sm border rounded bg-white text-slate-800 placeholder:text-slate-300"
                                                value={newClientData.phone}
                                                onChange={e => setNewClientData({ ...newClientData, phone: e.target.value })}
                                            />
                                            <input
                                                type="email"
                                                placeholder="Email"
                                                className="w-full px-2 py-1.5 text-sm border rounded bg-white text-slate-800 placeholder:text-slate-300"
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
                    )}

                    {/* Separation Amount */}
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <DollarSign size={14} className="text-slate-400" />
                            Monto de Separación (S/)
                        </label>
                        <div className="flex gap-2 items-center">
                            {[1000, 2000].map(amt => (
                                <button
                                    key={amt}
                                    type="button"
                                    onClick={() => setSeparationAmount(amt)}
                                    className={`flex-1 py-2 text-xs rounded-lg border font-bold transition-all ${separationAmount === amt ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-slate-50'}`}
                                >
                                    S/ {amt.toLocaleString('es-PE')}
                                </button>
                            ))}
                            <div className="relative flex-1">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">S/</span>
                                <input
                                    type="number"
                                    min={1}
                                    value={separationAmount}
                                    onChange={e => setSeparationAmount(e.target.value ? parseFloat(e.target.value) : '')}
                                    className="w-full pl-6 pr-2 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-bold text-slate-700"
                                    placeholder="Otros"
                                />
                            </div>
                        </div>
                    </div>

                    {/* File Upload */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                            <span>Evidencia de Pago</span>
                            <span className={files.length > 0 ? "text-blue-500" : ""}>{files.length}/3 archivos</span>
                        </div>
                        
                        {files.length > 0 && (
                            <div className="space-y-2 mb-3">
                                {files.map((f, i) => (
                                    <div key={i} className="flex items-center justify-between bg-blue-50 border border-blue-100 p-2 rounded-lg">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <FileText size={16} className="text-blue-600 shrink-0" />
                                            <span className="text-xs font-medium text-blue-800 truncate">{f.name}</span>
                                        </div>
                                        <button 
                                            onClick={(e) => removeFile(i, e)}
                                            className="text-blue-400 hover:text-red-500 hover:bg-white rounded-full p-1 transition-colors shrink-0"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {files.length < 3 && (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-slate-50 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors"
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*,.pdf"
                                    multiple
                                    onChange={handleFileChange}
                                />
                                <div className="bg-slate-100 p-3 rounded-full text-slate-400 mb-2">
                                    <Upload size={24} />
                                </div>
                                <p className="text-[13px] font-medium text-slate-600">Haz clic para añadir archivo</p>
                                <p className="text-[11px] text-slate-400 mt-1">Imágenes o PDF (Máx 5MB)</p>
                            </div>
                        )}
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-[13px] font-bold text-slate-700 mb-1.5">
                            Notas Adicionales
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all h-20 resize-none"
                            placeholder="Detalles sobre el pago, número de operación, etc..."
                        ></textarea>
                    </div>
                </div>

                {/* Footer — never shrinks, always visible */}
                <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex gap-3 shrink-0 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-medium rounded-lg text-[13px] hover:bg-white transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || files.length === 0 || (lot.x_statu === 'cotizacion' && !selectedQuoteId) || (lot.x_statu !== 'cotizacion' && !selectedClient)}
                        className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-[13px]"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            'Confirmar'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
