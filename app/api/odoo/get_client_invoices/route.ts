import { NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const partnerId = parseInt(body.partnerId);

        if (!partnerId || isNaN(partnerId)) {
            console.warn("⚠️ Get Client Invoices: Invalid or Missing partnerId");
            return NextResponse.json({ success: false, error: 'Invalid partnerId' }, { status: 400 });
        }

        console.log(`🔍 Fetching invoices for Partner ID: ${partnerId}`);

        // Search for Customer Invoices (move_type = 'out_invoice')
        // State = 'posted' (Valid invoices)
        const domain = [
            ['partner_id', '=', partnerId],
            ['move_type', '=', 'out_invoice'],
            ['state', '=', 'posted']
        ];

        // Safest field list for Odoo 17/18 compatibility
        // Excluding potentially problematic fields to debug the 500 error
        const fields = [
            'id',
            'name',
            'invoice_date',
            'invoice_date_due', // Standard in v17+, was date_due in old versions
            'payment_state',
            'amount_total',
            'amount_residual'
            // 'ref' and 'payment_reference' removed temporarily for debugging
        ];

        const invoices = await fetchOdoo(
            'account.move',
            'search_read',
            [domain],
            {
                fields: fields,
                limit: 100,
                order: 'invoice_date desc'
            }
        );

        return NextResponse.json({
            success: true,
            invoices: invoices || []
        });

    } catch (error: any) {
        console.error("❌ Get Client Invoices Error:");
        console.error(error);
        // Return success:false but with a 200 OK so the client doesn't throw a network error
        // and handles the empty list gracefully.
        return NextResponse.json({ success: false, error: error.message, invoices: [] }, { status: 200 });
    }
}
