import { odooService, fetchOdoo } from './odooService';

/**
 * Estructura de una factura pendiente
 */
export interface PendingInvoice {
    id: number;
    name: string;
    payment_reference: string;
    amount_total: number;
    amount_residual: number;
    invoice_date_due: string;
    payment_state: 'not_paid' | 'in_payment' | 'partial' | 'paid';
    state: string;
    partner_id: [number, string];
    lot_info?: {
        etapa: string;
        manzana: string;
        lote: string;
        quota: string;
    };
}

/**
 * Historial de un pago realizado
 */
export interface PaymentHistory {
    id: number;
    name: string;
    amount: number;
    date: string;
    ref: string;
    state: string;
    payment_method_id: [number, string];
    journal_id: [number, string];
}

/**
 * Servicio para gestión de pagos
 */
export const paymentService = {
    /**
     * Obtener facturas pendientes de un cliente
     */
    async getPendingInvoices(partnerId: number): Promise<PendingInvoice[]> {
        const domain = [
            ['partner_id', '=', partnerId],
            ['move_type', '=', 'out_invoice'],
            ['state', '=', 'posted'],
            ['payment_state', '!=', 'paid']
        ];

        const fields = [
            'name',
            'payment_reference',
            'amount_total',
            'amount_residual',
            'invoice_date_due',
            'payment_state',
            'state',
            'partner_id'
        ];

        const invoices = await fetchOdoo('account.move', 'search_read', [domain], { fields });

        // Parsear información del lote desde la referencia
        return invoices.map((inv: any) => ({
            ...inv,
            lot_info: this.parsePaymentReference(inv.payment_reference)
        }));
    },

    /**
     * Obtener historial de pagos de un cliente
     */
    async getPaymentHistory(partnerId: number): Promise<PaymentHistory[]> {
        const domain = [
            ['partner_id', '=', partnerId],
            ['state', '=', 'posted'],
            ['payment_type', '=', 'inbound']
        ];

        const fields = [
            'name',
            'amount',
            'date',
            'ref',
            'state',
            'payment_method_id',
            'journal_id'
        ];

        return await fetchOdoo('account.payment', 'search_read', [domain], { fields });
    },

    /**
     * Parsear referencia de pago: E01MZQ102P-C005-20260130
     */
    parsePaymentReference(ref: string): PendingInvoice['lot_info'] | undefined {
        if (!ref) return undefined;

        const match = ref.match(/E(\d+)(MZ[A-Z]+)(\d+)([A-Z])?-C(\d+)-(\d{8})/);

        if (match) {
            return {
                etapa: match[1],
                manzana: match[2],
                lote: match[3],
                quota: match[5]
            };
        }

        return undefined;
    },

    /**
     * Obtener una factura específica
     */
    async getInvoiceById(invoiceId: number): Promise<PendingInvoice | null> {
        const fields = [
            'name',
            'payment_reference',
            'amount_total',
            'amount_residual',
            'invoice_date_due',
            'payment_state',
            'state',
            'partner_id'
        ];

        const invoices = await fetchOdoo('account.move', 'read', [[invoiceId]], { fields });
        const invoice = invoices?.[0] || null;

        if (!invoice) return null;

        return {
            ...invoice,
            lot_info: this.parsePaymentReference(invoice.payment_reference)
        };
    }
};
