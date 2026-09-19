import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * La pasarela con tarjeta (Niubiz) no envía moneda: una cuota en dólares se habría cobrado
 * como si fueran soles (3.6 veces menos de lo debido). Debe bloquearse ANTES de crear la sesión.
 */

vi.mock('next-auth', () => ({
    getServerSession: vi.fn(async () => ({ user: { odooPartnerId: 77 } })),
}));
vi.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));

const createSessionToken = vi.fn(async () => 'SESSION-KEY');
vi.mock('@/app/services/niubizService', () => ({
    niubizService: { createSessionToken: (...a: unknown[]) => (createSessionToken as (...x: unknown[]) => unknown)(...a) },
}));

const getInvoiceById = vi.fn();
vi.mock('@/app/services/paymentService', () => ({
    paymentService: { getInvoiceById: (...a: unknown[]) => getInvoiceById(...a) },
}));

const baseInvoice = {
    id: 5, name: 'B-5', payment_reference: 'REF-5', amount_total: 1500, amount_residual: 1500,
    partner_id: [77, 'Cliente'], payment_state: 'not_paid', state: 'posted', invoice_date_due: '2026-09-30',
};

async function post() {
    const { POST } = await import('./route');
    const res = await POST(new Request('http://localhost/api/payments/niubiz/create-session', {
        method: 'POST', body: JSON.stringify({ invoice_id: 5 }),
    }));
    return { status: res.status, body: await res.json() };
}

beforeEach(() => {
    createSessionToken.mockClear();
    getInvoiceById.mockReset();
    process.env.NIUBIZ_MERCHANT_ID = 'M-1';
});

describe('POST /api/payments/niubiz/create-session', () => {
    it('BLOQUEA una cuota en dólares y no crea ninguna sesión de cobro', async () => {
        getInvoiceById.mockResolvedValue({ ...baseInvoice, currency_id: [1, 'USD'] });
        const { status, body } = await post();
        expect(status).toBe(422);
        expect(body.success).toBe(false);
        expect(body.error).toContain('dólares');
        expect(createSessionToken).not.toHaveBeenCalled();
    });

    it('una cuota en soles sigue funcionando igual que antes', async () => {
        getInvoiceById.mockResolvedValue({ ...baseInvoice, currency_id: [157, 'PEN'] });
        const { status, body } = await post();
        expect(status).toBe(200);
        expect(body.success).toBe(true);
        expect(createSessionToken).toHaveBeenCalledWith(1500, 'REF-5');
    });

    it('una factura sin moneda informada se trata como soles (comportamiento histórico)', async () => {
        getInvoiceById.mockResolvedValue({ ...baseInvoice });
        const { status } = await post();
        expect(status).toBe(200);
    });
});
