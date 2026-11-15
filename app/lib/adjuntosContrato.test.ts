import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchOdoo = vi.fn();
vi.mock('@/app/services/odooService', () => ({ fetchOdoo: (...a: unknown[]) => fetchOdoo(...a) }));

import { avisarDocumentosEnContrato, copiarAdjuntosAlContrato } from './adjuntosContrato';
import { DESCRIPCION_ADJUNTO, normalizarTipoAdjunto } from './tiposAdjunto';

type Adj = { id: number; name: string; checksum: string | false };

/** Odoo simulado: adjuntos por (modelo, id) y un `copy` que agrega la copia al destino. */
function odoo(deLaOrden: Adj[], delContrato: Adj[] = [], fallaCopiaDe: number[] = []) {
    let siguiente = 900;
    fetchOdoo.mockImplementation(async (model: string, method: string, args: unknown[]) => {
        if (model === 'ir.attachment' && method === 'search_read') {
            const dominio = (args[0] as unknown[][]);
            const modelo = dominio.find((t) => t[0] === 'res_model')![2];
            return modelo === 'sale.order' ? deLaOrden : delContrato;
        }
        if (model === 'ir.attachment' && method === 'copy') {
            const id = (args[0] as number[])[0];
            if (fallaCopiaDe.includes(id)) throw new Error('sin permiso');
            const origen = deLaOrden.find((a) => a.id === id)!;
            delContrato.push({ ...origen, id: siguiente++ });
            return siguiente;
        }
        if (model === 'mail.message' && method === 'create') return 1;
        throw new Error(`llamada inesperada ${model}.${method}`);
    });
}
const copias = () => fetchOdoo.mock.calls.filter((c) => c[1] === 'copy');

describe('copiarAdjuntosAlContrato', () => {
    beforeEach(() => {
        fetchOdoo.mockReset();
    });

    it('copia la cotización y los comprobantes de la orden al contrato', async () => {
        odoo([
            { id: 1, name: 'Cotizacion_E01MZP001P.pdf', checksum: 'aaa' },
            { id: 2, name: 'voucher1.jpg', checksum: 'bbb' },
            { id: 3, name: 'voucher2.jpg', checksum: 'ccc' },
        ]);
        const r = await copiarAdjuntosAlContrato(10, 77);
        expect(r).toEqual({ copiados: ['Cotizacion_E01MZP001P.pdf', 'voucher1.jpg', 'voucher2.jpg'], yaEstaban: 0, errores: [] });
        // Se copia a ESE contrato y solo se cambia el destino (no se mueve: el original no se toca)
        expect(copias()[0][2]).toEqual([[1], { res_model: 'simple.contract', res_id: 77 }]);
        expect(fetchOdoo.mock.calls.some((c) => c[1] === 'unlink' || c[1] === 'write')).toBe(false);
    });

    it('es repetible: lo que ya está en el contrato (mismo nombre y contenido) no se vuelve a copiar', async () => {
        odoo(
            [{ id: 1, name: 'Cotizacion.pdf', checksum: 'aaa' }, { id: 2, name: 'voucher.jpg', checksum: 'bbb' }],
            [{ id: 500, name: 'Cotizacion.pdf', checksum: 'aaa' }]
        );
        const r = await copiarAdjuntosAlContrato(10, 77);
        expect(r.copiados).toEqual(['voucher.jpg']);
        expect(r.yaEstaban).toBe(1);

        const segunda = await copiarAdjuntosAlContrato(10, 77);
        expect(segunda).toEqual({ copiados: [], yaEstaban: 2, errores: [] });
    });

    it('dos archivos con el mismo nombre pero distinto contenido se copian los dos', async () => {
        odoo(
            [{ id: 1, name: 'voucher.jpg', checksum: 'aaa' }, { id: 2, name: 'voucher.jpg', checksum: 'bbb' }],
            [{ id: 500, name: 'voucher.jpg', checksum: 'aaa' }]
        );
        const r = await copiarAdjuntosAlContrato(10, 77);
        expect(r.copiados).toEqual(['voucher.jpg']);
        expect(copias()[0][2][0]).toEqual([2]);
    });

    it('si un archivo falla, los demás igual se copian y no se lanza error', async () => {
        odoo([{ id: 1, name: 'a.pdf', checksum: 'a' }, { id: 2, name: 'b.pdf', checksum: 'b' }], [], [1]);
        const r = await copiarAdjuntosAlContrato(10, 77);
        expect(r.copiados).toEqual(['b.pdf']);
        expect(r.errores).toEqual(['a.pdf: sin permiso']);
    });

    it('si Odoo no responde, devuelve el error en vez de lanzarlo (el contrato ya está creado)', async () => {
        fetchOdoo.mockRejectedValue(new Error('Odoo caído'));
        const r = await copiarAdjuntosAlContrato(10, 77);
        expect(r).toEqual({ copiados: [], yaEstaban: 0, errores: ['Odoo caído'] });
    });

    it('una orden sin documentos no copia nada', async () => {
        odoo([]);
        expect(await copiarAdjuntosAlContrato(10, 77)).toEqual({ copiados: [], yaEstaban: 0, errores: [] });
        expect(copias()).toHaveLength(0);
    });
});

describe('avisarDocumentosEnContrato', () => {
    beforeEach(() => {
        fetchOdoo.mockReset();
    });

    it('deja el aviso en el chatter del contrato con la lista de documentos', async () => {
        fetchOdoo.mockResolvedValue(1);
        await avisarDocumentosEnContrato(10, 77, ['Cotizacion.pdf', 'voucher.jpg']);
        const [modelo, metodo, args] = fetchOdoo.mock.calls[0];
        expect([modelo, metodo]).toEqual(['mail.message', 'create']);
        expect((args as [Record<string, string>])[0]).toMatchObject({ model: 'simple.contract', res_id: 77 });
        expect((args as [Record<string, string>])[0].body).toContain('<li>Cotizacion.pdf</li>');
    });

    it('escapa el nombre del archivo (lo escribe una persona) para que no entre HTML en el chatter', async () => {
        fetchOdoo.mockResolvedValue(1);
        await avisarDocumentosEnContrato(10, 77, ['<img src=x onerror=alert(1)>.jpg']);
        const body = ((fetchOdoo.mock.calls[0][2] as [Record<string, string>])[0]).body;
        expect(body).not.toContain('<img');
        expect(body).toContain('&lt;img');
    });

    it('sin documentos copiados no escribe nada, y si falla el aviso no lanza', async () => {
        await avisarDocumentosEnContrato(10, 77, []);
        expect(fetchOdoo).not.toHaveBeenCalled();
        fetchOdoo.mockRejectedValue(new Error('x'));
        await expect(avisarDocumentosEnContrato(10, 77, ['a.pdf'])).resolves.toBeUndefined();
    });
});

describe('tiposAdjunto', () => {
    it('cotización y comprobante tienen descripciones distintas; lo desconocido es comprobante', () => {
        expect(DESCRIPCION_ADJUNTO.cotizacion).not.toBe(DESCRIPCION_ADJUNTO.comprobante);
        expect(normalizarTipoAdjunto('cotizacion')).toBe('cotizacion');
        expect(normalizarTipoAdjunto('comprobante')).toBe('comprobante');
        expect(normalizarTipoAdjunto(undefined)).toBe('comprobante');
        expect(normalizarTipoAdjunto('otra cosa')).toBe('comprobante');
    });
});
