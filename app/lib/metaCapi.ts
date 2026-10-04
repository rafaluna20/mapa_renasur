import { createHash, randomUUID } from 'crypto';

/**
 * API de conversiones de Meta (lado servidor) para el evento Lead de /venta.
 *
 * Por qué: el Pixel del navegador pierde eventos (bloqueadores de anuncios, iOS). Enviar el mismo Lead desde
 * el servidor, con el mismo event_id, deja que Meta lo cuente una sola vez y optimice mejor los anuncios.
 *
 * Apagado por defecto: necesita META_PIXEL_ID (o NEXT_PUBLIC_META_PIXEL_ID) y META_CAPI_TOKEN. Sin ellos
 * enviarEventoMeta() devuelve { enviado:false } y no hace ninguna llamada. NUNCA lanza ni bloquea la
 * creación del lead: si Meta falla, el contacto igual se guarda en Odoo. Nunca se registran el token ni los
 * datos del visitante; los datos personales viajan solo como hash SHA-256 (nombre, teléfono, correo).
 *
 * NO PROBADO contra la API real de Meta (no hay Pixel ni token todavía): al configurarlo, usar
 * META_TEST_EVENT_CODE (de "Probar eventos" en el Administrador de eventos) y revisar que llegue.
 */

const TIMEOUT_MS = 2500;

export function sha256(texto: string): string {
    return createHash('sha256').update(texto).digest('hex');
}

/** Teléfono peruano en el formato que pide Meta antes de hashear: solo dígitos con el código de país (51). */
export function normalizarTelefonoPE(digitos: string): string {
    const d = String(digitos).replace(/\D/g, '');
    if (d.length === 9) return `51${d}`;
    return d;
}

export interface LeadMetaInput {
    eventId?: string;
    pageUrl?: string;
    telefono: string;
    email?: string;
    nombre?: string;
    fbp?: string;
    fbc?: string;
    ip?: string;
    userAgent?: string;
    codigoLote: string;
    valor?: number;
    ahoraMs?: number;
}

export function construirEventoLead(i: LeadMetaInput) {
    const userData: Record<string, unknown> = { ph: [sha256(normalizarTelefonoPE(i.telefono))] };
    if (i.email) userData.em = [sha256(i.email.trim().toLowerCase())];
    const primerNombre = (i.nombre || '').trim().split(/\s+/)[0]?.toLowerCase();
    if (primerNombre) userData.fn = [sha256(primerNombre)];
    if (i.fbp) userData.fbp = i.fbp;
    if (i.fbc) userData.fbc = i.fbc;
    if (i.ip && i.ip !== 'unknown') userData.client_ip_address = i.ip;
    if (i.userAgent) userData.client_user_agent = i.userAgent;

    const custom: Record<string, unknown> = { content_ids: [i.codigoLote], content_type: 'product', currency: 'PEN' };
    if (i.valor && i.valor > 0) custom.value = i.valor;

    return {
        event_name: 'Lead',
        event_time: Math.floor((i.ahoraMs ?? Date.now()) / 1000),
        event_id: i.eventId || randomUUID(),
        action_source: 'website',
        ...(i.pageUrl ? { event_source_url: i.pageUrl } : {}),
        user_data: userData,
        custom_data: custom,
    };
}

export interface ResultadoMeta {
    enviado: boolean;
    motivo?: string;
}

interface OpcionesEnvio {
    env?: Record<string, string | undefined>;
    fetchImpl?: typeof fetch;
}

export async function enviarEventoMeta(
    evento: ReturnType<typeof construirEventoLead>,
    { env = process.env, fetchImpl = fetch }: OpcionesEnvio = {},
): Promise<ResultadoMeta> {
    const pixelId = (env.META_PIXEL_ID || env.NEXT_PUBLIC_META_PIXEL_ID || '').trim();
    const token = (env.META_CAPI_TOKEN || '').trim();
    if (!/^\d{5,20}$/.test(pixelId) || !token) return { enviado: false, motivo: 'sin configurar' };

    const version = /^v\d+\.\d+$/.test(env.META_GRAPH_VERSION || '') ? env.META_GRAPH_VERSION! : 'v21.0';
    // El token va en el CUERPO (campo access_token, forma documentada por Meta), no en la URL: así no queda en
    // registros de acceso ni en historiales.
    const cuerpo: Record<string, unknown> = { data: [evento], access_token: token };
    if (env.META_TEST_EVENT_CODE) cuerpo.test_event_code = env.META_TEST_EVENT_CODE;

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
        const res = await fetchImpl(`https://graph.facebook.com/${version}/${pixelId}/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cuerpo),
            signal: ctl.signal,
        });
        return res.ok ? { enviado: true } : { enviado: false, motivo: `Meta respondió ${res.status}` };
    } catch {
        return { enviado: false, motivo: 'error de red o tiempo agotado' };
    } finally {
        clearTimeout(timer);
    }
}
