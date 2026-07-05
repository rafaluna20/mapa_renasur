import { NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';
import { requireStaffSession } from '@/app/lib/staffAuth';

export async function POST(request: Request) {
    const auth = await requireStaffSession(request);
    if (auth.response) return auth.response;

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

        const orderIdNum = parseInt(saleOrderId);

        // 2. Idempotencia por sale_order_id (más el unique(sale_order_id) del
        // modelo como red de seguridad real ante llamadas concurrentes).
        const existingContracts = await fetchOdoo(
            'simple.contract',
            'search_read',
            [[['sale_order_id', '=', orderIdNum]]],
            { fields: ['id'], limit: 1 }
        );

        if (existingContracts && existingContracts.length > 0) {
            return NextResponse.json({
                success: true,
                message: 'Contrato ya existía (idempotencia)',
                contractId: existingContracts[0].id
            });
        }

        // 3. Obtener product_id y precio de la línea de la orden
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
        const listPrice = orderLinesCheck[0].price_unit;

        // 4. Calcular mensualidad (sin interés: mismo comportamiento histórico)
        const discount = order.x_discount_amount || 0;
        const downPayment = order.x_down_payment || 0;
        const netPrice = listPrice - discount;
        const financedAmount = netPrice - downPayment;
        const monthlyAmount = financedAmount / order.x_plazo_meses;

        // 5. Preparar datos del contrato
        const contractData = {
            name: `Contrato Manual - ${orderLinesCheck[0].name}`,
            partner_id: order.partner_id[0],
            product_id: productId,
            sale_order_id: orderIdNum,
            list_price: listPrice,
            discount_amount: discount,
            down_payment: downPayment,
            total_quotas: order.x_plazo_meses,
            amount: monthlyAmount,
            date_first_installment: order.x_date_first_installment || new Date().toISOString().split('T')[0],
            date_next_billing: order.x_date_first_installment || new Date().toISOString().split('T')[0],
            interval_type: 'months'
        };

        // 6. Crear el contrato
        // REVERTIDO temporalmente: create_contract llegó a usar el endpoint
        // asegurado del módulo (/api/contract/create con API key), pero eso
        // requiere una credencial (ODOO_CONTRACT_API_KEY) que todavía no está
        // configurada en producción. Sin ella, la llamada fallaba en
        // silencio (el caller la trata como "no bloqueante") y las reservas
        // dejaron de generar contrato. Vuelve a create() directo hasta que
        // se configure esa API key; ver odooModuleApi.ts para retomarlo.
        let contractId: number;
        try {
            contractId = await fetchOdoo(
                'simple.contract',
                'create',
                [contractData]
            );
        } catch (createError: unknown) {
            const message = createError instanceof Error ? createError.message : String(createError);
            if (message.includes('sale_order_id_unique') || message.includes('contrato de crédito para esta orden')) {
                const raceContracts = await fetchOdoo(
                    'simple.contract',
                    'search_read',
                    [[['sale_order_id', '=', orderIdNum]]],
                    { fields: ['id'], limit: 1 }
                );
                if (raceContracts && raceContracts.length > 0) {
                    return NextResponse.json({
                        success: true,
                        message: 'Contrato ya existía (idempotencia, creación concurrente)',
                        contractId: raceContracts[0].id
                    });
                }
            }
            throw createError;
        }

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

        /*// 8. Auto-confirmar el contrato (Petición del Usuario)
        try {
            console.log(`🔄 Auto-confirming Contract #${contractId}...`);
            await fetchOdoo(
                'simple.contract',
                'action_confirm', // Método estándar de Odoo para botones de confirmación
                [[contractId]]
            );
            console.log(`✅ Contract #${contractId} auto-confirmed successfully.`);
        } catch (confirmError) {
            console.warn(`⚠️ Could not auto-confirm contract #${contractId}. User must confirm manually. Error:`, confirmError);
            // No bloqueamos: El contrato ya existe, solo falta el click final.
        }*/

        return NextResponse.json({
            success: true,
            contractId: contractId,
            details: {
                monthlyAmount: monthlyAmount,
                totalQuotas: order.x_plazo_meses,
                financedAmount: financedAmount
            }
        });

    } catch (error: unknown) {
        console.error('❌ Create Contract Error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Internal Server Error' },
            { status: 500 }
        );
    }
}
