import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchOdooMock = vi.fn();
vi.mock('@/app/services/odooService', () => ({
    fetchOdoo: (...args: unknown[]) => fetchOdooMock(...args),
}));

import { fetchLotContractInfo } from './lotContract';

const USD: [number, string] = [1, 'USD'];
const PEN: [number, string] = [157, 'PEN'];

function setupOdoo(contracts: unknown[]) {
    fetchOdooMock.mockImplementation(async (model: string) => {
        if (model === 'product.product') return [{ id: 2710, default_code: 'E01MZS090P' }, { id: 2226, default_code: 'E01MZQ029P' }];
        if (model === 'simple.contract') return contracts;
        return [];
    });
}

beforeEach(() => { fetchOdooMock.mockReset(); }); // llaves: si devolviera el mock, vitest lo ejecutaría como teardown

describe('fetchLotContractInfo', () => {
    it('devuelve moneda y precio final pactado del contrato del lote (en su moneda)', async () => {
        setupOdoo([{ id: 389, state: 'confirmed', product_id: [2710, '[E01MZS090P] lote'], currency_id: USD, final_price: 100176 }]);
        const map = await fetchLotContractInfo(['E01MZS090P']);
        expect(map.get('E01MZS090P')).toEqual({ contractId: 389, state: 'confirmed', currency: 'USD', finalPrice: 100176 });
    });

    it('un lote en soles se reporta en PEN', async () => {
        setupOdoo([{ id: 10, state: 'confirmed', product_id: [2226, '[E01MZQ029P] lote'], currency_id: PEN, final_price: 118800 }]);
        expect((await fetchLotContractInfo(['E01MZQ029P'])).get('E01MZQ029P')?.currency).toBe('PEN');
    });

    it('con varios contratos en el mismo lote prefiere el confirmado sobre un borrador, sin importar el orden', async () => {
        setupOdoo([
            { id: 100, state: 'confirmed', product_id: [2710, 'x'], currency_id: USD, final_price: 100176 },
            { id: 200, state: 'draft', product_id: [2710, 'x'], currency_id: PEN, final_price: 360633.6 },
        ]);
        const info = (await fetchLotContractInfo(['E01MZS090P'])).get('E01MZS090P');
        expect(info?.contractId).toBe(100);
        expect(info?.currency).toBe('USD');
    });

    it('entre contratos del mismo estado gana el más reciente (mayor id)', async () => {
        setupOdoo([
            { id: 100, state: 'confirmed', product_id: [2710, 'x'], currency_id: PEN, final_price: 360633.6 },
            { id: 389, state: 'confirmed', product_id: [2710, 'x'], currency_id: USD, final_price: 100176 },
        ]);
        expect((await fetchLotContractInfo(['E01MZS090P'])).get('E01MZS090P')?.contractId).toBe(389);
    });

    it('solo consulta contratos vigentes (borrador/confirmado): los cerrados se excluyen desde la consulta', async () => {
        setupOdoo([]);
        await fetchLotContractInfo(['E01MZS090P']);
        const contractCall = fetchOdooMock.mock.calls.find((c) => c[0] === 'simple.contract')!;
        expect(JSON.stringify(contractCall[2])).toContain('"draft","confirmed"');
    });

    it('ante un fallo de Odoo devuelve un mapa vacío (la pantalla cae al catálogo en soles, no se rompe)', async () => {
        fetchOdooMock.mockImplementation(async () => { throw new Error('Odoo caído'); });
        const map = await fetchLotContractInfo(['E01MZS090P']);
        expect(map.size).toBe(0);
    });

    it('sin códigos no consulta nada', async () => {
        expect((await fetchLotContractInfo([])).size).toBe(0);
        expect(fetchOdooMock).not.toHaveBeenCalled();
    });
});
