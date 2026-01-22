import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { paymentService } from '@/app/services/paymentService';

/**
 * GET /api/invoices/history
 * Obtener historial de pagos del cliente autenticado
 */
export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return new Response('No autenticado', { status: 401 });
    }

    const odooPartnerId = (session.user as any).odooPartnerId;

    try {
        const history = await paymentService.getPaymentHistory(odooPartnerId);

        // Ordenar por fecha (más recientes primero)
        const sorted = history.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateB.getTime() - dateA.getTime();
        });

        return Response.json({
            success: true,
            count: sorted.length,
            payments: sorted
        });
    } catch (error: any) {
        console.error('Error fetching payment history:', error);
        return Response.json({
            success: false,
            error: error.message || 'Error al obtener historial'
        }, { status: 500 });
    }
}
