import { NextResponse } from 'next/server';
import { decode, encode } from 'next-auth/jwt';

/**
 * Sesión de personal interno (vendedores/administradores).
 *
 * No usa el provider de NextAuth (ese queda para clientes vía DNI+código):
 * el login de staff sigue autenticando contra Odoo directamente
 * (/web/session/authenticate) para no cambiar el contrato de AuthContext.
 * Lo único nuevo es que, además de devolver el JSON de siempre, el login
 * ahora también firma una cookie httpOnly con next-auth/jwt (mismo secreto
 * NEXTAUTH_SECRET) para que el servidor pueda verificar quién llama.
 *
 * Antes de esto, ninguna ruta bajo /api/odoo/* (salvo las de cliente) tenía
 * forma de saber si el caller había iniciado sesión: la app llamaba a Odoo
 * con una cuenta admin compartida (ODOO_USER_ID/ODOO_PASSWORD) sin ninguna
 * verificación intermedia.
 */
export const STAFF_COOKIE_NAME = 'terra_staff_session';
export const STAFF_SESSION_MAX_AGE = 8 * 60 * 60; // 8 horas

export interface StaffSessionPayload {
    odooUid: number;
    name: string;
    companyId: number;
    isSystem: boolean;
}

/**
 * Opciones de cookie compartidas entre el login (que la crea) y el
 * middleware de sesión deslizante (que la renueva) — para que ambos
 * emitan exactamente la misma cookie y no diverjan con el tiempo.
 */
export function getStaffCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: '/',
        maxAge: STAFF_SESSION_MAX_AGE,
    };
}

/**
 * Firma un token de sesión de staff nuevo (mismo formato que emite el
 * login). La usa el middleware para renovar el vencimiento en cada
 * request activo, sin tener que re-autenticar contra Odoo.
 */
export async function signStaffSessionToken(payload: StaffSessionPayload): Promise<string | null> {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return null;
    return encode({
        token: {
            odooUid: payload.odooUid,
            name: payload.name,
            companyId: payload.companyId,
            isSystem: payload.isSystem,
        },
        secret,
        maxAge: STAFF_SESSION_MAX_AGE,
    });
}

function readCookie(request: Request, name: string): string | null {
    const header = request.headers.get('cookie');
    if (!header) return null;
    const match = header
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export async function getStaffSession(request: Request): Promise<StaffSessionPayload | null> {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
        console.error('[staffAuth] NEXTAUTH_SECRET no configurado: no se puede validar la sesión de staff.');
        return null;
    }

    const raw = readCookie(request, STAFF_COOKIE_NAME);
    if (!raw) return null;

    try {
        const token = await decode({ token: raw, secret });
        if (!token || typeof token.odooUid !== 'number') return null;
        return {
            odooUid: token.odooUid,
            name: typeof token.name === 'string' ? token.name : '',
            companyId: typeof token.companyId === 'number' ? token.companyId : 0,
            isSystem: Boolean(token.isSystem),
        };
    } catch (error) {
        console.warn('[staffAuth] Cookie de staff inválida o expirada:', error);
        return null;
    }
}

type StaffAuthResult =
    | { session: StaffSessionPayload; response: null }
    | { session: null; response: NextResponse };

/**
 * Guard de una línea para usar al inicio de cada ruta interna:
 *
 *   const auth = await requireStaffSession(request);
 *   if (auth.response) return auth.response;
 */
export async function requireStaffSession(request: Request): Promise<StaffAuthResult> {
    const session = await getStaffSession(request);
    if (!session) {
        return {
            session: null,
            response: NextResponse.json(
                { success: false, error: 'No autenticado. Inicia sesión como vendedor/administrador.' },
                { status: 401 }
            ),
        };
    }
    return { session, response: null };
}
