import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchOdooMock = vi.fn();
vi.mock('./odooService', () => ({ fetchOdoo: (...a: unknown[]) => fetchOdooMock(...a) }));

import { paymentService } from './paymentService';

/**
 * «Cuotas pendientes» del portal: no debe listar una factura REVERTIDA (anulada con nota de credito; saldo 0). Antes solo
 * se excluian las pagadas y la revertida salia como una cuota pendiente de S/ 0 con boton de subir comprobante.
 */
describe('paymentService.getPendingInvoices — facturas revertidas', () => {
    beforeEach(() => {
        fetchOdooMock.mockReset();
        fetchOdooMock.mockResolvedValue([]);
    });

    it('excluye del dominio las facturas pagadas Y las revertidas', async () => {
        await paymentService.getPendingInvoices(10);
        const dominio = fetchOdooMock.mock.calls[0][2][0] as unknown[][];
        expect(dominio).toContainEqual(['payment_state', 'not in', ['paid', 'reversed']]);
        expect(JSON.stringify(dominio)).not.toContain('"payment_state","!=","paid"');
    });

    it('sigue filtrando por el cliente, por facturas de cliente y publicadas (control: no se aflojo nada mas)', async () => {
        await paymentService.getPendingInvoices(10);
        const dominio = fetchOdooMock.mock.calls[0][2][0] as unknown[][];
        expect(dominio).toContainEqual(['partner_id', '=', 10]);
        expect(dominio).toContainEqual(['move_type', '=', 'out_invoice']);
        expect(dominio).toContainEqual(['state', '=', 'posted']);
    });

    it('las parciales y las no pagadas siguen entrando (no estan en el grupo excluido)', async () => {
        await paymentService.getPendingInvoices(10);
        const dominio = fetchOdooMock.mock.calls[0][2][0] as unknown[][];
        const estado = dominio.find((d) => d[0] === 'payment_state') as unknown[];
        expect(estado[2]).not.toContain('partial');
        expect(estado[2]).not.toContain('not_paid');
    });
});
