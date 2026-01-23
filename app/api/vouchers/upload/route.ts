import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { put } from '@vercel/blob';
import { fetchOdoo } from '@/app/services/odooService'; // Import server-side utility

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

        // Subir a Vercel Blob (Opcional)
        let blobUrl = '';
        if (process.env.BLOB_READ_WRITE_TOKEN) {
            try {
                const blob = await put(`vouchers/${Date.now()}-${file.name}`, file, {
                    access: 'public',
                    addRandomSuffix: true
                });
                blobUrl = blob.url;
            } catch (blobError) {
                console.error('Error uploading to Vercel Blob:', blobError);
                // Continuar sin blob si falla
            }
        }

        // Convertir a base64 para Odoo
        const arrayBuffer = await file.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');

        const odooPartnerId = (session.user as any).odooPartnerId;

        // --- SISTEMA DE TRACKING: Solo crear attachment con estado ---
        // NO creamos pagos automáticamente
        // La factura permanece en estado "Publicado" hasta validación manual del administrador
        console.log(`[VOUCHER] ========== CREANDO COMPROBANTE CON TRACKING ==========`);
        console.log(`[VOUCHER] Invoice ID: ${invoiceId}`);
        console.log(`[VOUCHER] Amount: ${reportedAmount}`);
        console.log(`[VOUCHER] Bank: ${bankName}`);
        console.log(`[VOUCHER] Operation: ${operationNumber}`);

        // ✅ VALIDACIÓN: Verificar si ya existe un comprobante pendiente
        try {
            const existingVouchers = await fetchOdoo('ir.attachment', 'search_read', [[
                ['res_model', '=', 'account.move'],
                ['res_id', '=', parseInt(invoiceId)],
                ['description', 'ilike', 'Comprobante de transferencia%']
            ]], {
                fields: ['id', 'x_voucher_status', 'create_date'],
                order: 'create_date desc',
                limit: 1
            });

            if (existingVouchers.length > 0) {
                const existingStatus = existingVouchers[0].x_voucher_status || 'pending';
                if (existingStatus === 'pending') {
                    console.warn(`[VOUCHER] ⚠️ Ya existe un comprobante pendiente para factura ${invoiceId}`);
                    return Response.json({
                        success: false,
                        error: 'Ya existe un comprobante pendiente de validación para esta factura. Por favor espera a que sea procesado.'
                    }, { status: 409 });
                }
            }
        } catch (e) {
            console.warn('[VOUCHER] No se pudo verificar duplicados (campos x_ inexistentes), continuando...');
        }

        // Crear attachment de forma resiliente
        let attachmentId;
        try {
            // Intento 1: Con campos personalizados de tracking
            attachmentId = await fetchOdoo('ir.attachment', 'create', [{
                name: file.name,
                datas: base64,
                res_model: 'account.move',
                res_id: parseInt(invoiceId),
                public: false,
                description: `Comprobante de transferencia - ${bankName} - Op: ${operationNumber}`,
                // CAMPOS PERSONALIZADOS PARA TRACKING (pueden no existir)
                x_voucher_status: 'pending',
                x_voucher_submitted_at: new Date().toISOString().replace('T', ' ').split('.')[0],
                x_voucher_bank: bankName,
                x_voucher_operation: operationNumber,
                x_voucher_amount: parseFloat(reportedAmount),
                x_voucher_transfer_date: transferDate || new Date().toISOString().split('T')[0]
            }]);
        } catch (e: any) {
            console.warn('[VOUCHER] ⚠️ Los campos x_voucher_* no existen. Usando creación estándar.');
            // Intento 2: Solo campos estándar (fallback)
            attachmentId = await fetchOdoo('ir.attachment', 'create', [{
                name: file.name,
                datas: base64,
                res_model: 'account.move',
                res_id: parseInt(invoiceId),
                public: false,
                description: `Comprobante de transferencia - ${bankName} - Op: ${operationNumber}`
            }]);
        }

        console.log(`[VOUCHER] ✅ Attachment created with ID: ${attachmentId}`);
        console.log(`[VOUCHER] ✅ Status: pending (fallback if custom fields missing)`);
        console.log(`[VOUCHER] ℹ️ Invoice ${invoiceId} remains in "Posted" state`);


        // 2. Crear tarea de validación en Odoo (Optional)
        let taskId = null;
        try {
            // Only create task if project ID is configured and exists
            if (process.env.ODOO_COBRANZAS_PROJECT_ID) {
                taskId = await fetchOdoo('project.task', 'create', [{
                    name: `Validar Comprobante - Factura ${invoiceId}`,
                    project_id: parseInt(process.env.ODOO_COBRANZAS_PROJECT_ID),
                    partner_id: odooPartnerId,
                    user_ids: [[6, 0, [parseInt(process.env.ODOO_COBRANZAS_USER_ID || '2')]]],
                    description: `
## Validación de Comprobante Bancario

**Cliente:** ${session.user.name}
**DNI:** ${(session.user as any).dni}
**Factura ID:** ${invoiceId}

### Datos Reportados por el Cliente
- **Monto:** S/ ${reportedAmount}
- **Fecha Transferencia:** ${transferDate || 'No especificada'}
- **Banco:** ${bankName || 'No especificado'}
- **Nro. Operación:** ${operationNumber || 'No especificado'}

### Estado del Comprobante
✅ Comprobante subido - Estado: **PENDIENTE**
📎 Attachment ID: ${attachmentId}
${blobUrl ? `🔗 URL: ${blobUrl}` : '⚠️ URL Blob no disponible'}

### Instrucciones para Validar
1. ✅ Abrir la factura #${invoiceId} en Odoo
2. ✅ Ver el comprobante adjunto (ID: ${attachmentId})
3. ✅ Verificar que el comprobante sea auténtico
4. ✅ Confirmar que el dinero esté en la cuenta bancaria
5. ✅ Registrar el pago manualmente desde Odoo:
   - Ir a la factura → Botón "Registrar Pago"
   - Monto: S/ ${reportedAmount}
   - Diario: Seleccionar banco
   - Ref: Incluir nro de operación ${operationNumber || ''}
6. ✅ La factura cambiará a "Pagado" automáticamente
7. ✅ Marcar esta tarea como completada

> **Nota**: El cliente recibirá notificación automática cuando valides el pago.
      `.trim(),
                    priority: '1',  // High priority
                    tag_ids: [[6, 0, []]]
                }]);
                console.log(`✅ Validation task created: ${taskId}`);
            } else {
                console.warn('⚠️ ODOO_COBRANZAS_PROJECT_ID not configured, skipping task creation');
            }
        } catch (taskError: any) {
            console.error('❌ Failed to create validation task (non-blocking):', taskError.message);
            // Continue without task - the attachment is already uploaded
        }

        return Response.json({
            success: true,
            blob_url: blobUrl,
            attachment_id: attachmentId,
            task_id: taskId,
            voucher_status: 'pending',
            submitted_at: new Date().toISOString(),
            message: '✅ Comprobante subido exitosamente. Tu pago está en revisión y será validado en las próximas 24 horas.'
        });
    } catch (error: any) {
        console.error('Error uploading voucher:', error);
        return Response.json({
            success: false,
            error: error.message || 'Error al subir comprobante'
        }, { status: 500 });
    }
}
