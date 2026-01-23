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
        // Buscamos facturas que ya estén pagadas (o en proceso de pago)
        const domain = [
            ['partner_id', '=', partnerId],
            ['move_type', '=', 'out_invoice'],
            ['state', '=', 'posted'],
            ['payment_state', 'in', ['paid', 'in_payment']]
        ];

        const fields = [
            'name',
            'amount_total',
            'invoice_date',
            'state',
            'payment_state'
        ];

        const paidInvoices = await fetchOdoo('account.move', 'search_read', [domain], { fields });

        // Mapeamos facturas pagadas a la estructura de historial
        return paidInvoices.map((inv: any) => ({
            id: inv.id,
            name: inv.name,
            amount: inv.amount_total,
            date: inv.invoice_date,
            state: inv.payment_state,
            payment_method_id: [0, 'Vía Factura'],
            journal_id: [0, 'Odoo']
        }));
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
