/**
 * Medición para los anuncios de Facebook (Pixel de Meta, lado navegador).
 *
 * Apagado por defecto: sin NEXT_PUBLIC_META_PIXEL_ID no se carga nada y trackMeta() no hace nada, así que
 * la página se comporta igual que antes. El ID se valida (solo dígitos) porque se inyecta dentro de un
 * <script>: un valor raro en la variable de entorno nunca debe llegar al HTML.
 *
 * Eventos que usa /venta: PageView (al cargar), ViewContent (abrió un lote), Contact (clic en WhatsApp) y
 * Lead (envió el formulario). Lead además se envía desde el servidor (app/lib/metaCapi.ts) con el mismo
 * eventID para que Meta lo cuente una sola vez.
 */

export function validarPixelId(crudo: string | undefined | null): string {
    const id = String(crudo ?? '').trim();
    return /^\d{5,20}$/.test(id) ? id : '';
}

export const META_PIXEL_ID = validarPixelId(process.env.NEXT_PUBLIC_META_PIXEL_ID);

type Fbq = (...args: unknown[]) => void;
declare global {
    interface Window {
        fbq?: Fbq;
    }
}

/** Id único por evento; el mismo id viaja al servidor para que Meta no cuente dos veces el mismo Lead. */
export function nuevoEventId(): string {
    try {
        return crypto.randomUUID();
    } catch {
        return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
}

/** Nunca lanza: si el Pixel no cargó (sin ID, bloqueador de anuncios) simplemente no pasa nada. */
export function trackMeta(evento: string, datos?: Record<string, unknown>, eventId?: string): void {
    if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
    try {
        window.fbq('track', evento, datos ?? {}, eventId ? { eventID: eventId } : undefined);
    } catch {
        /* medir nunca debe romper la página */
    }
}

function leerCookie(nombre: string): string | undefined {
    if (typeof document === 'undefined') return undefined;
    const m = document.cookie.match(new RegExp(`(?:^|; )${nombre}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : undefined;
}

/** fbp / fbc para la API de conversiones. Si hay fbclid en la URL pero aún no cookie _fbc, se arma como pide Meta. */
export function cookiesMeta(): { fbp?: string; fbc?: string } {
    const fbp = leerCookie('_fbp');
    let fbc = leerCookie('_fbc');
    if (!fbc && typeof window !== 'undefined') {
        const fbclid = new URLSearchParams(window.location.search).get('fbclid');
        if (fbclid && /^[A-Za-z0-9_-]{5,300}$/.test(fbclid)) fbc = `fb.1.${Date.now()}.${fbclid}`;
    }
    return { fbp, fbc };
}
