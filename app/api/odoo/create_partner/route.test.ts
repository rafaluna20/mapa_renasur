import { describe, it, expect, vi, beforeEach } from 'vitest';

type Partner = { id: number; name: string; vat: string | false; active: boolean };
let partners: Partner[] = [];
let siguienteId = 1000;
let rechazarCreateConMensajeDeOdoo = false;

const fetchOdoo = vi.fn(async (model: string, method: string, args: unknown[]) => {
    if (model !== 'res.partner') throw new Error('modelo inesperado ' + model);
    if (method === 'search_read') {
        // El dominio real lleva ilike; aquí basta con devolver los que contengan alguno de los documentos pedidos.
        const dominio = args[0] as unknown[];
        const docs = dominio.filter((t): t is unknown[] => Array.isArray(t) && t[0] === 'vat').map((t) => String(t[2]));
        const excluir = dominio.find((t) => Array.isArray(t) && t[0] === 'id') as unknown[] | undefined;
        return partners.filter(
            (p) => p.active && p.vat && docs.some((d) => String(p.vat).includes(d)) && (!excluir || p.id !== excluir[2])
        );
    }
    if (method === 'create') {
        if (rechazarCreateConMensajeDeOdoo) {
            // Simula que otro proceso lo creó justo antes y Odoo lo rechaza por repetido.
            partners.push({ id: siguienteId++, name: 'CREADO POR OTRO', vat: (args[0] as { vat: string }).vat, active: true });
            throw new Error('Ya existe un contacto con el documento 43160220: CREADO POR OTRO (ID 999).');
        }
        const datos = args[0] as { name: string; vat: string };
        const id = siguienteId++;
        partners.push({ id, name: datos.name, vat: datos.vat, active: true });
        return id;
    }
    throw new Error('método inesperado ' + method);
});

vi.mock('@/app/services/odooService', () => ({
    fetchOdoo: (...a: [string, string, unknown[]]) => fetchOdoo(...a),
    inferIdentificationTypeId: (v: string) => (v.length === 8 ? 5 : 4),
}));
vi.mock('@/app/lib/staffAuth', () => ({ requireStaffSession: async () => ({ response: null, session: { odooUid: 1 } }) }));

import { POST } from './route';

const llamar = async (body: Record<string, unknown>) => {
    const res = await POST(new Request('http://x/api/odoo/create_partner', { method: 'POST', body: JSON.stringify(body) }));
    return { status: res.status, ...(await res.json()) };
};
const creaciones = () => fetchOdoo.mock.calls.filter((c) => c[1] === 'create');

describe('create_partner: un cliente no se registra dos veces', () => {
    beforeEach(() => {
        partners = [];
        siguienteId = 1000;
        rechazarCreateConMensajeDeOdoo = false;
        fetchOdoo.mockClear();
    });

    it('un documento nuevo se crea, con el documento normalizado a solo dígitos', async () => {
        const r = await llamar({ name: 'Ana Pérez', vat: '4316-0220' });
        expect(r).toMatchObject({ success: true, existed: false, name: 'Ana Pérez' });
        expect(creaciones()).toHaveLength(1);
        expect((creaciones()[0][2] as { vat: string }[])[0].vat).toBe('43160220');
    });

    it('si el DNI ya está registrado NO se crea otro: se devuelve la ficha existente', async () => {
        partners = [{ id: 7, name: 'ESCOBAR LUNA, RAFAEL', vat: '43160220', active: true }];
        const r = await llamar({ name: 'Rafael Escobar', vat: '43160220' });
        expect(r).toMatchObject({ success: true, existed: true, id: 7, name: 'ESCOBAR LUNA, RAFAEL' });
        expect(creaciones()).toHaveLength(0);
    });

    it('un titular que figura en un campo con dos documentos también cuenta como existente', async () => {
        partners = [{ id: 750, name: 'SANCHEZ LAZO Y POMA', vat: '10242342 / 28587662', active: true }];
        const r = await llamar({ name: 'Obdulia Poma', vat: '28587662' });
        expect(r).toMatchObject({ success: true, existed: true, id: 750 });
        expect(creaciones()).toHaveLength(0);
    });

    it('doble clic: dos envíos simultáneos del mismo DNI crean un solo cliente', async () => {
        const [a, b] = await Promise.all([
            llamar({ name: 'Gisell Carranza', vat: '41058198' }),
            llamar({ name: 'Gisell Carranza', vat: '41058198' }),
        ]);
        expect(creaciones()).toHaveLength(1);
        expect(a.id).toBe(b.id);
        expect([a.existed, b.existed].sort()).toEqual([false, true]);
    });

    it('la misma persona con su otro documento (DNI y RUC 10) avisa y no crea hasta que se confirme', async () => {
        partners = [{ id: 617, name: 'ESCOBAR LUNA RAFAEL', vat: '10431602208', active: true }];
        const aviso = await llamar({ name: 'Rafael Escobar', vat: '43160220' });
        expect(aviso).toMatchObject({ success: false, code: 'documento_equivalente', existing: { id: 617 } });
        expect(creaciones()).toHaveLength(0);

        const confirmado = await llamar({ name: 'Rafael Escobar', vat: '43160220', confirmarEquivalente: true });
        expect(confirmado).toMatchObject({ success: true, existed: false });
        expect(creaciones()).toHaveLength(1);
    });

    it('si Odoo rechaza el alta por repetida (carrera entre procesos), se usa la ficha que quedó registrada', async () => {
        rechazarCreateConMensajeDeOdoo = true;
        const r = await llamar({ name: 'Otro Vendedor', vat: '43160220' });
        expect(r).toMatchObject({ success: true, existed: true, name: 'CREADO POR OTRO' });
    });

    it('un error de Odoo distinto sí se informa', async () => {
        fetchOdoo.mockImplementationOnce(async () => []).mockImplementationOnce(async () => {
            throw new Error('Odoo caído');
        });
        const r = await llamar({ name: 'X', vat: '43160220' });
        expect(r).toMatchObject({ success: false, status: 500, error: 'Odoo caído' });
    });

    it('sin documento válido (8 u 11 dígitos) se rechaza antes de tocar Odoo', async () => {
        expect((await llamar({ name: 'X', vat: '12345' })).status).toBe(400);
        expect((await llamar({ name: 'X' })).status).toBe(400);
        expect((await llamar({ vat: '43160220' })).status).toBe(400);
        expect(fetchOdoo).not.toHaveBeenCalled();
    });

    it('los clientes archivados no bloquean (la búsqueda solo mira activos)', async () => {
        partners = [{ id: 5, name: 'ARCHIVADO', vat: '43160220', active: false }];
        const r = await llamar({ name: 'Nuevo', vat: '43160220' });
        expect(r).toMatchObject({ success: true, existed: false });
    });
});
