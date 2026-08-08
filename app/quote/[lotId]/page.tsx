'use client';

import { use, useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Calculator, Calendar, Tag, Table, Loader2, User, Search, Check, Plus, X, Save, Send, CheckCircle, Map } from 'lucide-react';
import { lotsData, Lot } from '@/app/data/lotsData';
import { financeService, QuoteCalculations } from '@/app/services/financeService';
import Header from '@/app/components/UI/Header';
import { exportQuoteToPdf } from '@/app/utils/quotePdfExporter';
import geometriesJson from '@/app/data/geometries.json';
import { useAuth } from '@/app/context/AuthContext';
import { odooService } from '@/app/services/odooService';
import { localQuoteService } from '@/app/services/localQuoteService';
import { LocalQuote } from '@/app/types/localQuote';
import { useDniRucLookup } from '@/app/hooks/useDniRucLookup';
import { STAFF_SESSION_EXPIRED_EVENT } from '@/app/lib/apiFetch';
import { ACCENT_CARDS, ACCENT_CARD_BASE } from '@/app/lib/designTokens';

interface QuotePageProps {
    params: Promise<{ lotId: string }>;
}

// Cliente encontrado vía búsqueda en Odoo (res.partner). El backend
// (app/api/odoo/search_partners/route.ts) ya trae email/phone/mobile/vat/
// street — antes se descartaban acá, dejando el PDF de cotización sin
// datos de contacto del cliente.
interface ClientSearchResult {
    id: number;
    name: string;
    email?: string;
    phone?: string;
    mobile?: string;
    vat?: string;
    street?: string;
}

// Pago adicional de la cuota inicial (2do, 3er, ... N pago). El primer
// pago sigue viviendo en los estados initialPayment/initialPaymentDate ya
// existentes, sin tocar su comportamiento — esto es solo lo que se suma
// encima cuando el cliente divide la inicial en varios pagos.
interface ExtraInitialPayment {
    id: string;
    amount: string;
    dateIso: string;
    dateDisplay: string;
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
                    const geometry = (geometriesJson as unknown as Record<string, { coordinates: [number, number][], measurements: { area: number } }>)[code];

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
                            ? {
                                area: geometry.measurements.area,
                                sides: [],
                                perimeter: 0,
                                centroid: [0, 0] as [number, number],
                            }
                            : undefined,
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
    const [discountPercent, setDiscountPercent] = useState<number | string>(0);
    const [discountAmount, setDiscountAmount] = useState<number | string>(0);
    const [initialPayment, setInitialPayment] = useState<number | string>(0);
    const [numInstallments, setNumInstallments] = useState<number | string>(72);
    
    // 🆕 Fechas separadas para cuota inicial y primera cuota (ISO interno)
    const [initialPaymentDate, setInitialPaymentDate] = useState<string>(
        new Date().toISOString().split('T')[0]
    );
    const [firstInstallmentDate, setFirstInstallmentDate] = useState<string>(() => {
        const today = new Date();
        const lastDay = financeService.getLastDayOfMonth(
            today.getFullYear(),
            today.getMonth() + 1
        );
        return lastDay.toISOString().split('T')[0];
    });

    // 🗓️ Display states en formato dd/mm/yy
    const isoToDisplay = (iso: string) => {
        if (!iso) return '';
        const [y, m, d] = iso.split('-');
        return `${d}/${m}/${y.slice(2)}`;
    };
    const [initialPaymentDateDisplay, setInitialPaymentDateDisplay] = useState<string>(
        () => isoToDisplay(new Date().toISOString().split('T')[0])
    );
    const [firstInstallmentDateDisplay, setFirstInstallmentDateDisplay] = useState<string>(() => {
        const today = new Date();
        const lastDay = financeService.getLastDayOfMonth(today.getFullYear(), today.getMonth() + 1);
        return isoToDisplay(lastDay.toISOString().split('T')[0]);
    });

    // Formatea mientras el usuario tipea y parsea a ISO cuando está completo
    const handleDateDisplayChange = (
        raw: string,
        setDisplay: (v: string) => void,
        setIso: (v: string) => void
    ) => {
        // Permitir solo dígitos y /
        let digits = raw.replace(/[^\d]/g, '');
        if (digits.length > 6) digits = digits.slice(0, 6);
        // Auto-insertar barras
        let formatted = digits;
        if (digits.length > 2) formatted = digits.slice(0, 2) + '/' + digits.slice(2);
        if (digits.length > 4) formatted = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4);
        setDisplay(formatted);
        // Parsear a ISO cuando esté completo (dd/mm/yy)
        if (digits.length === 6) {
            const dd = digits.slice(0, 2);
            const mm = digits.slice(2, 4);
            const yy = digits.slice(4, 6);
            const fullYear = `20${yy}`;
            const iso = `${fullYear}-${mm}-${dd}`;
            const date = new Date(`${fullYear}-${mm}-${dd}`);
            if (!isNaN(date.getTime())) setIso(iso);
        }
    };
    
    // 🆕 Cuota inicial en varios pagos: el 1er pago sigue en
    // initialPayment/initialPaymentDate de arriba, sin cambios de
    // comportamiento; esto es lo que el usuario suma con "+ Agregar pago"
    // cuando el cliente paga la inicial en 2, 3... N partes.
    const [extraInitialPayments, setExtraInitialPayments] = useState<ExtraInitialPayment[]>([]);

    const addExtraInitialPayment = () => {
        setExtraInitialPayments(prev => [
            ...prev,
            { id: `extra-${Date.now()}-${prev.length}`, amount: '', dateIso: '', dateDisplay: '' }
        ]);
    };
    const removeExtraInitialPayment = (id: string) => {
        setExtraInitialPayments(prev => prev.filter(p => p.id !== id));
    };
    const updateExtraInitialPaymentAmount = (id: string, valStr: string) => {
        setExtraInitialPayments(prev => prev.map(p => (p.id === id ? { ...p, amount: valStr } : p)));
    };
    const setExtraInitialPaymentDisplay = (id: string, v: string) => {
        setExtraInitialPayments(prev => prev.map(p => (p.id === id ? { ...p, dateDisplay: v } : p)));
    };
    const setExtraInitialPaymentIso = (id: string, v: string) => {
        setExtraInitialPayments(prev => prev.map(p => (p.id === id ? { ...p, dateIso: v } : p)));
    };

    // Total real de la cuota inicial (1er pago + todos los adicionales) —
    // esto es lo único que le importa al cálculo financiero, a Odoo y al
    // saldo a financiar; el desglose en varios pagos es solo para mostrar
    // en la página y en el PDF cómo se cobrará ese total.
    const initialPaymentTotal = useMemo(() => {
        const base = Number(initialPayment) || 0;
        const extra = extraInitialPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        return base + extra;
    }, [initialPayment, extraInitialPayments]);

    // Desglose para el PDF (cronograma de pagos): solo se arma cuando hay
    // pagos adicionales — con 1 solo pago (el caso de siempre) el PDF sigue
    // mostrando la única fila "PAGO INICIAL" de antes, sin cambios.
    const initialPaymentBreakdownForPdf = useMemo(() => {
        if (extraInitialPayments.length === 0) return undefined;
        const rows = [
            { amount: Number(initialPayment) || 0, date: financeService.parseLocalDate(initialPaymentDate) },
            ...extraInitialPayments
                .filter(p => p.dateIso)
                .map(p => ({ amount: Number(p.amount) || 0, date: financeService.parseLocalDate(p.dateIso) })),
        ];
        return rows;
    }, [initialPayment, initialPaymentDate, extraInitialPayments]);

    // 🆕 Tipo de Cronograma
    const [scheduleType, setScheduleType] = useState<'end_of_month' | 'fixed_day'>('end_of_month');

    // Mantener startDate para compatibilidad (usar initialPaymentDate)
    const [startDate] = useState<string>(new Date().toISOString().split('T')[0]);

    // Cliente (Búsqueda de Odoo)
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<ClientSearchResult[]>([]);
    const [selectedClient, setSelectedClient] = useState<ClientSearchResult | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [showCreateClient, setShowCreateClient] = useState(false);
    const [isCreatingClient, setIsCreatingClient] = useState(false);
    const [newClientData, setNewClientData] = useState({ name: '', vat: '', phone: '', email: '' });

    // Segundo cliente (cónyuge/conviviente): solo nombre + DNI/RUC, solo
    // informativo para pantalla y PDF — no crea un res.partner en Odoo ni
    // reemplaza al titular del sale.order, ver comentario en LocalQuoteClient.
    const [showSecondClient, setShowSecondClient] = useState(false);
    const [secondClientName, setSecondClientName] = useState('');
    const [secondClientVat, setSecondClientVat] = useState('');

    // Autocompletar nombre por DNI/RUC (RENIEC/SUNAT) al crear cliente nuevo
    const { lookup: lookupDoc, result: docLookup, isLoading: isLookingUpDoc, error: docLookupError, reset: resetDocLookup } = useDniRucLookup();
    useEffect(() => {
        if (!docLookup) return;
        setNewClientData(prev => ({ ...prev, name: docLookup.name }));
    }, [docLookup]);

    // Misma consulta RENIEC/SUNAT, instancia independiente para el cónyuge/
    // conviviente (useDniRucLookup guarda su estado por llamada, así que no
    // pisa el resultado de la búsqueda del cliente principal).
    const { lookup: lookupDoc2, result: docLookup2, isLoading: isLookingUpDoc2, error: docLookupError2, reset: resetDocLookup2 } = useDniRucLookup();
    useEffect(() => {
        if (!docLookup2) return;
        setSecondClientName(docLookup2.name);
    }, [docLookup2]);

    // Preservar trabajo en curso si la sesión de staff expira a mitad de la
    // cotización (ver AuthContext: al recibir staff-session-expired, guarda
    // esto y redirige a login; al reloguearse, vuelve a esta misma página).
    const QUOTE_DRAFT_KEY = `quote_draft_${lotId}`;

    useEffect(() => {
        const saved = sessionStorage.getItem(QUOTE_DRAFT_KEY);
        if (!saved) return;
        try {
            const draft = JSON.parse(saved);
            if (draft.discountPercent !== undefined) setDiscountPercent(draft.discountPercent);
            if (draft.discountAmount !== undefined) setDiscountAmount(draft.discountAmount);
            if (draft.initialPayment !== undefined) setInitialPayment(draft.initialPayment);
            if (draft.extraInitialPayments) setExtraInitialPayments(draft.extraInitialPayments);
            if (draft.numInstallments !== undefined) setNumInstallments(draft.numInstallments);
            if (draft.scheduleType) setScheduleType(draft.scheduleType);
            if (draft.selectedClient) setSelectedClient(draft.selectedClient);
            if (draft.showCreateClient) setShowCreateClient(draft.showCreateClient);
            if (draft.newClientData) setNewClientData(draft.newClientData);
            if (draft.showSecondClient) setShowSecondClient(draft.showSecondClient);
            if (draft.secondClientName) setSecondClientName(draft.secondClientName);
            if (draft.secondClientVat) setSecondClientVat(draft.secondClientVat);
        } catch {
            // Borrador corrupto, se ignora
        } finally {
            sessionStorage.removeItem(QUOTE_DRAFT_KEY);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const handleSessionExpired = () => {
            sessionStorage.setItem(QUOTE_DRAFT_KEY, JSON.stringify({
                discountPercent, discountAmount, initialPayment, extraInitialPayments, numInstallments,
                scheduleType, selectedClient, showCreateClient, newClientData,
                showSecondClient, secondClientName, secondClientVat,
            }));
        };
        window.addEventListener(STAFF_SESSION_EXPIRED_EVENT, handleSessionExpired);
        return () => window.removeEventListener(STAFF_SESSION_EXPIRED_EVENT, handleSessionExpired);
    }, [QUOTE_DRAFT_KEY, discountPercent, discountAmount, initialPayment, extraInitialPayments, numInstallments, scheduleType, selectedClient, showCreateClient, newClientData, showSecondClient, secondClientName, secondClientVat]);

    // Local Quote State
    const [currentQuoteId, setCurrentQuoteId] = useState<string | null>(null);
    const [isSavingQuote, setIsSavingQuote] = useState(false);
    const [isConfirmingQuote, setIsConfirmingQuote] = useState(false);
    const [quoteConfirmed, setQuoteConfirmed] = useState(false);
    
    // 🛡️ Estado para validación de fechas
    const [dateValidationError, setDateValidationError] = useState<string | null>(null);

    // Debounced client search
    useEffect(() => {
        if (!searchTerm || selectedClient) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const raw = await odooService.searchPartners(searchTerm);
                setSearchResults(raw.map(r => ({
                    id: Number(r.id),
                    name: String(r.name ?? ''),
                    email: r.email ? String(r.email) : undefined,
                    phone: r.phone ? String(r.phone) : undefined,
                    mobile: r.mobile ? String(r.mobile) : undefined,
                    vat: r.vat ? String(r.vat) : undefined,
                    street: r.street ? String(r.street) : undefined,
                })));
            } catch (error) {
                console.error('Error searching partners:', error);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchTerm, selectedClient]);

    const selectClient = (client: ClientSearchResult) => {
        setSelectedClient(client);
        setSearchTerm(client.name);
        setSearchResults([]);
    };

    // Datos combinados de cliente(s) para el PDF y para el guardado local —
    // centralizado acá para no repetir la misma forma en handleSaveQuote y
    // handleConfirmQuote. El segundo cliente solo se incluye si se activó
    // el bloque y se cargó al menos nombre o DNI.
    const clientPdfDetails = useMemo(() => {
        if (!selectedClient) return undefined;
        const hasSecondClient = showSecondClient && (secondClientName.trim() || secondClientVat.trim());
        return {
            name: selectedClient.name,
            phone: selectedClient.phone || selectedClient.mobile,
            email: selectedClient.email,
            vat: selectedClient.vat,
            address: selectedClient.street,
            ...(hasSecondClient ? {
                secondClientName: secondClientName.trim(),
                secondClientVat: secondClientVat.trim(),
            } : {}),
        };
    }, [selectedClient, showSecondClient, secondClientName, secondClientVat]);

    const handleCreateClient = async () => {
        const { name, vat, phone, email } = newClientData;
        const trimmedName = name.trim();
        if (!trimmedName || !vat) return;

        // Validación estricta DNI/RUC (8 o 11 dígitos)
        if (!/^(?:\d{8}|\d{11})$/.test(vat)) {
            alert('El DNI debe tener 8 dígitos o el RUC 11 dígitos numéricos.');
            return;
        }

        // Validación básica de Email
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            alert('El formato del correo electrónico es inválido.');
            return;
        }

        setIsCreatingClient(true);
        try {
            const newClient = await odooService.createPartner({
                name: trimmedName,
                vat,
                phone,
                email
            });

            selectClient(newClient);
            setShowCreateClient(false);
            setNewClientData({ name: '', vat: '', phone: '', email: '' });
        } catch (error) {
            console.error('Error creating client:', error);
            const message = error instanceof Error ? error.message : '';
            // Sesión vencida: apiFetch ya disparó el cierre de sesión y la
            // redirección a /login con su propio mensaje amigable (ver
            // AuthContext). Un alert() aquí sería redundante y, al ser
            // bloqueante, podría interponerse con esa redirección.
            if (!message.includes('No autenticado')) {
                alert(message || 'Error al crear el cliente. Intente nuevamente.');
            }
        } finally {
            setIsCreatingClient(false);
        }
    };

    // Prevent negative sign keydown
    const preventNegative = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === '-' || e.key === 'e') {
            e.preventDefault();
        }
    };

    // Sincronizar entradas de descuento - porcentaje con 6 decimales
    // 🔒 LÍMITE: Máximo 40% de descuento
    const handleDiscountPercentChange = (valStr: string) => {
        if (valStr === '') {
            setDiscountPercent('');
            setDiscountAmount('');
            return;
        }
        const val = parseFloat(valStr) || 0;
        // Limitar a máximo 40%
        const cappedVal = Math.min(val, 40);
        // Redondear a 6 decimales para máxima precisión en el porcentaje
        const roundedPercent = Math.round(cappedVal * 1000000) / 1000000;
        setDiscountPercent(roundedPercent);
        if (lot) {
            // Calcular monto con 4 decimales (suficiente para soles)
            const amount = Math.round(lot.list_price * (roundedPercent / 100) * 10000) / 10000;
            setDiscountAmount(amount);
        }
    };

    const handleDiscountAmountChange = (valStr: string) => {
        if (valStr === '') {
            setDiscountAmount('');
            setDiscountPercent('');
            return;
        }
        const val = parseFloat(valStr) || 0;
        // Redondear a 4 decimales para montos (suficiente para soles)
        const roundedAmount = Math.round(val * 10000) / 10000;
        setDiscountAmount(roundedAmount);
        if (lot && lot.list_price > 0) {
            // Calcular porcentaje con 6 decimales de precisión
            const percent = (roundedAmount / lot.list_price) * 100;
            const cappedPercent = Math.min(percent, 40);
            setDiscountPercent(Math.round(cappedPercent * 1000000) / 1000000);
            
            // Re-calcular monto basado en el cap
            if (percent > 40) {
                const maxAmount = Math.round(lot.list_price * (40 / 100) * 10000) / 10000;
                setDiscountAmount(maxAmount);
            }
        }
    };

    const handleInitialPaymentChange = (valStr: string) => {
        if (valStr === '') {
            setInitialPayment('');
            return;
        }
        const val = parseFloat(valStr) || 0;
        // La inicial no puede ser mayor al precio descontado
        const currentDiscountAmount = Number(discountAmount) || 0;
        const discountedPrice = lot ? lot.list_price - currentDiscountAmount : 0;
        const cappedVal = Math.min(val, discountedPrice);
        setInitialPayment(cappedVal);
    };

    const handleNumInstallmentsChange = (valStr: string) => {
        if (valStr === '') {
            setNumInstallments('');
            return;
        }
        const val = parseInt(valStr) || 0;
        const cappedVal = Math.min(Math.max(val, 1), 180); // clamp 1-180
        setNumInstallments(cappedVal);
    };



    // Save Quote Locally & Export PDF
    const handleSaveQuote = async (includeSchedule: boolean = true) => {
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
                    ...(clientPdfDetails?.secondClientName || clientPdfDetails?.secondClientVat ? {
                        secondClientName: clientPdfDetails.secondClientName,
                        secondClientVat: clientPdfDetails.secondClientVat,
                    } : {}),
                } : null,
                terms: {
                    originalPrice: lot.list_price,
                    discountPercent: Number(discountPercent) || 0,
                    discountAmount: Number(discountAmount) || 0,
                    discountedPrice: calculations.discountedPrice,
                    initialPayment: initialPaymentTotal,
                    initialPaymentBreakdown: extraInitialPayments.length > 0 ? [
                        { amount: Number(initialPayment) || 0, date: initialPaymentDate },
                        ...extraInitialPayments.map(p => ({ amount: Number(p.amount) || 0, date: p.dateIso })),
                    ] : undefined,
                    numInstallments: Number(numInstallments) || 0,
                    monthlyInstallment: calculations.monthlyInstallment,
                    remainingBalance: calculations.remainingBalance,
                    startDate,
                    scheduleType
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
                clientPdfDetails,
                false,
                includeSchedule,
                initialPaymentBreakdownForPdf
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
                clientPdfDetails,
                true, // Request Blob return instead of download
                true, // Incluir cronograma (comportamiento previo, sin flag propio acá)
                initialPaymentBreakdownForPdf
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
                `Cotización para ${lot.name}. Inicial: ${initialPaymentTotal}. Plazo: ${numInstallments} meses.`
                    + (clientPdfDetails?.secondClientName || clientPdfDetails?.secondClientVat
                        ? ` Cónyuge/Conviviente: ${clientPdfDetails.secondClientName || 'N/D'}${clientPdfDetails.secondClientVat ? ` (DNI/RUC: ${clientPdfDetails.secondClientVat})` : ''}.`
                        : ''),
                {
                    installments: Number(numInstallments) || 0,
                    downPayment: initialPaymentTotal,
                    discount: Number(discountAmount) || 0,
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

        } catch (error: unknown) {
            console.error("Confirmation error:", error);
            alert(`Error al confirmar en Odoo: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsConfirmingQuote(false);
        }
    };



    // 3. Cálculos en tiempo real - 🆕 ACTUALIZADO con nuevas fechas y validación
    const calculations: QuoteCalculations | null = useMemo(() => {
        if (!lot) return null;
        
        // 🛡️ Parsear fechas como LOCALES (no UTC) para evitar problemas de zona horaria
        const initialDate = financeService.parseLocalDate(initialPaymentDate);
        const firstDate = financeService.parseLocalDate(firstInstallmentDate);
        
        // Cuando el usuario tipea una fecha en el input type="date", el valor
        // puede ser temporalmente "" hasta que complete todo.
        // Proveemos fechas válidas por defecto para no romper el cálculo ni la UI.
        let validInitialDate = initialDate;
        let validFirstDate = firstDate;

        if (isNaN(initialDate.getTime())) {
            validInitialDate = new Date(); // Fallback a hoy si está vacío/inválido
        }

        // Si la cuota inicial se dividió en varios pagos, la fecha relevante
        // para validar contra la primera cuota mensual es la del ÚLTIMO
        // pago inicial (recién ahí termina de cobrarse la inicial) — no la
        // del primero.
        extraInitialPayments.forEach(p => {
            if (!p.dateIso) return;
            const d = financeService.parseLocalDate(p.dateIso);
            if (!isNaN(d.getTime()) && d > validInitialDate) validInitialDate = d;
        });

        if (isNaN(firstDate.getTime())) {
            // Fallback a fin del mes siguiente si está vacío/inválido
            validFirstDate = financeService.getLastDayOfMonth(
                validInitialDate.getFullYear(),
                validInitialDate.getMonth() + 1
            );
        }
        
        // Validación de orden de fechas
        if (validFirstDate < validInitialDate) {
            setDateValidationError('⚠️ La fecha de la primera cuota no puede ser anterior a la fecha de cuota inicial.');
            validFirstDate = validInitialDate; // Fallback para no romper
        } else {
            setDateValidationError(null);
        }
        
        try {
            return financeService.calculateQuote(
                lot.list_price,
                Number(discountPercent) || 0,
                initialPaymentTotal,
                Number(numInstallments) || 0,
                validInitialDate,    // Usar fechas validadas
                validFirstDate,      // Usar fechas validadas
                scheduleType
            );
        } catch (error) {
            console.error('Error al calcular cotización:', error);
            setDateValidationError('⚠️ Error al calcular la cotización. Por favor revisa los datos ingresados.');
            return null;
        }
    }, [lot, discountPercent, initialPaymentTotal, extraInitialPayments, numInstallments, initialPaymentDate, firstInstallmentDate, scheduleType]);

    // Derived states para validación visual de fechas tipeadas
    const isInitialDateInvalid = initialPaymentDateDisplay.length === 8 && isoToDisplay(initialPaymentDate) !== initialPaymentDateDisplay;
    const isFirstDateInvalid = firstInstallmentDateDisplay.length === 8 && isoToDisplay(firstInstallmentDate) !== firstInstallmentDateDisplay;

    if (loading) {
        return (
            <div className="flex flex-col h-screen items-center justify-center bg-slate-50 font-sans">
                <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
                <p className="text-slate-500 font-medium tracking-tight">Cargando detalles de cotización...</p>
            </div>
        );
    }

    if (!lot) {
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
                            {/* Guardar Cotización Parcial */}
                            <button
                                onClick={() => handleSaveQuote(false)}
                                disabled={isSavingQuote || quoteConfirmed}
                                className={`
                                    px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 text-sm
                                    ${quoteConfirmed
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        : 'bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 shadow-sm'
                                    }
                                `}
                            >
                                {isSavingQuote ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                PARCIAL
                            </button>

                            {/* Guardar / Exportar */}
                            <button
                                onClick={() => handleSaveQuote(true)}
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
                            {calculations && (
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
                                            <span>Descuento ({Number(discountPercent).toFixed(2)}%)</span>
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
                            )}
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
                                                    readOnly={!!selectedClient}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    className={`w-full px-3 py-2 text-sm text-black border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all pr-10 ${selectedClient ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold' : 'border-slate-200'}`}
                                                />
                                                {selectedClient ? (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedClient(null);
                                                            setSearchTerm('');
                                                            setSearchResults([]);
                                                        }}
                                                        className="absolute right-3 top-2.5 text-slate-400 hover:text-red-500 transition-colors"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                ) : isSearching ? (
                                                    <div className="absolute right-3 top-2.5 animate-spin">
                                                        <Search size={16} className="text-slate-400" />
                                                    </div>
                                                ) : (
                                                    <div className="absolute right-3 top-2.5">
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
                                                                className="w-full px-2 py-1.5 text-sm border rounded bg-white text-slate-800 placeholder:text-slate-500"
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
                                                        className="w-full px-2 py-1.5 text-sm border rounded bg-white text-slate-800 placeholder:text-slate-500"
                                                        value={newClientData.name}
                                                        onChange={e => setNewClientData({ ...newClientData, name: e.target.value })}
                                                    />
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="tel"
                                                            placeholder="Teléfono"
                                                            className="w-full px-2 py-1.5 text-sm border rounded bg-white text-slate-800 placeholder:text-slate-500"
                                                            value={newClientData.phone}
                                                            onChange={e => setNewClientData({ ...newClientData, phone: e.target.value })}
                                                        />
                                                        <input
                                                            type="email"
                                                            placeholder="Email"
                                                            className="w-full px-2 py-1.5 text-sm border rounded bg-white text-slate-800 placeholder:text-slate-500"
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

                                    {/* Segundo cliente (cónyuge/conviviente): solo visual/PDF, no crea
                                        un res.partner ni cambia el titular del pedido en Odoo — ver
                                        comentario en clientPdfDetails. Solo tiene sentido una vez que
                                        hay un cliente principal seleccionado. */}
                                    {selectedClient && (
                                        showSecondClient ? (
                                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 animate-in fade-in slide-in-from-top-2">
                                                <div className="flex justify-between items-center mb-3 text-xs font-bold text-slate-500 uppercase">
                                                    <span>Cónyuge / Conviviente</span>
                                                    <button
                                                        onClick={() => {
                                                            setShowSecondClient(false);
                                                            setSecondClientName('');
                                                            setSecondClientVat('');
                                                            resetDocLookup2();
                                                        }}
                                                        className="text-slate-400 hover:text-slate-600"
                                                    >
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
                                                                placeholder="DNI (8) / RUC (11)"
                                                                className="w-full px-2 py-1.5 text-sm border rounded bg-white text-slate-800 placeholder:text-slate-500"
                                                                value={secondClientVat}
                                                                onChange={e => {
                                                                    setSecondClientVat(e.target.value.replace(/\D/g, ''));
                                                                    resetDocLookup2();
                                                                }}
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        lookupDoc2(secondClientVat);
                                                                    }
                                                                }}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => lookupDoc2(secondClientVat)}
                                                                disabled={isLookingUpDoc2}
                                                                className="shrink-0 px-2.5 py-1.5 text-xs font-bold bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition-colors disabled:opacity-50 flex items-center gap-1"
                                                            >
                                                                {isLookingUpDoc2 ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                                                                Buscar
                                                            </button>
                                                        </div>
                                                        {isLookingUpDoc2 && (
                                                            <p className="text-[11px] text-slate-400 mt-0.5">Buscando en RENIEC/SUNAT...</p>
                                                        )}
                                                        {!isLookingUpDoc2 && docLookupError2 && (
                                                            <p className="text-[11px] text-amber-600 mt-0.5">{docLookupError2}. Completa el nombre manualmente.</p>
                                                        )}
                                                        {!isLookingUpDoc2 && docLookup2 && (
                                                            <p className="text-[11px] text-emerald-600 mt-0.5">✓ {docLookup2.name}</p>
                                                        )}
                                                    </div>
                                                    <input
                                                        type="text"
                                                        placeholder="Nombre completo"
                                                        className="w-full px-2 py-1.5 text-sm border rounded bg-white text-slate-800 placeholder:text-slate-500"
                                                        value={secondClientName}
                                                        onChange={e => setSecondClientName(e.target.value)}
                                                    />
                                                </div>
                                                <p className="text-[11px] text-slate-400 mt-2">
                                                    Aparecerá junto al cliente principal en la cotización y el PDF. No requiere ser un cliente registrado en Odoo.
                                                </p>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setShowSecondClient(true)}
                                                className="w-full py-2 border border-dashed border-slate-300 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-400 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Plus size={14} /> Agregar cónyuge / conviviente
                                            </button>
                                        )
                                    )}

                                    {/* Descuento Dual — tarjeta gris, separada de la cuota inicial
                                        (verde) y del financiamiento mensual (azul, más abajo). */}
                                    <div className={`${ACCENT_CARD_BASE} ${ACCENT_CARDS.neutral.border} space-y-3`}>
                                        <label className={`block text-xs font-bold ${ACCENT_CARDS.neutral.text} uppercase tracking-wider`}>Descuento aplicado</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="relative">
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</div>
                                                <input
                                                    type="number"
                                                    step="0.000001"
                                                    min="0"
                                                    max="40"
                                                    value={discountPercent}
                                                    onChange={(e) => handleDiscountPercentChange(e.target.value)}
                                                    onKeyDown={preventNegative}
                                                    className="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800 transition-all text-sm"
                                                    placeholder="% (máx 40%)"
                                                />
                                            </div>
                                            <div className="relative">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">S/</div>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={discountAmount}
                                                    onChange={(e) => handleDiscountAmountChange(e.target.value)}
                                                    onKeyDown={preventNegative}
                                                    className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800 transition-all text-sm"
                                                    placeholder="Monto"
                                                />
                                            </div>
                                        </div>
                                        <input
                                            type="range"
                                            min="0" max="40" step="0.1"
                                            value={discountPercent === '' ? 0 : discountPercent}
                                            onChange={(e) => handleDiscountPercentChange(e.target.value)}
                                            className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                        />
                                    </div>

                                    {/* 🆕 Cuota Inicial: agrupada en una sola tarjeta con acento verde
                                        para diferenciarla claramente del financiamiento mensual
                                        (Plazo / Fecha Primera Cuota, más abajo) — antes estos campos
                                        estaban intercalados y la página no se entendía bien. */}
                                    <div className={`${ACCENT_CARD_BASE} ${ACCENT_CARDS.success.border} space-y-4`}>
                                        <label className={`block text-xs font-bold ${ACCENT_CARDS.success.text} uppercase tracking-wider`}>Cuota Inicial</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-sm font-bold text-slate-700 mb-2">Cuota Inicial (S/)</label>
                                                <div className="relative">
                                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">S/</div>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={initialPayment}
                                                        onChange={(e) => handleInitialPaymentChange(e.target.value)}
                                                        onKeyDown={preventNegative}
                                                        className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800 transition-all"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                                    Fecha Cuota Inicial (Cuota 0)
                                                </label>
                                                <div className="relative">
                                                    <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                    <input
                                                        type="text"
                                                        value={initialPaymentDateDisplay}
                                                        onChange={(e) => handleDateDisplayChange(
                                                            e.target.value,
                                                            setInitialPaymentDateDisplay,
                                                            setInitialPaymentDate
                                                        )}
                                                        placeholder="dd/mm/aa"
                                                        maxLength={8}
                                                        className={`w-full pl-9 pr-10 py-2.5 bg-white border rounded-xl focus:ring-2 transition-all font-medium tracking-widest ${
                                                            isInitialDateInvalid
                                                                ? 'border-red-400 focus:ring-red-500 text-red-600'
                                                                : 'border-slate-200 focus:ring-indigo-500 text-slate-800'
                                                        }`}
                                                    />
                                                    {/* Date picker trigger */}
                                                    <input
                                                        type="date"
                                                        value={initialPaymentDate}
                                                        onChange={(e) => {
                                                            setInitialPaymentDate(e.target.value);
                                                            setInitialPaymentDateDisplay(isoToDisplay(e.target.value));
                                                        }}
                                                        className="absolute right-0 top-0 bottom-0 w-10 opacity-0 cursor-pointer"
                                                    />
                                                    <Calendar size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* 🆕 Pagos adicionales de la cuota inicial: el cliente a veces
                                            paga la inicial en 2, 3... N partes en vez de un solo monto.
                                            El primer pago es la fila de arriba — esto es lo que se suma
                                            encima. */}
                                        {extraInitialPayments.map((payment, idx) => (
                                            <div key={payment.id}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="block text-sm font-bold text-slate-700">
                                                        Cuota Inicial - Pago {idx + 2} (S/)
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeExtraInitialPayment(payment.id)}
                                                        className="text-xs text-red-500 hover:text-red-700 font-bold"
                                                    >
                                                        Quitar
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="relative">
                                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">S/</div>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={payment.amount}
                                                            onChange={(e) => updateExtraInitialPaymentAmount(payment.id, e.target.value)}
                                                            onKeyDown={preventNegative}
                                                            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800 transition-all"
                                                            placeholder="Monto"
                                                        />
                                                    </div>
                                                    <div className="relative">
                                                        <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                        <input
                                                            type="text"
                                                            value={payment.dateDisplay}
                                                            onChange={(e) => handleDateDisplayChange(
                                                                e.target.value,
                                                                (v) => setExtraInitialPaymentDisplay(payment.id, v),
                                                                (v) => setExtraInitialPaymentIso(payment.id, v)
                                                            )}
                                                            placeholder="dd/mm/aa"
                                                            maxLength={8}
                                                            className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium tracking-widest text-slate-800"
                                                        />
                                                        <input
                                                            type="date"
                                                            value={payment.dateIso}
                                                            onChange={(e) => {
                                                                setExtraInitialPaymentIso(payment.id, e.target.value);
                                                                setExtraInitialPaymentDisplay(payment.id, isoToDisplay(e.target.value));
                                                            }}
                                                            className="absolute right-0 top-0 bottom-0 w-10 opacity-0 cursor-pointer"
                                                        />
                                                        <Calendar size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none" />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        <div>
                                            <button
                                                type="button"
                                                onClick={addExtraInitialPayment}
                                                className="w-full py-2 border-2 border-dashed border-emerald-300 rounded-xl text-emerald-700 font-bold text-sm hover:bg-emerald-100 hover:border-emerald-400 transition-colors"
                                            >
                                                + Dividir cuota inicial (agregar otro pago)
                                            </button>
                                            {extraInitialPayments.length > 0 && (
                                                <div className="mt-2 text-sm font-bold text-emerald-800 text-right">
                                                    Total cuota inicial: {financeService.formatCurrency(initialPaymentTotal)}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* 🆕 Financiamiento Mensual: Plazo + Fecha Primera Cuota + Modo
                                        de Cronograma agrupados en una tarjeta con acento azul —
                                        separados de la cuota inicial (verde) y el descuento (gris). */}
                                    <div className={`${ACCENT_CARD_BASE} ${ACCENT_CARDS.info.border} space-y-4`}>
                                        <label className={`block text-xs font-bold ${ACCENT_CARDS.info.text} uppercase tracking-wider`}>Financiamiento Mensual</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {/* Cantidad de Cuotas Libres */}
                                            <div>
                                                <label className="block text-sm font-bold text-slate-700 mb-2">Plazo (Meses)</label>
                                                <div className="relative">
                                                    <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                    <input
                                                        type="number"
                                                        min="1" max="180"
                                                        value={numInstallments}
                                                        onChange={(e) => handleNumInstallmentsChange(e.target.value)}
                                                        onKeyDown={preventNegative}
                                                        className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800 transition-all"
                                                    />
                                                </div>
                                            </div>

                                            {/* 🆕 Fecha Primera Cuota (Cuota 1) */}
                                            <div>
                                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                                    Fecha Primera Cuota (Cuota 1)
                                                </label>
                                                <div className="relative">
                                                    <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                    <input
                                                        type="text"
                                                        value={firstInstallmentDateDisplay}
                                                        onChange={(e) => handleDateDisplayChange(
                                                            e.target.value,
                                                            setFirstInstallmentDateDisplay,
                                                            setFirstInstallmentDate
                                                        )}
                                                        placeholder="dd/mm/aa"
                                                        maxLength={8}
                                                        className={`w-full pl-9 pr-10 py-2.5 bg-white border rounded-xl focus:ring-2 transition-all font-medium tracking-widest ${
                                                            isFirstDateInvalid || dateValidationError
                                                                ? 'border-red-400 focus:ring-red-500 text-red-600'
                                                                : 'border-slate-200 focus:ring-indigo-500 text-slate-800'
                                                        }`}
                                                    />
                                                    {/* Date picker trigger */}
                                                    <input
                                                        type="date"
                                                        value={firstInstallmentDate}
                                                        min={initialPaymentDate}
                                                        onChange={(e) => {
                                                            setFirstInstallmentDate(e.target.value);
                                                            setFirstInstallmentDateDisplay(isoToDisplay(e.target.value));
                                                        }}
                                                        className="absolute right-0 top-0 bottom-0 w-10 opacity-0 cursor-pointer"
                                                    />
                                                    <Calendar size={16} className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${isFirstDateInvalid || dateValidationError ? 'text-red-500' : 'text-indigo-500'}`} />
                                                </div>
                                                {/* Date Validation Error Message */}
                                                {dateValidationError && (
                                                    <p className="text-red-500 text-xs mt-2 font-medium flex items-center gap-1">
                                                        {dateValidationError}
                                                    </p>
                                                )}
                                                {isFirstDateInvalid && !dateValidationError && (
                                                    <p className="text-red-500 text-xs mt-2 font-medium flex items-center gap-1">
                                                        ⚠️ Fecha inválida. Use un formato real.
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* 🆕 Tipo de Cronograma */}
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                                Modo de Cronograma
                                            </label>
                                            <div className="flex gap-4">
                                                <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${scheduleType === 'end_of_month' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-bold' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'}`}>
                                                    <input
                                                        type="radio"
                                                        name="scheduleType"
                                                        value="end_of_month"
                                                        checked={scheduleType === 'end_of_month'}
                                                        onChange={() => setScheduleType('end_of_month')}
                                                        className="hidden"
                                                    />
                                                    Fines de Mes
                                                </label>
                                                <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${scheduleType === 'fixed_day' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-bold' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'}`}>
                                                    <input
                                                        type="radio"
                                                        name="scheduleType"
                                                        value="fixed_day"
                                                        checked={scheduleType === 'fixed_day'}
                                                        onChange={() => setScheduleType('fixed_day')}
                                                        className="hidden"
                                                    />
                                                    Día Fijo ({firstInstallmentDate ? financeService.parseLocalDate(firstInstallmentDate).getDate() : ''})
                                                </label>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1.5">
                                                {scheduleType === 'end_of_month' ? 'Las cuotas se programarán para el último día de cada mes.' : 'Las cuotas mantendrán el mismo día de la primera cuota.'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* 🚨 Alerta de Validación de Fechas */}
                                    {dateValidationError && (
                                        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-lg animate-in fade-in slide-in-from-top-2">
                                            <div className="flex items-start gap-3">
                                                <div className="flex-shrink-0">
                                                    <svg className="h-5 w-5 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="text-sm font-bold text-amber-800">
                                                        Error en las Fechas
                                                    </h3>
                                                    <p className="mt-1 text-sm text-amber-700">
                                                        {dateValidationError}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
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
                                            {calculations && (
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
                                            )}

                                            {/* Cuotas Mensuales */}
                                            {calculations?.installments.map((inst) => (
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
