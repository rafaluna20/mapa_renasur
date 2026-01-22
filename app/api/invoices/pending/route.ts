import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { paymentService } from '@/app/services/paymentService';

/**
 * GET /api/invoices/pending
 * Obtener facturas pendientes del cliente autenticado
 */
export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return new Response('No autenticado', { status: 401 });
    }

    const odooPartnerId = (session.user as any).odooPartnerId;

    if (!odooPartnerId) {
        return new Response('Partner ID no encontrado en sesión', { status: 400 });
    }

    try {
        const pendingInvoices = await paymentService.getPendingInvoices(odooPartnerId);

        // Ordenar por fecha de vencimiento (próximas primero)
        const sorted = pendingInvoices.sort((a, b) => {
            const dateA = new Date(a.invoice_date_due);
            const dateB = new Date(b.invoice_date_due);
            return dateA.getTime() - dateB.getTime();
        });

        return Response.json({
            success: true,
            count: sorted.length,
            invoices: sorted
        });
    } catch (error: any) {
        console.error('Error fetching pending invoices:', error);
        return Response.json({
            success: false,
            error: error.message || 'Error al obtener facturas'
        }, { status: 500 });
    }
}
