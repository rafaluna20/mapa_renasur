import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { paymentService } from '@/app/services/paymentService';

/**
 * GET /api/vouchers/status
 * Consultar el estado del comprobante de una factura
 */
export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get('invoice_id');

    if (!session?.user) {
        return new Response('No autenticado', { status: 401 });
    }

    if (!invoiceId) {
        return Response.json({
            success: false,
            error: 'ID de factura es requerido'
        }, { status: 400 });
    }

    try {
        const status = await paymentService.getVoucherStatus(parseInt(invoiceId));

        if (!status) {
            return Response.json({
                success: true,
                voucher_submitted: false,
                message: 'No se encontró comprobante para esta factura'
            });
        }

        return Response.json({
            success: true,
            voucher_submitted: true,
            status: status.x_voucher_status || 'pending',
            submitted_at: status.x_voucher_submitted_at || null,
            bank_name: status.x_voucher_bank || 'No especificado',
            operation_number: status.x_voucher_operation || 'No especificado',
            amount: status.x_voucher_amount || 0,
            transfer_date: status.x_voucher_transfer_date || null,
            message: getStatusMessage(status.x_voucher_status || 'pending')
        });
    } catch (error: any) {
        console.error('Error fetching voucher status:', error);
        return Response.json({
            success: false,
            error: error.message || 'Error al obtener estado del comprobante'
        }, { status: 500 });
    }
}

function getStatusMessage(status: string): string {
    switch (status) {
        case 'pending':
            return 'Tu comprobante está en revisión. Te notificaremos por email cuando sea validado.';
        case 'approved':
            return '¡Tu pago ha sido validado exitosamente!';
        case 'rejected':
            return 'Hubo un problema con tu comprobante. Por favor, sube uno nuevo o contacta al administrador.';
        default:
            return 'Estado desconocido';
    }
}
