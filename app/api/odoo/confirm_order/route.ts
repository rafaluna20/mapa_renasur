import { NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';

export async function POST(request: Request) {
    try {
        const { orderId } = await request.json();

        if (!orderId) {
            return NextResponse.json(
                { success: false, error: 'Missing orderId' },
                { status: 400 }
            );
        }

        // Confirm the sale order by changing state from 'draft' to 'sale'
        // In Odoo, this is typically done via action_confirm() but we can also write directly
        const result = await fetchOdoo(
            'sale.order',
            'action_confirm',
            [[parseInt(orderId)]]
        );

        console.log(`✅ Order ${orderId} confirmed (state changed to 'sale')`);

        return NextResponse.json({
            success: true,
            message: 'Order confirmed successfully'
        });

    } catch (error: any) {
        console.error("Confirm Order API Error:", error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
