import { NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';
import { requireStaffSession } from '@/app/lib/staffAuth';

/**
 * Find the latest DRAFT sale order for a specific product (lot), or a specific order by ID
 */
export async function POST(request: Request) {
    const auth = await requireStaffSession(request);
    if (auth.response) return auth.response;

    try {
        const { defaultCode, userId, orderId } = await request.json();

        if (!defaultCode && !orderId) {
            return NextResponse.json(
                { success: false, error: 'Missing defaultCode or orderId' },
                { status: 400 }
            );
        }

        if (orderId) {
            console.log(`🔍 Finding specific draft order: ${orderId}`);
            const orders = await fetchOdoo(
                'sale.order',
                'search_read',
                [[['id', '=', orderId]]],
                { fields: ['id', 'partner_id', 'amount_total', 'date_order', 'order_line'] }
            );

            if (!orders || orders.length === 0) {
                return NextResponse.json({ success: true, order: null });
            }

            const order = orders[0];
            const orderLineIds = order.order_line as number[];
            let productId = null;
            let productTmplId = null;

            if (orderLineIds && orderLineIds.length > 0) {
                const lines = await fetchOdoo('sale.order.line', 'read', [orderLineIds], { fields: ['product_id', 'product_template_id'] });
                if (lines && lines.length > 0) {
                    productId = Array.isArray(lines[0].product_id) ? lines[0].product_id[0] : lines[0].product_id;
                    productTmplId = Array.isArray(lines[0].product_template_id) ? lines[0].product_template_id[0] : lines[0].product_template_id;
                }
            }

            return NextResponse.json({
                success: true,
                order: {
                    id: order.id,
                    partnerId: Array.isArray(order.partner_id) ? order.partner_id[0] : order.partner_id,
                    partnerName: Array.isArray(order.partner_id) ? order.partner_id[1] : 'Desconocido',
                    amount: order.amount_total,
                    productId: productId,
                    productTmplId: productTmplId
                }
            });
        }

        console.log(`🔍 Finding draft order for lot: ${defaultCode} (User: ${userId || 'Any'})`);

        // 1. First find the product ID from default_code
        // We need the product.product ID to search in order lines
        const products = await fetchOdoo(
            'product.product',
            'search_read',
            [[['default_code', '=', defaultCode]]],
            { fields: ['id', 'product_tmpl_id'], limit: 1 }
        );

        if (!products || products.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Product not found' },
                { status: 404 }
            );
        }

        const productId = products[0].id;
        const productTmplId = Array.isArray(products[0].product_tmpl_id)
            ? products[0].product_tmpl_id[0]
            : products[0].product_tmpl_id;

        // 2. Search for Sale Orders in 'draft' or 'sent' state containing this product
        const domain: unknown[] = [
            ['state', 'in', ['draft', 'sent']],
            ['order_line.product_id', '=', productId]
        ];

        // Filter by user if provided
        if (userId) {
            domain.push(['user_id', '=', parseInt(userId)]);
        }

        const orders = await fetchOdoo(
            'sale.order',
            'search_read',
            [domain],
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
                productId: productId,
                productTmplId: productTmplId // Return Template ID for status updates
            }
        });

    } catch (error: unknown) {
        console.error("❌ Find Draft Order API Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Internal Server Error' },
            { status: 500 }
        );
    }
}
