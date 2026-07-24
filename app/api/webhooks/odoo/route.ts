import crypto from 'crypto';
import { paymentService } from '@/app/services/paymentService';
import { emailService } from '@/app/services/emailService';
import { fetchOdoo } from '@/app/services/odooService';

/**
 * Compara 2 secretos en tiempo constante (mismo patrón que
 * app/api/auth/odoo-sso/route.ts) — evitar timing attacks, donde un
 * atacante podría inferir el secreto correcto byte a byte midiendo
 * cuánto tarda cada comparación fallida con `!==` normal.
 */
function timingSafeEqualStrings(a: unknown, b: string): boolean {
    if (typeof a !== 'string') return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

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

        if (!timingSafeEqualStrings(secret, WEBHOOK_SECRET)) {
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

    } catch (error: unknown) {
        console.error('[WEBHOOK] ❌ Error procesando webhook:', error);
        return Response.json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal Server Error'
        }, { status: 500 });
    }
}
