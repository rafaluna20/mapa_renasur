import { fetchOdoo } from '@/app/services/odooService';
import { CurrencyCode, normalizeCurrency } from '@/app/utils/money';

/**
 * Moneda y precio pactado del contrato VIGENTE de un lote (simple.contract de Odoo).
 *
 * Por qué existe: el precio de `product.template.list_price` está SIEMPRE en soles (es el
 * catálogo). En un contrato firmado en dólares, "Valor total" y "Saldo deudor" deben salir
 * del contrato (en su moneda): restar cobros en dólares al precio de catálogo en soles daba
 * un saldo sin sentido (S/360,633.60 - US$1,500).
 */
export interface LotContractInfo {
    contractId: number;
    state: string;
    currency: CurrencyCode;
    /** Precio final pactado (lista - descuento) en la moneda del CONTRATO. */
    finalPrice: number;
}

interface OdooContractRow {
    id: number;
    state: string;
    product_id: [number, string] | false;
    currency_id: [number, string] | false;
    final_price: number;
}

/**
 * Devuelve el contrato vigente por código de lote. Si un lote tiene varios (p. ej. uno viejo
 * cerrado y uno nuevo), se prefiere el confirmado sobre el borrador y, a igualdad, el más
 * reciente; los cerrados se ignoran. Ante cualquier fallo devuelve un mapa vacío: quien llame
 * cae al comportamiento histórico (catálogo en soles) en vez de romper la pantalla.
 */
export async function fetchLotContractInfo(codes: string[]): Promise<Map<string, LotContractInfo>> {
    const result = new Map<string, LotContractInfo>();
    const uniqueCodes = [...new Set(codes.filter(Boolean))];
    if (uniqueCodes.length === 0) return result;

    try {
        const products = (await fetchOdoo(
            'product.product',
            'search_read',
            [[['default_code', 'in', uniqueCodes]]],
            { fields: ['id', 'default_code'], context: { active_test: false } }
        )) as { id: number; default_code: string }[];
        if (!products?.length) return result;

        const codeByProductId = new Map(products.map((p) => [p.id, p.default_code]));

        const contracts = (await fetchOdoo(
            'simple.contract',
            'search_read',
            [[['product_id', 'in', [...codeByProductId.keys()]], ['state', 'in', ['draft', 'confirmed']]]],
            { fields: ['id', 'state', 'product_id', 'currency_id', 'final_price'], order: 'id asc' }
        )) as OdooContractRow[];

        for (const c of contracts || []) {
            if (!c.product_id) continue;
            const code = codeByProductId.get(c.product_id[0]);
            if (!code) continue;
            const current = result.get(code);
            // Orden ascendente por id: el último gana, salvo que ya haya un confirmado y este sea borrador.
            if (current && current.state === 'confirmed' && c.state !== 'confirmed') continue;
            result.set(code, {
                contractId: c.id,
                state: c.state,
                currency: normalizeCurrency(c.currency_id),
                finalPrice: c.final_price || 0,
            });
        }
    } catch (error) {
        console.warn('[lotContract] No se pudo leer simple.contract (se usa el catálogo en soles):', error);
        return new Map();
    }
    return result;
}
