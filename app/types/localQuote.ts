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
    numInstallments: number;
    monthlyInstallment: number;
    remainingBalance: number;
    startDate: string;
}

export interface LocalQuoteClient {
    name: string;
    vat?: string;
    phone?: string;
    email?: string;
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
