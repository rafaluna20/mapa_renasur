import { NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';
import { requireStaffSession } from '@/app/lib/staffAuth';
import { isModelAllowed } from '@/app/lib/odooAllowlist';

/**
 * POST /api/odoo/call
 * Generic method call endpoint for Odoo models
 *
 * Antes esta ruta reenviaba { model, method, args } tal cual a Odoo con la
 * cuenta de servicio, sin ninguna verificación de quién llamaba ni de qué
 * modelo/método se estaba invocando. Ahora exige sesión de staff y restringe
 * el modelo a una allowlist explícita.
 */
export async function POST(request: Request) {
    const auth = await requireStaffSession(request);
    if (auth.response) return auth.response;

    try {
        const { model, method, args, kwargs } = await request.json();

        if (!model || !method) {
            return NextResponse.json(
                { error: 'model and method are required' },
                { status: 400 }
            );
        }

        if (!isModelAllowed(model)) {
            return NextResponse.json(
                { error: `Model '${model}' not allowed for generic call` },
                { status: 403 }
            );
        }

        const result = await fetchOdoo(
            model,
            method,
            args || [],
            kwargs || {}
        );

        return NextResponse.json({ result });
    } catch (error: unknown) {
        console.error('[call] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to call method' },
            { status: 500 }
        );
    }
}
