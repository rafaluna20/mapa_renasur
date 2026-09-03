import { NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';
import { requireStaffSession } from '@/app/lib/staffAuth';

/**
 * Get the salesperson (user_id) who holds the reservation for a lot
 */
export async function POST(request: Request) {
    const auth = await requireStaffSession(request);
    if (auth.response) return auth.response;

    try {
        const { defaultCode, productId } = await request.json();

        if (!defaultCode && !productId) {
            return NextResponse.json({ success: false, error: 'Missing identifier' }, { status: 400 });
        }

        console.log(`🔍 Finding reservation owner for: ${defaultCode || productId}`);

        // If we only have defaultCode, get Product ID first
        let effectiveProductId = productId;
        if (!effectiveProductId && defaultCode) {
            const products = await fetchOdoo(
                'product.product',
                'search_read',
                [[['default_code', '=', defaultCode]]],
                { fields: ['id'], limit: 1 }
            );
            if (products && products.length > 0) {
                effectiveProductId = products[0].id;
            }
        }

        if (!effectiveProductId) {
            return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
        }

        // Search for Confirmed Orders (state = 'sale') for this product
        const orders = await fetchOdoo(
            'sale.order',
            'search_read',
            [[
                ['state', '=', 'sale'], // Only confirmed sales (Reservations)
                ['order_line.product_id', '=', effectiveProductId]
            ]],
            {
                fields: ['user_id', 'partner_id', 'date_order', 'x_plazo_meses', 'x_separacion'],
                limit: 1,
                order: 'date_order desc' // Latest one
            }
        );

        if (!orders || orders.length === 0) {
            return NextResponse.json({ success: true, ownerId: null });
        }

        const order = orders[0];
        // user_id is [id, name]
        const ownerId = order.user_id ? order.user_id[0] : null;
        const ownerName = order.user_id ? order.user_id[1] : 'Unknown';
        const partnerId = order.partner_id ? order.partner_id[0] : null;
        const clientName = order.partner_id ? order.partner_id[1] : 'Unknown';
        // Parse custom field, default to 72 if missing or 0
        const totalInstallments = order.x_plazo_meses ? parseInt(order.x_plazo_meses) : 72;
        const separationAmount = order.x_separacion ? parseFloat(order.x_separacion) : null;

        // Teléfono del cliente (para el recordatorio de pago por WhatsApp) —
        // se prefiere mobile sobre phone porque es el que normalmente tiene
        // WhatsApp activo. Email/DNI se suman acá (mismo fetch) para el
        // botón "Descargar Estado de Cuenta" del modal de lote.
        let clientPhone: string | null = null;
        let clientEmail: string | null = null;
        let clientDni: string | null = null;
        if (partnerId) {
            const partners = await fetchOdoo(
                'res.partner',
                'read',
                [[partnerId]],
                { fields: ['phone', 'mobile', 'email', 'vat'] }
            );
            const partner = partners && partners[0];
            clientPhone = (partner?.mobile || partner?.phone || null) as string | null;
            clientEmail = (partner?.email || null) as string | null;
            clientDni = (partner?.vat || null) as string | null;
        }

        return NextResponse.json({
            success: true,
            ownerId, // Salesperson User ID
            ownerName,
            partnerId,
            clientName,
            clientPhone,
            clientEmail,
            clientDni,
            totalInstallments,
            orderDate: order.date_order,
            orderId: order.id, // Actual Sale Order ID
            separationAmount // Saved separation amount
        });

    } catch (error: unknown) {
        console.error("❌ Get Reservation Owner Error:", error);
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
    }
}
