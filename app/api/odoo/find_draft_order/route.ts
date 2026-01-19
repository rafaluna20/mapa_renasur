import { NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';

/**
 * Find the latest DRAFT sale order for a specific product (lot)
 */
export async function POST(request: Request) {
    try {
        const { defaultCode } = await request.json();

        if (!defaultCode) {
            return NextResponse.json(
                { success: false, error: 'Missing defaultCode' },
                { status: 400 }
            );
        }

        console.log(`🔍 Finding draft order for lot: ${defaultCode}`);

        // 1. First find the product ID from default_code
        // We need the product.product ID to search in order lines
        const products = await fetchOdoo(
            'product.product',
            'search_read',
            [[['default_code', '=', defaultCode]]],
            { fields: ['id'], limit: 1 }
        );

        if (!products || products.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Product not found' },
                { status: 404 }
            );
        }

        const productId = products[0].id;

        // 2. Search for Sale Orders in 'draft' or 'sent' state containing this product
        // Domain explanation: 
        // - state in ['draft', 'sent'] (Quotations)
        // - order_line.product_id = productId
        const orders = await fetchOdoo(
            'sale.order',
            'search_read',
            [
                [
                    ['state', 'in', ['draft', 'sent']],
                    ['order_line.product_id', '=', productId]
                ]
            ],
            {
                fields: ['id', 'partner_id', 'amount_total', 'date_order'],
                limit: 1,
                order: 'date_order desc' // Get latest
            }
        );

        if (!orders || orders.length === 0) {
            return NextResponse.json({ success: true, order: null });
        }

        const order = orders[0];

        return NextResponse.json({
            success: true,
            order: {
                id: order.id,
                partnerId: order.partner_id[0],
                partnerName: order.partner_id[1],
                amount: order.amount_total,
                productId: productId
            }
        });

    } catch (error: any) {
        console.error("❌ Find Draft Order API Error:", error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
