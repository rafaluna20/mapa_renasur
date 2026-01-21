import { NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';

export async function POST(request: Request) {
    try {
        const { saleOrderId } = await request.json();

        if (!saleOrderId) {
            return NextResponse.json(
                { success: false, error: 'Missing saleOrderId' },
                { status: 400 }
            );
        }

        console.log(`🔄 Creating recurring contract for Sale Order: ${saleOrderId}`);

        // 1. Leer datos de la orden de venta
        const orders = await fetchOdoo(
            'sale.order',
            'search_read',
            [[['id', '=', parseInt(saleOrderId)]]],
            {
                fields: [
                    'id', 'partner_id', 'order_line', 'state',
                    'x_plazo_meses', 'x_down_payment',
                    'x_discount_amount', 'x_date_first_installment'
                ],
                limit: 1
            }
        );

        if (!orders || orders.length === 0) {
            throw new Error(`Sale Order ${saleOrderId} not found`);
        }

        const order = orders[0];

        // Validaciones
        if (order.state !== 'sale') {
            return NextResponse.json(
                { success: false, error: 'Order must be in "sale" state to create contract' },
                { status: 400 }
            );
        }

        if (!order.x_plazo_meses || order.x_plazo_meses <= 0) {
            return NextResponse.json(
                { success: false, error: 'Invalid installment plan (x_plazo_meses)' },
                { status: 400 }
            );
        }

        if (!order.order_line || order.order_line.length === 0) {
            throw new Error('Sale Order has no products');
        }

        // 2. Verificar que no exista ya un contrato
        const existingContracts = await fetchOdoo(
            'simple.contract',
            'search_read',
            [[['sale_order_id', '=', parseInt(saleOrderId)]]],
            { fields: ['id'], limit: 1 }
        );

        if (existingContracts && existingContracts.length > 0) {
            return NextResponse.json({
                success: false,
                error: 'Contract already exists for this order',
                existingContractId: existingContracts[0].id
            }, { status: 409 });
        }

        // 3. Obtener detalles del producto
        const productLineId = order.order_line[0];
        const orderLines = await fetchOdoo(
            'sale.order.line',
            'search_read',
            [[['id', '=', productLineId]]],
            { fields: ['product_id', 'price_unit'], limit: 1 }
        );

        if (!orderLines || orderLines.length === 0) {
            throw new Error('Product line not found');
        }

        const productId = orderLines[0].product_id[0];
        const listPrice = orderLines[0].price_unit;

        // 4. Calcular mensualidad
        const discount = order.x_discount_amount || 0;
        const downPayment = order.x_down_payment || 0;
        const netPrice = listPrice - discount;
        const financedAmount = netPrice - downPayment;
        const monthlyAmount = financedAmount / order.x_plazo_meses;

        // 5. Preparar datos del contrato
        const contractData = {
            partner_id: order.partner_id[0],
            product_id: productId,
            sale_order_id: parseInt(saleOrderId),
            list_price: listPrice,
            discount_amount: discount,
            down_payment: downPayment,
            total_quotas: order.x_plazo_meses,
            amount: monthlyAmount,
            date_first_installment: order.x_date_first_installment || new Date().toISOString().split('T')[0],
            interval_type: 'months'  // Cambiar a 'minutes' para testing
        };

        console.log('📋 Creating contract with data:', contractData);

        // 6. Crear el contrato
        const contractId = await fetchOdoo(
            'simple.contract',
            'create',
            [contractData]
        );

        console.log(`✅ Recurring Contract Created: ID ${contractId}`);

        // 7. Agregar mensaje en la orden
        await fetchOdoo(
            'mail.message',
            'create',
            [{
                model: 'sale.order',
                res_id: parseInt(saleOrderId),
                body: `✅ Contrato recurrente creado: #${contractId}<br/>` +
                    `📊 Cuotas: ${order.x_plazo_meses}<br/>` +
                    `💰 Mensualidad: $${monthlyAmount.toFixed(2)}`,
                message_type: 'notification'
            }]
        );

        return NextResponse.json({
            success: true,
            contractId: contractId,
            details: {
                monthlyAmount: monthlyAmount,
                totalQuotas: order.x_plazo_meses,
                financedAmount: financedAmount
            }
        });

    } catch (error: any) {
        console.error('❌ Create Contract Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
