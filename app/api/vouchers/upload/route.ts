import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { put } from '@vercel/blob';
import { fetchOdoo } from '@/app/services/odooService';

// ✅ Simple rate limiting usando Map en memoria (para desarrollo)
// En producción, usar Redis/Upstash
const uploadAttempts = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT = {
    MAX_ATTEMPTS: 3,
    WINDOW_MS: 60 * 60 * 1000 // 1 hora
};

function checkRateLimit(identifier: string): { allowed: boolean; resetIn?: number } {
    const now = Date.now();
    const userAttempts = uploadAttempts.get(identifier);

    if (!userAttempts || now > userAttempts.resetAt) {
        // Nueva ventana o expiró
        uploadAttempts.set(identifier, {
            count: 1,
            resetAt: now + RATE_LIMIT.WINDOW_MS
        });
        return { allowed: true };
    }

    if (userAttempts.count >= RATE_LIMIT.MAX_ATTEMPTS) {
        const resetIn = Math.ceil((userAttempts.resetAt - now) / 60000);
        return { allowed: false, resetIn };
    }

    userAttempts.count++;
    return { allowed: true };
}

/**
 * Valida magic bytes del archivo (server-side validation)
 */
async function validateFileSignature(buffer: Buffer): Promise<{ valid: boolean; type?: string }> {
    const signatures: Record<string, number[][]> = {
        'image/jpeg': [[0xFF, 0xD8, 0xFF]],
        'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
        'application/pdf': [[0x25, 0x50, 0x44, 0x46]] // %PDF
    };

    for (const [type, sigs] of Object.entries(signatures)) {
        for (const sig of sigs) {
            if (sig.every((byte, i) => buffer[i] === byte)) {
                return { valid: true, type };
            }
        }
    }

    return { valid: false };
}

/**
 * Sanitiza nombre de archivo
 */
function sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * POST /api/vouchers/upload
 * Subir comprobante de transferencia bancaria con validaciones robustas
 */
export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return new Response('No autenticado', { status: 401 });
    }

    const userEmail = session.user.email || 'unknown';

    // ✅ RATE LIMITING
    const rateLimitCheck = checkRateLimit(userEmail);
    if (!rateLimitCheck.allowed) {
        console.warn(`[VOUCHER] ⚠️ Rate limit exceeded for ${userEmail}`);
        return Response.json({
            success: false,
            error: `Has alcanzado el límite de intentos. Intenta nuevamente en ${rateLimitCheck.resetIn} minutos.`
        }, { status: 429 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const invoiceId = formData.get('invoice_id') as string;
        const reportedAmount = formData.get('amount') as string;
        const transferDate = formData.get('transfer_date') as string;
        const bankName = formData.get('bank_name') as string;
        const operationNumber = formData.get('operation_number') as string;

        // Validaciones básicas
        if (!file || !invoiceId || !reportedAmount) {
            return Response.json({
                success: false,
                error: 'Archivo, invoice_id y amount son requeridos'
            }, { status: 400 });
        }

        // ✅ Validar tamaño de archivo (máx 5MB)
        if (file.size > 5 * 1024 * 1024) {
            return Response.json({
                success: false,
                error: 'El archivo no debe exceder 5MB'
            }, { status: 400 });
        }

        // ✅ Convertir a buffer y validar magic bytes
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        const signatureValidation = await validateFileSignature(buffer);
        if (!signatureValidation.valid) {
            console.warn(`[VOUCHER] ⚠️ Invalid file signature from ${userEmail}`);
            return Response.json({
                success: false,
                error: 'Tipo de archivo no permitido. Solo se aceptan JPG, PNG o PDF auténticos.'
            }, { status: 400 });
        }

        console.log(`[VOUCHER] ✅ File signature validated: ${signatureValidation.type}`);

        // ✅ Validar que el monto reportado coincida con la factura
        try {
            const invoice = await fetchOdoo('account.move', 'read', [[parseInt(invoiceId)]], {
                fields: ['amount_residual']
            });

            if (invoice && invoice[0]) {
                const invoiceAmount = invoice[0].amount_residual;
                const reportedAmountNum = parseFloat(reportedAmount);
                const tolerance = 0.01;

                if (Math.abs(invoiceAmount - reportedAmountNum) > tolerance) {
                    console.warn(`[VOUCHER] ⚠️ Amount mismatch: reported ${reportedAmountNum}, expected ${invoiceAmount}`);
                    return Response.json({
                        success: false,
                        error: `El monto reportado (S/ ${reportedAmountNum.toFixed(2)}) no coincide con el monto de la factura (S/ ${invoiceAmount.toFixed(2)})`
                    }, { status: 400 });
                }
            }
        } catch (e) {
            console.warn('[VOUCHER] ⚠️ Could not validate amount against invoice');
        }

        const odooPartnerId = (session.user as any).odooPartnerId;

        // ✅ VALIDACIÓN ROBUSTA: Verificar duplicados con fallback
        let existingVouchers: any[] = [];
        try {
            // Intento 1: Buscar por campos custom
            existingVouchers = await fetchOdoo('ir.attachment', 'search_read', [[
                ['res_model', '=', 'account.move'],
                ['res_id', '=', parseInt(invoiceId)],
                ['x_voucher_status', '=', 'pending']
            ]], {
                fields: ['id', 'create_date'],
                limit: 1
            });
        } catch (e) {
            // Intento 2: Fallback con búsqueda por descripción reciente
            console.warn('[VOUCHER] Using fallback duplicate detection');
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            
            existingVouchers = await fetchOdoo('ir.attachment', 'search_read', [[
                ['res_model', '=', 'account.move'],
                ['res_id', '=', parseInt(invoiceId)],
                ['description', 'ilike', 'Comprobante de transferencia%'],
                ['create_date', '>=', sevenDaysAgo.toISOString().split('T')[0]]
            ]], {
                fields: ['id', 'create_date'],
                limit: 1
            });
        }

        if (existingVouchers.length > 0) {
            console.warn(`[VOUCHER] ⚠️ Duplicate voucher attempt for invoice ${invoiceId} by ${userEmail}`);
            return Response.json({
                success: false,
                error: 'Ya existe un comprobante pendiente de validación para esta factura. Por favor espera a que sea procesado.'
            }, { status: 409 });
        }

        // Sanitizar nombre de archivo
        const sanitizedFileName = sanitizeFileName(file.name);

        // Subir a Vercel Blob (Opcional)
        let blobUrl = '';
        if (process.env.BLOB_READ_WRITE_TOKEN) {
            try {
                const blob = await put(`vouchers/${Date.now()}-${sanitizedFileName}`, buffer, {
                    access: 'public',
                    addRandomSuffix: true
                });
                blobUrl = blob.url;
                console.log(`[VOUCHER] ✅ Uploaded to blob: ${blobUrl}`);
            } catch (blobError) {
                console.error('[VOUCHER] ❌ Error uploading to Vercel Blob:', blobError);
                // Continuar sin blob si falla
            }
        }

        // Convertir a base64 para Odoo
        const base64 = buffer.toString('base64');

        console.log(`[VOUCHER] ========== CREATING VOUCHER ==========`);
        console.log(`[VOUCHER] User: ${userEmail}`);
        console.log(`[VOUCHER] Invoice ID: ${invoiceId}`);
        console.log(`[VOUCHER] Amount: ${reportedAmount}`);
        console.log(`[VOUCHER] Bank: ${bankName}`);
        console.log(`[VOUCHER] Operation: ${operationNumber}`);
        console.log(`[VOUCHER] File: ${sanitizedFileName} (${signatureValidation.type})`);

        // Crear attachment de forma resiliente
        let attachmentId;
        try {
            // Intento 1: Con campos personalizados de tracking
            attachmentId = await fetchOdoo('ir.attachment', 'create', [{
                name: sanitizedFileName,
                datas: base64,
                res_model: 'account.move',
                res_id: parseInt(invoiceId),
                public: false,
                description: `Comprobante de transferencia - ${bankName} - Op: ${operationNumber} - Usuario: ${userEmail}`,
                // CAMPOS PERSONALIZADOS PARA TRACKING
                x_voucher_status: 'pending',
                x_voucher_submitted_at: new Date().toISOString().replace('T', ' ').split('.')[0],
                x_voucher_bank: bankName,
                x_voucher_operation: operationNumber,
                x_voucher_amount: parseFloat(reportedAmount),
                x_voucher_transfer_date: transferDate || new Date().toISOString().split('T')[0]
            }]);
            console.log(`[VOUCHER] ✅ Attachment created with custom fields: ${attachmentId}`);
        } catch (e: any) {
            console.warn('[VOUCHER] ⚠️ Custom fields not available, using standard creation');
            // Intento 2: Solo campos estándar (fallback)
            attachmentId = await fetchOdoo('ir.attachment', 'create', [{
                name: sanitizedFileName,
                datas: base64,
                res_model: 'account.move',
                res_id: parseInt(invoiceId),
                public: false,
                description: `Comprobante de transferencia - ${bankName} - Op: ${operationNumber} - Usuario: ${userEmail}`
            }]);
            console.log(`[VOUCHER] ✅ Attachment created (standard): ${attachmentId}`);
        }

        // Crear tarea de validación en Odoo (Optional)
        let taskId = null;
        try {
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
**Email:** ${userEmail}
**Factura ID:** ${invoiceId}

### Datos Reportados por el Cliente
- **Monto:** S/ ${reportedAmount}
- **Fecha Transferencia:** ${transferDate || 'No especificada'}
- **Banco Origen:** ${bankName || 'No especificado'}
- **Nro. Operación:** ${operationNumber || 'No especificado'}

### Estado del Comprobante
✅ Comprobante subido - Estado: **PENDIENTE**
📎 Attachment ID: ${attachmentId}
🔒 Archivo validado: ${signatureValidation.type}
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
                    priority: '1',
                    tag_ids: [[6, 0, []]]
                }]);
                console.log(`[VOUCHER] ✅ Validation task created: ${taskId}`);
            }
        } catch (taskError: any) {
            console.error('[VOUCHER] ❌ Failed to create validation task (non-blocking):', taskError.message);
        }

        console.log(`[VOUCHER] ========== SUCCESS ==========`);

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
        console.error('[VOUCHER] ❌ Error uploading voucher:', error);
        return Response.json({
            success: false,
            error: error.message || 'Error al subir comprobante'
        }, { status: 500 });
    }
}
