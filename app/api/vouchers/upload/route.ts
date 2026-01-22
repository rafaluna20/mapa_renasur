import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { put } from '@vercel/blob';
import { odooService } from '@/app/services/odooService';

/**
 * POST /api/vouchers/upload
 * Subir comprobante de transferencia bancaria
 */
export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return new Response('No autenticado', { status: 401 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const invoiceId = formData.get('invoice_id') as string;
        const reportedAmount = formData.get('amount') as string;
        const transferDate = formData.get('transfer_date') as string;
        const bankName = formData.get('bank_name') as string;
        const operationNumber = formData.get('operation_number') as string;

        if (!file || !invoiceId || !reportedAmount) {
            return Response.json({
                success: false,
                error: 'Archivo, invoice_id y amount son requeridos'
            }, { status: 400 });
        }

        // Validar tamaño de archivo (máx 5MB)
        if (file.size > 5 * 1024 * 1024) {
            return Response.json({
                success: false,
                error: 'Archivo no debe exceder 5MB'
            }, { status: 400 });
        }

        // Validar tipo de archivo
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            return Response.json({
                success: false,
                error: 'Solo se permiten imágenes (JPG, PNG) o PDF'
            }, { status: 400 });
        }

        // Subir a Vercel Blob
        const blob = await put(`vouchers/${Date.now()}-${file.name}`, file, {
            access: 'public',
            addRandomSuffix: true
        });

        // Convertir a base64 para Odoo
        const arrayBuffer = await file.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');

        // Crear attachment en Odoo
        const attachmentId = await odooService.call('ir.attachment', 'create', [{
            name: file.name,
            datas: base64,
            res_model: 'account.move',
            res_id: parseInt(invoiceId),
            public: false,
            description: `Comprobante de transferencia - ${bankName} - Op: ${operationNumber}`
        }]);

        const odooPartnerId = (session.user as any).odooPartnerId;

        // Crear tarea de validación en Odoo
        const taskId = await odooService.call('project.task', 'create', [{
            name: `Validar Pago - Factura ${invoiceId}`,
            project_id: parseInt(process.env.ODOO_COBRANZAS_PROJECT_ID || '1'),
            partner_id: odooPartnerId,
            user_ids: [[6, 0, [parseInt(process.env.ODOO_COBRANZAS_USER_ID || '2')]]],
            description: `
## Validación de Comprobante Bancario

**Cliente:** ${session.user.name}
**DNI:** ${(session.user as any).dni}
**Factura ID:** ${invoiceId}

### Datos Reportados
- **Monto:** S/ ${reportedAmount}
- **Fecha Transferencia:** ${transferDate || 'No especificada'}
- **Banco:** ${bankName || 'No especificado'}
- **Nro. Operación:** ${operationNumber || 'No especificado'}

### Archivo Adjunto
Ver adjunto ID: ${attachmentId}
URL Blob: ${blob.url}

### Siguiente Paso
1. Revisar comprobante adjunto
2. Verificar que el monto y la referencia coincidan
3. Registrar pago en Odoo si es correcto
4. Marcar esta tarea como completada
      `.trim(),
            priority: '1',  // High priority
            tag_ids: [[6, 0, []]]  // Puedes agregar tags si los tienes configurados
        }]);

        return Response.json({
            success: true,
            blob_url: blob.url,
            attachment_id: attachmentId,
            task_id: taskId,
            message: 'Comprobante subido exitosamente. Será validado en las próximas 24 horas.'
        });
    } catch (error: any) {
        console.error('Error uploading voucher:', error);
        return Response.json({
            success: false,
            error: error.message || 'Error al subir comprobante'
        }, { status: 500 });
    }
}
