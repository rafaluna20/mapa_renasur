import { NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';

/**
 * POST /api/odoo/read
 * Generic read endpoint for Odoo records
 */
export async function POST(request: Request) {
    try {
        const { model, ids, fields } = await request.json();

        if (!model || !ids) {
            return NextResponse.json(
                { error: 'model and ids are required' },
                { status: 400 }
            );
        }

        const records = await fetchOdoo(
            model,
            'read',
            [ids],
            { fields: fields || [] }
        );

        return NextResponse.json({ records });
    } catch (error: any) {
        console.error('[read] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to read records' },
            { status: 500 }
        );
    }
}
