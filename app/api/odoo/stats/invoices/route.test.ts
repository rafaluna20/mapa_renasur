import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Regresión: los totales de recaudación/morosidad SUMABAN todas las facturas sin mirar su
 * moneda, así que US$1,500 se contaba como S/1,500. Datos reales (2026-09): 9 cuotas vencidas
 * en dólares (US$22,176) se sumaban como soles al "total vencido".
 * Aquí se ejercita la ruta real con Odoo simulado (soles + dólares mezclados).
 */

vi.mock('@/app/lib/staffAuth', () => ({
    requireStaffSession: vi.fn(async () => ({ response: null, session: { odooUid: 1, isSystem: true } })),
}));

const fetchOdooMock = vi.fn();
vi.mock('@/app/services/odooService', () => ({
    fetchOdoo: (...args: unknown[]) => fetchOdooMock(...args),
}));

const PEN: [number, string] = [157, 'PEN'];
const USD: [number, string] = [1, 'USD'];

// Facturas vencidas (no pagadas): 2 en soles, 2 en dólares
const overdueInvoices = [
    { id: 1, name: 'B-1', amount_total: 1000, amount_residual: 1000, currency_id: PEN, invoice_date_due: '2020-01-01', partner_id: [10, 'Cliente Soles'], invoice_line_ids: [] },
    { id: 2, name: 'B-2', amount_total: 500, amount_residual: 500, currency_id: PEN, invoice_date_due: '2020-01-01', partner_id: [10, 'Cliente Soles'], invoice_line_ids: [] },
    { id: 3, name: 'B-3', amount_total: 10176, amount_residual: 10176, currency_id: USD, invoice_date_due: '2020-01-01', partner_id: [20, 'Cliente Dolares'], invoice_line_ids: [] },
    { id: 4, name: 'B-4', amount_total: 1500, amount_residual: 1500, currency_id: USD, invoice_date_due: '2020-01-01', partner_id: [20, 'Cliente Dolares'], invoice_line_ids: [] },
];

// Facturas cobradas: 1 en soles (S/2,000) y 1 en dólares (US$1,500)
const paidInvoices = [
    { id: 5, name: 'B-5', amount_total: 2000, amount_residual: 0, currency_id: PEN, invoice_date: '2026-09-01', partner_id: [10, 'Cliente Soles'], invoice_line_ids: [] },
    { id: 6, name: 'B-6', amount_total: 1500, amount_residual: 0, currency_id: USD, invoice_date: '2026-09-02', partner_id: [20, 'Cliente Dolares'], invoice_line_ids: [] },
];

function odooFake(model: string, method: string, args: unknown[]) {
    if (model === 'account.move' && method === 'search_read') {
        const domain = JSON.stringify(args[0]);
        return domain.includes('not_paid') ? overdueInvoices : paidInvoices;
    }
    if (model === 'account.move' && method === 'read_group') {
        return [
            { __count: 3, amount_total: 6000, amount_residual: 0, currency_id: PEN },
            { __count: 1, amount_total: 3000, amount_residual: 0, currency_id: USD },
        ];
    }
    return []; // account.move.line / product.product: sin líneas
}

async function callGet(query = '') {
    const { GET } = await import('./route');
    const { NextRequest } = await import('next/server');
    const res = await GET(new NextRequest(`http://localhost/api/odoo/stats/invoices${query}`));
    return (await res.json()).data;
}

beforeEach(() => {
    fetchOdooMock.mockReset();
    fetchOdooMock.mockImplementation(async (model: string, method: string, args: unknown[]) => odooFake(model, method, args));
});

describe('GET /api/odoo/stats/invoices — soles y dólares por separado', () => {
    it('el total vencido en soles NO incluye los dólares', async () => {
        const data = await callGet();
        expect(data.totalOverdue).toBe(1500); // 1000 + 500 (soles), NO 13,176
        expect(data.aging.reduce((s: number, a: { totalAmount: number }) => s + a.totalAmount, 0)).toBe(1500);
        expect(data.overdueDetail.map((o: { invoice: string }) => o.invoice).sort()).toEqual(['B-1', 'B-2']);
    });

    it('los dólares salen aparte en foreignCurrencies.USD', async () => {
        const data = await callGet();
        const usd = data.foreignCurrencies.USD;
        expect(usd.currency).toBe('USD');
        expect(usd.totalOverdue).toBe(11676); // 10,176 + 1,500
        expect(usd.overdueDetail.map((o: { invoice: string }) => o.invoice).sort()).toEqual(['B-3', 'B-4']);
        expect(usd.aging.reduce((s: number, a: { totalAmount: number }) => s + a.totalAmount, 0)).toBe(11676);
    });

    it('lo recaudado también se separa: soles y dólares nunca se suman', async () => {
        const data = await callGet();
        expect(data.totalCollected).toBe(2000); // solo soles
        expect(data.recentPayments.map((p: { invoice: string }) => p.invoice)).toEqual(['B-5']);
        expect(data.foreignCurrencies.USD.totalCollected).toBe(1500);
        expect(data.foreignCurrencies.USD.recentPayments.map((p: { invoice: string }) => p.invoice)).toEqual(['B-6']);
    });

    it('sin facturas en dólares, foreignCurrencies queda vacío y soles no cambia', async () => {
        fetchOdooMock.mockImplementation(async (model: string, method: string, args: unknown[]) => {
            const r = odooFake(model, method, args);
            if (model === 'account.move' && method === 'search_read') {
                return (r as { currency_id: [number, string] }[]).filter((i) => i.currency_id[1] === 'PEN');
            }
            return r;
        });
        const data = await callGet();
        expect(data.foreignCurrencies).toEqual({});
        expect(data.totalOverdue).toBe(1500);
        expect(data.totalCollected).toBe(2000);
    });

    it('con rango de fechas, cada moneda se compara contra el período anterior DE LA MISMA moneda', async () => {
        const data = await callGet('?startDate=2026-09-01&endDate=2026-09-30');
        // soles: 2000 vs 6000 anterior -> -67%. dólares: 1500 vs 3000 -> -50%
        expect(data.comparison.totalCollected.change).toBe(-67);
        expect(data.foreignCurrencies.USD.comparison.totalCollected.change).toBe(-50);
    });

    it('un período sin cobros pero con deuda vencida en dólares conserva la deuda en dólares', async () => {
        fetchOdooMock.mockImplementation(async (model: string, method: string, args: unknown[]) => {
            if (model === 'account.move' && method === 'search_read' && !JSON.stringify(args[0]).includes('not_paid')) return [];
            return odooFake(model, method, args);
        });
        const data = await callGet();
        expect(data.totalCollected).toBe(0);
        expect(data.foreignCurrencies.USD.totalOverdue).toBe(11676);
    });
});
