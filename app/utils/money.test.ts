import { describe, it, expect } from 'vitest';
import { formatMoney, normalizeCurrency, currencySymbol, currencyName, sumByCurrency } from './money';

describe('normalizeCurrency', () => {
    it('lee el formato de Odoo [id, "USD"]', () => {
        expect(normalizeCurrency([1, 'USD'])).toBe('USD');
        expect(normalizeCurrency([157, 'PEN'])).toBe('PEN');
    });

    it('acepta un código suelto sin importar mayúsculas/espacios', () => {
        expect(normalizeCurrency(' usd ')).toBe('USD');
    });

    it('lo desconocido cae a soles (comportamiento histórico), nunca a undefined', () => {
        expect(normalizeCurrency(undefined)).toBe('PEN');
        expect(normalizeCurrency(false)).toBe('PEN');
        expect(normalizeCurrency(null)).toBe('PEN');
        expect(normalizeCurrency('')).toBe('PEN');
        expect(normalizeCurrency([])).toBe('PEN');
    });
});

describe('formatMoney', () => {
    it('soles conserva el formato histórico "S/ 1,500.00"', () => {
        expect(formatMoney(1500)).toBe('S/ 1,500.00');
        expect(formatMoney(1500, 'PEN')).toBe('S/ 1,500.00');
    });

    it('dólares NUNCA se muestra con "S/" (el bug original: US$1,500 se veía como S/ 1,500)', () => {
        const txt = formatMoney(19176, 'USD');
        expect(txt).toBe('US$ 19,176.00');
        expect(txt).not.toContain('S/');
    });

    it('siempre 2 decimales y separador de miles', () => {
        expect(formatMoney(100176, 'USD')).toBe('US$ 100,176.00');
        expect(formatMoney(0.5, 'PEN')).toBe('S/ 0.50');
    });

    it('un valor no numérico se muestra como 0.00 en vez de NaN', () => {
        expect(formatMoney(NaN, 'USD')).toBe('US$ 0.00');
    });
});

describe('currencySymbol / currencyName', () => {
    it('símbolos y nombres', () => {
        expect(currencySymbol('PEN')).toBe('S/');
        expect(currencySymbol('USD')).toBe('US$');
        expect(currencyName('USD')).toBe('dólares');
        expect(currencyName('PEN')).toBe('soles');
    });
});

describe('sumByCurrency', () => {
    it('suma cada moneda por separado, nunca las mezcla', () => {
        const totals = sumByCurrency([
            { amount: 1000, currency: 'PEN' },
            { amount: 1500, currency: 'USD' },
            { amount: 500, currency: 'PEN' },
            { amount: 10176, currency: 'USD' },
        ]);
        expect(totals.PEN).toBe(1500);
        expect(totals.USD).toBe(11676);
    });

    it('una moneda sin montos no aparece', () => {
        expect(sumByCurrency([{ amount: 10, currency: 'PEN' }]).USD).toBeUndefined();
    });
});
