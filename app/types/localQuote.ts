/**
 * Local Quote Type Definitions
 * Represents quotations stored in browser LocalStorage before Odoo confirmation
 */

export interface LocalQuoteTerms {
    originalPrice: number;
    discountPercent: number;
    discountAmount: number;
    discountedPrice: number;
    initialPayment: number;
    // Desglose de la cuota inicial cuando el cliente la paga en varios
    // pagos (2, 3... N) en vez de uno solo. initialPayment sigue siendo el
    // TOTAL (suma de este arreglo) — nada del cálculo financiero ni el
    // envío a Odoo depende de este desglose, es solo para reconstruir el
    // detalle mostrado en el PDF/página si se necesita más adelante.
    initialPaymentBreakdown?: { amount: number; date: string }[];
    numInstallments: number;
    monthlyInstallment: number;
    remainingBalance: number;
    startDate: string;
    scheduleType?: 'end_of_month' | 'fixed_day';
}

export interface LocalQuoteClient {
    name: string;
    vat?: string;
    phone?: string;
    email?: string;
    // Segundo cliente (cónyuge/conviviente) cuando el lote se compra a
    // nombre de los dos. Solo informativo — no crea un res.partner en
    // Odoo, no es el titular del sale.order (eso lo sigue siendo el
    // cliente principal de arriba); solo aparece en pantalla y en el PDF.
    secondClientName?: string;
    secondClientVat?: string;
}

export interface LocalQuote {
    id: string; // UUID for local identification
    lotId: string;
    lotName: string;
    lotDefaultCode: string;
    clientData: LocalQuoteClient | null;
    terms: LocalQuoteTerms;
    createdAt: string; // ISO date string
    updatedAt: string; // ISO date string
    status: 'draft_local' | 'confirmed_odoo';
    odooOrderId?: number; // Only set after confirmation
    odooPartnerId?: number; // Only set after confirmation
    vendorName: string;
}
