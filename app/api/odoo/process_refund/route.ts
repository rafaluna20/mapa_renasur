import { NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';

/**
 * EXPERT REFUND LOGIC (Odoo 18 Community):
 * 
 * Case A — Order WITH posted invoice:
 *   → Create credit note + Cancel order only (keep record for accounting audit trail)
 *   Reason: The credit note references the invoice. Deleting the order would
 *   orphan the credit note and break accounting reconciliation.
 *
 * Case B — Order WITHOUT posted invoice:
 *   → Cancel order + DELETE it (unlink)
 *   Reason: No accounting record exists. Keeping a cancelled order with no
 *   financial trace pollutes the database with no benefit.
 */
export async function POST(request: Request) {
    try {
        const { orderId, refundAmount, reason } = await request.json();

        if (!orderId || !reason) {
            return NextResponse.json(
                { success: false, error: 'Missing orderId or reason' },
                { status: 400 }
            );
        }

        // ─── Step 1: Read the order ───────────────────────────────────────────
        const orders = await fetchOdoo(
            'sale.order',
            'search_read',
            [[['id', '=', orderId]]],
            { fields: ['id', 'name', 'state', 'partner_id', 'amount_total', 'invoice_ids', 'picking_ids'], limit: 1 }
        );

        if (!orders || orders.length === 0) {
            return NextResponse.json(
                { success: false, error: `Sale order ${orderId} not found` },
                { status: 404 }
            );
        }

        const order = orders[0];
        const invoiceIds = (order.invoice_ids as number[]) || [];
        const pickingIds = (order.picking_ids as number[]) || [];

        // Pre-fetch the product ID before any potential order deletion occurs
        let productId: number | null = null;
        try {
            const lines = await fetchOdoo(
                'sale.order.line', 'search_read',
                [[['order_id', '=', orderId]]],
                { fields: ['product_id'], limit: 1 }
            );
            if (Array.isArray(lines) && lines.length > 0) {
                productId = Array.isArray(lines[0].product_id)
                    ? (lines[0].product_id as unknown[])[0] as number
                    : lines[0].product_id as number;
                console.log(`ℹ️ Pre-fetched Product ID: ${productId} from order lines`);
            }
        } catch (err) {
            console.warn("Could not pre-fetch product_id from order lines:", err);
        }

        let action: string;
        let creditNoteId: number | null = null;
        let orderDeleted = false;

        // ─── Step 2: Cancel any pending stock pickings ────────────────────────
        // (Real estate lots usually have no pickings, but handle gracefully)
        if (pickingIds.length > 0) {
            try {
                await fetchOdoo('stock.picking', 'action_cancel', [pickingIds]);
                console.log(`✅ Cancelled ${pickingIds.length} picking(s) for order ${orderId}`);
            } catch (pickErr) {
                console.warn('⚠️ Could not cancel pickings (may already be done):', pickErr);
            }
        }

        // ─── Step 3: Handle based on invoice state ────────────────────────────
        const hasPostedInvoice = invoiceIds.length > 0 && await checkPostedInvoice(invoiceIds);

        if (hasPostedInvoice) {
            // ── CASE A: Has posted invoice → Credit note + Cancel only ──────
            console.log(`📋 Order ${orderId} has posted invoice → creating credit note, keeping order record`);

            const postedInvoice = await getPostedInvoice(invoiceIds);
            if (postedInvoice) {
                // Create credit note
                const reversalId = await fetchOdoo(
                    'account.move.reversal',
                    'create',
                    [{
                        move_ids: [[4, postedInvoice.id]],
                        date: new Date().toISOString().split('T')[0],
                        reason: reason,
                        refund_method: 'refund',
                    }]
                );
                await fetchOdoo('account.move.reversal', 'reverse_moves', [[reversalId]]);
                creditNoteId = reversalId;
                console.log(`✅ Credit note created (reversal wizard ID: ${reversalId})`);
            }

            // Cancel the order (keep record for accounting integrity)
            await cancelOrder(orderId);
            action = 'credit_note_created_order_cancelled';
            orderDeleted = false;

        } else {
            // ── CASE B: No posted invoice → Cancel + DELETE ──────────────────
            console.log(`🗑️ Order ${orderId} has no posted invoice → cancel + delete`);

            // Cancel first (required before unlink in Odoo)
            await cancelOrder(orderId);

            // Now delete permanently
            try {
                await fetchOdoo('sale.order', 'unlink', [[orderId]]);
                orderDeleted = true;
                action = 'order_cancelled_and_deleted';
                console.log(`✅ Order ${orderId} permanently deleted from Odoo`);
            } catch (unlinkErr) {
                // unlink can fail if Odoo still has internal references
                console.warn('⚠️ Could not delete order (keeping as cancelled):', unlinkErr);
                action = 'order_cancelled_only';
                orderDeleted = false;
            }
        }

        // ─── Step 4: Find remaining active quotes for this lot ────────────────
        const newLotStatus = await getRemainingLotStatus(productId, orderId);

        return NextResponse.json({
            success: true,
            action,
            creditNoteId,
            orderDeleted,
            orderName: order.name,
            refundAmount: refundAmount ?? order.amount_total,
            newLotStatus,
        });

    } catch (error: unknown) {
        console.error('Process Refund API Error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Internal Server Error' },
            { status: 500 }
        );
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function checkPostedInvoice(invoiceIds: number[]): Promise<boolean> {
    const invoices = await fetchOdoo(
        'account.move',
        'search_read',
        [[['id', 'in', invoiceIds], ['state', '=', 'posted'], ['move_type', '=', 'out_invoice']]],
        { fields: ['id'], limit: 1 }
    );
    return Array.isArray(invoices) && invoices.length > 0;
}

async function getPostedInvoice(invoiceIds: number[]): Promise<{ id: number; amount_total: number } | null> {
    const invoices = await fetchOdoo(
        'account.move',
        'search_read',
        [[['id', 'in', invoiceIds], ['state', '=', 'posted'], ['move_type', '=', 'out_invoice']]],
        { fields: ['id', 'amount_total'], limit: 1 }
    );
    if (!Array.isArray(invoices) || invoices.length === 0) return null;
    return invoices[0] as { id: number; amount_total: number };
}

async function cancelOrder(orderId: number): Promise<void> {
    try {
        const result = await fetchOdoo('sale.order', 'action_cancel', [[orderId]]);

        // action_cancel sometimes returns a wizard dict instead of True
        // If it returns a dict, the cancel was initiated via wizard — verify state manually
        if (result && typeof result === 'object' && !Array.isArray(result)) {
            console.log('⚠️ action_cancel returned a wizard dict. Verifying order state...');
            const check = await fetchOdoo(
                'sale.order', 'search_read',
                [[['id', '=', orderId]]],
                { fields: ['state'], limit: 1 }
            );
            if (Array.isArray(check) && check.length > 0 && check[0].state !== 'cancel') {
                // Force the state via write as last resort
                await fetchOdoo('sale.order', 'write', [[orderId], { state: 'cancel' }]);
                console.log(`⚡ Force-wrote state=cancel for order ${orderId}`);
            }
        }
        console.log(`✅ Order ${orderId} is now cancelled`);
    } catch (err) {
        // Final fallback: force write
        console.warn('action_cancel threw error, attempting force write:', err);
        await fetchOdoo('sale.order', 'write', [[orderId], { state: 'cancel' }]);
    }
}

async function getRemainingLotStatus(productId: number | null, excludeOrderId: number): Promise<string> {
    if (!productId) {
        console.warn("getRemainingLotStatus: No product ID provided, defaulting status to 'libre'");
        return 'libre';
    }
    try {
        // Search for all sale.order.lines with this product
        const allLines = await fetchOdoo(
            'sale.order.line', 'search_read',
            [[['product_id', '=', productId]]],
            { fields: ['order_id'] }
        );

        if (!Array.isArray(allLines) || allLines.length === 0) return 'libre';

        // Extract and filter order IDs
        const orderIds = allLines
            .map(line => Array.isArray(line.order_id) ? line.order_id[0] : line.order_id)
            .filter((id): id is number => typeof id === 'number' && id !== excludeOrderId);

        if (orderIds.length === 0) return 'libre';

        // Search for active/draft quotes among those orders
        const remaining = await fetchOdoo(
            'sale.order', 'search_read',
            [[['id', 'in', orderIds], ['state', '=', 'draft']]],
            { fields: ['id'], limit: 5 }
        );

        const count = Array.isArray(remaining) ? remaining.length : 0;
        console.log(`ℹ️ ${count} active quote(s) remain for product ${productId} → lot status: ${count > 0 ? 'cotizacion' : 'libre'}`);
        return count > 0 ? 'cotizacion' : 'libre';
    } catch (err) {
        console.error("Error in getRemainingLotStatus:", err);
        return 'libre';
    }
}
