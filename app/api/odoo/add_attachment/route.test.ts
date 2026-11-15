import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchOdoo = vi.fn();
vi.mock('@/app/services/odooService', () => ({ fetchOdoo: (...a: unknown[]) => fetchOdoo(...a) }));
vi.mock('@/app/lib/staffAuth', () => ({ requireStaffSession: async () => ({ response: null, session: { odooUid: 1 } }) }));

import { POST } from './route';

const subir = async (campos: Record<string, string>) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(campos)) form.append(k, v);
    form.append('file', new File(['contenido'], 'archivo.pdf', { type: 'application/pdf' }));
    const res = await POST(new Request('http://x/api/odoo/add_attachment', { method: 'POST', body: form }));
    return res.json();
};
const adjuntoCreado = () => (fetchOdoo.mock.calls[0][2] as [Record<string, unknown>])[0];

describe('add_attachment', () => {
    beforeEach(() => {
        fetchOdoo.mockReset();
        fetchOdoo.mockResolvedValue(55);
    });

    it('la cotización se guarda como «Cotización del terreno» en la orden', async () => {
        const r = await subir({ orderId: '10', tipo: 'cotizacion' });
        expect(r).toEqual({ success: true, attachmentId: 55 });
        expect(adjuntoCreado()).toMatchObject({ res_model: 'sale.order', res_id: 10, description: 'Cotización del terreno' });
    });

    it('un comprobante, o un llamador antiguo sin tipo, sigue guardándose como comprobante de pago', async () => {
        await subir({ orderId: '10', tipo: 'comprobante' });
        expect(adjuntoCreado().description).toBe('Comprobante de pago - Reserva');
        fetchOdoo.mockClear();
        await subir({ orderId: '10' });
        expect(adjuntoCreado().description).toBe('Comprobante de pago - Reserva');
    });
});
