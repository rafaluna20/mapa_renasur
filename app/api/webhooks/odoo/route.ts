import { paymentService } from '@/app/services/paymentService';
import { emailService } from '@/app/services/emailService';
import { fetchOdoo } from '@/app/services/odooService';

/**
 * Webhook para recibir eventos desde Odoo
 * POST /api/webhooks/odoo
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { invoice_id, event, secret } = body;

        // ✅ SEGURIDAD: Validación de secreto obligatoria
        const WEBHOOK_SECRET = process.env.ODOO_WEBHOOK_SECRET;
        if (!WEBHOOK_SECRET) {
            console.error('[WEBHOOK] ❌ ODOO_WEBHOOK_SECRET no configurado en .env');
            return Response.json({
                success: false,
                message: 'Webhook not configured'
            }, { status: 503 });
        }

        if (secret !== WEBHOOK_SECRET) {
            console.warn('[WEBHOOK] ⚠️ Intento de acceso no autorizado');
            return new Response('Unauthorized', { status: 401 });
        }

        if (!invoice_id || event !== 'payment_validated') {
            return Response.json({ success: false, message: 'Invalid payload' }, { status: 400 });
        }

        console.log(`[WEBHOOK] 🔔 Recibida validación para factura ID: ${invoice_id}`);

        // 1. Obtener detalles de la factura
        const invoice = await paymentService.getInvoiceById(parseInt(invoice_id));
        if (!invoice) {
            return Response.json({ success: false, message: 'Invoice not found' }, { status: 404 });
        }

        // 2. Obtener detalles del partner (email)
        const partner = await fetchOdoo('res.partner', 'read', [[invoice.partner_id[0]]], {
            fields: ['name', 'email']
        });

        if (!partner?.[0]?.email) {
            console.warn(`[WEBHOOK] ⚠️ Partner ${invoice.partner_id[1]} no tiene email configurado.`);
            return Response.json({ success: false, message: 'Partner email not found' }, { status: 200 });
        }

        // 3. Buscar próximo vencimiento (opcional)
        let nextDueDate = undefined;
        try {
            const pendingInvoices = await paymentService.getPendingInvoices(invoice.partner_id[0]);
            const nextInvoice = pendingInvoices.find(inv => inv.id !== parseInt(invoice_id));
            if (nextInvoice) {
                nextDueDate = new Date(nextInvoice.invoice_date_due).toLocaleDateString('es-PE', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                });
            }
        } catch (e) {
            console.error('[WEBHOOK] Error buscando próximo vencimiento:', e);
        }

        // 4. Enviar Email
        await emailService.sendPaymentValidationEmail({
            email: partner[0].email,
            userName: partner[0].name,
            amount: invoice.amount_total,
            invoiceName: invoice.name,
            paymentReference: invoice.payment_reference,
            nextDueDate
        });

        return Response.json({
            success: true,
            message: `Email de confirmación enviado a ${partner[0].email}`
        });

    } catch (error: any) {
        console.error('[WEBHOOK] ❌ Error procesando webhook:', error);
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
