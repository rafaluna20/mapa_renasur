import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchOdoo = vi.fn();
vi.mock('@/app/services/odooService', () => ({
    fetchOdoo: (...a: unknown[]) => fetchOdoo(...a),
    inferIdentificationTypeId: (v: string) => (v.length === 8 ? 5 : 4),
}));
vi.mock('@/app/lib/staffAuth', () => ({ requireStaffSession: async () => ({ response: null, session: { odooUid: 1 } }) }));

import { POST } from './route';

const llamar = async (body: Record<string, unknown>) => {
    const res = await POST(new Request('http://x/api/odoo/update_partner', { method: 'POST', body: JSON.stringify(body) }));
    return { status: res.status, ...(await res.json()) };
};

describe('update_partner: corregir un documento no puede duplicar a otro cliente', () => {
    beforeEach(() => fetchOdoo.mockReset());

    it('si el nuevo documento ya es de OTRO cliente, se rechaza con 409 y no se escribe', async () => {
        fetchOdoo.mockResolvedValueOnce([{ id: 7, name: 'ESCOBAR LUNA, RAFAEL', vat: '43160220' }]);
        const r = await llamar({ id: 99, name: 'Rafael', vat: '43160220' });
        expect(r).toMatchObject({ success: false, status: 409, code: 'documento_duplicado', existing: { id: 7 } });
        expect(fetchOdoo.mock.calls.some((c) => c[1] === 'write')).toBe(false);
        // la búsqueda excluye al propio cliente
        expect(JSON.stringify(fetchOdoo.mock.calls[0][2])).toContain('["id","!=",99]');
    });

    it('un documento libre se guarda normalizado', async () => {
        fetchOdoo.mockResolvedValueOnce([]).mockResolvedValueOnce(true);
        const r = await llamar({ id: 99, name: 'Rafael', vat: '4316-0220' });
        expect(r).toMatchObject({ success: true, id: 99 });
        const escritura = fetchOdoo.mock.calls.find((c) => c[1] === 'write')!;
        expect((escritura[2] as [number[], { vat: string }])[1].vat).toBe('43160220');
    });

    it('un documento mal formado se rechaza', async () => {
        expect((await llamar({ id: 99, name: 'X', vat: '123' })).status).toBe(400);
    });
});
