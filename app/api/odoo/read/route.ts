import { NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';
import { requireStaffSession } from '@/app/lib/staffAuth';
import { isModelAllowed } from '@/app/lib/odooAllowlist';

/**
 * POST /api/odoo/read
 * Generic read endpoint for Odoo records
 */
export async function POST(request: Request) {
    const auth = await requireStaffSession(request);
    if (auth.response) return auth.response;

    try {
        const { model, ids, fields } = await request.json();

        if (!model || !ids) {
            return NextResponse.json(
                { error: 'model and ids are required' },
                { status: 400 }
            );
        }

        if (!isModelAllowed(model)) {
            return NextResponse.json(
                { error: `Model '${model}' not allowed for generic read` },
                { status: 403 }
            );
        }

        const records = await fetchOdoo(
            model,
            'read',
            [ids],
            { fields: fields || [] }
        );

        return NextResponse.json({ records });
    } catch (error: unknown) {
        console.error('[read] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to read records' },
            { status: 500 }
        );
    }
}
