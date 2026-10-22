import { describe, it, expect, vi } from 'vitest';

vi.mock('@/app/services/odooService', () => ({ fetchOdoo: vi.fn() }));

import { consultarSeparaciones, type OdooRpc } from './separaciones';

const HOY = '2026-10-15';

function rpcFalso(datos: {
    ordenes?: unknown[];
    contratos?: unknown[];
    lineas?: unknown[];
    admin?: unknown[];
    sinCamposPlazo?: boolean;
    sinAdmin?: boolean;
}): OdooRpc {
    return async (model) => {
        if (model === 'sale.order') {
            if (datos.sinCamposPlazo) throw new Error("Invalid field 'separation_deadline' on model 'sale.order'");
            return datos.ordenes ?? [];
        }
        if (model === 'simple.contract') return datos.contratos ?? [];
        if (model === 'sale.order.line') return datos.lineas ?? [];
        if (model === 'product.template') {
            if (datos.sinAdmin || datos.sinCamposPlazo) throw new Error("Invalid field 'admin_reserved'");
            return datos.admin ?? [];
        }
        throw new Error('modelo inesperado ' + model);
    };
}

const orden = (id: number, limite: string, extra: Record<string, unknown> = {}) => ({
    id,
    name: `S${id}`,
    user_id: [7, 'Ana'],
    separation_start: '2026-10-01 15:00:00',
    separation_deadline: limite,
    separation_extension_count: 0,
    ...extra,
});
const linea = (ordenId: number, loteId: number) => ({ order_id: [ordenId, `S${ordenId}`], product_template_id: [loteId, 'Lote'] });

describe('consultarSeparaciones', () => {
    it('si Odoo no tiene los campos, devuelve vacío sin lanzar (el mapa sigue igual que antes)', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const r = await consultarSeparaciones(rpcFalso({ sinCamposPlazo: true }), HOY);
        expect(r).toEqual({ porLote: {}, reservasAdmin: [], disponible: false });
        warn.mockRestore();
    });

    it('arma una separación por lote con vendedor, antigüedad y estado', async () => {
        const r = await consultarSeparaciones(
            rpcFalso({ ordenes: [orden(1, '2026-10-17')], lineas: [linea(1, 500)], admin: [{ id: 900 }] }),
            HOY
        );
        expect(r.disponible).toBe(true);
        expect(r.reservasAdmin).toEqual([900]);
        const s = r.porLote['500'];
        expect(s.vendedor).toBe('Ana');
        expect(s.diasSeparado).toBe(14);
        expect(s.diasRestantes).toBe(2);
        expect(s.estado).toBe('por_vencer');
        expect(s.ordenesActivas).toBe(1);
    });

    it('un contrato vigente la marca como contratada aunque el plazo haya pasado', async () => {
        const r = await consultarSeparaciones(
            rpcFalso({
                ordenes: [orden(1, '2026-09-01')],
                lineas: [linea(1, 500)],
                contratos: [{ sale_order_id: [1, 'S1'] }],
            }),
            HOY
        );
        expect(r.porLote['500'].estado).toBe('contratada');
    });

    it('doble reserva: elige la que vence primero y avisa con ordenesActivas', async () => {
        const r = await consultarSeparaciones(
            rpcFalso({
                ordenes: [orden(1, '2026-10-30'), orden(2, '2026-10-05')],
                lineas: [linea(1, 500), linea(2, 500)],
            }),
            HOY
        );
        expect(r.porLote['500'].orderId).toBe(2);
        expect(r.porLote['500'].estado).toBe('vencida');
        expect(r.porLote['500'].ordenesActivas).toBe(2);
    });

    it('si solo falta admin_reserved, igual entrega las separaciones', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const r = await consultarSeparaciones(rpcFalso({ ordenes: [orden(1, '2026-10-30')], lineas: [linea(1, 500)], sinAdmin: true }), HOY);
        expect(r.porLote['500'].estado).toBe('vigente');
        expect(r.reservasAdmin).toEqual([]);
        expect(r.disponible).toBe(false);
        warn.mockRestore();
    });

    it('ignora líneas sin lote (secciones/notas) sin romperse', async () => {
        const r = await consultarSeparaciones(
            rpcFalso({ ordenes: [orden(1, '2026-10-30')], lineas: [{ order_id: [1, 'S1'], product_template_id: false }] }),
            HOY
        );
        expect(r.porLote).toEqual({});
    });
});
