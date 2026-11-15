import { describe, it, expect, vi, beforeEach } from 'vitest';

let contratosExistentes: { id: number }[] = [];
let falloLaCopia = false;
const adjuntosOrden = [
    { id: 1, name: 'Cotizacion_E01MZP001P.pdf', checksum: 'aaa' },
    { id: 2, name: 'voucher.jpg', checksum: 'bbb' },
];
let adjuntosContrato: { id: number; name: string; checksum: string }[] = [];

const fetchOdoo = vi.fn(async (model: string, method: string, args: unknown[]) => {
    if (model === 'sale.order' && method === 'search_read') {
        return [{ id: 10, partner_id: [5, 'Ana'], order_line: [100], state: 'sale', x_plazo_meses: 60, x_down_payment: 1000, x_discount_amount: 0, x_date_first_installment: '2026-12-01' }];
    }
    if (model === 'sale.order' && method === 'read') return [{ x_installment_date_mode: 'month_end' }];
    if (model === 'sale.order.line') return [{ product_id: [9, 'Lote'], name: 'Lote E01MZP001P', price_unit: 61000 }];
    if (model === 'simple.contract' && method === 'search_read') return contratosExistentes;
    if (model === 'simple.contract' && method === 'create') return 77;
    if (model === 'ir.attachment' && method === 'search_read') {
        const modelo = (args[0] as unknown[][]).find((t) => t[0] === 'res_model')![2];
        return modelo === 'sale.order' ? adjuntosOrden : adjuntosContrato;
    }
    if (model === 'ir.attachment' && method === 'copy') {
        if (falloLaCopia) throw new Error('sin permiso');
        adjuntosContrato.push({ ...adjuntosOrden.find((a) => a.id === (args[0] as number[])[0])!, id: 800 + adjuntosContrato.length });
        return 800;
    }
    if (model === 'mail.message') return 1;
    throw new Error(`llamada inesperada ${model}.${method}`);
});
vi.mock('@/app/services/odooService', () => ({ fetchOdoo: (...a: [string, string, unknown[]]) => fetchOdoo(...a) }));
vi.mock('@/app/lib/staffAuth', () => ({ requireStaffSession: async () => ({ response: null, session: { odooUid: 1 } }) }));

import { POST } from './route';

const llamar = async () => {
    const res = await POST(new Request('http://x/api/odoo/create_contract', { method: 'POST', body: JSON.stringify({ saleOrderId: 10 }) }));
    return { status: res.status, ...(await res.json()) };
};
const llamadas = (modelo: string, metodo: string) => fetchOdoo.mock.calls.filter((c) => c[0] === modelo && c[1] === metodo);

describe('create_contract: los documentos de la reserva pasan al contrato', () => {
    beforeEach(() => {
        contratosExistentes = [];
        falloLaCopia = false;
        adjuntosContrato = [];
        fetchOdoo.mockClear();
    });

    it('al crear el contrato copia la cotización y el comprobante, y deja el aviso en el contrato', async () => {
        const r = await llamar();
        expect(r).toMatchObject({ success: true, contractId: 77, documentos: { copiados: 2, yaEstaban: 0, errores: 0 } });
        expect(adjuntosContrato.map((a) => a.name)).toEqual(['Cotizacion_E01MZP001P.pdf', 'voucher.jpg']);
        const avisoAlContrato = llamadas('mail.message', 'create').find((c) => (c[2] as [Record<string, unknown>])[0].model === 'simple.contract');
        expect(avisoAlContrato).toBeTruthy();
    });

    it('si el contrato ya existía (p. ej. lo creó la acción automática de Odoo), igual completa los documentos', async () => {
        contratosExistentes = [{ id: 77 }];
        const r = await llamar();
        expect(r).toMatchObject({ success: true, contractId: 77, documentos: { copiados: 2 } });
        expect(llamadas('simple.contract', 'create')).toHaveLength(0);
    });

    it('llamarlo otra vez no duplica los documentos', async () => {
        await llamar();
        contratosExistentes = [{ id: 77 }];
        const segunda = await llamar();
        expect(segunda.documentos).toMatchObject({ copiados: 0, yaEstaban: 2 });
        expect(adjuntosContrato).toHaveLength(2);
    });

    it('si falla la copia, el contrato se crea igual y se informa el error', async () => {
        falloLaCopia = true;
        const r = await llamar();
        expect(r).toMatchObject({ success: true, contractId: 77, documentos: { copiados: 0, errores: 2 } });
    });
});
