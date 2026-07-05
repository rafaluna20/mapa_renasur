import { NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';
import { emailService } from '@/app/services/emailService';

/**
 * POST /api/auth/request-code
 * Handles the first step of the login flow: Requesting an SMS code.
 */
export async function POST(request: Request) {
    try {
        const { dni } = await request.json();

        if (!dni) {
            return NextResponse.json({ error: 'DNI requerido' }, { status: 400 });
        }

        // Validar formato DNI (8 dígitos)
        if (!/^\d{8}$/.test(dni)) {
            return NextResponse.json({ error: 'DNI debe tener 8 dígitos' }, { status: 400 });
        }

        // Buscar partner en Odoo
        const partners = await fetchOdoo('res.partner', 'search_read', [
            [['vat', '=', dni]]
        ], {
            fields: ['id', 'name', 'phone', 'email']
        });

        if (partners.length === 0) {
            return NextResponse.json({ error: 'DNI no registrado en el sistema' }, { status: 404 });
        }

        const partner = partners[0];

        if (!partner.email) {
            return NextResponse.json({ error: 'No hay email registrado para este DNI' }, { status: 400 });
        }

        // Enviar código por email
        // No loguear el código real: esto es lo que terminó filtrado en
        // auth-debug.log (commiteado a git con códigos OTP reales en texto
        // plano). El código solo debe viajar por email al usuario.
        await emailService.sendVerificationCode(
            partner.email,
            dni
        );

        // Mask email for display (e.g., ab***@gmail.com)
        const maskedEmail = partner.email.replace(/(.{2}).*(@.*)/, '$1***$2');

        console.log(`[AUTH] Verification code sent to ${maskedEmail} for DNI ${dni}`);

        return NextResponse.json({
            success: true,
            maskedEmail
        });

    } catch (error: unknown) {
        console.error('[AUTH] Request code error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Error interno al enviar código' },
            { status: 500 }
        );
    }
}
