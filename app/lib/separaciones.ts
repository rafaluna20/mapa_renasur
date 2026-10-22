import { fetchOdoo } from '@/app/services/odooService';
import { armarSeparacion, fechaLimaDeOdoo, hoyLima, type SeparacionInfo } from '@/app/utils/separacionUtils';

/**
 * Consulta masiva (una sola ronda, no una por lote) de las separaciones con
 * plazo y de las reservas administrativas, para pintar el mapa de staff.
 *
 * Los campos viven en el módulo Odoo simple_recurring_contract v3.20+
 * (sale.order.separation_* y product.template.admin_reserved). Mientras ese
 * módulo no esté desplegado, Odoo responde "campo inexistente": cada consulta
 * está aislada en su propio try/catch y devuelve vacío, de modo que el mapa
 * sigue funcionando EXACTAMENTE como antes. Nunca se piden estos campos en la
 * consulta principal de lotes (page.tsx): un solo campo desconocido ahí
 * tumbaría todo el mapa.
 */

export type OdooRpc = (model: string, method: string, args: unknown[], kwargs?: Record<string, unknown>) => Promise<unknown>;

export interface MapaSeparaciones {
    /** Clave: id de product.template (el mismo `id` que usa Lot.id). */
    porLote: Record<string, SeparacionInfo>;
    /** ids de product.template marcados como reserva administrativa. */
    reservasAdmin: number[];
    /** false = el módulo de Odoo aún no tiene los campos (o Odoo falló). */
    disponible: boolean;
}

interface OrdenOdoo {
    id: number;
    name: string;
    user_id: [number, string] | false;
    separation_start: string | false;
    separation_deadline: string | false;
    separation_extension_count: number;
}

const VACIO: MapaSeparaciones = { porLote: {}, reservasAdmin: [], disponible: false };

export async function consultarSeparaciones(rpc: OdooRpc, hoy: string = hoyLima()): Promise<MapaSeparaciones> {
    let ordenes: OrdenOdoo[] = [];
    let disponible = true;
    try {
        ordenes = (await rpc(
            'sale.order',
            'search_read',
            [[['state', '=', 'sale'], ['separation_deadline', '!=', false]]],
            {
                fields: ['id', 'name', 'user_id', 'separation_start', 'separation_deadline', 'separation_extension_count'],
                limit: 2000,
            }
        )) as OrdenOdoo[];
    } catch (error) {
        disponible = false;
        console.warn('[separaciones] Odoo no tiene (aún) los campos de plazo de separación; se omite:', error instanceof Error ? error.message : error);
    }

    const porLote: Record<string, SeparacionInfo> = {};
    if (ordenes.length > 0) {
        const ids = ordenes.map((o) => o.id);
        const [contratos, lineas] = await Promise.all([
            rpc('simple.contract', 'search_read', [[['sale_order_id', 'in', ids], ['state', 'in', ['confirmed', 'closed']]]], {
                fields: ['sale_order_id'],
            }) as Promise<{ sale_order_id: [number, string] | false }[]>,
            rpc('sale.order.line', 'search_read', [[['order_id', 'in', ids]]], {
                fields: ['order_id', 'product_template_id'],
            }) as Promise<{ order_id: [number, string]; product_template_id: [number, string] | false }[]>,
        ]);
        const conContrato = new Set(contratos.map((c) => (c.sale_order_id ? c.sale_order_id[0] : 0)));
        const porId = new Map(ordenes.map((o) => [o.id, o]));

        const infoPorLote = new Map<number, SeparacionInfo[]>();
        for (const linea of lineas) {
            const orden = porId.get(linea.order_id[0]);
            if (!orden || !linea.product_template_id || !orden.separation_deadline) continue;
            const lista = infoPorLote.get(linea.product_template_id[0]) ?? [];
            lista.push(
                armarSeparacion({
                    orderId: orden.id,
                    orderName: orden.name,
                    vendedor: orden.user_id ? orden.user_id[1] : null,
                    inicio: orden.separation_start ? fechaLimaDeOdoo(orden.separation_start) : orden.separation_deadline,
                    limite: orden.separation_deadline,
                    extensiones: orden.separation_extension_count || 0,
                    tieneContrato: conContrato.has(orden.id),
                    hoy,
                })
            );
            infoPorLote.set(linea.product_template_id[0], lista);
        }
        for (const [loteId, lista] of infoPorLote) {
            // Con contrato manda; si no, la que vence primero. Si hay varias órdenes,
            // se avisa (doble reserva) con ordenesActivas.
            const elegida = lista.find((s) => s.estado === 'contratada') ?? [...lista].sort((a, b) => a.limite.localeCompare(b.limite))[0];
            porLote[String(loteId)] = { ...elegida, ordenesActivas: lista.length };
        }
    }

    let reservasAdmin: number[] = [];
    try {
        const filas = (await rpc('product.template', 'search_read', [[['admin_reserved', '=', true]]], {
            fields: ['id'],
            limit: 5000,
            context: { active_test: false },
        })) as { id: number }[];
        reservasAdmin = filas.map((f) => f.id);
    } catch (error) {
        disponible = false;
        console.warn('[separaciones] Odoo no tiene (aún) el campo admin_reserved; se omite:', error instanceof Error ? error.message : error);
    }

    return { porLote, reservasAdmin, disponible };
}

// Misma ventana que la caché de lotes de page.tsx (30 s).
const CACHE_TTL = 30_000;
let cache: { data: MapaSeparaciones; timestamp: number } | null = null;

export async function obtenerSeparaciones(forceRefresh = false): Promise<MapaSeparaciones> {
    const ahora = Date.now();
    if (cache && !forceRefresh && ahora - cache.timestamp < CACHE_TTL) return cache.data;
    try {
        const data = await consultarSeparaciones(fetchOdoo);
        cache = { data, timestamp: ahora };
        return data;
    } catch (error) {
        // Una falla inesperada (red, contratos/líneas) nunca debe tumbar el mapa.
        console.error('[separaciones] Falla inesperada; se sirve la última caché o vacío:', error);
        return cache?.data ?? VACIO;
    }
}
