import { NextRequest, NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';
import { requireStaffSession } from '@/app/lib/staffAuth';

/**
 * Parser del código de lote Terra Lima: E01MZD148P
 * Extrae etapa, manzana, número de lote y sufijo.
 */
function parseLotCode(code: string | false | null | undefined) {
    if (!code || typeof code !== 'string') return null;
    const m = code.trim().match(/^E(\d+)MZ([A-Z]+)(\d+)([A-Z0-9]+)$/i);
    if (!m) return null;
    return {
        etapa: `E${m[1].padStart(2, '0')}`,   // 'E01'
        manzana: m[2].toUpperCase(),             // 'D'
        lotNum: m[3],                             // '148'
        suffix: m[4].toUpperCase(),               // 'P', '1', '2'
        isDivided: m[4] !== 'P'                   // true si el lote está dividido
    };
}

/**
 * Parser de referencia de factura: CONTRATOMANUAL-E01MZD148P-C013 / INIT
 * Devuelve el número de cuota o 'INICIAL'.
 */
function parseCuotaRef(ref: string | false | null | undefined): { label: string; num: number | null; isInitial: boolean } {
    if (!ref || typeof ref !== 'string') return { label: '', num: null, isInitial: false };
    if (/[-_]INIT(\b|$|-)/i.test(ref)) return { label: 'Cuota Inicial', num: 0, isInitial: true };
    const m = ref.match(/[-_]C(\d+)(?:\b|$|-)/i);
    if (m) { const n = parseInt(m[1], 10); return { label: `Cuota N° ${n}`, num: n, isInitial: false }; }
    return { label: '', num: null, isInitial: false };
}

interface OdooInvoice {
    id: number;
    name: string;
    amount_total: number;
    amount_residual: number;
    invoice_date: string;
    partner_id: [number, string] | false;
    invoice_line_ids: number[];
}

interface OdooInvoiceLine {
    id: number;
    product_id: [number, string] | false;
    price_total: number;
    move_id: [number, string];
}

interface OdooProduct {
    id: number;
    default_code: string | false;
    x_mz: string | false;
}

export async function GET(request: NextRequest) {
    const auth = await requireStaffSession(request);
    if (auth.response) return auth.response;

    try {
        // Antes se confiaba en los headers 'x-user-id'/'x-is-system' (enviados
        // por el propio cliente, sin firma): ahora se usa la cookie de sesión
        // firmada del servidor.
        const userId = auth.session.odooUid;
        const isSystem = auth.session.isSystem;

        if (!userId || !isSystem) {
            return NextResponse.json({ success: false, error: "No autorizado. Este reporte es exclusivo para administradores." }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        const domain: any[] = [
            ["move_type", "=", "out_invoice"],
            ["state", "=", "posted"],
            ["payment_state", "in", ["paid", "in_payment"]]
        ];

        if (startDate) domain.push(["invoice_date", ">=", startDate]);
        if (endDate) domain.push(["invoice_date", "<=", endDate]);

        // 1. Fetch all paid or partially paid posted invoices
        const invoices = await fetchOdoo(
            "account.move",
            "search_read",
            [domain],
            {
                fields: ["id", "name", "amount_total", "amount_residual", "invoice_date", "partner_id", "invoice_line_ids"]
            }
        ) as OdooInvoice[];

        if (!invoices || !Array.isArray(invoices) || invoices.length === 0) {
            return NextResponse.json({ success: true, data: { totalCollected: 0, blocks: [], recentPayments: [] } });
        }

        // Collect all line IDs
        const allLineIds = invoices.flatMap(inv => inv.invoice_line_ids || []);

        // 2. Fetch Invoice Lines to get Products
        const lines = await fetchOdoo(
            "account.move.line",
            "search_read",
            [[["id", "in", allLineIds]]],
            {
                fields: ["id", "product_id", "price_total", "move_id"]
            }
        ) as OdooInvoiceLine[];

        // Extract unique product IDs
        const productIds = new Set<number>();
        lines.forEach(line => {
            if (line.product_id) {
                productIds.add(line.product_id[0]);
            }
        });

        // 3. Fetch Products (Lots) to get Manzana
        const products = await fetchOdoo(
            "product.product",
            "search_read",
            [[["id", "in", Array.from(productIds)]]],
            {
                fields: ["id", "default_code", "x_mz"]
            }
        ) as OdooProduct[];

        const productMap: Record<number, OdooProduct> = {};
        products.forEach(p => productMap[p.id] = p);

        // Calculate
        let totalCollected = 0;
        const mzMap: Record<string, { totalAmount: number; invoicesCount: number; lots: Set<string>; etapa: string }> = {};

        const recentPayments: {
            invoice: string; cuotaLabel: string; date: string; client: string;
            lot: string; etapa: string; mz: string; paidAmount: number;
        }[] = [];

        for (const inv of invoices) {
            // Monto realmente pagado (Total - Saldo pendiente)
            const paidAmount = inv.amount_total - (inv.amount_residual || 0);
            if (paidAmount <= 0) continue;

            totalCollected += paidAmount;

            // Buscar el lote principal de esta factura (primera línea con código de 10 chars)
            const invLines = lines.filter(l => l.move_id && l.move_id[0] === inv.id);
            let primaryLot: OdooProduct | null = null;
            
            for (const line of invLines) {
                if (line.product_id) {
                    const prod = productMap[line.product_id[0]];
                    if (prod && prod.default_code && prod.default_code.trim().length === 10) {
                        primaryLot = prod;
                        break;
                    }
                }
            }

            // Parsear código del lote para extraer etapa y manzana exactas
            const lotParsed = parseLotCode(primaryLot?.default_code);
            const mz = lotParsed?.manzana
                || (primaryLot?.x_mz ? String(primaryLot.x_mz).trim() : null)
                || 'S/M';
            const etapa = lotParsed?.etapa || 'S/E';
            const lotCode = primaryLot?.default_code || 'S/N';

            // Parsear la referencia de la factura para etiqueta de cuota
            const cuota = parseCuotaRef((inv as OdooInvoice & { ref?: string }).ref || inv.name);
            const cuotaLabel = cuota.label || inv.name;

            // Agrupar por manzana
            if (!mzMap[mz]) {
                mzMap[mz] = { totalAmount: 0, invoicesCount: 0, lots: new Set(), etapa };
            }
            mzMap[mz].totalAmount += paidAmount;
            mzMap[mz].invoicesCount++;
            if (lotCode !== 'S/N') mzMap[mz].lots.add(lotCode);

            recentPayments.push({
                invoice: inv.name,
                cuotaLabel,
                date: inv.invoice_date,
                client: inv.partner_id ? inv.partner_id[1] : 'Desconocido',
                lot: lotCode,
                etapa,
                mz,
                paidAmount
            });
        }

        const blocks = Object.entries(mzMap)
            .map(([mz, stats]) => ({
                mz,
                etapa: stats.etapa,
                totalAmount: stats.totalAmount,
                invoicesCount: stats.invoicesCount,
                uniqueLotsCount: stats.lots.size
            }))
            .sort((a, b) => a.mz.localeCompare(b.mz)); // Orden alfabético por manzana

        // Ordenar pagos: más recientes primero
        recentPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        let dateRangeLabel = undefined;
        if (startDate || endDate) {
            dateRangeLabel = `${startDate || 'Inicio'} al ${endDate || 'Hoy'}`;
        }

        return NextResponse.json({
            success: true,
            data: {
                totalCollected,
                blocks,
                recentPayments,
                dateRangeLabel
            }
        });

    } catch (error: unknown) {
        console.error("API Invoices Stats Error:", error);
        return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 });
    }
}
