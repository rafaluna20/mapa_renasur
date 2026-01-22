import { NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';

/**
 * POST /api/odoo/search-read
 * Generic search_read endpoint for Odoo models
 */
export async function POST(request: Request) {
    try {
        const { model, domain, fields } = await request.json();

        if (!model || !domain) {
            return NextResponse.json(
                { error: 'model and domain are required' },
                { status: 400 }
            );
        }

        const records = await fetchOdoo(
            model,
            'search_read',
            [domain],
            { fields: fields || [] }
        );

        return NextResponse.json({ records });
    } catch (error: any) {
        console.error('[search-read] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to search records' },
            { status: 500 }
        );
    }
}
