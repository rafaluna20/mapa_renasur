import { NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';
import { requireStaffSession } from '@/app/lib/staffAuth';

export async function POST(request: Request) {
    const auth = await requireStaffSession(request);
    if (auth.response) return auth.response;

    try {
        const { orderId, separationAmount } = await request.json();

        if (!orderId) {
            return NextResponse.json(
                { success: false, error: 'Missing orderId' },
                { status: 400 }
            );
        }

        // Save separation amount to Odoo custom field if provided
        if (separationAmount !== undefined && separationAmount !== null) {
            try {
                await fetchOdoo(
                    'sale.order',
                    'write',
                    [[parseInt(orderId)], { x_separacion: parseFloat(separationAmount) }]
                );
                console.log(`✅ Separation amount S/ ${separationAmount} saved to x_separacion for order ${orderId}`);
            } catch (err) {
                console.warn(`⚠️ Could not write x_separacion field on sale.order ${orderId}:`, err);
            }
        }

        // Confirm the sale order by changing state from 'draft' to 'sale'
        // In Odoo, this is typically done via action_confirm() but we can also write directly
        await fetchOdoo(
            'sale.order',
            'action_confirm',
            [[parseInt(orderId)]]
        );

        console.log(`✅ Order ${orderId} confirmed (state changed to 'sale')`);

        return NextResponse.json({
            success: true,
            message: 'Order confirmed successfully'
        });

    } catch (error: unknown) {
        console.error("Confirm Order API Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Internal Server Error' },
            { status: 500 }
        );
    }
}
