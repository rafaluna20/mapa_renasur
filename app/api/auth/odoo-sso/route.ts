import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { STAFF_COOKIE_NAME, signStaffSessionToken, getStaffCookieOptions } from '@/app/lib/staffAuth';

/**
 * SSO desde Odoo (mapa_renasur_connector, controllers/sso.py): si el
 * usuario ya está logueado en Odoo y entra por el menú "Mapa Renasur", este
 * endpoint valida un token firmado (HMAC-SHA256, secreto compartido
 * ODOO_SSO_SECRET) y le crea la sesión de staff automáticamente, sin
 * pedirle credenciales de nuevo.
 *
 * El token es de un solo uso funcional (vida corta, TOKEN_TTL en el
 * controller de Odoo) — no reemplaza la cookie de sesión real, solo sirve
 * para el "handoff" inicial.
 */

interface SsoPayload {
    uid: number;
    name: string;
    company_id: number;
    is_system: boolean;
    exp: number;
}

function base64UrlDecode(input: string): string {
    let b64 = input.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    return Buffer.from(b64, 'base64').toString('utf-8');
}

function loginRedirect(request: NextRequest, reason: string): NextResponse {
    console.warn(`[odoo-sso] Token rechazado: ${reason}`);
    return NextResponse.redirect(new URL('/login', request.url));
}

export async function GET(request: NextRequest) {
    const token = request.nextUrl.searchParams.get('token');
    const secret = process.env.ODOO_SSO_SECRET;

    if (!secret) {
        console.error('[odoo-sso] ODOO_SSO_SECRET no configurado.');
        return loginRedirect(request, 'ODOO_SSO_SECRET no configurado');
    }
    if (!token) {
        return loginRedirect(request, 'sin token');
    }

    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) {
        return loginRedirect(request, 'formato de token inválido');
    }

    const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('hex');
    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSig, 'hex');
    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
        return loginRedirect(request, 'firma inválida');
    }

    let payload: SsoPayload;
    try {
        payload = JSON.parse(base64UrlDecode(payloadB64));
    } catch {
        return loginRedirect(request, 'payload no es JSON válido');
    }

    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
        return loginRedirect(request, 'token expirado');
    }
    if (typeof payload.uid !== 'number') {
        return loginRedirect(request, 'payload sin uid numérico');
    }

    const sessionToken = await signStaffSessionToken({
        odooUid: payload.uid,
        name: payload.name,
        companyId: payload.company_id,
        isSystem: payload.is_system,
    });

    if (!sessionToken) {
        console.error('[odoo-sso] NEXTAUTH_SECRET no configurado: no se pudo emitir cookie de staff.');
        return loginRedirect(request, 'no se pudo firmar la sesión');
    }

    // Mismo shape que devuelve /api/auth/login (lo que espera AuthContext vía
    // localStorage). username/session_id/partner_id quedan vacíos porque el
    // SSO no pasa por /web/session/authenticate — no se usan en la UI.
    const user = {
        uid: payload.uid,
        name: payload.name,
        username: '',
        session_id: '',
        partner_id: 0,
        company_id: payload.company_id,
        is_system: payload.is_system,
    };

    // Página HTML mínima en vez de un redirect JSON: hace falta ejecutar JS
    // en el navegador para escribir localStorage (AuthContext lee de ahí,
    // no solo de la cookie httpOnly) antes de entrar a la app.
    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /><title>Ingresando…</title></head>
<body>
<script>
  try {
    localStorage.setItem('odoo_user', ${JSON.stringify(JSON.stringify(user))});
  } catch (e) {}
  window.location.replace('/');
</script>
</body>
</html>`;

    const response = new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
    response.cookies.set(STAFF_COOKIE_NAME, sessionToken, getStaffCookieOptions());
    return response;
}
