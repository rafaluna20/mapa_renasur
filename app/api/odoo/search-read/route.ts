import { NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';
import { requireStaffSession } from '@/app/lib/staffAuth';
import { isModelAllowed } from '@/app/lib/odooAllowlist';

/**
 * POST /api/odoo/search-read
 * Generic search_read endpoint for Odoo models
 */
export async function POST(request: Request) {
    const auth = await requireStaffSession(request);
    if (auth.response) return auth.response;

    try {
        const { model, domain, fields } = await request.json();

        if (!model || !domain) {
            return NextResponse.json(
                { error: 'model and domain are required' },
                { status: 400 }
            );
        }

        if (!isModelAllowed(model)) {
            return NextResponse.json(
                { error: `Model '${model}' not allowed for generic search-read` },
                { status: 403 }
            );
        }

        const records = await fetchOdoo(
            model,
            'search_read',
            [domain],
            { fields: fields || [] }
        );

        return NextResponse.json({ records });
    } catch (error: unknown) {
        console.error('[search-read] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to search records' },
            { status: 500 }
        );
    }
}
