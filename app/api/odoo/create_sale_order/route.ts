import { NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';

export async function POST(request: Request) {
    try {
        const { partnerId, defaultCode, price, notes } = await request.json();

        if (!partnerId || !defaultCode || !price) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // STEP 1: Search for product.product by default_code
        console.log(`🔍 Searching for product with code: ${defaultCode}`);

        const products = await fetchOdoo(
            'product.product',
            'search_read',
            [[['default_code', '=', defaultCode]]],
            { fields: ['id', 'name', 'default_code'], limit: 1 }
        );

        if (!products || products.length === 0) {
            throw new Error(`Product with code '${defaultCode}' not found in Odoo`);
        }

        const productId = products[0].id;
        console.log(`✅ Found product.product ID: ${productId} (${products[0].name})`);

        // STEP 2: Create Sale Order in draft state
        const orderData = {
            partner_id: partnerId,
            state: 'draft',  // Draft state - waiting for approval
            note: notes || '',
            order_line: [
                [0, 0, {  // [0, 0, {...}] means "create new line"
                    product_id: productId,
                    product_uom_qty: 1,
                    price_unit: price,
                }]
            ]
        };

        console.log('📤 Creating Sale Order with data:', JSON.stringify(orderData, null, 2));

        const orderId = await fetchOdoo(
            'sale.order',
            'create',
            [orderData]
        );

        console.log(`✅ Sale Order Created: SO-${orderId} for Partner ${partnerId}`);

        return NextResponse.json({
            success: true,
            orderId: orderId
        });

    } catch (error: any) {
        console.error("❌ Create Sale Order API Error:");
        console.error("Error message:", error.message);
        console.error("Full error:", JSON.stringify(error, null, 2));
        return NextResponse.json(
            { success: false, error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
