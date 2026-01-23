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
    voucher_status?: {
        status: 'pending' | 'approved' | 'rejected' | string;
        submitted_at: string;
        amount: number;
    } | null;
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

        if (invoices.length === 0) return [];

        // Obtener comprobantes para estas facturas de forma resiliente
        let vouchers: any[] = [];
        try {
            const invoiceIds = invoices.map((inv: any) => inv.id);
            const voucherDomain = [
                ['res_model', '=', 'account.move'],
                ['res_id', 'in', invoiceIds],
                ['x_voucher_status', '!=', false]
            ];
            const voucherFields = ['res_id', 'x_voucher_status', 'x_voucher_submitted_at', 'x_voucher_amount'];

            vouchers = await fetchOdoo('ir.attachment', 'search_read', [voucherDomain], { fields: voucherFields });
        } catch (e: any) {
            console.warn('[PAYMENT] ⚠️ Los campos personalizados x_voucher_* no existen en Odoo. Usando fallback por descripción.');

            const invoiceIds = invoices.map((inv: any) => inv.id);
            const fallbackDomain = [
                ['res_model', '=', 'account.move'],
                ['res_id', 'in', invoiceIds],
                ['description', 'ilike', 'Comprobante de transferencia%']
            ];

            const fallbackVouchers = await fetchOdoo('ir.attachment', 'search_read', [fallbackDomain], {
                fields: ['res_id', 'description', 'create_date'],
                order: 'create_date desc'
            });

            vouchers = fallbackVouchers.map((v: any) => ({
                res_id: v.res_id[0],
                x_voucher_status: 'pending',
                x_voucher_submitted_at: v.create_date,
                x_voucher_amount: 0
            }));
        }

        // Mapear vouchers a un objeto para búsqueda rápida
        const voucherMap = vouchers.reduce((acc: any, v: any) => {
            const resId = Array.isArray(v.res_id) ? v.res_id[0] : v.res_id;

            // ✅ CORREGIDO: Siempre guardar el más reciente
            const currentDate = new Date(v.x_voucher_submitted_at || 0);
            const existingDate = acc[resId] ? new Date(acc[resId].submitted_at || 0) : new Date(0);

            if (!acc[resId] || currentDate > existingDate) {
                acc[resId] = {
                    status: v.x_voucher_status || 'pending',
                    submitted_at: v.x_voucher_submitted_at,
                    amount: v.x_voucher_amount || 0
                };
            }
            return acc;
        }, {});

        // Parsear información del lote y adjuntar voucher status
        return invoices.map((inv: any) => ({
            ...inv,
            lot_info: this.parsePaymentReference(inv.payment_reference),
            voucher_status: voucherMap[inv.id] || null
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
    },

    /**
     * Obtener el estado del comprobante subido para una factura
     */
    async getVoucherStatus(invoiceId: number): Promise<any | null> {
        try {
            const domain = [
                ['res_model', '=', 'account.move'],
                ['res_id', '=', invoiceId],
                ['x_voucher_status', '!=', false]
            ];

            const fields = [
                'name',
                'x_voucher_status',
                'x_voucher_submitted_at',
                'x_voucher_bank',
                'x_voucher_operation',
                'x_voucher_amount',
                'x_voucher_transfer_date'
            ];

            const attachments = await fetchOdoo('ir.attachment', 'search_read', [domain], {
                fields,
                order: 'create_date desc',
                limit: 1
            });

            return attachments?.[0] || null;
        } catch (e: any) {
            console.warn('[PAYMENT] ⚠️ getVoucherStatus fallback por campos inexistentes');
            const fallbackDomain = [
                ['res_model', '=', 'account.move'],
                ['res_id', '=', invoiceId],
                ['description', 'ilike', 'Comprobante de transferencia%']
            ];
            const attachments = await fetchOdoo('ir.attachment', 'search_read', [fallbackDomain], {
                fields: ['name', 'description', 'create_date'],
                order: 'create_date desc',
                limit: 1
            });

            if (!attachments?.[0]) return null;

            return {
                ...attachments[0],
                x_voucher_status: 'pending',
                x_voucher_submitted_at: attachments[0].create_date
            };
        }
    }
};
