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
    invoice_date_due?: string;
    partner_id: [number, string] | false;
    invoice_line_ids: number[];
}

const AGING_BUCKETS = ['0-30', '31-60', '61-90', '90+'] as const;
type AgingBucket = typeof AGING_BUCKETS[number];

function bucketFor(daysOverdue: number): AgingBucket {
    if (daysOverdue > 90) return '90+';
    if (daysOverdue > 60) return '61-90';
    if (daysOverdue > 30) return '31-60';
    return '0-30';
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

/**
 * Antigüedad de saldos VENCIDOS (facturas no pagadas cuya fecha de
 * vencimiento ya pasó) — foto "a hoy", intencionalmente independiente del
 * rango de fechas del reporte (ese rango es sobre facturas YA cobradas, un
 * concepto distinto: la antigüedad de deuda siempre se mide contra la
 * fecha actual, no contra un período pasado). Antes este reporte de
 * "Recaudación" solo mostraba dinero ya cobrado, sin ninguna visibilidad
 * de lo que sigue pendiente/vencido. Se computa en una función aparte y se
 * llama ANTES del early-return de "no hay facturas pagadas" — si no,
 * un período sin cobros pero con deuda vencida real habría devuelto la
 * antigüedad vacía igual.
 */
async function computeOverdueAging() {
    const todayStr = new Date().toISOString().slice(0, 10);
    const overdueInvoices = await fetchOdoo(
        "account.move",
        "search_read",
        [[
            ["move_type", "=", "out_invoice"],
            ["state", "=", "posted"],
            ["payment_state", "in", ["not_paid", "partial"]],
            ["invoice_date_due", "<", todayStr]
        ]],
        { fields: ["id", "name", "amount_total", "amount_residual", "invoice_date_due", "partner_id", "invoice_line_ids"] }
    ) as OdooInvoice[];

    const agingMap: Record<AgingBucket, { totalAmount: number; invoicesCount: number }> = {
        '0-30': { totalAmount: 0, invoicesCount: 0 },
        '31-60': { totalAmount: 0, invoicesCount: 0 },
        '61-90': { totalAmount: 0, invoicesCount: 0 },
        '90+': { totalAmount: 0, invoicesCount: 0 },
    };
    const overdueDetail: { invoice: string; client: string; lot: string; daysOverdue: number; amountDue: number }[] = [];
    let totalOverdue = 0;

    if (overdueInvoices.length > 0) {
        const todayMs = Date.now();
        const overdueLineIds = overdueInvoices.flatMap(inv => inv.invoice_line_ids || []);
        const overdueLines = overdueLineIds.length > 0
            ? await fetchOdoo(
                "account.move.line",
                "search_read",
                [[["id", "in", overdueLineIds]]],
                { fields: ["id", "product_id", "price_total", "move_id"] }
            ) as OdooInvoiceLine[]
            : [];
        const overdueProductIds = new Set<number>();
        overdueLines.forEach(l => { if (l.product_id) overdueProductIds.add(l.product_id[0]); });
        const overdueProducts = overdueProductIds.size > 0
            ? await fetchOdoo(
                "product.product",
                "search_read",
                [[["id", "in", Array.from(overdueProductIds)]]],
                { fields: ["id", "default_code", "x_mz"] }
            ) as OdooProduct[]
            : [];
        const overdueProductMap: Record<number, OdooProduct> = {};
        overdueProducts.forEach(p => overdueProductMap[p.id] = p);

        for (const inv of overdueInvoices) {
            const amountDue = inv.amount_residual || 0;
            if (amountDue <= 0) continue;

            const dueDateMs = inv.invoice_date_due ? new Date(inv.invoice_date_due).getTime() : todayMs;
            const daysOverdue = Math.max(0, Math.floor((todayMs - dueDateMs) / 86400000));
            const bucket = bucketFor(daysOverdue);

            agingMap[bucket].totalAmount += amountDue;
            agingMap[bucket].invoicesCount++;
            totalOverdue += amountDue;

            const invLines = overdueLines.filter(l => l.move_id && l.move_id[0] === inv.id);
            let primaryLot: OdooProduct | null = null;
            for (const line of invLines) {
                if (line.product_id) {
                    const prod = overdueProductMap[line.product_id[0]];
                    if (prod && prod.default_code && prod.default_code.trim().length === 10) {
                        primaryLot = prod;
                        break;
                    }
                }
            }

            overdueDetail.push({
                invoice: inv.name,
                client: inv.partner_id ? inv.partner_id[1] : 'Desconocido',
                lot: primaryLot?.default_code || 'S/N',
                daysOverdue,
                amountDue,
            });
        }
    }

    // Los más urgentes primero (más días vencidos)
    overdueDetail.sort((a, b) => b.daysOverdue - a.daysOverdue);

    const aging = AGING_BUCKETS.map((bucket) => ({
        bucket,
        totalAmount: agingMap[bucket].totalAmount,
        invoicesCount: agingMap[bucket].invoicesCount,
    }));

    return { totalOverdue, aging, overdueDetail: overdueDetail.slice(0, 15) };
}

function pctChange(curr: number, prev: number): number {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
}
function trendOf(change: number): 'up' | 'down' | 'stable' {
    return change > 0 ? 'up' : change < 0 ? 'down' : 'stable';
}

/**
 * Totales de recaudación del período anterior de igual duración, para
 * comparar contra el período actual (mismo patrón ya usado en
 * stats/general y stats/detailed). Se llama ANTES del early-return de
 * "sin facturas pagadas" para que un período sin cobros pero con un
 * período anterior real igual pueda mostrar la caída del 100%.
 * Devuelve null cuando no hay `startDate` explícito: sin él, el rango
 * es "todo el histórico" y no existe una duración de período coherente
 * contra la cual comparar.
 */
async function computePreviousPeriodTotals(startDate: string | null, endDate: string | null) {
    if (!startDate) return null;

    const effectiveEndStr = endDate || new Date().toISOString().slice(0, 10);
    const startD = new Date(startDate + 'T00:00:00Z');
    const endD = new Date(effectiveEndStr + 'T00:00:00Z');
    const periodMs = endD.getTime() - startD.getTime();
    const prevEndD = new Date(startD.getTime() - 86400000);
    const prevStartD = new Date(prevEndD.getTime() - periodMs);
    const toDateStr = (d: Date) => d.toISOString().slice(0, 10);

    const prevAgg = await fetchOdoo(
        "account.move",
        "read_group",
        [[
            ["move_type", "=", "out_invoice"],
            ["state", "=", "posted"],
            ["payment_state", "in", ["paid", "in_payment"]],
            ["invoice_date", ">=", toDateStr(prevStartD)],
            ["invoice_date", "<=", toDateStr(prevEndD)]
        ]],
        { fields: ["amount_total", "amount_residual"], groupby: [] }
    ) as { __count?: number; amount_total?: number; amount_residual?: number }[];

    return {
        prevTotalCollected: (prevAgg[0]?.amount_total || 0) - (prevAgg[0]?.amount_residual || 0),
        prevInvoicesCount: prevAgg[0]?.__count || 0,
    };
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

        // Antigüedad de vencidos: independiente del filtro de fecha y del
        // resultado de facturas pagadas — se calcula antes del early-return
        // de abajo para no perderla si el período no tiene cobros.
        const overdueData = await computeOverdueAging();
        const prevPeriodTotals = await computePreviousPeriodTotals(startDate, endDate);

        const buildComparison = (currentTotalCollected: number, currentInvoicesCount: number) => {
            if (!prevPeriodTotals) return undefined;
            const totalCollectedChange = pctChange(currentTotalCollected, prevPeriodTotals.prevTotalCollected);
            const invoicesCountChange = pctChange(currentInvoicesCount, prevPeriodTotals.prevInvoicesCount);
            return {
                totalCollected: { value: currentTotalCollected, change: totalCollectedChange, trend: trendOf(totalCollectedChange) },
                invoicesCount: { value: currentInvoicesCount, change: invoicesCountChange, trend: trendOf(invoicesCountChange) },
            };
        };

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
            return NextResponse.json({
                success: true,
                data: { totalCollected: 0, blocks: [], recentPayments: [], ...overdueData, comparison: buildComparison(0, 0) }
            });
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
                ...overdueData,
                dateRangeLabel,
                comparison: buildComparison(totalCollected, recentPayments.length)
            }
        });

    } catch (error: unknown) {
        console.error("API Invoices Stats Error:", error);
        return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 });
    }
}
