/**
 * Rutas que NUNCA deben depender de la sesión de staff: un visitante anónimo
 * (cliente que llegó por un anuncio o por el enlace del bot de ventas) tiene
 * que poder verlas aunque ese navegador tenga restos de una sesión de staff
 * vencida. AuthProvider envuelve TODA la app (app/providers.tsx), así que sin
 * esta lista cerraba la sesión y mandaba a /login desde cualquier página.
 *
 * Tiene que coincidir con los prefijos que el service worker (public/sw.js)
 * deja pasar sin interceptar (RUTAS_PUBLICAS_SW): si agregas una ruta aquí,
 * agrégala también allá.
 */
export const RUTAS_PUBLICAS = ['/venta', '/portal'] as const;

export function esRutaPublica(pathname: string | null | undefined): boolean {
    if (!pathname) return false;
    return RUTAS_PUBLICAS.some((base) => pathname === base || pathname.startsWith(base + '/'));
}
