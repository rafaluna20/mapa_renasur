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

const obtenerMapaAliasMock = vi.fn(async (): Promise<Record<string, string>> => ({}));
vi.mock('@/app/lib/aliasLotesServidor', () => ({
    obtenerMapaAlias: () => obtenerMapaAliasMock(),
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
    obtenerMapaAliasMock.mockReset();
    obtenerMapaAliasMock.mockResolvedValue({});
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

describe('GET /api/invoices/statement — lote que cambió de código (alias)', () => {
    const preparar = (mapaAlias: Record<string, string>) => {
        obtenerMapaAliasMock.mockResolvedValue(mapaAlias);
        fetchLotContractInfoMock.mockResolvedValue(new Map());
        fetchOdooMock.mockImplementation(async (model: string) => {
            if (model === 'account.move') {
                return [
                    // factura emitida con el código VIEJO del lote 129C
                    invoice(10, 'CONTRATOMANUAL-E01MZD129P-C001', PEN, 42660, true),
                    // y una posterior ya con el código vigente
                    invoice(11, 'CONTRATOMANUAL-E01MZD1293-C002', PEN, 1000),
                ];
            }
            if (model === 'res.partner') return [{ phone: '999', mobile: false }];
            if (model === 'product.template') {
                return [{ default_code: 'E01MZD1293', list_price: 42660, x_mz: 'D', x_etapa: '1', x_lote: '129' }];
            }
            return [];
        });
    };

    it('con alias: la factura con el código viejo se agrupa con el lote actual, con sus datos y su contrato', async () => {
        preparar({ E01MZD129P: 'E01MZD1293' });
        const { lots } = await callGet();
        expect(lots).toHaveLength(1);                       // un solo lote, no «E01MZD129P» aparte
        expect(lots[0].code).toBe('E01MZD1293');
        expect(lots[0].label).toBe('Etapa 1 Mz D Lote 129C');
        expect(lots[0].listPrice).toBe(42660);
        expect(lots[0].invoices).toHaveLength(2);
        expect(fetchLotContractInfoMock.mock.calls[0][0]).toEqual(['E01MZD1293']);   // el contrato se busca por el código vigente
    });

    it('sin alias: igual que antes (el código viejo queda como lote aparte, sin datos)', async () => {
        preparar({});
        const { lots } = await callGet();
        const viejo = lots.find((l: { code: string }) => l.code === 'E01MZD129P');
        expect(viejo.label).toBe('E01MZD129P');
        expect(viejo.numeroLote).toBeNull();
        expect(lots.find((l: { code: string }) => l.code === 'E01MZD1293').invoices).toHaveLength(1);
    });
});


/**
 * Estado de cuenta POR CONTRATO (ficha mapa_estado_cuenta_por_contrato, criterio C3).
 * Un copropietario ve las facturas de su contrato aunque hayan salido a nombre del otro titular; quien no es titular
 * ni copropietario sigue viendo solo lo suyo. El contrato sale de la SESIÓN del servidor, nunca de un parámetro.
 */
describe('GET /api/invoices/statement — por contrato (copropietarios)', () => {
    const contratoFila = (over: Record<string, unknown> = {}) => ({
        id: 63, state: 'confirmed', partner_id: [10, 'Titular 1'], product_id: [900, 'Lote'],
        billing_mode: 'manual', co_owner_ids: [77], ...over,
    });

    const preparar = (opts: { contratos?: Record<string, unknown>[]; v322?: boolean; cronograma?: Record<string, unknown>[] }) => {
        fetchLotContractInfoMock.mockResolvedValue(new Map());
        fetchOdooMock.mockImplementation(async (model: string, _method: string, args: unknown[], kwargs: Record<string, unknown> = {}) => {
            if (model === 'simple.contract') {
                if (opts.v322 && JSON.stringify(args).includes('co_owner_ids')) throw new Error('Invalid field co_owner_ids');
                if (opts.v322 && ((kwargs.fields as string[]) || []).includes('billing_mode')) throw new Error('Invalid field billing_mode');
                return opts.contratos ?? [];
            }
            if (model === 'product.product') return [{ id: 900, default_code: 'E01MZP037P' }];
            if (model === 'simple.contract.schedule') return opts.cronograma ?? [];
            if (model === 'account.move') {
                return [
                    { ...invoice(1, 'CONTRATOMANUAL-E01MZP037P-C001', PEN, 1000, true), contract_id: [63, 'c'], contract_quota_number: 1 },
                    { ...invoice(2, 'CONTRATOMANUAL-E01MZP037P-C002', PEN, 1000, true), contract_id: [63, 'c'], contract_quota_number: 2 },
                ];
            }
            if (model === 'res.partner') return [{ phone: '999', mobile: false }];
            if (model === 'product.template') return [{ default_code: 'E01MZP037P', list_price: 60000, x_mz: 'P', x_etapa: '1', x_lote: '37' }];
            return [];
        });
    };

    const dominioFacturas = () => fetchOdooMock.mock.calls.find((c) => c[0] === 'account.move')![2][0];

    it('un copropietario recibe también las facturas de su contrato (a nombre del otro titular)', async () => {
        preparar({ contratos: [contratoFila()] });
        const { lots } = await callGet();
        const d = JSON.stringify(dominioFacturas());
        expect(d).toContain('["partner_id","=",77]');
        expect(d).toContain('["contract_id","in",[63]]');
        expect(lots[0].invoices).toHaveLength(2);
    });

    it('los contratos se buscan con el cliente de la SESIÓN (77), como titular o copropietario', async () => {
        preparar({ contratos: [contratoFila()] });
        await callGet();
        const llamada = fetchOdooMock.mock.calls.find((c) => c[0] === 'simple.contract')!;
        const dom = JSON.stringify(llamada[2]);
        expect(dom).toContain('["partner_id","=",77]');
        expect(dom).toContain('["co_owner_ids","in",[77]]');
    });

    it('quien no es titular ni copropietario sigue viendo solo lo suyo (el filtro no cambia)', async () => {
        preparar({ contratos: [] });
        await callGet();
        expect(dominioFacturas()).toEqual([
            ['partner_id', '=', 77],
            ['move_type', '=', 'out_invoice'],
            ['state', '=', 'posted'],
        ]);
    });

    it('no expone a nombre de quién salió cada factura (no se filtra el nombre del otro titular)', async () => {
        preparar({ contratos: [contratoFila()] });
        await callGet();
        const campos = fetchOdooMock.mock.calls.find((c) => c[0] === 'account.move')![3].fields as string[];
        expect(campos).not.toContain('partner_id');
        expect(campos).toContain('contract_id');
        expect(campos).toContain('contract_quota_number');
    });

    it('contrato Manual: el lote lleva su cronograma, también si todavía no tiene ninguna factura', async () => {
        preparar({
            contratos: [contratoFila()],
            cronograma: [{ sequence: 3, date: '2026-10-15', amount: 1000, portal_emitted: false }],
        });
        const { lots } = await callGet();
        const lot = lots.find((l: { code: string }) => l.code === 'E01MZP037P');
        expect(lot.scheduleLines).toEqual([{ sequence: 3, date: '2026-10-15', amount: 1000, portal_emitted: false }]);
    });

    it('agrupa por el lote del CONTRATO aunque la referencia de la factura no traiga el codigo (ej. "CTR10691-C001")', async () => {
        preparar({
            contratos: [contratoFila()],
            cronograma: [{ sequence: 3, date: '2026-10-15', amount: 1000, portal_emitted: false }],
        });
        fetchOdooMock.mockImplementation(async (model: string) => {
            if (model === 'simple.contract') return [contratoFila()];
            if (model === 'product.product') return [{ id: 900, default_code: 'E01MZP037P' }];
            if (model === 'simple.contract.schedule') return [{ sequence: 3, date: '2026-10-15', amount: 1000, portal_emitted: false }];
            if (model === 'account.move') {
                return [
                    { ...invoice(1, 'CTR10691-C001', PEN, 1000, true), contract_id: [63, 'c'], contract_quota_number: 1 },
                    { ...invoice(2, 'CTR10691-C002', PEN, 1000, true), contract_id: [63, 'c'], contract_quota_number: 2 },
                ];
            }
            if (model === 'res.partner') return [{ phone: '999', mobile: false }];
            if (model === 'product.template') return [{ default_code: 'E01MZP037P', list_price: 60000, x_mz: 'P', x_etapa: '1', x_lote: '37' }];
            return [];
        });
        const { lots } = await callGet();
        expect(lots).toHaveLength(1);
        expect(lots[0].code).toBe('E01MZP037P');         // no "SIN_LOTE" / "Otros pagos"
        expect(lots[0].label).toBe('Etapa 1 Mz P Lote 37');
        expect(lots[0].invoices).toHaveLength(2);
        expect(lots[0].scheduleLines).toHaveLength(1);    // el cronograma queda en el mismo lote
    });

    it('una factura SIN contrato sigue agrupandose por la referencia, como siempre', async () => {
        preparar({ contratos: [] });
        const { lots } = await callGet();
        expect(lots[0].code).toBe('E01MZP037P');
    });

    it('un lote Manual en DOLARES que aun no tiene ninguna factura sale en dolares (moneda del contrato), no en soles', async () => {
        preparar({
            contratos: [contratoFila()],
            cronograma: [{ sequence: 1, date: '2026-09-01', amount: 500, portal_emitted: false }],
        });
        fetchLotContractInfoMock.mockResolvedValue(new Map([
            ['E01MZP037P', { contractId: 63, state: 'confirmed', currency: 'USD', finalPrice: 60000 }],
        ]));
        const base = fetchOdooMock.getMockImplementation()!;
        fetchOdooMock.mockImplementation(async (model: string, ...resto: unknown[]) => (model === 'account.move' ? [] : base(model, ...resto)));
        const { lots } = await callGet();
        const lot = lots.find((l: { code: string }) => l.code === 'E01MZP037P');
        expect(lot.invoices).toHaveLength(0);
        expect(lot.currency).toBe('USD');
        expect(lot.listPrice).toBe(60000);
        expect(lot.scheduleLines).toHaveLength(1);
    });

    it('un contrato Manual CERRADO no aporta cuotas por facturar (no se inventa deuda en un contrato terminado)', async () => {
        preparar({
            contratos: [contratoFila({ state: 'closed' })],
            cronograma: [{ sequence: 3, date: '2026-10-15', amount: 1000, portal_emitted: false }],
        });
        const { lots } = await callGet();
        expect(lots[0].scheduleLines).toEqual([]);
        expect(fetchOdooMock.mock.calls.some((c) => c[0] === 'simple.contract.schedule')).toBe(false);
    });

    it('contrato Automático: no se pide cronograma y el lote no lleva cuotas por facturar', async () => {
        preparar({ contratos: [contratoFila({ billing_mode: 'auto' })] });
        const { lots } = await callGet();
        expect(lots[0].scheduleLines).toEqual([]);
        expect(fetchOdooMock.mock.calls.some((c) => c[0] === 'simple.contract.schedule')).toBe(false);
    });

    it('con un Odoo v3.22 (sin copropietarios) funciona como antes: los contratos del titular principal, Automáticos', async () => {
        preparar({ v322: true, contratos: [{ id: 63, state: 'confirmed', partner_id: [77, 'Yo'], product_id: [900, 'Lote'] }] });
        const { success, lots } = await callGet();
        expect(success).toBe(true);
        expect(lots[0].invoices).toHaveLength(2);
        expect(lots[0].scheduleLines).toEqual([]);
        // el respaldo (solo titular principal) SÍ encontró el contrato: las facturas se piden por contrato
        expect(JSON.stringify(dominioFacturas())).toContain('["contract_id","in",[63]]');
    });

    it('si falla la lectura de contratos, el estado de cuenta sale igual que antes (solo por cliente)', async () => {
        fetchLotContractInfoMock.mockResolvedValue(new Map());
        fetchOdooMock.mockImplementation(async (model: string) => {
            if (model === 'simple.contract') throw new Error('boom');
            if (model === 'account.move') return [invoice(1, 'CONTRATOMANUAL-E01MZP037P-C001', PEN, 1000, true)];
            if (model === 'res.partner') return [{ phone: '999', mobile: false }];
            return [];
        });
        const { success, lots } = await callGet();
        expect(success).toBe(true);
        expect(lots).toHaveLength(1);
    });
});
