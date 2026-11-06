import { describe, it, expect, vi, beforeEach } from 'vitest';

// Seguridad de /api/odoo/photo/[attachmentId]: la ruta es pública (sin sesión) y lee
// con la cuenta de servicio. Por eso SOLO puede servir adjuntos que sean fotos de un
// elemento urbano (elemento.urbano.x_fotos) — nunca un ir.attachment cualquiera
// (contratos, DNI, comprobantes…) adivinando su número.
const fetchOdoo = vi.fn();
vi.mock('@/app/services/odooService', () => ({ fetchOdoo: (...a: unknown[]) => fetchOdoo(...a) }));

import { GET } from './route';

const PNG_B64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]).toString('base64');

const pedir = (id: string) =>
    GET(new Request(`http://x/api/odoo/photo/${id}`) as never, { params: Promise.resolve({ attachmentId: id }) });

/** Simula Odoo: `vinculados` = ids de adjuntos que sí son x_fotos de algún elemento urbano. */
function odoo(opts: { vinculados: number[]; adjuntos: Record<number, { datas: string | false; mimetype: string | false }> }) {
    fetchOdoo.mockImplementation(async (model: string, method: string, args: unknown[]) => {
        if (model === 'elemento.urbano' && method === 'search_count') {
            const dominio = JSON.stringify(args);
            return opts.vinculados.some((id) => dominio.includes(`[${id}]`)) ? 1 : 0;
        }
        if (model === 'ir.attachment' && method === 'read') {
            const id = (args[0] as number[])[0];
            return opts.adjuntos[id] ? [opts.adjuntos[id]] : [];
        }
        throw new Error(`llamada inesperada ${model}.${method}`);
    });
}

const lecturasDeAdjuntos = () => fetchOdoo.mock.calls.filter((c) => c[0] === 'ir.attachment');

describe('GET /api/odoo/photo/[attachmentId]', () => {
    // Con llaves a propósito: si el callback DEVOLVIERA el mock, vitest lo trataría
    // como función de limpieza y lo llamaría sin argumentos al terminar cada prueba.
    beforeEach(() => {
        fetchOdoo.mockReset();
    });

    it('sirve la foto de un elemento urbano (x_fotos) con su tipo de imagen y nosniff', async () => {
        odoo({ vinculados: [7], adjuntos: { 7: { datas: PNG_B64, mimetype: 'image/png' } } });
        const res = await pedir('7');
        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe('image/png');
        expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
        expect(Buffer.from(await res.arrayBuffer()).equals(Buffer.from(PNG_B64, 'base64'))).toBe(true);
    });

    it('NO sirve un adjunto que no es foto de un elemento urbano (p. ej. un contrato) y ni siquiera lo lee', async () => {
        odoo({ vinculados: [7], adjuntos: { 99: { datas: PNG_B64, mimetype: 'application/pdf' } } });
        const res = await pedir('99');
        expect(res.status).toBe(404);
        expect(lecturasDeAdjuntos()).toHaveLength(0); // nunca se trae el contenido
    });

    it('la respuesta de un adjunto ajeno es indistinguible de la de uno inexistente (no sirve para enumerar)', async () => {
        odoo({ vinculados: [], adjuntos: { 99: { datas: PNG_B64, mimetype: 'image/png' } } });
        const ajeno = await pedir('99');
        const inexistente = await pedir('123456');
        expect(ajeno.status).toBe(inexistente.status);
        expect(await ajeno.json()).toEqual(await inexistente.json());
    });

    it('rechaza imágenes SVG aunque estén vinculadas (pueden ejecutar scripts desde el dominio de la app)', async () => {
        odoo({ vinculados: [8], adjuntos: { 8: { datas: Buffer.from('<svg onload=alert(1)/>').toString('base64'), mimetype: 'image/svg+xml' } } });
        const res = await pedir('8');
        expect(res.status).toBe(404);
    });

    it('rechaza ids que no son un entero positivo estricto, sin consultar Odoo', async () => {
        odoo({ vinculados: [12], adjuntos: { 12: { datas: PNG_B64, mimetype: 'image/png' } } });
        for (const malo of ['12abc', '-5', '0', '1.5', '1e3', ' 12', '']) {
            const res = await pedir(malo);
            expect(res.status, `id "${malo}"`).toBe(400);
        }
        expect(fetchOdoo).not.toHaveBeenCalled();
    });

    it('si Odoo falla responde 500 genérico, sin filtrar el detalle del error', async () => {
        fetchOdoo.mockRejectedValue(new Error('conexion a 10.0.0.5 rechazada, usuario svc'));
        const res = await pedir('7');
        expect(res.status).toBe(500);
        expect(JSON.stringify(await res.json())).not.toContain('10.0.0.5');
    });
});
