import { NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';
import { requireStaffSession } from '@/app/lib/staffAuth';

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
                return NextResponse.json({ success: true, invoices: [] });
            }

            const productId = products[0].id;
            console.log(`✅ Producto encontrado - ID: ${productId}`);

            // Paso 2: Buscar líneas de factura (account.move.line) que tengan ese producto
            const invoiceLines = await fetchOdoo(
                'account.move.line',
                'search_read',
                [[['product_id', '=', productId]]],
                { fields: ['move_id'], limit: 100 }
            );

            if (!invoiceLines || invoiceLines.length === 0) {
                console.log(`ℹ️ No se encontraron líneas de factura para producto ${productCode}`);
                return NextResponse.json({ success: true, invoices: [] });
            }

            // Extraer IDs de facturas
            const invoiceIds = [...new Set(invoiceLines.map((line: Record<string, unknown>) => (line.move_id as unknown[])[0]))];
            console.log(`📋 Facturas encontradas para producto: ${invoiceIds.length}`);

            // Paso 3: Filtrar por partner_id + invoice IDs + tipo + estado
            domain = [
                ['id', 'in', invoiceIds],
                ['partner_id', '=', partnerId],
                ['move_type', '=', 'out_invoice'],
                ['state', '=', 'posted']
            ];
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
            'ref',                 // Ej: CONTRATOMANUAL-E01MZD148P-C013
            'payment_reference',   // Referencia de pago (alternativa a ref)
            'invoice_date',
            'invoice_date_due',
            'payment_state',
            'amount_total',
            'amount_residual'
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

        return NextResponse.json({
            success: true,
            invoices: invoices || []
        });

    } catch (error: unknown) {
        console.error("❌ Get Client Invoices Error:");
        console.error(error);
        // Return success:false but with a 200 OK so the client doesn't throw a network error
        // and handles the empty list gracefully.
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Internal Server Error', invoices: [] }, { status: 200 });
    }
}
