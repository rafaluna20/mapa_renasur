import { NextRequest, NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';
import { requireStaffSession } from '@/app/lib/staffAuth';

interface OdooOrder {
    id: number;
    name: string;
    state: string;
    partner_id: [number, string] | false;
    user_id: [number, string] | false;
    create_date?: string;
    date_order?: string;
    amount_total?: number;
    order_line?: number[];
}

interface QuoteInfo {
    client: string;
    advisor: string;
    hours: number;
}

interface ProductDraftInfo {
    name: string;
    quotes: QuoteInfo[];
}

interface OdooOrderLine {
    id: number;
    product_id: [number, string] | false;
}

export async function GET(request: NextRequest) {
    const auth = await requireStaffSession(request);
    if (auth.response) return auth.response;

    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const reqStartDate = searchParams.get('startDate');
        const reqEndDate = searchParams.get('endDate');

        if (!userId) {
            return NextResponse.json({ success: false, error: "Missing userId parameter" }, { status: 400 });
        }

        const uid = parseInt(userId);
        if (isNaN(uid)) {
            return NextResponse.json({ success: false, error: "Invalid userId parameter" }, { status: 400 });
        }

        console.log(`[API Detailed Stats] Querying Odoo for user ID: ${uid} (Range: ${reqStartDate || 'YTD'} to ${reqEndDate || 'YTD'})`);

        // 1. DYNAMIC KPIs
        // A. Active draft quotes count (state = 'draft')
        const draftDomain: any[] = [
            ["user_id", "=", uid],
            ["state", "=", "draft"]
        ];
        if (reqStartDate && reqEndDate) {
            draftDomain.push(["date_order", ">=", `${reqStartDate} 00:00:00`]);
            draftDomain.push(["date_order", "<=", `${reqEndDate} 23:59:59`]);
        }

        // B. Total sales amount (confirmed/done) — filtrado dinámicamente o al año actual para
        //    que coincida con el gráfico de tendencia y el % de meta mensual sea coherente
        const currentYearForKpi = new Date().getFullYear();
        const kpiStartDate = reqStartDate ? `${reqStartDate} 00:00:00` : `${currentYearForKpi}-01-01 00:00:00`;
        const kpiEndDate   = reqEndDate ? `${reqEndDate} 23:59:59` : `${currentYearForKpi}-12-31 23:59:59`;

        const totalSalesData = await fetchOdoo(
            "sale.order",
            "read_group",
            [[
                ["user_id", "=", uid],
                ["state", "in", ["sale", "done"]],
                ["date_order", ">=", kpiStartDate],
                ["date_order", "<=", kpiEndDate]
            ]],
            {
                fields: ["amount_total"],
                groupby: ["user_id"]
            }
        ) as { amount_total?: number }[];

        let totalValue = 0;
        if (totalSalesData && totalSalesData.length > 0) {
            totalValue = totalSalesData[0].amount_total || 0;
        }

        const salesCountThisPeriod = await fetchOdoo(
            "sale.order",
            "search_count",
            [[
                ["user_id", "=", uid],
                ["state", "in", ["sale", "done"]],
                ["date_order", ">=", kpiStartDate],
                ["date_order", "<=", kpiEndDate]
            ]]
        ) as number;

        // C. Calculate dynamic commission (6% dynamic real estate fee)
        const commission = totalValue * 0.06;

        // D. Monthly goal — configurable via env var, fallback a S/200,000
        const monthlyGoal = parseInt(process.env.SALES_MONTHLY_GOAL || '200000', 10);

        // E. Pipeline & tasa de conversión, calculados desde sale.order (draft
        // = pipeline abierto) — NO desde crm.lead. Verificado directamente
        // contra producción: el modelo crm.lead NO EXISTE en este Odoo (el
        // módulo CRM nunca se instaló), así que el bloque try/catch anterior
        // caía SIEMPRE al catch y mostraba una estimación fija (45% de
        // conversión, cantidad de borradores × S/85,000 de pipeline) en vez
        // de datos reales — nunca el valor real de las cotizaciones abiertas.
        const draftAgg = await fetchOdoo(
            "sale.order",
            "read_group",
            [draftDomain],
            { fields: ["amount_total"], groupby: [] }
        ) as { __count?: number; amount_total?: number }[];
        const draftCount = draftAgg[0]?.__count || 0;
        const pipelineValue = draftAgg[0]?.amount_total || 0;

        // Tasa de conversión real: ventas confirmadas vs. TODAS las órdenes
        // creadas en el período (draft + sale/done + cancel), usando
        // create_date — a diferencia de date_order, los borradores casi
        // nunca lo tienen todavía.
        const allOrdersCreatedCount = await fetchOdoo(
            "sale.order",
            "search_count",
            [[
                ["user_id", "=", uid],
                ["create_date", ">=", kpiStartDate],
                ["create_date", "<=", kpiEndDate]
            ]]
        ) as number;

        const conversionRate = allOrdersCreatedCount > 0
            ? Math.round((salesCountThisPeriod / allOrdersCreatedCount) * 100)
            : 0;

        // F. Comparación real contra el período anterior de igual duración
        // (antes esto era un +15%/+12%/+8% fijo armado en el frontend, sin
        // calcular nada real).
        const periodMs = new Date(kpiEndDate).getTime() - new Date(kpiStartDate).getTime();
        const prevEndDate = new Date(new Date(kpiStartDate).getTime() - 1000);
        const prevStartDate = new Date(prevEndDate.getTime() - periodMs);
        const prevStartStr = prevStartDate.toISOString().slice(0, 19).replace('T', ' ');
        const prevEndStr = prevEndDate.toISOString().slice(0, 19).replace('T', ' ');

        const prevSalesData = await fetchOdoo(
            "sale.order",
            "read_group",
            [[
                ["user_id", "=", uid],
                ["state", "in", ["sale", "done"]],
                ["date_order", ">=", prevStartStr],
                ["date_order", "<=", prevEndStr]
            ]],
            { fields: ["amount_total"], groupby: ["user_id"] }
        ) as { amount_total?: number }[];
        const prevTotalValue = prevSalesData[0]?.amount_total || 0;
        const prevCommission = prevTotalValue * 0.06;

        const prevSalesCount = await fetchOdoo(
            "sale.order",
            "search_count",
            [[
                ["user_id", "=", uid],
                ["state", "in", ["sale", "done"]],
                ["date_order", ">=", prevStartStr],
                ["date_order", "<=", prevEndStr]
            ]]
        ) as number;

        const pctChange = (curr: number, prev: number): number => {
            if (prev === 0) return curr > 0 ? 100 : 0;
            return Math.round(((curr - prev) / prev) * 100);
        };
        const trendOf = (change: number): 'up' | 'down' | 'stable' =>
            change > 0 ? 'up' : change < 0 ? 'down' : 'stable';

        const totalSalesChange = pctChange(totalValue, prevTotalValue);
        const commissionChange = pctChange(commission, prevCommission);
        const salesCountChange = pctChange(salesCountThisPeriod, prevSalesCount);

        // 2. DYNAMIC SALES TREND (Last 12 Months or dynamic range)
        const currentYear = new Date().getFullYear();
        const startDate = reqStartDate ? `${reqStartDate} 00:00:00` : `${currentYear}-01-01 00:00:00`;
        const endDate = reqEndDate ? `${reqEndDate} 23:59:59` : `${currentYear}-12-31 23:59:59`;

        const ordersThisYear = await fetchOdoo(
            "sale.order",
            "search_read",
            [[
                ["user_id", "=", uid],
                ["state", "in", ["sale", "done"]],
                ["date_order", ">=", startDate],
                ["date_order", "<=", endDate]
            ]],
            {
                fields: ["date_order", "amount_total"]
            }
        ) as OdooOrder[];

        // Generar dinámicamente los meses comprendidos entre startDate y endDate
        const start = new Date(startDate.split(' ')[0]);
        const end = new Date(endDate.split(' ')[0]);
        const monthsAbbr = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const salesTrend: { name: string; ventas: number; meta: number; comision: number; year: number; month: number }[] = [];

        let current = new Date(start.getFullYear(), start.getMonth(), 1);
        while (current <= end) {
            const m = current.getMonth();
            const y = current.getFullYear();
            
            // Si el rango de visualización cruza años distintos, añadimos el año abreviado para claridad
            const label = start.getFullYear() === end.getFullYear()
                ? monthsAbbr[m]
                : `${monthsAbbr[m]} ${String(y).slice(-2)}`;
            
            salesTrend.push({
                name: label,
                ventas: 0,
                meta: monthlyGoal,
                comision: 0,
                year: y,
                month: m
            });
            
            current.setMonth(current.getMonth() + 1);
        }

        if (ordersThisYear && Array.isArray(ordersThisYear)) {
            for (const order of ordersThisYear) {
                const dateStr = order.date_order;
                if (dateStr) {
                    const orderDate = new Date(dateStr);
                    const m = orderDate.getMonth();
                    const y = orderDate.getFullYear();
                    
                    const trendPoint = salesTrend.find(p => p.year === y && p.month === m);
                    if (trendPoint) {
                        trendPoint.ventas += (order.amount_total || 0);
                    }
                }
            }
        }

        // Calcular la comisión de forma dinámica para cada punto de tendencia
        for (const point of salesTrend) {
            point.comision = Math.round(point.ventas * 0.06);
        }

        // 3. RECENT ACTIVITY & ASSIGNED LOTS
        // Get the latest 10 orders of any state, filtered by dates if provided
        const recentOrdersDomain: any[] = [
            ["user_id", "=", uid],
            ["state", "in", ["draft", "sent", "sale", "done"]]
        ];
        if (reqStartDate && reqEndDate) {
            recentOrdersDomain.push(["date_order", ">=", `${reqStartDate} 00:00:00`]);
            recentOrdersDomain.push(["date_order", "<=", `${reqEndDate} 23:59:59`]);
        }

        const recentOrders = await fetchOdoo(
            "sale.order",
            "search_read",
            [recentOrdersDomain],
            {
                fields: ["id", "name", "state", "partner_id", "date_order", "amount_total", "order_line"],
                limit: 10,
                order: "date_order desc"
            }
        ) as OdooOrder[];

        // Batch read the product names and statuses from order lines
        const allLineIds = recentOrders.flatMap((order: OdooOrder) => order.order_line || []);
        const lineMap: Record<number, string> = {};
        const lineStatusMap: Record<number, string> = {};

        if (allLineIds.length > 0) {
            const orderLines = await fetchOdoo(
                "sale.order.line",
                "search_read",
                [[["id", "in", allLineIds]]],
                {
                    fields: ["id", "product_id"]
                }
            ) as OdooOrderLine[];

            if (orderLines && Array.isArray(orderLines)) {
                // Extract unique product template/variant IDs
                const productIds = orderLines
                    .map((line) => line.product_id ? line.product_id[0] : null)
                    .filter(Boolean) as number[];

                const productStatusMap: Record<number, string> = {};
                if (productIds.length > 0) {
                    const products = await fetchOdoo(
                        "product.product",
                        "search_read",
                        [[["id", "in", productIds]]],
                        {
                            fields: ["id", "x_statu"]
                        }
                    ) as { id: number; x_statu?: string }[];

                    if (products && Array.isArray(products)) {
                        for (const prod of products) {
                            productStatusMap[prod.id] = prod.x_statu || 'cotizacion';
                        }
                    }
                }

                for (const line of orderLines) {
                    if (line.product_id) {
                        let prodName = line.product_id[1];
                        if (prodName.includes(']')) {
                            prodName = prodName.split(']').pop()?.trim() || prodName;
                        }
                        lineMap[line.id] = prodName;
                        lineStatusMap[line.id] = productStatusMap[line.product_id[0]] || 'cotizacion';
                    }
                }
            }
        }

        // Map recent activity list
        const recentActivity = recentOrders.map((order: OdooOrder) => {
            const firstLineId = order.order_line && order.order_line.length > 0 ? order.order_line[0] : null;
            const lotName = firstLineId ? (lineMap[firstLineId] || "Lote") : "Lote";
            const lotStatus = firstLineId ? (lineStatusMap[firstLineId] || "cotizacion") : "cotizacion";

            let action = "Cotización";
            if (lotStatus === 'reservado') action = "Reserva";
            if (lotStatus === 'vendido') action = "Venta";

            const date = order.date_order ? new Date(order.date_order).toLocaleDateString('es-PE', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            }) : "Reciente";

            return {
                id: order.id,
                action,
                lot: lotName,
                date
            };
        });

        // Map assigned lots list — deduplicado por nombre de lote para evitar
        // que la misma propiedad aparezca múltiples veces cuando hay varias líneas/órdenes
        const seenLotNames = new Set<string>();
        const assignedLots: { lot: string; stage: string; client: string; status: string; price: number }[] = [];

        for (const order of recentOrders) {
            const firstLineId = order.order_line && order.order_line.length > 0 ? order.order_line[0] : null;
            if (!firstLineId) continue;

            const lotName = lineMap[firstLineId] || "Lote";
            if (seenLotNames.has(lotName)) continue; // saltar duplicados
            seenLotNames.add(lotName);

            const lotStatus = lineStatusMap[firstLineId] || "cotizacion";

            let status = "Cotización";
            if (lotStatus === 'reservado') status = "Separado";
            if (lotStatus === 'vendido')   status = "Vendido";
            if (lotStatus === 'disponible') status = "Disponible";

            assignedLots.push({
                lot: lotName,
                stage: "Etapa Activa",
                client: Array.isArray(order.partner_id) ? order.partner_id[1] : "Cliente",
                status,
                price: order.amount_total || 0
            });
        }

        // 4. DYNAMIC HOT CONFLICTED LOTS (Competed Lots)
        // Find all draft orders in Odoo across all advisors
        const draftOrders = await fetchOdoo(
            "sale.order",
            "search_read",
            [[["state", "=", "draft"]]],
            {
                fields: ["id", "name", "partner_id", "user_id", "create_date", "order_line"]
            }
        ) as OdooOrder[];

        const draftLineIds = draftOrders.flatMap((order: OdooOrder) => order.order_line || []);
        const draftLineMap: Record<number, { productId: number; productName: string }> = {};

        if (draftLineIds.length > 0) {
            const lines = await fetchOdoo(
                "sale.order.line",
                "search_read",
                [[["id", "in", draftLineIds]]],
                { fields: ["id", "product_id"] }
            ) as OdooOrderLine[];

            if (lines && Array.isArray(lines)) {
                for (const line of lines) {
                    if (line.product_id) {
                        let prodName = line.product_id[1];
                        if (prodName.includes(']')) {
                            prodName = prodName.split(']').pop()?.trim() || prodName;
                        }
                        draftLineMap[line.id] = {
                            productId: line.product_id[0],
                            productName: prodName
                        };
                    }
                }
            }
        }

        const productDrafts: Record<number, ProductDraftInfo> = {};
        for (const order of draftOrders) {
            for (const lineId of (order.order_line || [])) {
                const productData = draftLineMap[lineId];
                if (productData) {
                    if (!productDrafts[productData.productId]) {
                        productDrafts[productData.productId] = {
                            name: productData.productName,
                            quotes: []
                        };
                    }

                    // Compute relative hours elapsed
                    const created = order.create_date ? new Date(order.create_date) : new Date();
                    const hoursElapsed = Math.max(1, Math.round((new Date().getTime() - created.getTime()) / (1000 * 60 * 60)));

                    productDrafts[productData.productId].quotes.push({
                        client: Array.isArray(order.partner_id) ? order.partner_id[1] : "Cliente",
                        advisor: Array.isArray(order.user_id) ? order.user_id[1] : "Asesor",
                        hours: hoursElapsed
                    });
                }
            }
        }

        // Keep products with > 1 draft quotes
        const competedLots = Object.values(productDrafts)
            .filter((item: ProductDraftInfo) => item.quotes.length > 1)
            .map((item: ProductDraftInfo) => ({
                lot: item.name,
                stage: "Etapa Activa",
                quotes: item.quotes
            }));

        return NextResponse.json({
            success: true,
            stats: {
                kpis: {
                    totalSales: totalValue,
                    monthlyGoal,
                    commission,
                    pendingLeads: draftCount,
                    pipelineValue,
                    conversionRate
                },
                comparison: {
                    totalSales: { value: totalValue, change: totalSalesChange, trend: trendOf(totalSalesChange) },
                    commission: { value: commission, change: commissionChange, trend: trendOf(commissionChange) },
                    salesCount: { value: salesCountThisPeriod, change: salesCountChange, trend: trendOf(salesCountChange) }
                },
                salesTrend,
                recentActivity,
                competedLots,
                assignedLots
            }
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
        console.error("API Detailed Stats Error:", error);
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
}
