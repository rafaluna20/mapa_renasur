import { NextRequest, NextResponse } from 'next/server';
import { getStaffSession, signStaffSessionToken, getStaffCookieOptions, STAFF_COOKIE_NAME } from '@/app/lib/staffAuth';

/**
 * Sesión deslizante para el staff (vendedores/administradores).
 *
 * La cookie terra_staff_session dura 8h desde que se firma (ver
 * app/lib/staffAuth.ts). Sin esto, un vendedor activo todo el día
 * igual se quedaba sin sesión a mitad de una cotización porque el
 * vencimiento se contaba desde el login, no desde la última actividad
 * (ver [[mapa-renasur-staff-session-relogin]] y el interceptor de
 * app/lib/apiFetch.ts que maneja el caso cuando sí expira).
 *
 * Cada vez que llega una request autenticada a una ruta protegida, si
 * la cookie sigue siendo válida, se vuelve a firmar con un vencimiento
 * de 8h contado desde AHORA — el corte de 8h solo afecta a quien
 * realmente dejó de usar la app, no a alguien en medio de una venta.
 */
export async function proxy(request: NextRequest) {
    const response = NextResponse.next();

    const session = await getStaffSession(request);
    if (session) {
        const refreshedToken = await signStaffSessionToken(session);
        if (refreshedToken) {
            response.cookies.set(STAFF_COOKIE_NAME, refreshedToken, getStaffCookieOptions());
        }
    }

    return response;
}

export const config = {
    matcher: ['/api/odoo/:path*', '/api/planos/:path*'],
};
