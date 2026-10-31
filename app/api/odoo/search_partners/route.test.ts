import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchOdoo = vi.fn();
vi.mock('@/app/services/odooService', () => ({ fetchOdoo: (...a: unknown[]) => fetchOdoo(...a) }));
vi.mock('@/app/lib/staffAuth', () => ({ requireStaffSession: async () => ({ response: null, session: { odooUid: 1 } }) }));

import { POST } from './route';

const buscar = async (query: string) => {
    const res = await POST(new Request('http://x/api/odoo/search_partners', { method: 'POST', body: JSON.stringify({ query }) }));
    return res.json();
};

describe('search_partners', () => {
    beforeEach(() => fetchOdoo.mockReset());

    it('al buscar por DNI, la ficha con ese documento exacto va primero y los clientes con contrato quedan marcados', async () => {
        fetchOdoo
            .mockResolvedValueOnce([
                { id: 617, name: 'ESCOBAR LUNA RAFAEL', vat: '10431602208' }, // misma persona, otro documento
                { id: 7, name: 'ESCOBAR LUNA, RAFAEL', vat: '43160220' },
            ])
            .mockResolvedValueOnce([{ partner_id: [7, 'ESCOBAR LUNA, RAFAEL'] }]);
        const r = await buscar('43160220');
        expect(r.results.map((x: { id: number }) => x.id)).toEqual([7, 617]);
        expect(r.results[0].tieneContrato).toBe(true);
        expect(r.results[1].tieneContrato).toBe(false);
    });

    it('busca por documento Y por el RUC 10 de la misma persona', async () => {
        fetchOdoo.mockResolvedValue([]);
        await buscar('43160220');
        const dominio = JSON.stringify(fetchOdoo.mock.calls[0][2]);
        expect(dominio).toContain('43160220');
        expect(dominio).toContain('10431602208');
    });

    it('si falla la marca de contratos, la búsqueda igual devuelve los clientes', async () => {
        fetchOdoo
            .mockResolvedValueOnce([{ id: 1, name: 'ANA', vat: '11111111' }])
            .mockRejectedValueOnce(new Error('sin permiso en simple.contract'));
        const r = await buscar('ana');
        expect(r).toMatchObject({ success: true, results: [{ id: 1, name: 'ANA' }] });
    });

    it('sin texto no consulta Odoo', async () => {
        const r = await buscar('');
        expect(r).toEqual({ success: true, results: [] });
        expect(fetchOdoo).not.toHaveBeenCalled();
    });
});
