import { getServerSession } from 'next-auth';
<parameter name="authOptions" > from '@/app/api/auth/[...nextauth]/route';
import { niubizService } from '@/app/services/niubizService';
import { paymentService } from '@/app/services/paymentService';

/**
 * POST /api/payments/niubiz/create-session
 * Crear sesión de pago en Niubiz
 */
export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return new Response('No autenticado', { status: 401 });
    }

    try {
        const { invoice_id } = await request.json();

        if (!invoice_id) {
            return Response.json({
                success: false,
                error: 'invoice_id requerido'
            }, { status: 400 });
        }

        // Obtener factura de Odoo
        const invoice = await paymentService.getInvoiceById(invoice_id);

        if (!invoice) {
            return Response.json({
                success: false,
                error: 'Factura no encontrada'
            }, { status: 404 });
        }

        // Verificar que la factura pertenece al cliente autenticado
        const odooPartnerId = (session.user as any).odooPartnerId;
        if (invoice.partner_id[0] !== odooPartnerId) {
            return Response.json({
                success: false,
                error: 'No autorizado para pagar esta factura'
            }, { status: 403 });
        }

        // Crear sesión en Niubiz
        const sessionKey = await niubizService.createSessionToken(
            invoice.amount_residual,
            invoice.payment_reference
        );

        return Response.json({
            success: true,
            sessionKey,
            merchantId: process.env.NIUBIZ_MERCHANT_ID!,
            amount: invoice.amount_residual,
            paymentReference: invoice.payment_reference,
            invoice: {
                id: invoice.id,
                name: invoice.name,
                due_date: invoice.invoice_date_due
            }
        });
    } catch (error: any) {
        console.error('Error creating Niubiz session:', error);
        return Response.json({
            success: false,
            error: error.message || 'Error al crear sesión de pago'
        }, { status: 500 });
    }
}
