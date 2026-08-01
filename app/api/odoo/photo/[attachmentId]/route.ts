import { NextRequest, NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';

// Sirve el contenido de un ir.attachment de Odoo (fotos de puntos de
// interés en el mapa, ver elemento.urbano.x_fotos) como imagen real —
// nunca se expone al navegador el ID crudo apuntando directo a Odoo, ni
// las credenciales de la cuenta de servicio.
//
// Sin requireStaffSession a propósito: son fotos de marketing (vista de
// parque, calle de acceso), no datos sensibles, y el mapa que las muestra
// ya requiere login (cliente o asesor) para cargar en primer lugar —
// mismo criterio de riesgo que ya usa page.tsx, cuyo fetch inicial de
// lotes tampoco está gateado por sesión a nivel de API.
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ attachmentId: string }> }
) {
    try {
        const { attachmentId } = await params;
        const id = parseInt(attachmentId, 10);
        if (isNaN(id)) {
            return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 });
        }

        const records = await fetchOdoo(
            'ir.attachment',
            'read',
            [[id]],
            { fields: ['datas', 'mimetype'] }
        ) as { datas: string | false; mimetype: string | false }[];

        const attachment = records && records[0];
        if (!attachment || !attachment.datas) {
            return NextResponse.json({ success: false, error: 'Foto no encontrada' }, { status: 404 });
        }

        const buffer = Buffer.from(attachment.datas, 'base64');
        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': attachment.mimetype || 'image/jpeg',
                // Las fotos de un punto no cambian seguido — cachear en el
                // navegador/CDN reduce la carga repetida a Odoo por cada
                // visita al mapa.
                'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
            },
        });
    } catch (error: unknown) {
        console.error('[API Photo] Error:', error);
        return NextResponse.json({ success: false, error: 'Error al obtener la foto' }, { status: 500 });
    }
}
