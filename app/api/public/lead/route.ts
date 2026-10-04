import { NextRequest, NextResponse } from 'next/server';
import { crearLeadPublico, lotExisteYActivo } from '@/app/services/odooPublicService';
import { construirEventoLead, enviarEventoMeta } from '@/app/lib/metaCapi';

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

// Datos de medición que manda el navegador (Pixel de Meta). Nunca se confía en ellos más que para medir:
// se validan con un patrón estricto y, si no calzan, simplemente se ignoran.
function idMedicion(valor: unknown, patron: RegExp): string | undefined {
    return typeof valor === 'string' && patron.test(valor) ? valor : undefined;
}
const PATRON_EVENT_ID = /^[A-Za-z0-9_-]{8,64}$/;
const PATRON_COOKIE_META = /^[A-Za-z0-9._-]{5,200}$/;

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
            eventId,
            fbp,
            fbc,
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

        // API de conversiones de Meta: mejor esfuerzo. Nunca lanza ni cambia la respuesta: el lead ya está
        // guardado en Odoo, y si Meta falla (o no está configurada) el visitante no se entera.
        await enviarEventoMeta(
            construirEventoLead({
                eventId: idMedicion(eventId, PATRON_EVENT_ID),
                pageUrl: typeof pageUrl === 'string' ? pageUrl.slice(0, 500) : undefined,
                telefono: telefonoDigitos,
                email: typeof email === 'string' && email !== '' ? email : undefined,
                nombre: nombreLimpio,
                fbp: idMedicion(fbp, PATRON_COOKIE_META),
                fbc: idMedicion(fbc, PATRON_COOKIE_META),
                ip,
                userAgent: request.headers.get('user-agent') || undefined,
                codigoLote: lote.default_code || String(lote.id),
                valor: lote.list_price,
            }),
        );

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
