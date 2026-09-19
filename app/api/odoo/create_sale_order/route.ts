import { NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';
import { requireStaffSession } from '@/app/lib/staffAuth';

export async function POST(request: Request) {
    const auth = await requireStaffSession(request);
    if (auth.response) return auth.response;

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
        const orderData: Record<string, unknown> = {
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
            // Modo de fechas de las cuotas de la cotización -> lo usa create_contract para
            // crear el contrato con el MISMO cronograma que vio el cliente en el PDF.
            // 'end_of_month' = fin de mes (todas las cuotas, 1ra incluida) | 'fixed_day' = mismo día.
            if (quoteDetails.scheduleType) {
                orderData.x_installment_date_mode =
                    quoteDetails.scheduleType === 'end_of_month' ? 'month_end' : 'same_day';
            }
        }

        // Assign the logged-in user as the salesperson
        if (userId) {
            orderData.user_id = parseInt(userId);
            console.log(`👤 Assigning salesperson: User ID ${userId}`);
        }

        // 🐛 DEBUG: Log complete data being sent to Odoo
        console.log('📤 ===== SALE ORDER DATA TO ODOO =====');
        console.log('Partner ID:', orderData.partner_id);
        const orderLineData = (orderData.order_line as any[])[0][2] as { product_id: number; price_unit: number; product_uom_qty: number };
        console.log('Product:', {
            id: orderLineData.product_id,
            price_unit: orderLineData.price_unit,
            quantity: orderLineData.product_uom_qty
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
            note: typeof orderData.note === 'string' ? orderData.note.substring(0, 50) + '...' : 'N/A'
        });
        console.log('======================================');

        console.log('📤 Creating Sale Order with data:', JSON.stringify(orderData, null, 2));

        let orderId: number;
        try {
            orderId = await fetchOdoo(
                'sale.order',
                'create',
                [orderData]
            );
        } catch (createError: unknown) {
            // Ventana de despliegue: si esta app se publica ANTES de actualizar el módulo
            // de Odoo, sale.order todavía no tiene x_installment_date_mode y el create
            // fallaría (se caerían TODAS las cotizaciones). Se reintenta sin ese campo:
            // el contrato saldrá "mismo día" (comportamiento histórico) en vez de perder la cotización.
            const message = createError instanceof Error ? createError.message : String(createError);
            if (orderData.x_installment_date_mode && message.includes('x_installment_date_mode')) {
                console.warn('⚠️ Odoo sin x_installment_date_mode en sale.order: reintentando sin ese campo');
                delete orderData.x_installment_date_mode;
                orderId = await fetchOdoo('sale.order', 'create', [orderData]);
            } else {
                throw createError;
            }
        }

        console.log(`✅ Sale Order Created: SO-${orderId} for Partner ${partnerId}`);

        return NextResponse.json({
            success: true,
            orderId: orderId
        });

    } catch (error: unknown) {
        console.error("❌ Create Sale Order API Error:");
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        console.error("Error message:", errorMessage);
        console.error("Full error:", JSON.stringify(error, null, 2));
        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}
