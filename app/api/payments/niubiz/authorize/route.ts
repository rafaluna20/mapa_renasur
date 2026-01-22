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
            const odooPartnerId = (session.user as any).odooPartnerId;

            const paymentId = await fetchOdoo('account.payment', 'create', [{
                payment_type: 'inbound',
                partner_id: odooPartnerId,
                amount: parseFloat(authorization.order.amount) / 100,
                date: new Date().toISOString().split('T')[0],
                ref: paymentReference,
                journal_id: parseInt(process.env.ODOO_NIUBIZ_JOURNAL_ID || '1'),
                payment_method_id: parseInt(process.env.ODOO_CARD_PAYMENT_METHOD_ID || '1'),
                // Metadata Niubiz
                narration: `Niubiz Transaction: ${authorization.order.transactionId}\nCard: ${authorization.dataMap?.CARD}\nBrand: ${authorization.dataMap?.BRAND}`
            }]);

            // Post payment
            await fetchOdoo('account.payment', 'action_post', [paymentId]);

            // Intentar conciliación automática si existe invoiceId
            if (invoiceId) {
                try {
                    // Nota: Odoo usualmente requiere que el pago esté vinculado a las facturas
                    // o usar js_assign_outstanding_line en la factura si el pago ya está posteado.
                    await fetchOdoo(
                        'account.move',
                        'js_assign_outstanding_line',
                        [invoiceId]
                    );
                } catch (reconcileError) {
                    console.error('Auto-reconciliation failed:', reconcileError);
                    // No fallar si la conciliación falla, se puede hacer manual en Odoo
                }
            }

            return Response.json({
                success: true,
                transactionId: authorization.order.transactionId,
                paymentId
            });
        } catch (odooError: any) {
            console.error('Error registering payment in Odoo:', odooError);
            return Response.json({
                success: true, // El pago en Niubiz fue exitoso, pero falló el registro en Odoo
                warning: 'Pago procesado pero error al registrar en el sistema contable.',
                transactionId: authorization.order.transactionId
            });
        }
    } catch (error: any) {
        console.error('Error authorizing Niubiz transaction:', error);
        return Response.json({
            success: false,
            error: error.message || 'Error al procesar la autorización'
        }, { status: 500 });
    }
}
