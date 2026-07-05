import { NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';
import { callContractApi } from '@/app/services/odooModuleApi';
import { requireStaffSession } from '@/app/lib/staffAuth';

interface ContractCreateResult {
    status: 'success' | 'error';
    message?: string;
    contract_id: number;
    contract_name?: string;
    state?: string;
    final_price?: number;
    financed_amount?: number;
}

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

        // Nota: ya no hace falta verificar duplicados acá — el endpoint
        // /api/contract/create del módulo Odoo resuelve la idempotencia por
        // sale_order_id internamente (y el unique(sale_order_id) del modelo
        // es la red de seguridad real ante llamadas concurrentes).

        // 2. Obtener product_id y precio de la línea de la orden
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

        // 3. Calcular mensualidad (sin interés: mismo comportamiento histórico)
        const discount = order.x_discount_amount || 0;
        const downPayment = order.x_down_payment || 0;
        const netPrice = listPrice - discount;
        const financedAmount = netPrice - downPayment;
        const monthlyAmount = financedAmount / order.x_plazo_meses;
        const dateFirstInstallment = order.x_date_first_installment || new Date().toISOString().split('T')[0];

        // 4. Crear el contrato vía el endpoint asegurado del módulo (API key,
        // rate limit, validadores e idempotencia por sale_order_id ya
        // resueltos ahí) en vez de un create() directo con la cuenta admin.
        //
        // Nota de comportamiento: a diferencia del create() directo anterior,
        // este endpoint no acepta un 'name' custom — el contrato queda con el
        // código autogenerado por la secuencia de Odoo (mismo formato que los
        // contratos creados manualmente), en vez de "Contrato Manual - X".
        const result = await callContractApi<ContractCreateResult>('/api/contract/create', {
            partner_id: order.partner_id[0],
            product_id: productId,
            sale_order_id: orderIdNum,
            list_price: listPrice,
            discount_amount: discount,
            down_payment: downPayment,
            total_quotas: order.x_plazo_meses,
            amount: monthlyAmount,
            date_first_installment: dateFirstInstallment,
            interval_type: 'months',
        });

        const contractId = result.contract_id;
        console.log(`✅ Recurring Contract Created: ID ${contractId} (${result.message || 'nuevo'})`);

        // 5. Agregar mensaje en la orden
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
