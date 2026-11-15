import { NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';
import { requireStaffSession } from '@/app/lib/staffAuth';
import { fetchCronograma, resolverContratoDelLote, type ContratoEstado } from '@/app/lib/contratoEstadoCuenta';

export async function POST(request: Request) {
    const auth = await requireStaffSession(request);
    if (auth.response) return auth.response;

    try {
        const body = await request.json();
        const partnerId = parseInt(body.partnerId);
        const productCode = body.productCode; // 🆕 Código del producto (lote)

        if (!partnerId || isNaN(partnerId)) {
            console.warn("⚠️ Get Client Invoices: Invalid or Missing partnerId");
            return NextResponse.json({ success: false, error: 'Invalid partnerId' }, { status: 400 });
        }

        console.log(`🔍 Fetching invoices for Partner ID: ${partnerId}${productCode ? ` - Product Code: ${productCode}` : ''}`);

        // Estado de cuenta POR CONTRATO (ficha mapa_estado_cuenta_por_contrato): si el lote tiene contrato, se leen
        // todas las facturas de ese contrato (contract_id), sin importar a nombre de quién salieron (en un lote con
        // copropietarios la factura nace al cobro, a nombre de quien paga). Lo que no tiene contrato_id (histórico o
        // manual) sigue entrando por cliente + lote, como siempre. Sin contrato se conserva el comportamiento anterior.
        let contrato: ContratoEstado | null = null;
        if (productCode) {
            try {
                contrato = await resolverContratoDelLote(productCode);
            } catch (e) {
                console.warn('⚠️ No se pudo resolver el contrato del lote; se usa cliente + lote:', e);
            }
        }

        // 🆕 Si se proporciona productCode, filtrar facturas por ese producto específico
        let domain;

        if (productCode) {
            // Paso 1: Buscar el product.product por default_code
            const products = await fetchOdoo(
                'product.product',
                'search_read',
                [[['default_code', '=', productCode]]],
                { fields: ['id'], limit: 1 }
            );

            if (!products || products.length === 0) {
                console.warn(`⚠️ No se encontró producto con código: ${productCode}`);
                if (!contrato) return NextResponse.json({ success: true, invoices: [] });
            }

            // Paso 2: Buscar líneas de factura (account.move.line) que tengan ese producto
            let invoiceIds: unknown[] = [];
            if (products && products.length > 0) {
                const productId = products[0].id;
                console.log(`✅ Producto encontrado - ID: ${productId}`);
                const invoiceLines = await fetchOdoo(
                    'account.move.line',
                    'search_read',
                    [[['product_id', '=', productId]]],
                    { fields: ['move_id'], limit: 100 }
                );
                invoiceIds = [...new Set((invoiceLines || []).map((line: Record<string, unknown>) => (line.move_id as unknown[])[0]))];
                console.log(`📋 Facturas encontradas para producto: ${invoiceIds.length}`);
            }

            if (contrato) {
                // Titulares del contrato: solo para las facturas viejas SIN contrato (no cambian de dueño).
                const titulares = [...new Set([partnerId, ...(contrato.partnerId ? [contrato.partnerId] : []), ...contrato.coOwnerIds])];
                domain = [
                    ['move_type', '=', 'out_invoice'],
                    ['state', '=', 'posted'],
                    '|',
                    ['contract_id', '=', contrato.id],
                    '&', '&',
                    ['contract_id', '=', false],
                    ['partner_id', 'in', titulares],
                    ['id', 'in', invoiceIds],
                ];
            } else {
                if (invoiceIds.length === 0) {
                    console.log(`ℹ️ No se encontraron líneas de factura para producto ${productCode}`);
                    return NextResponse.json({ success: true, invoices: [] });
                }
                // Paso 3: Filtrar por partner_id + invoice IDs + tipo + estado
                domain = [
                    ['id', 'in', invoiceIds],
                    ['partner_id', '=', partnerId],
                    ['move_type', '=', 'out_invoice'],
                    ['state', '=', 'posted']
                ];
            }
        } else {
            // Sin filtro de producto: Retornar todas las facturas del cliente
            domain = [
                ['partner_id', '=', partnerId],
                ['move_type', '=', 'out_invoice'],
                ['state', '=', 'posted']
            ];
        }

        // Campos de factura — incluye 'ref' para parsear el número de cuota
        const fields = [
            'id',
            'name',
            'partner_id',          // Quién pagó (staff): en lotes con copropietarios cambia de cuota a cuota
            'contract_id',
            'contract_quota_number', // Número de cuota estructurado (mejor que leerlo de la referencia)
            'ref',                 // Ej: CONTRATOMANUAL-E01MZD148P-C013
            'payment_reference',   // Referencia de pago (alternativa a ref)
            'invoice_date',
            'invoice_date_due',
            'payment_state',
            'amount_total',
            'amount_residual',
            'currency_id',         // Moneda de la factura ([id, 'USD']): contratos en dólares
            // Mora (simple_recurring_contract >= 3.18): permite separar los cargos por mora de las cuotas
            'is_late_fee',
            'late_fee_origin_id',
            'late_fee_days_late',
            'late_fee_percentage_applied',
            'late_fee_waived',
            'invoice_payments_widget' // Fecha real de pago (para el PDF de Estado de Cuenta)
        ];

        const invoices = await fetchOdoo(
            'account.move',
            'search_read',
            [domain],
            {
                fields: fields,
                limit: 200,
                order: 'invoice_date asc'  // Orden cronológico: cuota inicial primero
            }
        );

        // Contrato Manual: la factura nace al cobro, así que las cuotas vencidas sin cobrar no tienen factura y
        // hay que tomarlas del cronograma. En Automático no hace falta (el motor ya las facturó).
        let scheduleLines: Awaited<ReturnType<typeof fetchCronograma>> = [];
        if (contrato?.billingMode === 'manual' && contrato.state === 'confirmed') {
            try {
                scheduleLines = await fetchCronograma(contrato.id);
            } catch (e) {
                console.warn('⚠️ No se pudo leer el cronograma del contrato manual:', e);
            }
        }

        return NextResponse.json({
            success: true,
            invoices: invoices || [],
            contract: contrato
                ? { id: contrato.id, state: contrato.state, billingMode: contrato.billingMode, coOwnerIds: contrato.coOwnerIds }
                : null,
            scheduleLines,
        });

    } catch (error: unknown) {
        console.error("❌ Get Client Invoices Error:");
        console.error(error);
        // Return success:false but with a 200 OK so the client doesn't throw a network error
        // and handles the empty list gracefully.
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Internal Server Error', invoices: [] }, { status: 200 });
    }
}
