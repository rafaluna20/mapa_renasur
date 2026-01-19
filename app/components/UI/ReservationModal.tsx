import { X, Upload, FileText, AlertCircle, Check, Search, User, Loader2, Plus } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Lot } from '@/app/data/lotsData';
import { odooService } from '@/app/services/odooService';
import { useAuth } from '@/app/context/AuthContext';

interface ReservationModalProps {
    lot: Lot;
    onClose: () => void;
    onSuccess: () => void;
}

export default function ReservationModal({ lot, onClose, onSuccess }: ReservationModalProps) {
    const { user } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [notes, setNotes] = useState('');
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

    // Debounce search
    useEffect(() => {
        // Skip search if we are in create mode or selected
        if (showCreateClient || selectedClient) return;

        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.length > 0) {
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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async () => {
        // Validation: If NOT in cotizacion, we need a client. If in cotizacion, we assume client exists in order.
        if (!file) {
            alert("Por favor suba un comprobante de pago");
            return;
        }

        if (lot.x_statu !== 'cotizacion' && !selectedClient) {
            alert("Por favor seleccione un cliente");
            return;
        }

        setIsSubmitting(true);
        try {
            if (lot.x_statu === 'cotizacion') {
                // Flow for already quoted lots: Find order, attach file, update status
                await odooService.reserveQuotedLot(lot.default_code, file, notes);
            } else {
                // Flow for direct reservation (legacy or admin override): Create Order -> Attach -> Status
                if (!selectedClient) return; // Should be caught above
                await odooService.processReservationLevel2(
                    lot.default_code,
                    selectedClient.id,
                    lot.list_price,
                    file,
                    notes
                );
            }

            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error reserving lot:', error);
            alert(`Error al procesar la reserva: ${error.message || 'Intente nuevamente'}`);
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1100] animate-in fade-in duration-200">
            <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[65vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-blue-600 px-4 py-3 flex justify-between items-center text-white shrink-0">
                    <h2 className="font-bold text-[15px] flex items-center gap-2">
                        <FileText size={18} />
                        Confirmar Reserva
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-3 overflow-y-auto flex-1">
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-[13px] text-blue-800 flex gap-2">
                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                        <p>Para reservar el lote <strong>{lot.name}</strong>, es necesario crear una orden y adjuntar el pago.</p>
                    </div>

                    {/* Client Selection (Level 2) - Only if NOT already quoted */}
                    {lot.x_statu !== 'cotizacion' ? (
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
                                            className="w-full px-2 py-1.5 text-sm border rounded placeholder:text-slate-400"
                                            value={newClientData.name}
                                            onChange={e => setNewClientData({ ...newClientData, name: e.target.value })}
                                        />
                                        <input
                                            type="text"
                                            placeholder="DNI / RUC (Obligatorio)"
                                            className="w-full px-2 py-1.5 text-sm border rounded placeholder:text-slate-300"
                                            value={newClientData.vat}
                                            onChange={e => setNewClientData({ ...newClientData, vat: e.target.value })}
                                        />
                                        <div className="flex gap-2">
                                            <input
                                                type="tel"
                                                placeholder="Teléfono"
                                                className="w-full px-2 py-1.5 text-sm border rounded placeholder:text-slate-300"
                                                value={newClientData.phone}
                                                onChange={e => setNewClientData({ ...newClientData, phone: e.target.value })}
                                            />
                                            <input
                                                type="email"
                                                placeholder="Email"
                                                className="w-full px-2 py-1.5 text-sm border rounded placeholder:text-slate-300"
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
                    ) : (
                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex items-start gap-3">
                            <User className="text-amber-600 shrink-0 mt-0.5" size={16} />
                            <div>
                                <h4 className="text-xs font-bold text-amber-800">Cliente Pre-asignado</h4>
                                <p className="text-[11px] text-amber-600 mt-1 leading-relaxed">
                                    Este lote ya tiene una cotización activa. La reserva se asociará automáticamente a la orden existente.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* File Upload */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                            <span>Evidencia de Pago</span>
                            {file && <span className="text-blue-500">Archivo listo</span>}
                        </div>
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors ${file ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
                                }`}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*,.pdf"
                                onChange={handleFileChange}
                            />
                            {file ? (
                                <>
                                    <div className="bg-blue-100 p-2 rounded-full text-blue-600 mb-2">
                                        <FileText size={24} />
                                    </div>
                                    <p className="text-[13px] font-medium text-blue-700 truncate max-w-full text-center px-4">
                                        {file.name}
                                    </p>
                                    <p className="text-[11px] text-blue-600 mt-1">Clic para cambiar archivo</p>
                                </>
                            ) : (
                                <>
                                    <div className="bg-slate-100 p-3 rounded-full text-slate-400 mb-2">
                                        <Upload size={24} />
                                    </div>
                                    <p className="text-[13px] font-medium text-slate-600">Haz clic para subir imagen o PDF</p>
                                    <p className="text-[11px] text-slate-400 mt-1">Máximo 5MB</p>
                                </>
                            )}
                        </div>
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

                {/* Footer Actions - Pinned */}
                <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-medium rounded-lg text-[13px] hover:bg-white transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !file || !selectedClient}
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
