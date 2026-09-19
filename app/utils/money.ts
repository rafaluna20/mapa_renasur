/**
 * Dinero con moneda. Regla del sistema: NINGÚN monto viaja ni se muestra sin su moneda.
 *
 * Contexto: hay contratos firmados en dólares (Odoo simple_recurring_contract v3.12+).
 * Sus facturas vienen en USD, pero la app asumía soles en todos lados ("S/" fijo y
 * `currency_id` nunca se pedía a Odoo): una cuota de US$1,500 se mostraba como "S/ 1,500"
 * -una deuda 3.6 veces menor-, y el saldo restaba dólares al precio en soles del catálogo.
 * Todo lo que formatee dinero de FACTURAS o CONTRATOS debe pasar por aquí.
 */

export type CurrencyCode = 'PEN' | 'USD';

/** Moneda por defecto: soles (todo lo histórico). */
export const DEFAULT_CURRENCY: CurrencyCode = 'PEN';

/**
 * Normaliza lo que devuelve Odoo (`currency_id` = [id, 'USD'] | false) o un código suelto.
 * Cualquier cosa desconocida cae a soles: es el comportamiento histórico y evita
 * mostrar "undefined", pero un código válido distinto de PEN/USD se respeta tal cual.
 */
export function normalizeCurrency(value: unknown): CurrencyCode {
    let code: unknown = value;
    if (Array.isArray(value)) code = value[1];
    if (typeof code !== 'string') return DEFAULT_CURRENCY;
    const upper = code.trim().toUpperCase();
    return (upper || DEFAULT_CURRENCY) as CurrencyCode;
}

/** Símbolo corto: soles "S/", dólares "US$"; otro código se muestra como está. */
export function currencySymbol(currency: CurrencyCode = DEFAULT_CURRENCY): string {
    if (currency === 'PEN') return 'S/';
    if (currency === 'USD') return 'US$';
    return currency;
}

/** Nombre para textos ("soles" / "dólares"). */
export function currencyName(currency: CurrencyCode = DEFAULT_CURRENCY): string {
    if (currency === 'PEN') return 'soles';
    if (currency === 'USD') return 'dólares';
    return currency;
}

/** "S/ 1,500.00" / "US$ 1,500.00": mismo formato numérico que la app usaba para soles. */
export function formatMoney(amount: number, currency: CurrencyCode = DEFAULT_CURRENCY): string {
    const n = Number.isFinite(amount) ? amount : 0;
    return `${currencySymbol(currency)} ${n.toLocaleString('es-PE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

/** Una lista de montos con moneda -> total por moneda (nunca mezcla monedas). */
export function sumByCurrency(
    items: { amount: number; currency: CurrencyCode }[]
): Partial<Record<CurrencyCode, number>> {
    const totals: Partial<Record<CurrencyCode, number>> = {};
    for (const { amount, currency } of items) {
        totals[currency] = (totals[currency] ?? 0) + (amount || 0);
    }
    return totals;
}
