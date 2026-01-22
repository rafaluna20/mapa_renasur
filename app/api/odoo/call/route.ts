import { NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';

/**
 * POST /api/odoo/call
 * Generic method call endpoint for Odoo models
 */
export async function POST(request: Request) {
    try {
        const { model, method, args, kwargs } = await request.json();

        if (!model || !method) {
            return NextResponse.json(
                { error: 'model and method are required' },
                { status: 400 }
            );
        }

        const result = await fetchOdoo(
            model,
            method,
            args || [],
            kwargs || {}
        );

        return NextResponse.json({ result });
    } catch (error: any) {
        console.error('[call] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to call method' },
            { status: 500 }
        );
    }
}
