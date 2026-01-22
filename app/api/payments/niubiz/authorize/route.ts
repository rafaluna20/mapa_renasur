import { niubizService } from '@/app/services/niubizService';
import { odooService } from '@/app/services/odooService';

/**
 * POST /api/payments/niubiz/authorize
 * Autorizar transacción después de que el cliente ingresó tarjeta
 */
export async function POST(request: Request) {
    try {
        const {
            transactionToken,
            amount,
            paymentReference,
            invoiceId
        } = await request.json();

        if (!transactionToken || !amount || !paymentReference || !invoiceId) {
            return Response.json({
                success: false,
                error: 'Parámetros incompletos'
            }, { status: 400 });
        }

        // Autorizar con Niubiz
        const authorization = await niubizService.authorizeTransaction(
            transactionToken,
            amount,
            paymentReference
        );

        // Verificar si fue exitosa (código 000 = aprobado)
        const isApproved = authorization.dataMap?.ACTION_CODE === '000';

        if (!isApproved) {
            return Response.json({
                success: false,
                error: authorization.dataMap?.ACTION_DESCRIPTION || 'Transacción rechazada',
                authorizationCode: authorization.dataMap?.ACTION_CODE
            }, { status: 400 });
        }

        // Registrar pago en Odoo
        try {
            const payment = await odooService.call('account.payment', 'create', [{
                payment_type: 'inbound',
                partner_id: authorization.order.partnerId || 1, // TODO: Obtener del invoice
                amount: parseFloat(authorization.order.amount) / 100,
                date: new Date().toISOString().split('T')[0],
                ref: paymentReference,
                journal_id: parseInt(process.env.ODOO_NIUBIZ_JOURNAL_ID || '1'),
                payment_method_id: parseInt(process.env.ODOO_CARD_PAYMENT_METHOD_ID || '1'),
                // Metadata Niubiz
                narration: `Niubiz Transaction: ${authorization.order.transactionId}\nCard: ${authorization.dataMap?.CARD}\nBrand: ${authorization.dataMap?.BRAND}`
            }]);

            // Post payment
            await odooService.call('account.payment', 'action_post', [payment]);

            // Obtener invoice para conciliar
            const invoices = await odooService.searchRead('account.move', [
                ['id', '=', invoiceId]
            ], ['id', 'line_ids']);

            if (invoices.length > 0) {
                // Intentar conciliación automática
                try {
                    await odooService.call(
                        'account.move',
                        'js_assign_outstanding_line',
                        [invoiceId]
                    );
                } catch (reconcileError) {
                    console.error('Auto-reconciliation failed:', reconcileError);
                    // No fallar si la conciliación falla, se puede hacer manual
                }
            }

            return Response.json({
                success: true,
                transactionId: authorization.order.transactionId,
                paymentId
