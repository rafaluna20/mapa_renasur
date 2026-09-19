import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Estado de cuenta del portal: cada lote debe salir con SU moneda. Para un lote en dólares,
 * "listPrice" es el precio pactado del contrato (en dólares) y no el precio de catálogo en soles
 * (restar cobros en dólares a S/360,633.60 daba un saldo sin sentido).
 */

vi.mock('next-auth', () => ({
    getServerSession: vi.fn(async () => ({ user: { odooPartnerId: 77 } })),
}));
vi.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));

const fetchOdooMock = vi.fn();
vi.mock('@/app/services/odooService', () => ({
    fetchOdoo: (...args: unknown[]) => fetchOdooMock(...args),
}));

const fetchLotContractInfoMock = vi.fn();
vi.mock('@/app/lib/lotContract', () => ({
    fetchLotContractInfo: (...args: unknown[]) => fetchLotContractInfoMock(...args),
}));

const PEN: [number, string] = [157, 'PEN'];
const USD: [number, string] = [1, 'USD'];

const invoice = (id: number, ref: string, currency: [number, string], total: number, paid = false) => ({
    id, name: `B-${id}`, ref, payment_reference: false, invoice_date: '2026-09-01', invoice_date_due: '2026-09-30',
    payment_state: paid ? 'paid' : 'not_paid', amount_total: total, amount_residual: paid ? 0 : total,
    currency_id: currency, invoice_payments_widget: false,
});

beforeEach(() => {
    fetchOdooMock.mockReset();
    fetchLotContractInfoMock.mockReset();
    fetchOdooMock.mockImplementation(async (model: string) => {
        if (model === 'account.move') {
            return [
                invoice(1, 'CONTRATOMANUAL-E01MZS090P-INIT', USD, 10176),
                invoice(2, 'CONTRATOMANUAL-E01MZS090P-C001', USD, 1500),
                invoice(3, 'CONTRATOMANUAL-E01MZQ029P-C001', PEN, 1182.85, true),
            ];
        }
        if (model === 'res.partner') return [{ phone: '999', mobile: false }];
        if (model === 'product.template') {
            return [
                { default_code: 'E01MZS090P', list_price: 360633.6, x_mz: 'S', x_etapa: '1', x_lote: '90' },
                { default_code: 'E01MZQ029P', list_price: 118800, x_mz: 'Q', x_etapa: '1', x_lote: '29' },
            ];
        }
        return [];
    });
});

async function callGet() {
    const { GET } = await import('./route');
    const res = await GET();
    return res.json();
}

describe('GET /api/invoices/statement — moneda por lote', () => {
    it('lote en dólares: moneda USD y precio = precio pactado del contrato (no el catálogo en soles)', async () => {
        fetchLotContractInfoMock.mockResolvedValue(new Map([
            ['E01MZS090P', { contractId: 389, state: 'confirmed', currency: 'USD', finalPrice: 100176 }],
        ]));
        const { lots } = await callGet();
        const lot = lots.find((l: { code: string }) => l.code === 'E01MZS090P');
        expect(lot.currency).toBe('USD');
        expect(lot.listPrice).toBe(100176);
        expect(lot.listPrice).not.toBe(360633.6);
    });

    it('lote en soles: moneda PEN y precio de catálogo, exactamente como antes', async () => {
        fetchLotContractInfoMock.mockResolvedValue(new Map());
        const { lots } = await callGet();
        const lot = lots.find((l: { code: string }) => l.code === 'E01MZQ029P');
        expect(lot.currency).toBe('PEN');
        expect(lot.listPrice).toBe(118800);
    });

    it('lote en dólares SIN contrato legible: precio 0 (la pantalla muestra "—"), nunca el catálogo en soles', async () => {
        fetchLotContractInfoMock.mockResolvedValue(new Map());
        const { lots } = await callGet();
        const lot = lots.find((l: { code: string }) => l.code === 'E01MZS090P');
        expect(lot.currency).toBe('USD');
        expect(lot.listPrice).toBe(0);
    });

    it('un contrato en soles no se aplica a facturas en dólares del mismo lote (monedas distintas)', async () => {
        fetchLotContractInfoMock.mockResolvedValue(new Map([
            ['E01MZS090P', { contractId: 5, state: 'draft', currency: 'PEN', finalPrice: 360633.6 }],
        ]));
        const { lots } = await callGet();
        const lot = lots.find((l: { code: string }) => l.code === 'E01MZS090P');
        expect(lot.currency).toBe('USD');
        expect(lot.listPrice).toBe(0);
    });

    it('las facturas viajan con su moneda', async () => {
        fetchLotContractInfoMock.mockResolvedValue(new Map());
        const { lots } = await callGet();
        const lot = lots.find((l: { code: string }) => l.code === 'E01MZS090P');
        expect(lot.invoices.every((i: { currency_id: [number, string] }) => i.currency_id[1] === 'USD')).toBe(true);
        // y se pidió `currency_id` a Odoo
        const invoiceCall = fetchOdooMock.mock.calls.find((c) => c[0] === 'account.move')!;
        expect(invoiceCall[3].fields).toContain('currency_id');
    });
});
