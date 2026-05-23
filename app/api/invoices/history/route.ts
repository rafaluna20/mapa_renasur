import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { paymentService } from '@/app/services/paymentService';

/**
 * GET /api/invoices/history
 * Obtener historial de pagos del cliente autenticado
 */
export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return new Response('No autenticado', { status: 401 });
    }

    const odooPartnerId = (session.user as unknown as { odooPartnerId: number }).odooPartnerId;

    try {
        console.log(`[HISTORY_API] Fetching history for partner: ${odooPartnerId}`);
        const history = await paymentService.getPaymentHistory(odooPartnerId);
        console.log(`[HISTORY_API] Found ${history.length} payments`);

        // Ordenar por fecha (más recientes primero)
        const sorted = history.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateB.getTime() - dateA.getTime();
        });

        console.log(`[HISTORY_API] Data sample:`, sorted.length > 0 ? JSON.stringify(sorted[0], null, 2) : 'No data');

        return Response.json({
            success: true,
            count: sorted.length,
            payments: sorted
        });
    } catch (error: unknown) {
        console.error('Error fetching payment history:', error);
        return Response.json({
            success: false,
            error: error instanceof Error ? error.message : 'Error al obtener historial'
        }, { status: 500 });
    }
}
