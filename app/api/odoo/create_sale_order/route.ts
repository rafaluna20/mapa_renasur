import { NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';

export async function POST(request: Request) {
    try {
        const { partnerId, defaultCode, price, notes, userId, quoteDetails } = await request.json();

        if (!partnerId || !defaultCode || !price) {
            const missing = [];
            if (!partnerId) missing.push('partnerId');
            if (!defaultCode) missing.push('defaultCode');
            if (!price) missing.push('price');

            return NextResponse.json(
                { success: false, error: `Missing required fields: ${missing.join(', ')}` },
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
        const orderData: any = {
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

        // Add Custom Fields if provided (Advanced Quotation)
        if (quoteDetails) {
            if (quoteDetails.installments) orderData.x_plazo_meses = parseInt(quoteDetails.installments);
            if (quoteDetails.downPayment) orderData.x_down_payment = parseFloat(quoteDetails.downPayment);
            if (quoteDetails.discount) orderData.x_discount_amount = parseFloat(quoteDetails.discount);
            if (quoteDetails.firstInstallmentDate) orderData.x_date_first_installment = quoteDetails.firstInstallmentDate;
        }

        // Assign the logged-in user as the salesperson
        if (userId) {
            orderData.user_id = parseInt(userId);
            console.log(`👤 Assigning salesperson: User ID ${userId}`);
        }

        // 🐛 DEBUG: Log complete data being sent to Odoo
        console.log('📤 ===== SALE ORDER DATA TO ODOO =====');
        console.log('Partner ID:', orderData.partner_id);
        console.log('Product:', {
            id: orderData.order_line[0][2].product_id,
            price_unit: orderData.order_line[0][2].price_unit,
            quantity: orderData.order_line[0][2].product_uom_qty
        });
        console.log('Financial Details:', {
            x_plazo_meses: orderData.x_plazo_meses || 'NOT SET',
            x_down_payment: orderData.x_down_payment || 'NOT SET',
            x_discount_amount: orderData.x_discount_amount || 'NOT SET',
            x_date_first_installment: orderData.x_date_first_installment || 'NOT SET'
        });
        console.log('Metadata:', {
            state: orderData.state,
            user_id: orderData.user_id,
            note: orderData.note?.substring(0, 50) + '...'
        });
        console.log('======================================');

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
