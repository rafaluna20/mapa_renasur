import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchOdoo = vi.fn();
vi.mock('@/app/services/odooService', () => ({ fetchOdoo: (...a: unknown[]) => fetchOdoo(...a) }));
vi.mock('@/app/lib/staffAuth', () => ({ requireStaffSession: async () => ({ response: null, session: { odooUid: 1 } }) }));

import { POST } from './route';

const llamar = async (body: Record<string, unknown>) => {
    const res = await POST(new Request('http://x/api/odoo/get_reservation_owner', { method: 'POST', body: JSON.stringify(body) }));
    return res.json();
};

// Respuestas de Odoo por modelo
function odoo(datos: { orden?: Record<string, unknown> | null; contrato?: Record<string, unknown> | null }) {
    fetchOdoo.mockImplementation(async (model: string) => {
        if (model === 'sale.order') return datos.orden ? [datos.orden] : [];
        if (model === 'simple.contract') return datos.contrato ? [datos.contrato] : [];
        if (model === 'res.partner') return [{ phone: '999', mobile: false, email: 'a@b.c', vat: '12345678' }];
        throw new Error('modelo inesperado ' + model);
    });
}

describe('get_reservation_owner', () => {
    beforeEach(() => {
        fetchOdoo.mockReset();
    });

    it('con orden confirmada devuelve vendedor, cliente y orden (comportamiento de siempre)', async () => {
        odoo({ orden: { id: 281, user_id: [7, 'Ana'], partner_id: [509, 'Cliente Orden'], date_order: '2026-07-03', x_plazo_meses: 60, x_separacion: 500 } });
        const r = await llamar({ productId: 1932 });
        expect(r).toMatchObject({ success: true, ownerId: 7, ownerName: 'Ana', partnerId: 509, orderId: 281, totalInstallments: 60, separationAmount: 500 });
    });

    it('sin orden pero con contrato vigente, devuelve el cliente del contrato (para que se vean los pagos)', async () => {
        odoo({ orden: null, contrato: { partner_id: [475, 'Cliente Contrato'], total_quotas: 75 } });
        const r = await llamar({ productId: 1932 });
        expect(r).toMatchObject({ success: true, ownerId: null, partnerId: 475, clientName: 'Cliente Contrato', totalInstallments: 75, orderId: null, clientDni: '12345678' });
    });

    it('sin orden y sin contrato vigente/finalizado, no hay dueño (igual que antes)', async () => {
        odoo({ orden: null, contrato: null });
        const r = await llamar({ productId: 1932 });
        expect(r).toEqual({ success: true, ownerId: null });
    });

    it('el fallback solo mira contratos vigentes o finalizados, nunca borradores', async () => {
        odoo({ orden: null, contrato: null });
        await llamar({ productId: 1932 });
        const llamadaContrato = fetchOdoo.mock.calls.find((c) => c[0] === 'simple.contract');
        expect(JSON.stringify(llamadaContrato?.[2])).toContain('"confirmed","closed"');
    });
});
