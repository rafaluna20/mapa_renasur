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

        // 2. Verificar que no exista ya un contrato (Por Partner + Producto, ya que no existe sale_order_id)
        // Necesitamos obtener el product_id primero para verificar duplicados
        const productLineIdCheck = order.order_line[0];
        const orderLinesCheck = await fetchOdoo(
            'sale.order.line',
            'search_read',
            [[['id', '=', productLineIdCheck]]],
            { fields: ['product_id', 'name', 'price_unit'], limit: 1 }
        );

        if (!orderLinesCheck || orderLinesCheck.length === 0) {
            throw new Error('Product line not found');
        }

        const productId = orderLinesCheck[0].product_id[0];
        const listPrice = orderLinesCheck[0].price_unit; // Ya lo tenemos aquí, optimizamos

        const existingContracts = await fetchOdoo(
            'simple.contract',
            'search_read',
            [[
                ['partner_id', '=', order.partner_id[0]],
                ['product_id', '=', productId]
            ]],
            { fields: ['id'], limit: 1 }
        );

        if (existingContracts && existingContracts.length > 0) {
            return NextResponse.json({
                success: false,
                error: 'Contract already exists for this partner and product',
                existingContractId: existingContracts[0].id
            }, { status: 409 });
        }

        // 3. (Optimizado: ya obtuvimos product_id y listPrice arriba)

        // 4. Calcular mensualidad
        const discount = order.x_discount_amount || 0;
        const downPayment = order.x_down_payment || 0;
        const netPrice = listPrice - discount;
        const financedAmount = netPrice - downPayment;
        const monthlyAmount = financedAmount / order.x_plazo_meses;

        // 5. Preparar datos del contrato
        const contractData = {
            name: `Contrato Manual - ${orderLinesCheck[0].name}`, // Referencia manual
            partner_id: order.partner_id[0],
            product_id: productId,
            // sale_order_id: parseInt(saleOrderId), // REMOVED: Field does not exist
            list_price: listPrice,
            discount_amount: discount,
            down_payment: downPayment,
            total_quotas: order.x_plazo_meses,
            amount: monthlyAmount,
            date_first_installment: order.x_date_first_installment || new Date().toISOString().split('T')[0],
            date_next_billing: order.x_date_first_installment || new Date().toISOString().split('T')[0], // ✅ Campo obligatorio del Robot
            interval_type: 'months'
        };

        console.log('📋 Payload Enviado a Odoo (Contract):', JSON.stringify(contractData, null, 2));

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
