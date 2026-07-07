/**
 * Wrapper de fetch para las rutas /api/odoo/* protegidas por sesión de staff
 * (ver app/lib/staffAuth.ts). Todas esas rutas devuelven HTTP 401 cuando la
 * cookie terra_staff_session no existe o venció (8h). En vez de que cada una
 * de las ~18 funciones de odooService.ts maneje ese caso por su cuenta (lo
 * que llevaba a mensajes genéricos o silenciados), este wrapper detecta el
 * 401 en un solo lugar y dispara un evento global que AuthContext escucha
 * para cerrar sesión y redirigir al login con un mensaje amigable.
 *
 * Es un reemplazo directo de `fetch`: mismo request/response, mismo
 * response.ok/response.json() en el código que lo llama — no cambia nada
 * más que agregar esta detección.
 */
export const STAFF_SESSION_EXPIRED_EVENT = 'staff-session-expired';

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const response = await fetch(input, init);

    if (response.status === 401 && typeof window !== 'undefined') {
        window.dispatchEvent(new Event(STAFF_SESSION_EXPIRED_EVENT));
    }

    return response;
}
