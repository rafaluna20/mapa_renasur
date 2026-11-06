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
//
// Como la ruta es pública y lee con la cuenta de servicio, SOLO puede servir
// adjuntos que sean fotos de un elemento urbano activo (x_fotos). Sin esa
// comprobación cualquiera podía pedir /api/odoo/photo/<n> con números
// consecutivos y bajar CUALQUIER adjunto de Odoo (contratos, DNI,
// comprobantes). Un adjunto ajeno y uno inexistente responden igual (404) para
// que la ruta no sirva para averiguar qué números existen.

// Solo formatos de foto. SVG queda fuera a propósito: puede traer scripts y se
// serviría desde el dominio de la app.
const MIMETYPES_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const noEncontrada = () => NextResponse.json({ success: false, error: 'Foto no encontrada' }, { status: 404 });

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ attachmentId: string }> }
) {
    try {
        const { attachmentId } = await params;
        // Entero positivo estricto (parseInt aceptaba "12abc" como 12).
        if (!/^[1-9]\d{0,9}$/.test(attachmentId)) {
            return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 });
        }
        const id = Number(attachmentId);

        // args = [dominio] (un solo elemento que ES la lista de condiciones).
        const vinculados = (await fetchOdoo(
            'elemento.urbano',
            'search_count',
            [[['x_fotos', 'in', [id]], ['active', '=', true]]]
        )) as number;
        if (!vinculados) {
            return noEncontrada();
        }

        const records = await fetchOdoo(
            'ir.attachment',
            'read',
            [[id]],
            { fields: ['datas', 'mimetype'] }
        ) as { datas: string | false; mimetype: string | false }[];

        const attachment = records && records[0];
        if (!attachment || !attachment.datas) {
            return noEncontrada();
        }

        const mimetype = attachment.mimetype || 'image/jpeg';
        if (!MIMETYPES_PERMITIDOS.has(mimetype)) {
            return noEncontrada();
        }

        const buffer = Buffer.from(attachment.datas, 'base64');
        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': mimetype,
                'X-Content-Type-Options': 'nosniff',
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
