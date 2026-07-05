import { NextRequest, NextResponse } from 'next/server';
import { requireStaffSession } from '@/app/lib/staffAuth';

const DNIRUC_BASE_URL = 'https://dniruc.apisperu.com/api/v1';
const UPSTREAM_TIMEOUT_MS = 8000;

/**
 * GET /api/dni-lookup?doc=48320582
 * Proxy server-side hacia apisperu.com: el token nunca debe llegar al cliente
 * (quedaría expuesto en el bundle/red si se llamara directo desde el navegador).
 * Detecta DNI (8 dígitos) vs RUC (11 dígitos) por longitud.
 */
export async function GET(request: NextRequest) {
    const auth = await requireStaffSession(request);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const doc = (searchParams.get('doc') || '').trim();

    const docType = doc.length === 8 ? 'dni' : doc.length === 11 ? 'ruc' : null;
    if (!docType || !/^\d+$/.test(doc)) {
        return NextResponse.json(
            { success: false, error: 'Documento inválido: DNI debe tener 8 dígitos o RUC 11 dígitos' },
            { status: 400 }
        );
    }

    const token = process.env.DNIRUC_API_TOKEN;
    if (!token) {
        console.error('[dni-lookup] Falta la variable de entorno DNIRUC_API_TOKEN');
        return NextResponse.json(
            { success: false, error: 'Servicio de consulta no configurado' },
            { status: 500 }
        );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    try {
        const upstream = await fetch(`${DNIRUC_BASE_URL}/${docType}/${doc}?token=${token}`, {
            signal: controller.signal,
        });

        if (upstream.status === 401) {
            console.error('[dni-lookup] Token DNIRUC_API_TOKEN rechazado por apisperu.com (inválido o expirado)');
            return NextResponse.json(
                { success: false, error: 'Servicio de consulta no disponible temporalmente' },
                { status: 502 }
            );
        }
        if (upstream.status === 429) {
            return NextResponse.json(
                { success: false, error: 'Se alcanzó el límite de consultas del servicio. Completa los datos manualmente.' },
                { status: 429 }
            );
        }
        if (upstream.status === 404) {
            return NextResponse.json(
                { success: false, error: `${docType.toUpperCase()} no encontrado` },
                { status: 404 }
            );
        }
        if (!upstream.ok) {
            console.error(`[dni-lookup] Respuesta inesperada de apisperu.com: ${upstream.status}`);
            return NextResponse.json(
                { success: false, error: 'No se pudo consultar el documento' },
                { status: 502 }
            );
        }

        const data = await upstream.json();

        const name = docType === 'dni'
            ? [data.nombres, data.apellidoPaterno, data.apellidoMaterno].filter(Boolean).join(' ').trim()
            : String(data.razonSocial || '').trim();

        if (!name) {
            return NextResponse.json(
                { success: false, error: `${docType.toUpperCase()} no encontrado` },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, docType, name });
    } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
            return NextResponse.json(
                { success: false, error: 'El servicio de consulta demoró demasiado, intenta de nuevo' },
                { status: 504 }
            );
        }
        console.error('[dni-lookup] Error consultando apisperu.com:', error);
        return NextResponse.json(
            { success: false, error: 'Error consultando el documento' },
            { status: 500 }
        );
    } finally {
        clearTimeout(timeoutId);
    }
}
