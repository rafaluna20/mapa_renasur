import { NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';

/**
 * Get the salesperson (user_id) who holds the reservation for a lot
 */
export async function POST(request: Request) {
    try {
        const { defaultCode, productId } = await request.json();

        if (!defaultCode && !productId) {
            return NextResponse.json({ success: false, error: 'Missing identifier' }, { status: 400 });
        }

        console.log(`🔍 Finding reservation owner for: ${defaultCode || productId}`);

        // If we only have defaultCode, get Product ID first
        let effectiveProductId = productId;
        if (!effectiveProductId && defaultCode) {
            const products = await fetchOdoo(
                'product.product',
                'search_read',
                [[['default_code', '=', defaultCode]]],
                { fields: ['id'], limit: 1 }
            );
            if (products && products.length > 0) {
                effectiveProductId = products[0].id;
            }
        }

        if (!effectiveProductId) {
            return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
        }

        // Search for Confirmed Orders (state = 'sale') for this product
        const orders = await fetchOdoo(
            'sale.order',
            'search_read',
            [[
                ['state', '=', 'sale'], // Only confirmed sales (Reservations)
                ['order_line.product_id', '=', effectiveProductId]
            ]],
            {
                fields: ['user_id', 'partner_id', 'date_order', 'x_plazo_meses'],
                limit: 1,
                order: 'date_order desc' // Latest one
            }
        );

        if (!orders || orders.length === 0) {
            return NextResponse.json({ success: true, ownerId: null });
        }

        const order = orders[0];
        // user_id is [id, name]
        const ownerId = order.user_id ? order.user_id[0] : null;
        const ownerName = order.user_id ? order.user_id[1] : 'Unknown';
        const partnerId = order.partner_id ? order.partner_id[0] : null;
        const clientName = order.partner_id ? order.partner_id[1] : 'Unknown';
        // Parse custom field, default to 72 if missing or 0
        const totalInstallments = order.x_plazo_meses ? parseInt(order.x_plazo_meses) : 72;

        return NextResponse.json({
            success: true,
            ownerId,
            ownerName,
            partnerId,
            clientName,
            totalInstallments,
            orderDate: order.date_order
        });

    } catch (error: any) {
        console.error("❌ Get Reservation Owner Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
