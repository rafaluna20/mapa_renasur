import { NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';
import { requireStaffSession } from '@/app/lib/staffAuth';

/**
 * Search for a product by default_code and return its product.product ID
 */
export async function POST(request: Request) {
    const auth = await requireStaffSession(request);
    if (auth.response) return auth.response;

    try {
        const { defaultCode } = await request.json();

        if (!defaultCode) {
            return NextResponse.json(
                { success: false, error: 'Missing defaultCode' },
                { status: 400 }
            );
        }

        console.log(`🔍 Searching for product with code: ${defaultCode}`);

        const products = await fetchOdoo(
            'product.product',
            'search_read',
            [[['default_code', '=', defaultCode]]],
            { fields: ['id', 'product_tmpl_id'], limit: 1 }
        );

        if (!products || products.length === 0) {
            return NextResponse.json(
                { success: false, error: `Product with code '${defaultCode}' not found` },
                { status: 404 }
            );
        }

        // Result format for Many2one: [id, name]
        const tmplId = Array.isArray(products[0].product_tmpl_id)
            ? products[0].product_tmpl_id[0]
            : products[0].product_tmpl_id;

        return NextResponse.json({
            success: true,
            productId: tmplId // We return Template ID to be used in update_status (which writes to product.template)
        });

    } catch (error: unknown) {
        console.error("❌ Search Product API Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Internal Server Error' },
            { status: 500 }
        );
    }
}
