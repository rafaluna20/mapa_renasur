import { niubizService } from '@/app/services/niubizService';
import { fetchOdoo } from '@/app/services/odooService';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

/**
 * POST /api/payments/niubiz/authorize
 * Autorizar transacción después de que el cliente ingresó tarjeta
 */
export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return new Response('No autenticado', { status: 401 });
    }

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
            const journalId = parseInt(process.env.ODOO_NIUBIZ_JOURNAL_ID || '1');
            const amountPaid = parseFloat(authorization.order.amount) / 100;

            // FIX: account.payment necesita 'payment_method_line_id' (account.payment.method.line),
            // no 'payment_method_id' (account.payment.method) — el mismo bug de tipo incorrecto
            // que ya se había corregido en el módulo Odoo (payment_controller.py) reaparecía aquí,
            // sin corregir, en el flujo de tarjeta.
            const paymentMethodLines = await fetchOdoo('account.payment.method.line', 'search_read', [
                [
                    ['journal_id', '=', journalId],
                    ['payment_type', '=', 'inbound'],
                ]
            ], { fields: ['id'], limit: 1 });

            if (!paymentMethodLines || paymentMethodLines.length === 0) {
                throw new Error(`No se encontró método de pago inbound para el diario ${journalId}`);
            }
            const paymentMethodLineId = paymentMethodLines[0].id;

            // FIX: crear el pago vía el wizard nativo account.payment.register (mismo patrón
            // que createPayment en odooService.ts y que pay_invoice en el módulo Odoo), en vez
            // de crear account.payment a mano + llamar account.move.js_assign_outstanding_line
            // (que espera el ID de una línea de conciliación, no el ID de la factura, y por eso
            // fallaba en silencio dejando la factura marcada como no pagada pese al cobro real
            // con tarjeta — lo que además dispararía mora indebida sobre esa factura).
            const wizardId = await fetchOdoo('account.payment.register', 'create', [{
                amount: amountPaid,
                journal_id: journalId,
                payment_date: new Date().toISOString().split('T')[0],
                payment_method_line_id: paymentMethodLineId,
                communication: `Niubiz ${authorization.order.transactionId} - ${paymentReference}`,
            }], {
                context: {
                    active_model: 'account.move',
                    active_ids: [parseInt(invoiceId)],
                },
            });

            if (!wizardId) {
                throw new Error('No se pudo crear el wizard de registro de pago');
            }

            await fetchOdoo('account.payment.register', 'action_create_payments', [[wizardId]]);

            return Response.json({
                success: true,
                transactionId: authorization.order.transactionId,
            });
        } catch (odooError: unknown) {
            console.error('Error registering payment in Odoo:', odooError);
            return Response.json({
                success: true, // El pago en Niubiz fue exitoso, pero falló el registro en Odoo
                warning: 'Pago procesado pero error al registrar en el sistema contable.',
                transactionId: authorization.order.transactionId
            });
        }
    } catch (error: unknown) {
        console.error('Error authorizing Niubiz transaction:', error);
        return Response.json({
            success: false,
            error: error instanceof Error ? error.message : 'Error al procesar la autorización'
        }, { status: 500 });
    }
}
