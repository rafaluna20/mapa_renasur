import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * POST /api/avisos-pago: el cliente informa el pago de una cuota SIN factura (contrato Manual). El cliente sale de la
 * SESION, el contrato debe ser suyo (titular o copropietario) y Manual y Vigente; Odoo valida las reglas de fondo.
 */

let sesion: { user?: Record<string, unknown> } | null = null;
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => sesion) }));
vi.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));

const fetchOdooMock = vi.fn();
vi.mock('@/app/services/odooService', () => ({ fetchOdoo: (...a: unknown[]) => fetchOdooMock(...a) }));

const contratosMock = vi.fn();
vi.mock('@/app/lib/contratoEstadoCuenta', () => ({ contratosDelTitular: (...a: unknown[]) => contratosMock(...a) }));

import { POST } from './route';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
let partner = 1000;

function peticion(campos: Record<string, string | undefined> = {}, archivo: Buffer | null = PNG, nombre = 'voucher.png') {
    const fd = new FormData();
    const hoy = new Date().toISOString().slice(0, 10);
    const base: Record<string, string | undefined> = {
        contract_id: '63', quota_number: '3', amount: '10000', bank_name: 'BCP', operation_number: 'OP-1',
        transfer_date: hoy, note: '', ...campos,
    };
    for (const [k, v] of Object.entries(base)) if (v !== undefined) fd.append(k, v);
    if (archivo) fd.append('file', new File([new Uint8Array(archivo)], nombre, { type: 'image/png' }));
    return new Request('http://x/api/avisos-pago', { method: 'POST', body: fd });
}

const contrato = (over: Record<string, unknown> = {}) => ({
    id: 63, state: 'confirmed', partnerId: 10, billingMode: 'manual', coOwnerIds: [partner], ...over,
});

const llamadas = (modelo: string, metodo: string) => fetchOdooMock.mock.calls.filter((c) => c[0] === modelo && c[1] === metodo);

beforeEach(() => {
    partner += 1; // un cliente distinto por prueba: el limitador de intentos es por cliente
    sesion = { user: { odooPartnerId: partner, email: `c${partner}@example.com` } };
    fetchOdooMock.mockReset();
    contratosMock.mockReset();
    contratosMock.mockResolvedValue([contrato()]);
    fetchOdooMock.mockImplementation(async (model: string, method: string) => {
        if (model === 'simple.contract.payment.notice' && method === 'create') return 501;
        if (model === 'ir.attachment' && method === 'create') return 9001;
        if (model === 'simple.contract.payment.notice' && method === 'read') return [{ id: 501, state: 'pending' }];
        return true;
    });
});

describe('POST /api/avisos-pago — acceso', () => {
    it('sin sesion responde 401 y no toca Odoo', async () => {
        sesion = null;
        const r = await POST(peticion());
        expect(r.status).toBe(401);
        expect(fetchOdooMock).not.toHaveBeenCalled();
    });
    it('una sesion sin cliente de Odoo responde 400', async () => {
        sesion = { user: { email: 'x@y.z' } };
        expect((await POST(peticion())).status).toBe(400);
    });
    it('el cliente sale de la sesion: un payer_id enviado en el formulario se ignora', async () => {
        await POST(peticion({ payer_id: '777', partner_id: '777' }));
        const crear = llamadas('simple.contract.payment.notice', 'create')[0];
        expect(crear[2][0].payer_id).toBe(partner);
        expect(JSON.stringify(crear)).not.toContain('777');
    });
});

describe('POST /api/avisos-pago — validaciones', () => {
    it('datos invalidos responden 400 y no crean nada', async () => {
        for (const campos of [{ amount: '0' }, { contract_id: 'x' }, { transfer_date: '2999-01-01' }]) {
            const r = await POST(peticion(campos));
            expect(r.status, JSON.stringify(campos)).toBe(400);
        }
        expect(llamadas('simple.contract.payment.notice', 'create')).toHaveLength(0);
    });
    it('sin archivo responde 400', async () => {
        expect((await POST(peticion({}, null))).status).toBe(400);
    });
    it('un archivo que no es imagen ni PDF autentico responde 400 y no crea nada', async () => {
        const r = await POST(peticion({}, Buffer.from('MZ\x90 ejecutable'), 'voucher.png'));
        expect(r.status).toBe(400);
        expect(llamadas('simple.contract.payment.notice', 'create')).toHaveLength(0);
    });
});

describe('POST /api/avisos-pago — de quien es el contrato', () => {
    it('un contrato que no es del cliente responde 403 y no crea nada', async () => {
        contratosMock.mockResolvedValue([contrato({ id: 99 })]);
        const r = await POST(peticion({ contract_id: '63' }));
        expect(r.status).toBe(403);
        expect(llamadas('simple.contract.payment.notice', 'create')).toHaveLength(0);
    });
    it('los contratos se buscan con el cliente de la sesion', async () => {
        await POST(peticion());
        expect(contratosMock).toHaveBeenCalledWith(partner);
    });
    it('un contrato Automatico responde 403 (sus cuotas las factura el sistema)', async () => {
        contratosMock.mockResolvedValue([contrato({ billingMode: 'auto' })]);
        expect((await POST(peticion())).status).toBe(403);
        expect(llamadas('simple.contract.payment.notice', 'create')).toHaveLength(0);
    });
    it('un contrato que no esta Vigente responde 403', async () => {
        contratosMock.mockResolvedValue([contrato({ state: 'closed' })]);
        expect((await POST(peticion())).status).toBe(403);
    });
    it('si no se pueden leer los contratos responde 502', async () => {
        contratosMock.mockRejectedValue(new Error('Odoo caido'));
        expect((await POST(peticion())).status).toBe(502);
    });
});

describe('POST /api/avisos-pago — creacion', () => {
    it('crea el aviso con los datos del formulario y adjunta el comprobante SOLO en Odoo', async () => {
        const r = await POST(peticion({ amount: '10000', bank_name: 'BCP', operation_number: 'OP-77' }));
        expect(r.status).toBe(201);
        const cuerpo = await r.json();
        expect(cuerpo).toMatchObject({ success: true, notice: { id: 501, state: 'pending' } });

        const crear = llamadas('simple.contract.payment.notice', 'create')[0][2][0];
        expect(crear).toMatchObject({ contract_id: 63, quota_number: 3, amount: 10000, bank_name: 'BCP', operation_number: 'OP-77' });

        const adjunto = llamadas('ir.attachment', 'create')[0][2][0];
        expect(adjunto).toMatchObject({ res_model: 'simple.contract.payment.notice', res_id: 501, public: false });
        expect(typeof adjunto.datas).toBe('string');
        const escribir = llamadas('simple.contract.payment.notice', 'write')[0];
        expect(escribir[2]).toEqual([[501], { attachment_ids: [[4, 9001]] }]);
    });
    it('el nombre del archivo se sanea', async () => {
        await POST(peticion({}, PNG, '../../mi voucher (1).png'));
        const adjunto = llamadas('ir.attachment', 'create')[0][2][0];
        expect(adjunto.name).toMatch(/^[a-zA-Z0-9._-]+$/);
    });
    it('un aviso con monto distinto lo informa como creado (el estado lo decide Odoo)', async () => {
        fetchOdooMock.mockImplementation(async (model: string, method: string) => {
            if (model === 'simple.contract.payment.notice' && method === 'create') return 502;
            if (model === 'ir.attachment') return 1;
            if (method === 'read') return [{ id: 502, state: 'observed' }];
            return true;
        });
        const r = await POST(peticion({ amount: '9000' }));
        expect(r.status).toBe(201);
        expect((await r.json()).notice.state).toBe('observed');
    });
});

describe('POST /api/avisos-pago — respuestas de Odoo', () => {
    const odooFalla = (texto: string) =>
        fetchOdooMock.mockImplementation(async (model: string, method: string) => {
            if (model === 'simple.contract.payment.notice' && method === 'create') throw new Error('Odoo Error: Odoo Server Error - ' + texto);
            return true;
        });

    it('un aviso abierto para esa cuota responde 409 con el mensaje de Odoo y no sube el archivo', async () => {
        odooFalla('Ya hay un aviso de pago abierto para la cuota 3 de este contrato. Espere a que administración lo resuelva.');
        const r = await POST(peticion());
        expect(r.status).toBe(409);
        expect((await r.json()).error).toContain('aviso de pago abierto');
        expect(llamadas('ir.attachment', 'create')).toHaveLength(0);
    });
    it('"no es titular ni copropietario" responde 403', async () => {
        odooFalla('Fulano no es titular ni copropietario de este contrato.');
        expect((await POST(peticion())).status).toBe(403);
    });
    it('cuota ya facturada u otro rechazo de Odoo responde 400 con su mensaje', async () => {
        odooFalla('La cuota 3 ya está facturada, está marcada como emitida en el portal o no se puede facturar en este contrato.');
        const r = await POST(peticion());
        expect(r.status).toBe(400);
        expect((await r.json()).error).toContain('ya está facturada');
    });
    it('un Odoo sin el modelo (modulo anterior a 3.24) responde 501', async () => {
        fetchOdooMock.mockImplementation(async () => { throw new Error("Odoo Error: Odoo Server Error - Object simple.contract.payment.notice doesn't exist"); });
        expect((await POST(peticion())).status).toBe(501);
    });
    it('no filtra trazas internas de Odoo al cliente', async () => {
        odooFalla('Traceback (most recent call last): ' + 'x'.repeat(600));
        const r = await POST(peticion());
        const { error } = await r.json();
        expect(error).not.toContain('Traceback');
        expect(error.length).toBeLessThan(200);
    });
    it('si falla adjuntar el comprobante, se intenta borrar el aviso y responde 502', async () => {
        fetchOdooMock.mockImplementation(async (model: string, method: string) => {
            if (model === 'simple.contract.payment.notice' && method === 'create') return 503;
            if (model === 'ir.attachment') throw new Error('disco lleno');
            return true;
        });
        const r = await POST(peticion());
        expect(r.status).toBe(502);
        expect(llamadas('simple.contract.payment.notice', 'unlink')[0][2]).toEqual([[503]]);
    });
});

describe('POST /api/avisos-pago — limite de intentos', () => {
    it('el cuarto intento en la misma hora responde 429', async () => {
        for (let i = 0; i < 3; i++) expect((await POST(peticion({ amount: '0' }))).status).toBe(400);
        const r = await POST(peticion());
        expect(r.status).toBe(429);
        expect(llamadas('simple.contract.payment.notice', 'create')).toHaveLength(0);
    });
});
