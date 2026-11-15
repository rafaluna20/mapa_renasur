import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchOdoo = vi.fn();
vi.mock('@/app/services/odooService', () => ({ fetchOdoo: (...a: unknown[]) => fetchOdoo(...a) }));
vi.mock('@/app/lib/staffAuth', () => ({ requireStaffSession: async () => ({ response: null, session: { odooUid: 1 } }) }));

import { POST } from './route';

const llamar = async (body: Record<string, unknown>) => {
    const res = await POST(new Request('http://x/api/odoo/get_client_invoices', { method: 'POST', body: JSON.stringify(body) }));
    return res.json();
};

type Dato = Record<string, unknown>;
interface Escenario {
    contratos?: Dato[];                 // filas de simple.contract (con campos v3.23)
    contratosFallaV323?: boolean;       // Odoo < 3.23: pedir billing_mode/co_owner_ids da error
    cronograma?: Dato[];
    cronogramaFallaPortal?: boolean;
    facturas?: Dato[];
    productos?: Dato[];
    lineas?: Dato[];
    partners?: Dato[];                  // filas de res.partner (copropietarios)
    partnersFalla?: boolean;
}

function odoo(e: Escenario) {
    fetchOdoo.mockImplementation(async (model: string, _m: string, args: unknown[], kwargs: Dato = {}) => {
        if (model === 'product.product') return e.productos ?? [{ id: 900 }];
        if (model === 'account.move.line') return e.lineas ?? [{ move_id: [11, 'x'] }, { move_id: [12, 'y'] }];
        if (model === 'simple.contract') {
            const campos = (kwargs.fields as string[]) || [];
            if (e.contratosFallaV323 && campos.includes('billing_mode')) throw new Error('Invalid field billing_mode');
            return e.contratos ?? [];
        }
        if (model === 'simple.contract.schedule') {
            const campos = (kwargs.fields as string[]) || [];
            if (e.cronogramaFallaPortal && campos.includes('portal_emitted')) throw new Error('Invalid field portal_emitted');
            return e.cronograma ?? [];
        }
        if (model === 'res.partner') {
            if (e.partnersFalla) throw new Error('sin permiso en res.partner');
            return e.partners ?? [];
        }
        if (model === 'account.move') return e.facturas ?? [];
        throw new Error('modelo inesperado ' + model);
    });
}

const dominioFacturas = () => {
    const c = fetchOdoo.mock.calls.find((x) => x[0] === 'account.move');
    return c ? (c[2] as unknown[][])[0] : null;
};

describe('get_client_invoices — por contrato', () => {
    beforeEach(() => {
        fetchOdoo.mockReset();
    });

    it('con contrato, pide las facturas por contract_id y no solo por el cliente (dos pagadores)', async () => {
        odoo({
            contratos: [{ id: 63, state: 'confirmed', partner_id: [10, 'T1'], billing_mode: 'manual', co_owner_ids: [20] }],
            facturas: [
                { id: 11, partner_id: [10, 'T1'], contract_id: [63, 'c'] },
                { id: 12, partner_id: [20, 'T2'], contract_id: [63, 'c'] },
            ],
        });
        const r = await llamar({ partnerId: 10, productCode: 'E01MZX001P' });
        expect(r.success).toBe(true);
        expect(r.invoices).toHaveLength(2);
        const d = JSON.stringify(dominioFacturas());
        expect(d).toContain('["contract_id","=",63]');
        // el filtro solo por el cliente 10 ya NO es el que manda
        expect(d).not.toContain('["partner_id","=",10]');
        expect(r.contract).toMatchObject({ id: 63, billingMode: 'manual', coOwnerIds: [20] });
    });

    it('las facturas viejas sin contrato entran por cliente + lote, pero solo de los titulares (no mezcla a un tercero)', async () => {
        odoo({ contratos: [{ id: 63, state: 'confirmed', partner_id: [10, 'T1'], billing_mode: 'manual', co_owner_ids: [20] }] });
        await llamar({ partnerId: 10, productCode: 'E01MZX001P' });
        const d = JSON.stringify(dominioFacturas());
        expect(d).toContain('["contract_id","=",false]');
        expect(d).toContain('["partner_id","in",[10,20]]');
    });

    it('elige el contrato confirmado antes que uno cerrado anterior del mismo lote (no mezcla el contrato resuelto)', async () => {
        odoo({
            contratos: [
                { id: 70, state: 'confirmed', partner_id: [10, 'T1'], billing_mode: 'auto', co_owner_ids: [] },
                { id: 40, state: 'closed', partner_id: [10, 'T1'], billing_mode: 'auto', co_owner_ids: [] },
            ],
        });
        const r = await llamar({ partnerId: 10, productCode: 'E01MZX001P' });
        expect(r.contract.id).toBe(70);
        expect(JSON.stringify(dominioFacturas())).toContain('["contract_id","=",70]');
        expect(JSON.stringify(dominioFacturas())).not.toContain('["contract_id","=",40]');
    });

    it('sin confirmado, usa el cerrado más reciente; el borrador nunca cuenta', async () => {
        odoo({ contratos: [{ id: 40, state: 'closed', partner_id: [10, 'T1'], billing_mode: 'auto', co_owner_ids: [] }] });
        const r = await llamar({ partnerId: 10, productCode: 'E01MZX001P' });
        expect(r.contract.id).toBe(40);
        const llamadaContratos = fetchOdoo.mock.calls.find((c) => c[0] === 'simple.contract');
        expect(JSON.stringify(llamadaContratos?.[2])).toContain('"confirmed","closed"');
        expect(JSON.stringify(llamadaContratos?.[2])).not.toContain('draft');
    });

    it('en un contrato Manual trae el cronograma; en uno Automático no lo pide', async () => {
        odoo({
            contratos: [{ id: 63, state: 'confirmed', partner_id: [10, 'T1'], billing_mode: 'manual', co_owner_ids: [20] }],
            cronograma: [{ sequence: 1, date: '2026-09-15', amount: 1000, portal_emitted: false }],
        });
        const manual = await llamar({ partnerId: 10, productCode: 'E01MZX001P' });
        expect(manual.scheduleLines).toEqual([{ sequence: 1, date: '2026-09-15', amount: 1000, portal_emitted: false }]);

        fetchOdoo.mockReset();
        odoo({ contratos: [{ id: 64, state: 'confirmed', partner_id: [10, 'T1'], billing_mode: 'auto', co_owner_ids: [] }] });
        const auto = await llamar({ partnerId: 10, productCode: 'E01MZX002P' });
        expect(auto.scheduleLines).toEqual([]);
        expect(fetchOdoo.mock.calls.some((c) => c[0] === 'simple.contract.schedule')).toBe(false);
    });

    it('un contrato Manual cerrado no trae cronograma (no se inventa deuda en un contrato terminado)', async () => {
        odoo({
            contratos: [{ id: 63, state: 'closed', partner_id: [10, 'T1'], billing_mode: 'manual', co_owner_ids: [20] }],
            cronograma: [{ sequence: 1, date: '2026-09-15', amount: 1000, portal_emitted: false }],
        });
        const r = await llamar({ partnerId: 10, productCode: 'E01MZX001P' });
        expect(r.scheduleLines).toEqual([]);
        expect(fetchOdoo.mock.calls.some((c) => c[0] === 'simple.contract.schedule')).toBe(false);
    });

    it('un fallo al leer el cronograma no tumba el estado de cuenta (queda sin cuotas por facturar)', async () => {
        odoo({ contratos: [{ id: 63, state: 'confirmed', partner_id: [10, 'T1'], billing_mode: 'manual', co_owner_ids: [] }] });
        fetchOdoo.mockImplementation(async (model: string) => {
            if (model === 'simple.contract') return [{ id: 63, state: 'confirmed', partner_id: [10, 'T1'], billing_mode: 'manual', co_owner_ids: [] }];
            if (model === 'simple.contract.schedule') throw new Error('boom');
            if (model === 'product.product') return [{ id: 900 }];
            if (model === 'account.move.line') return [];
            return [];
        });
        const r = await llamar({ partnerId: 10, productCode: 'E01MZX001P' });
        expect(r.success).toBe(true);
        expect(r.scheduleLines).toEqual([]);
    });
});

describe('get_client_invoices — compatibilidad con Odoo v3.22 y sin contrato', () => {
    beforeEach(() => {
        fetchOdoo.mockReset();
    });

    it('con un Odoo sin billing_mode/co_owner_ids sigue funcionando: contrato Automático sin copropietarios', async () => {
        odoo({
            contratosFallaV323: true,
            contratos: [{ id: 63, state: 'confirmed', partner_id: [10, 'T1'] }],
        });
        const r = await llamar({ partnerId: 10, productCode: 'E01MZX001P' });
        expect(r.success).toBe(true);
        expect(r.contract).toMatchObject({ id: 63, billingMode: 'auto', coOwnerIds: [] });
        expect(r.scheduleLines).toEqual([]);
    });

    it('un lote sin contrato conserva exactamente el filtro de siempre (cliente + facturas del lote)', async () => {
        odoo({ contratos: [] });
        await llamar({ partnerId: 10, productCode: 'E01MZX001P' });
        expect(dominioFacturas()).toEqual([
            ['id', 'in', [11, 12]],
            ['partner_id', '=', 10],
            ['move_type', '=', 'out_invoice'],
            ['state', '=', 'posted'],
        ]);
    });

    it('si falla la lectura del contrato, el estado de cuenta sale igual que antes (cliente + lote)', async () => {
        fetchOdoo.mockImplementation(async (model: string) => {
            if (model === 'simple.contract') throw new Error('boom');
            if (model === 'product.product') return [{ id: 900 }];
            if (model === 'account.move.line') return [{ move_id: [11, 'x'] }];
            if (model === 'account.move') return [{ id: 11 }];
            return [];
        });
        const r = await llamar({ partnerId: 10, productCode: 'E01MZX001P' });
        expect(r.success).toBe(true);
        expect(r.invoices).toEqual([{ id: 11 }]);
        expect(r.contract).toBeNull();
        expect(dominioFacturas()).toEqual([
            ['id', 'in', [11]],
            ['partner_id', '=', 10],
            ['move_type', '=', 'out_invoice'],
            ['state', '=', 'posted'],
        ]);
    });

    it('sin contrato y sin líneas de factura del lote devuelve vacío (igual que antes)', async () => {
        odoo({ contratos: [], lineas: [] });
        const r = await llamar({ partnerId: 10, productCode: 'E01MZX001P' });
        expect(r).toEqual({ success: true, invoices: [] });
    });

    it('sin productCode trae todas las facturas del cliente (igual que antes)', async () => {
        odoo({});
        await llamar({ partnerId: 10 });
        expect(dominioFacturas()).toEqual([
            ['partner_id', '=', 10],
            ['move_type', '=', 'out_invoice'],
            ['state', '=', 'posted'],
        ]);
        expect(fetchOdoo.mock.calls.some((c) => c[0] === 'simple.contract')).toBe(false);
    });

    it('un partnerId inválido sigue dando 400', async () => {
        odoo({});
        const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ partnerId: 'abc' }) }));
        expect(res.status).toBe(400);
    });
});

describe('get_client_invoices — copropietarios del contrato', () => {
    beforeEach(() => {
        fetchOdoo.mockReset();
    });

    it('con copropietarios devuelve su nombre, DNI y teléfono para el estado de cuenta', async () => {
        odoo({
            contratos: [{ id: 63, state: 'confirmed', partner_id: [10, 'T1'], billing_mode: 'manual', co_owner_ids: [20, 21] }],
            partners: [
                { id: 21, name: 'LUIS RAMOS', vat: false, phone: false, mobile: '999000111' },
                { id: 20, name: 'ANA PEREZ', vat: '43160220', phone: '014445566', mobile: false },
            ],
        });
        const r = await llamar({ partnerId: 10, productCode: 'E01MZP037P' });
        expect(r.contract.coOwners).toEqual([
            { id: 20, name: 'ANA PEREZ', dni: '43160220', phone: '014445566' },
            { id: 21, name: 'LUIS RAMOS', dni: null, phone: '999000111' },
        ]);
        // solo se leen los copropietarios de ESTE contrato
        const lectura = fetchOdoo.mock.calls.find((c) => c[0] === 'res.partner')!;
        expect(JSON.stringify(lectura[2])).toContain('[20,21]');
    });

    it('sin copropietarios no manda nada y ni siquiera consulta res.partner', async () => {
        odoo({ contratos: [{ id: 63, state: 'confirmed', partner_id: [10, 'T1'], billing_mode: 'auto', co_owner_ids: [] }] });
        const r = await llamar({ partnerId: 10, productCode: 'E01MZP037P' });
        expect(r.contract.coOwners).toEqual([]);
        expect(fetchOdoo.mock.calls.some((c) => c[0] === 'res.partner')).toBe(false);
    });

    it('si falla la lectura de los copropietarios, el estado de cuenta sale igual (sin esa información)', async () => {
        odoo({
            contratos: [{ id: 63, state: 'confirmed', partner_id: [10, 'T1'], billing_mode: 'manual', co_owner_ids: [20] }],
            partnersFalla: true,
            facturas: [{ id: 11, partner_id: [10, 'T1'], contract_id: [63, 'c'] }],
        });
        const r = await llamar({ partnerId: 10, productCode: 'E01MZP037P' });
        expect(r.success).toBe(true);
        expect(r.invoices).toHaveLength(1);
        expect(r.contract.coOwners).toEqual([]);
    });

    it('un lote sin contrato no trae copropietarios', async () => {
        odoo({ contratos: [], lineas: [{ move_id: [11, 'x'] }] });
        const r = await llamar({ partnerId: 10, productCode: 'E01MZX001P' });
        expect(r.contract).toBeNull();
    });
});
