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

        let ownerId: number | null = null;
        let ownerName = '';
        let partnerId: number | null = null;
        let clientName = 'Unknown';
        let totalInstallments = 72;
        let separationAmount: number | null = null;
        let orderDate: string | null = null;
        let orderId: number | null = null;

        if (orders && orders.length > 0) {
            const order = orders[0];
            // user_id is [id, name]
            ownerId = order.user_id ? order.user_id[0] : null;
            ownerName = order.user_id ? order.user_id[1] : 'Unknown';
            partnerId = order.partner_id ? order.partner_id[0] : null;
            clientName = order.partner_id ? order.partner_id[1] : 'Unknown';
            // Parse custom field, default to 72 if missing or 0
            totalInstallments = order.x_plazo_meses ? parseInt(order.x_plazo_meses) : 72;
            separationAmount = order.x_separacion ? parseFloat(order.x_separacion) : null;
            orderDate = order.date_order;
            orderId = order.id;
        } else {
            // Lote vendido SIN orden de venta confirmada (la orden se borró, o el contrato se cargó
            // a mano): el contrato vigente/finalizado identifica al cliente cuyas facturas hay que
            // mostrar. Sin esto la ficha no pedía las facturas y no aparecían los pagos.
            // No hay vendedor ni orden: ownerId queda en null, así que ningún botón de dueño-de-reserva
            // (vender/devolver) se habilita.
            const contratos = await fetchOdoo(
                'simple.contract',
                'search_read',
                [[['product_id', '=', effectiveProductId], ['state', 'in', ['confirmed', 'closed']]]],
                { fields: ['partner_id', 'total_quotas'], limit: 1, order: 'id desc' }
            );
            if (!contratos || contratos.length === 0 || !contratos[0].partner_id) {
                return NextResponse.json({ success: true, ownerId: null });
            }
            partnerId = contratos[0].partner_id[0];
            clientName = contratos[0].partner_id[1];
            totalInstallments = contratos[0].total_quotas || 72;
        }

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
            ownerId, // Salesperson User ID (null si el lote no tiene orden: solo contrato)
            ownerName,
            partnerId,
            clientName,
            clientPhone,
            clientEmail,
            clientDni,
            totalInstallments,
            orderDate,
            orderId, // Actual Sale Order ID (null si el lote no tiene orden)
            separationAmount // Saved separation amount
        });

    } catch (error: unknown) {
        console.error("❌ Get Reservation Owner Error:", error);
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
    }
}
