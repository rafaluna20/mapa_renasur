import { describe, it, expect, vi } from 'vitest';
import { sha256, normalizarTelefonoPE, construirEventoLead, enviarEventoMeta } from './metaCapi';
import { validarPixelId } from '../venta/metaPixel';

const base = { telefono: '977 684 050', codigoLote: 'E01MZS033P', ahoraMs: 1_760_000_000_000 };

describe('normalizarTelefonoPE', () => {
    it('9 dígitos -> antepone 51; ya con 51 se deja; quita símbolos', () => {
        expect(normalizarTelefonoPE('977684050')).toBe('51977684050');
        expect(normalizarTelefonoPE('+51 977 684 050')).toBe('51977684050');
    });
});

describe('construirEventoLead', () => {
    it('hashea teléfono, correo y nombre; nunca los manda en claro', () => {
        const e = construirEventoLead({ ...base, email: ' Ana@Correo.COM ', nombre: 'Ana María Pérez', eventId: 'abc12345' });
        const json = JSON.stringify(e);
        expect(e.user_data.ph).toEqual([sha256('51977684050')]);
        expect(e.user_data.em).toEqual([sha256('ana@correo.com')]);
        expect(e.user_data.fn).toEqual([sha256('ana')]);
        expect(json).not.toContain('977');
        expect(json).not.toMatch(/ana@correo|María|Pérez/i);
        expect(e.event_id).toBe('abc12345');
        expect(e.event_time).toBe(1_760_000_000);
        expect(e.custom_data.content_ids).toEqual(['E01MZS033P']);
        expect(e.custom_data.currency).toBe('PEN');
    });

    it('sin event_id genera uno; ip "unknown" y campos vacíos no se envían', () => {
        const e = construirEventoLead({ ...base, ip: 'unknown' });
        expect(e.event_id).toMatch(/[0-9a-f-]{20,}/);
        expect(e.user_data).not.toHaveProperty('client_ip_address');
        expect(e.user_data).not.toHaveProperty('em');
        expect(e.custom_data).not.toHaveProperty('value');
    });
});

describe('enviarEventoMeta', () => {
    const evento = construirEventoLead(base);

    it('sin configuración no llama a la red', async () => {
        const f = vi.fn();
        const r = await enviarEventoMeta(evento, { env: {}, fetchImpl: f as unknown as typeof fetch });
        expect(r).toEqual({ enviado: false, motivo: 'sin configurar' });
        expect(f).not.toHaveBeenCalled();
    });

    it('un ID de pixel no numérico se rechaza', async () => {
        const f = vi.fn();
        const r = await enviarEventoMeta(evento, { env: { META_PIXEL_ID: '123/../x', META_CAPI_TOKEN: 't' }, fetchImpl: f as unknown as typeof fetch });
        expect(r.enviado).toBe(false);
        expect(f).not.toHaveBeenCalled();
    });

    it('configurado: POST a graph.facebook.com con el token en el cuerpo (no en la URL) y test_event_code', async () => {
        const f = vi.fn().mockResolvedValue({ ok: true, status: 200 });
        const r = await enviarEventoMeta(evento, {
            env: { META_PIXEL_ID: '1234567890', META_CAPI_TOKEN: 'TOKEN_SECRETO', META_TEST_EVENT_CODE: 'TEST123' },
            fetchImpl: f as unknown as typeof fetch,
        });
        expect(r.enviado).toBe(true);
        const [url, init] = f.mock.calls[0];
        expect(url).toBe('https://graph.facebook.com/v21.0/1234567890/events');
        expect(url).not.toContain('TOKEN_SECRETO');            // el token no queda en la URL
        const cuerpo = JSON.parse(init.body);
        expect(cuerpo.access_token).toBe('TOKEN_SECRETO');
        expect(cuerpo.test_event_code).toBe('TEST123');
        expect(cuerpo.data).toHaveLength(1);
    });

    it('si Meta responde error o la red falla, NO lanza (el lead no se pierde)', async () => {
        const env = { META_PIXEL_ID: '1234567890', META_CAPI_TOKEN: 't' };
        const r1 = await enviarEventoMeta(evento, { env, fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 400 }) as unknown as typeof fetch });
        expect(r1).toEqual({ enviado: false, motivo: 'Meta respondió 400' });
        const r2 = await enviarEventoMeta(evento, { env, fetchImpl: vi.fn().mockRejectedValue(new Error('boom')) as unknown as typeof fetch });
        expect(r2.enviado).toBe(false);
        expect(JSON.stringify(r2)).not.toContain('boom');
    });
});

describe('validarPixelId (el ID se inyecta dentro de un <script>)', () => {
    it('solo dígitos', () => {
        expect(validarPixelId(' 1234567890 ')).toBe('1234567890');
        for (const malo of ["1234');alert(1);//", 'abc', '', undefined, null, '12'])
            expect(validarPixelId(malo as string)).toBe('');
    });
});
