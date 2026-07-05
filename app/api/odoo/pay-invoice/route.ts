import { NextResponse } from 'next/server';
import { callContractApi } from '@/app/services/odooModuleApi';
import { requireStaffSession } from '@/app/lib/staffAuth';

interface PayInvoiceResult {
    status: 'success' | 'error';
    message?: string;
    payment_id?: number;
    payment_name?: string;
    invoice_state?: string;
    amount_paid?: number;
    amount_residual?: number;
    retry_after?: number;
}

/**
 * POST /api/odoo/pay-invoice
 *
 * Registra un pago manual (transferencia/efectivo) vía el endpoint asegurado
 * del módulo Odoo (/api/simple_contract/pay_invoice: API key, rate limit,
 * chequeo IDOR de que la factura pertenece a un contrato y a una compañía
 * accesible), en vez de crear account.payment.register directo con la
 * cuenta admin.
 */
export async function POST(request: Request) {
    const auth = await requireStaffSession(request);
    if (auth.response) return auth.response;

    try {
        const { invoiceId, amount, paymentDate, ref, journalId, partnerId } = await request.json();

        if (!invoiceId) {
            return NextResponse.json({ success: false, error: 'Missing invoiceId' }, { status: 400 });
        }

        const result = await callContractApi<PayInvoiceResult>('/api/simple_contract/pay_invoice', {
            invoice_id: invoiceId,
            amount: amount ?? undefined,
            journal_id: journalId ?? undefined,
            payment_date: paymentDate ?? undefined,
            ref: ref ?? undefined,
            partner_id: partnerId ?? undefined,
        });

        return NextResponse.json({ success: true, ...result });
    } catch (error: unknown) {
        console.error('❌ Pay Invoice Error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Internal Server Error' },
            { status: 500 }
        );
    }
}
