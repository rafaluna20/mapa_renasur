import { NextRequest, NextResponse } from 'next/server';
import { crearLeadPublico, lotExisteYActivo } from '@/app/services/odooPublicService';

// Endpoint público (sin login) para la landing de anuncios /venta.
// Sin requireStaffSession A PROPÓSITO: un visitante anónimo que llegó desde
// un anuncio pagado tiene que poder mandar sus datos sin autenticarse. Usa
// su propia credencial mínima de Odoo (ver odooPublicService.ts) — nunca la
// cuenta admin de las demás rutas /api/odoo/*.
//
// SOLO crea crm.lead (equipo RENASUR) para que un humano de staff se
// comunique — nunca reserva, nunca paga, nunca crea un contrato. Esos
// flujos se quedan exactamente donde están (staff-only), sin ningún cambio.

// Mismo patrón de rate limiting best-effort en memoria que ya usa
// app/api/chat/route.ts (por instancia serverless, no persiste entre cold
// starts) — ajustado a un límite más bajo porque un lead es una acción de
// escritura, no una consulta de chat.
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 5;

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
        rateLimitMap.set(ip, { count: 1, windowStart: now });
        return true;
    }
    if (entry.count >= RATE_LIMIT_MAX_REQUESTS) return false;
    entry.count++;
    return true;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
        if (!checkRateLimit(ip)) {
            return NextResponse.json({ success: false, error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' }, { status: 429 });
        }

        const body = await request.json();
        const {
            nombre,
            telefono,
            email,
            lotId,
            utmSource,
            utmMedium,
            utmCampaign,
            referrer,
            pageUrl,
            website, // campo trampa (honeypot): un visitante real nunca lo llena
        } = body || {};

        // Honeypot: si vino relleno, es un bot. Se responde éxito sin crear
        // nada — nunca delatarle al bot que fue detectado.
        if (typeof website === 'string' && website.trim() !== '') {
            return NextResponse.json({ success: true });
        }

        const nombreLimpio = typeof nombre === 'string' ? nombre.trim() : '';
        if (nombreLimpio.length < 2 || nombreLimpio.length > 80) {
            return NextResponse.json({ success: false, error: 'Nombre inválido' }, { status: 400 });
        }

        const telefonoDigitos = typeof telefono === 'string' ? telefono.replace(/\D/g, '') : '';
        if (telefonoDigitos.length < 9) {
            return NextResponse.json({ success: false, error: 'Teléfono inválido' }, { status: 400 });
        }

        if (email !== undefined && email !== '' && (typeof email !== 'string' || !EMAIL_PATTERN.test(email))) {
            return NextResponse.json({ success: false, error: 'Email inválido' }, { status: 400 });
        }

        const lotIdNum = Number(lotId);
        if (!Number.isInteger(lotIdNum) || lotIdNum <= 0) {
            return NextResponse.json({ success: false, error: 'Lote inválido' }, { status: 400 });
        }

        // Nunca se confía en el lotId que manda el navegador tal cual — se
        // revalida contra Odoo antes de crear el lead.
        const lote = await lotExisteYActivo(lotIdNum);
        if (!lote) {
            return NextResponse.json({ success: false, error: 'El lote seleccionado ya no está disponible' }, { status: 400 });
        }

        await crearLeadPublico({
            nombre: nombreLimpio,
            telefono: telefonoDigitos,
            email: typeof email === 'string' && email !== '' ? email : undefined,
            lotId: lote.id,
            lotCode: lote.default_code || String(lote.id),
            lotArea: lote.x_area,
            lotPrice: lote.list_price,
            utmSource: typeof utmSource === 'string' ? utmSource : undefined,
            utmMedium: typeof utmMedium === 'string' ? utmMedium : undefined,
            utmCampaign: typeof utmCampaign === 'string' ? utmCampaign : undefined,
            referrer: typeof referrer === 'string' ? referrer.slice(0, 500) : undefined,
            pageUrl: typeof pageUrl === 'string' ? pageUrl.slice(0, 500) : undefined,
        });

        // Nunca se devuelve el id del lead creado al navegador.
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('[api/public/lead] Error:', error);
        return NextResponse.json(
            { success: false, error: 'No se pudo enviar tu solicitud. Intenta de nuevo o escríbenos por WhatsApp.' },
            { status: 500 }
        );
    }
}
