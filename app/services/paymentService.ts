import { fetchOdoo } from './odooService';

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
        totalQuotas?: number;
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
            'partner_id',
            // Campos estructurados que el módulo ya expone "PARA API/N8N": evitan
            // tener que adivinar el número de cuota parseando el texto de la
            // referencia por regex (frágil ante cualquier cambio de formato).
            'contract_quota_number',
            'contract_total_quotas'
        ];

        const invoices = await fetchOdoo('account.move', 'search_read', [domain], { fields });

        if (invoices.length === 0) return [];

        // Obtener comprobantes para estas facturas de forma resiliente
        let vouchers: Record<string, unknown>[] = [];
        try {
            const invoiceIds = invoices.map((inv: Record<string, unknown>) => inv.id);
            const voucherDomain = [
                ['res_model', '=', 'account.move'],
                ['res_id', 'in', invoiceIds],
                ['x_voucher_status', '!=', false]
            ];
            const voucherFields = ['res_id', 'x_voucher_status', 'x_voucher_submitted_at', 'x_voucher_amount'];

            vouchers = await fetchOdoo('ir.attachment', 'search_read', [voucherDomain], { fields: voucherFields });
        } catch {
            console.warn('[PAYMENT] ⚠️ Los campos personalizados x_voucher_* no existen en Odoo. Usando fallback por descripción.');

            const invoiceIds = invoices.map((inv: Record<string, unknown>) => inv.id);
            const fallbackDomain = [
                ['res_model', '=', 'account.move'],
                ['res_id', 'in', invoiceIds],
                ['description', 'ilike', 'Comprobante de transferencia%']
            ];

            const fallbackVouchers = await fetchOdoo('ir.attachment', 'search_read', [fallbackDomain], {
                fields: ['res_id', 'description', 'create_date'],
                order: 'create_date desc'
            });

            vouchers = fallbackVouchers.map((v: Record<string, unknown>) => ({
                res_id: Array.isArray(v.res_id) ? v.res_id[0] : v.res_id,
                x_voucher_status: 'pending',
                x_voucher_submitted_at: v.create_date,
                x_voucher_amount: 0
            }));
        }

        // Mapear vouchers a un objeto para búsqueda rápida
        const voucherMap = vouchers.reduce((acc: Record<string, { status: string; submitted_at: string; amount: number }>, v: Record<string, unknown>) => {
            const resId = String(Array.isArray(v.res_id) ? v.res_id[0] : v.res_id);

            // ✅ CORREGIDO: Siempre guardar el más reciente
            const submittedAt = typeof v.x_voucher_submitted_at === 'string' ? v.x_voucher_submitted_at : '';
            const currentDate = new Date(submittedAt || 0);
            const existingDate = acc[resId] ? new Date(acc[resId].submitted_at || 0) : new Date(0);

            if (!acc[resId] || currentDate > existingDate) {
                acc[resId] = {
                    status: (v.x_voucher_status as string) || 'pending',
                    submitted_at: submittedAt,
                    amount: (v.x_voucher_amount as number) || 0
                };
            }
            return acc;
        }, {});

        // Parsear información del lote y adjuntar voucher status
        return invoices.map((inv: Record<string, unknown>) => ({
            ...inv,
            lot_info: this.parsePaymentReference(
                (inv.payment_reference as string) || '',
                inv.contract_quota_number as number | undefined,
                inv.contract_total_quotas as number | undefined
            ),
            voucher_status: voucherMap[String(inv.id)] || null
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
        return paidInvoices.map((inv: Record<string, unknown>) => ({
            id: inv.id as number,
            name: inv.name,
            amount: inv.amount_total,
            date: inv.invoice_date,
            state: inv.payment_state,
            payment_method_id: [0, 'Vía Factura'],
            journal_id: [0, 'Odoo']
        }));
    },

    /**
     * Deriva la info de lote/cuota a mostrar en la UI.
     *
     * El número/total de cuota viene de contract_quota_number/contract_total_quotas
     * en account.move (campos estructurados que el módulo Odoo ya calcula al crear
     * la factura) en vez de parsearlo del texto de la referencia por regex: son
     * enteros reales, no dependen del formato exacto de la referencia y no se
     * rompen si ese formato cambia.
     *
     * Etapa/manzana/lote no están expuestos como campos propios en account.move
     * (viven en el product.template del contrato), así que para esos tres sí se
     * sigue parseando la referencia — es el mismo dato con el que Odoo generó
     * esa referencia, y evita una consulta extra por factura solo para mostrar
     * el código del lote.
     */
    parsePaymentReference(
        ref: string,
        quotaNumber?: number,
        totalQuotas?: number
    ): PendingInvoice['lot_info'] | undefined {
        if (!ref) {
            if (quotaNumber === undefined) return undefined;
            return { etapa: '', manzana: '', lote: '', quota: String(quotaNumber), totalQuotas };
        }

        const match = ref.match(/E(\d+)(MZ[A-Z]+)(\d+)([A-Z])?-C(\d+)-(\d{8})/);

        if (!match) return undefined;

        return {
            etapa: match[1],
            manzana: match[2],
            lote: match[3],
            quota: quotaNumber !== undefined ? String(quotaNumber) : match[5],
            totalQuotas
        };
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
            'partner_id',
            'contract_quota_number',
            'contract_total_quotas'
        ];

        const invoices = await fetchOdoo('account.move', 'read', [[invoiceId]], { fields });
        const invoice = invoices?.[0] || null;

        if (!invoice) return null;

        return {
            ...invoice,
            lot_info: this.parsePaymentReference(
                invoice.payment_reference,
                invoice.contract_quota_number,
                invoice.contract_total_quotas
            )
        };
    },

    /**
     * Obtener el estado del comprobante subido para una factura
     */
    async getVoucherStatus(invoiceId: number): Promise<Record<string, unknown> | null> {
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
        } catch {
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
