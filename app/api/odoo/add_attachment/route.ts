import { NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const orderId = formData.get('orderId');
        const file = formData.get('file') as File;

        if (!orderId || !file) {
            return NextResponse.json(
                { success: false, error: 'Missing orderId or file' },
                { status: 400 }
            );
        }

        // Validate that file is actually a File object
        if (typeof file === 'string' || !('arrayBuffer' in file)) {
            console.error("❌ Invalid file format received:", file);
            return NextResponse.json(
                { success: false, error: 'Invalid file format. Expected binary file.' },
                { status: 400 }
            );
        }

        // Convert file to base64
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Data = buffer.toString('base64');

        // Create attachment in Odoo
        const attachmentData = {
            name: file.name,
            type: 'binary',
            datas: base64Data,
            res_model: 'sale.order',
            res_id: parseInt(orderId as string),
            description: 'Comprobante de pago - Reserva'
        };

        const attachmentId = await fetchOdoo(
            'ir.attachment',
            'create',
            [attachmentData]
        );

        console.log(`✅ Attachment Created: ${file.name} (ID: ${attachmentId}) for Order ${orderId}`);

        return NextResponse.json({
            success: true,
            attachmentId: attachmentId
        });

    } catch (error: any) {
        console.error("Add Attachment API Error:", error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
