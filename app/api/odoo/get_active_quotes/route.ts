import { NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';

export async function POST(request: Request) {
    try {
        const { defaultCode } = await request.json();

        if (!defaultCode) {
            return NextResponse.json(
                { success: false, error: 'Missing defaultCode' },
                { status: 400 }
            );
        }

        // 1. Find product by default_code to get product template ID
        const products = await fetchOdoo(
            'product.product',
            'search_read',
            [[['default_code', '=', defaultCode]]],
            { fields: ['id', 'product_tmpl_id'], limit: 1 }
        );

        if (!products || products.length === 0) {
            return NextResponse.json({
                success: true,
                quotes: [] // No product found, no quotes
            });
        }

        const productId = products[0].id;

        // 2. Search for sale orders in 'draft' state that contain this product variant
        // sale.order.line.product_id refers to product.product, NOT product.template
        const orderLines = await fetchOdoo(
            'sale.order.line',
            'search_read',
            [[['product_id', '=', productId]]],
            { fields: ['order_id', 'product_uom_qty', 'price_unit'] }
        );

        if (!orderLines || orderLines.length === 0) {
            return NextResponse.json({
                success: true,
                quotes: []
            });
        }

        // Extract unique order IDs
        const orderIds = [...new Set(orderLines.map((line: any) =>
            Array.isArray(line.order_id) ? line.order_id[0] : line.order_id
        ))];

        // 3. Get order details for draft orders only
        const orders = await fetchOdoo(
            'sale.order',
            'search_read',
            [[
                ['id', 'in', orderIds],
                ['state', '=', 'draft']
            ]],
            { fields: ['id', 'name', 'partner_id', 'user_id', 'create_date', 'amount_total'] }
        );

        if (!orders || orders.length === 0) {
            return NextResponse.json({
                success: true,
                quotes: []
            });
        }

        // 4. Format response
        const quotes = orders.map((order: any) => ({
            orderId: order.id,
            orderName: order.name,
            clientName: Array.isArray(order.partner_id) ? order.partner_id[1] : 'Cliente Desconocido',
            vendorName: Array.isArray(order.user_id) ? order.user_id[1] : 'Vendedor Desconocido',
            createdAt: order.create_date,
            amount: order.amount_total || 0
        }));

        console.log(`✅ Found ${quotes.length} active quote(s) for lot ${defaultCode}`);

        return NextResponse.json({
            success: true,
            quotes
        });

    } catch (error: any) {
        console.error("Get Active Quotes API Error:", error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
