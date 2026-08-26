import { NextRequest, NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';
import { requireStaffSession } from '@/app/lib/staffAuth';
import { getCommissionRate } from '@/app/lib/commissionRates';

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

interface OdooProduct {
    id: number;
    x_statu?: string;
    list_price?: number;
    default_code?: string | false;
    x_mz?: string | false;
}

/**
 * Parser del código de lote Terra Lima
 * Formato: E01MZD148P
 *   E01  = Etapa 01
 *   MZ   = Literal
 *   D    = Manzana D
 *   148  = Número de lote
 *   P    = Sufijo (P=entero, 1=parte A, 2=parte B, etc.)
 */
function parseLotCode(code: string | false | null | undefined): { etapa: string; manzana: string; lotNum: string; suffix: string } | null {
    if (!code || typeof code !== 'string') return null;
    const m = code.trim().match(/^E(\d+)MZ([A-Z]+)(\d+)([A-Z0-9]+)$/i);
    if (!m) return null;
    return {
        etapa: m[1].padStart(2, '0'),      // '01'
        manzana: m[2].toUpperCase(),        // 'D'
        lotNum: m[3],                        // '148'
        suffix: m[4].toUpperCase()           // 'P', '1', '2'
    };
}

interface OdooOrderLine {
    id: number;
    product_id: [number, string] | false;
}

export async function GET(request: NextRequest) {
    const auth = await requireStaffSession(request);
    if (auth.response) return auth.response;

    try {
        // Antes esto se verificaba con los headers 'x-user-id'/'x-is-system',
        // que el propio cliente envía sin ninguna firma: cualquiera podía
        // mandar 'X-Is-System: true' a mano y pasar el check. Ahora se usa
        // el valor real de la cookie de sesión firmada del servidor.
        const userId = auth.session.odooUid;
        const isSystem = auth.session.isSystem;

        if (!userId || !isSystem) {
            console.warn(`[API General Stats] Access denied for user ID ${userId}. Admin privilege required.`);
            return NextResponse.json({ success: false, error: "No autorizado. Este reporte es exclusivo para administradores." }, { status: 403 });
        }

        // Leer parámetros de fecha dinámica
        const { searchParams } = new URL(request.url);
        const reqStartDate = searchParams.get('startDate');
        const reqEndDate = searchParams.get('endDate');

        const currentYear = new Date().getFullYear();
        const startDate = reqStartDate ? `${reqStartDate} 00:00:00` : `${currentYear}-01-01 00:00:00`;
        const endDate = reqEndDate ? `${reqEndDate} 23:59:59` : `${currentYear}-12-31 23:59:59`;

        console.log(`[API General Stats] Querying Odoo for project stats (Authorized for user ${userId}, Range: ${startDate} → ${endDate})`);

        // 1. QUERY ALL PRODUCTS (LOTS) — inventario siempre completo (sin filtro de fecha)
        const products = await fetchOdoo(
            "product.product",
            "search_read",
            [[]], // Empty domain fetches all products
            {
                fields: ["id", "x_statu", "list_price", "default_code", "x_mz"]
            }
        ) as OdooProduct[];

        let totalLots = 0;
        let soldLots = 0;
        let reservedLots = 0;
        let availableLots = 0;
        let otherProductsCount = 0;
        let projectValue = 0;

        // Resumen por los 5 estados reales del lote (para el reporte de
        // administrador) — misma categorización que getColorEstado/getColor
        // en LeafletMap.tsx, así el conteo nunca diverge del color que ve el
        // admin en el mapa. Es una foto del inventario ACTUAL: no se filtra
        // por rango de fechas (a diferencia de las ventas/comisiones de más
        // abajo), porque el estado de un lote no es un hecho histórico.
        // "otros" no se muestra como tile, solo evita perder en silencio
        // algún x_statu no contemplado (dato sucio).
        let estadoNoVender = 0;
        let estadoDisponible = 0;
        let estadoCotizacion = 0;
        let estadoReservado = 0;
        let estadoVendido = 0;
        let estadoOtros = 0;

        const mzMap: Record<string, { total: number; sold: number; reserved: number; available: number }> = {};

        if (products && Array.isArray(products)) {
            for (const prod of products) {
                // Filtro experto: Los lotes tienen una referencia exacta de 10 caracteres (ej. E01MZD148P)
                const isLot = prod.default_code && typeof prod.default_code === 'string' && prod.default_code.trim().length === 10;
                
                if (isLot) {
                    totalLots++;
                    const status = (prod.x_statu || 'libre').toLowerCase();

                    // Extraer manzana desde el código del lote (E01MZD148P → Manzana D)
                    // Más preciso que x_mz. Fallback a x_mz si el parseo falla.
                    const parsed = parseLotCode(prod.default_code);
                    const mz = parsed?.manzana
                        || (prod.x_mz && typeof prod.x_mz === 'string' ? prod.x_mz.trim() : null)
                        || 'S/M';

                    if (!mzMap[mz]) mzMap[mz] = { total: 0, sold: 0, reserved: 0, available: 0 };
                    mzMap[mz].total++;

                    if (status === 'vendido') {
                        soldLots++;
                        mzMap[mz].sold++;
                    } else if (status === 'separado' || status === 'reservado') {
                        reservedLots++;
                        mzMap[mz].reserved++;
                    } else {
                        availableLots++;
                        mzMap[mz].available++;
                    }
                    projectValue += (prod.list_price || 0);

                    // Resumen de 5 estados (ver declaración arriba) — switch
                    // idéntico al de getColorEstado, no reutiliza las
                    // categorías de 3 baldes de arriba porque esas mezclan
                    // "no vender"/"disponible"/"cotización" en un solo
                    // "availableLots".
                    if (status === 'no vender') {
                        estadoNoVender++;
                    } else if (status === 'libre' || status === 'disponible') {
                        estadoDisponible++;
                    } else if (status === 'cotizacion' || status === 'cotización') {
                        estadoCotizacion++;
                    } else if (status === 'reservado' || status === 'separado') {
                        estadoReservado++;
                    } else if (status === 'vendido') {
                        estadoVendido++;
                    } else {
                        estadoOtros++;
                    }
                } else {
                    otherProductsCount++;
                }
            }
        }

        const manzanasDistribution = Object.entries(mzMap)
            .map(([mz, stats]) => ({ mz, ...stats }))
            .sort((a, b) => a.mz.localeCompare(b.mz));

        // 2. QUERY SALES TREND & TOTAL SALES (GLOBAL) — filtrado por rango dinámico
        const globalOrders = await fetchOdoo(
            "sale.order",
            "search_read",
            [[
                ["state", "in", ["sale", "done"]],
                ["date_order", ">=", startDate],

                ["date_order", "<=", endDate]
            ]],
            {
                fields: ["id", "name", "user_id", "date_order", "amount_total", "partner_id", "order_line"]
            }
        ) as OdooOrder[];

        let totalSales = 0;
        const monthsAbbr = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const salesTrend = monthsAbbr.map(name => ({ name, ventas: 0 }));

        // Map for aggregation by advisor
        const advisorSales: Record<number, { name: string; lotsCount: number; amountTotal: number }> = {};

        if (globalOrders && Array.isArray(globalOrders)) {
            for (const order of globalOrders) {
                const salesAmount = order.amount_total || 0;
                totalSales += salesAmount;

                // Trend Monthly
                const dateStr = order.date_order;
                if (dateStr) {
                    const orderDate = new Date(dateStr);
                    const monthIndex = orderDate.getMonth();
                    if (monthIndex >= 0 && monthIndex < 12) {
                        salesTrend[monthIndex].ventas += salesAmount;
                    }
                }

                // Advisor Aggregation
                if (order.user_id) {
                    const [userId, userName] = order.user_id;
                    if (!advisorSales[userId]) {
                        advisorSales[userId] = {
                            name: userName,
                            lotsCount: 0,
                            amountTotal: 0
                        };
                    }
                    advisorSales[userId].lotsCount += (order.order_line ? order.order_line.length : 1);
                    advisorSales[userId].amountTotal += salesAmount;
                }
            }
        }

        // Formulate Advisor Leaderboard — cada asesor con su propia tasa
        // acordada (ver commissionRates.ts), no un 6% plano para todos.
        const advisorRanking = Object.entries(advisorSales)
            .map(([userIdStr, adv]) => ({
                name: adv.name,
                lotsCount: adv.lotsCount,
                amountTotal: adv.amountTotal,
                commission: adv.amountTotal * getCommissionRate(parseInt(userIdStr, 10))
            }))
            .sort((a, b) => b.amountTotal - a.amountTotal);

        // Comisión global = suma de las comisiones reales por asesor (no
        // totalSales * tasa fija) — así el total sigue siendo correcto
        // incluso cuando las tasas difieren entre asesores.
        const commission = advisorRanking.reduce((sum, adv) => sum + adv.commission, 0);

        // Occupation rate
        const occupationRate = totalLots > 0
            ? Math.round(((soldLots + reservedLots) / totalLots) * 100)
            : 0;

        // Comparación real contra el período anterior de igual duración
        // (mismo patrón ya usado en stats/detailed para el dashboard en
        // vivo). El Reporte General en PDF mostraba los KPIs como números
        // absolutos sin indicar si mejoraron o empeoraron vs. el período
        // previo — solo se compara lo que tiene sentido temporal real
        // (ventas/comisión/N° de órdenes); ocupación y valor comercial son
        // fotos de inventario actual, no series por período, así que no
        // se les fabrica una comparación sin sentido.
        const periodMs = new Date(endDate).getTime() - new Date(startDate).getTime();
        const prevEndDate = new Date(new Date(startDate).getTime() - 1000);
        const prevStartDate = new Date(prevEndDate.getTime() - periodMs);
        const prevStartStr = prevStartDate.toISOString().slice(0, 19).replace('T', ' ');
        const prevEndStr = prevEndDate.toISOString().slice(0, 19).replace('T', ' ');

        // Agrupado por asesor (no un solo agregado global) para poder aplicar
        // la tasa de comisión de cada uno también en el período anterior.
        const prevSalesAgg = await fetchOdoo(
            "sale.order",
            "read_group",
            [[
                ["state", "in", ["sale", "done"]],
                ["date_order", ">=", prevStartStr],
                ["date_order", "<=", prevEndStr]
            ]],
            { fields: ["amount_total"], groupby: ["user_id"] }
        ) as { __count?: number; amount_total?: number; user_id?: [number, string] | false }[];

        let prevTotalSales = 0;
        let prevSalesCount = 0;
        let prevCommission = 0;
        for (const group of prevSalesAgg) {
            const amt = group.amount_total || 0;
            prevTotalSales += amt;
            prevSalesCount += group.__count || 0;
            const prevUserId = group.user_id ? group.user_id[0] : null;
            prevCommission += amt * getCommissionRate(prevUserId);
        }

        const pctChange = (curr: number, prev: number): number => {
            if (prev === 0) return curr > 0 ? 100 : 0;
            return Math.round(((curr - prev) / prev) * 100);
        };
        const trendOf = (change: number): 'up' | 'down' | 'stable' =>
            change > 0 ? 'up' : change < 0 ? 'down' : 'stable';

        const totalSalesChange = pctChange(totalSales, prevTotalSales);
        const commissionChange = pctChange(commission, prevCommission);
        const salesCountChange = pctChange(globalOrders.length, prevSalesCount);

        // 3. RECENT ACTIVITY GLOBAL (Last 10 Orders)
        const recentOrders = await fetchOdoo(
            "sale.order",
            "search_read",
            [[
                ["state", "in", ["draft", "sent", "sale", "done"]]
            ]],
            {
                fields: ["id", "name", "state", "user_id", "date_order", "amount_total", "order_line"],
                limit: 10,
                order: "date_order desc"
            }
        ) as OdooOrder[];

        // Batch read names of products
        const allLineIds = recentOrders.flatMap((order: OdooOrder) => order.order_line || []);
        const lineMap: Record<number, string> = {};

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
                for (const line of orderLines) {
                    if (line.product_id) {
                        let prodName = line.product_id[1];
                        if (prodName.includes(']')) {
                            prodName = prodName.split(']').pop()?.trim() || prodName;
                        }
                        lineMap[line.id] = prodName;
                    }
                }
            }
        }

        const recentActivity = recentOrders.map((order: OdooOrder) => {
            const firstLineId = order.order_line && order.order_line.length > 0 ? order.order_line[0] : null;
            const lotName = firstLineId ? (lineMap[firstLineId] || "Lote") : "Lote";
            const advisorName = order.user_id ? order.user_id[1] : "Asesor";

            let action = "Cotización";
            const state = order.state;
            if (state === 'sale') action = "Reserva";
            if (state === 'done') action = "Venta";

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
                advisor: advisorName,
                date
            };
        });

        // 4. REPORTE DE OPERACIONES (Administrador) — lista completa, no solo
        // las últimas 10 como recentActivity. Respeta el mismo rango de
        // fechas que globalOrders (a diferencia del resumen de estados de
        // arriba, que es una foto actual). Anuladas (state='cancel') quedan
        // fuera a propósito, igual que recentActivity/globalOrders.
        const allOperationsOrders = await fetchOdoo(
            "sale.order",
            "search_read",
            [[
                ["state", "in", ["draft", "sent", "sale", "done"]],
                ["date_order", ">=", startDate],
                ["date_order", "<=", endDate]
            ]],
            {
                fields: ["id", "state", "user_id", "partner_id", "date_order", "order_line"],
                order: "date_order desc"
            }
        ) as OdooOrder[];

        const allOpLineIds = allOperationsOrders.flatMap((order: OdooOrder) => order.order_line || []);
        // Mapa código→nombre (a diferencia de lineMap de arriba, que
        // descarta el código entre corchetes y se queda con el nombre: acá
        // es al revés, "PROPIEDAD" necesita el código de lote, no el
        // nombre largo).
        const codeMap: Record<number, string> = {};

        if (allOpLineIds.length > 0) {
            const opOrderLines = await fetchOdoo(
                "sale.order.line",
                "search_read",
                [[["id", "in", allOpLineIds]]],
                { fields: ["id", "product_id"] }
            ) as OdooOrderLine[];

            if (opOrderLines && Array.isArray(opOrderLines)) {
                for (const line of opOrderLines) {
                    if (line.product_id) {
                        const displayName = line.product_id[1];
                        // "[E01MZD148P] Lote 148 - Manzana D" → "E01MZD148P".
                        // Si no viene entre corchetes (producto sin código),
                        // se deja el nombre tal cual como respaldo.
                        const match = displayName.match(/^\[(.+?)\]/);
                        codeMap[line.id] = match ? match[1] : displayName;
                    }
                }
            }
        }

        const operacionesCrudas = allOperationsOrders.flatMap((order: OdooOrder) => {
            let tipo: 'Cotización' | 'Reserva' | 'Venta' = 'Cotización';
            if (order.state === 'sale') tipo = 'Reserva';
            if (order.state === 'done') tipo = 'Venta';

            const asesor = order.user_id ? order.user_id[1] : 'Sin asesor';
            const asignado = order.partner_id ? order.partner_id[1] : 'Sin cliente';
            const fecha = order.date_order || '';

            const lineIds = order.order_line || [];
            if (lineIds.length === 0) {
                // Orden sin líneas (raro, pero no debería desaparecer del
                // reporte): una fila con propiedad vacía en vez de omitirla.
                return [{ tipo, propiedad: '—', asesor, asignado, fecha }];
            }
            // Una fila por lote de la orden: una orden con 2+ lotes genera
            // 2+ filas crudas, cada una con su propio código en "propiedad"
            // pero mismo tipo/asesor/asignado/fecha (misma operación) —
            // se deduplican por lote más abajo.
            return lineIds.map((lineId) => ({
                tipo,
                propiedad: codeMap[lineId] || 'Lote',
                asesor,
                asignado,
                fecha
            }));
        });

        // Una fila POR LOTE (no por operación histórica): un lote puede
        // haber pasado por cotización → reserva → venta con distintos
        // asesores/clientes en el camino; acá se muestra solo la operación
        // más reciente de cada lote — "para cada lote, qué cliente tiene
        // asignado y qué asesor se lo vendió/cotizó", pedido explícito del
        // usuario, no un historial completo. Comparación de fecha como
        // string funciona porque Odoo la entrega en formato "YYYY-MM-DD
        // HH:mm:ss" (orden lexicográfico = orden cronológico).
        const masRecientePorLote = new Map<string, typeof operacionesCrudas[number]>();
        for (const op of operacionesCrudas) {
            const actual = masRecientePorLote.get(op.propiedad);
            if (!actual || op.fecha > actual.fecha) {
                masRecientePorLote.set(op.propiedad, op);
            }
        }
        const operaciones = Array.from(masRecientePorLote.values())
            .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));

        return NextResponse.json({
            success: true,
            stats: {
                kpis: {
                    totalSales,
                    projectValue,
                    commission,
                    occupationRate,
                    totalLots,
                    soldLots,
                    reservedLots,
                    availableLots,
                    otherProducts: otherProductsCount
                },
                manzanasDistribution,
                salesTrend,
                advisorRanking,
                recentActivity,
                estadoSummary: {
                    noVender: estadoNoVender,
                    disponible: estadoDisponible,
                    cotizacion: estadoCotizacion,
                    reservado: estadoReservado,
                    vendido: estadoVendido,
                    otros: estadoOtros
                },
                operaciones,
                comparison: {
                    totalSales: { value: totalSales, change: totalSalesChange, trend: trendOf(totalSalesChange) },
                    commission: { value: commission, change: commissionChange, trend: trendOf(commissionChange) },
                    salesCount: { value: globalOrders.length, change: salesCountChange, trend: trendOf(salesCountChange) }
                }
            }
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
        console.error("API General Stats Error:", error);
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
}
