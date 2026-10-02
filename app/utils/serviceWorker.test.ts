import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Ejecuta el public/sw.js REAL con un navegador simulado (self, caches, fetch, Response) para probar los
// escenarios que mandaban a /login a clientes en /venta.
const codigo = fs.readFileSync(path.join(process.cwd(), 'public', 'sw.js'), 'utf8');

function cargarSW({ fetchFalla = false, cacheado = {} as Record<string, unknown> } = {}) {
    const oyentes: Record<string, (e: any) => void> = {};
    const cachesBorrados: string[] = [];
    const precacheadas: string[] = [];
    const fakeCache = { addAll: async (l: string[]) => { precacheadas.push(...l); }, match: async () => undefined, put: async () => {} };
    const fakeCaches = {
        open: async () => fakeCache,
        keys: async () => ['renasur-v1', 'renasur-v2', 'map-tiles-v1', 'static-assets-v1'],
        delete: async (k: string) => { cachesBorrados.push(k); return true; },
        match: async (k: string) => (cacheado as any)[k],
    };
    const self = {
        location: { origin: 'https://mapa-renasur.vercel.app' },
        addEventListener: (t: string, fn: any) => { oyentes[t] = fn; },
        skipWaiting: () => {},
        clients: { claim: async () => {} },
    };
    const fakeFetch = async () => { if (fetchFalla) throw new Error('sin red'); return new Response('ok'); };
    new Function('self', 'caches', 'fetch', codigo)(self, fakeCaches, fakeFetch);

    const navegar = async (ruta: string) => {
        const resp: { p: Promise<Response> | null } = { p: null };
        const event = { request: { url: 'https://mapa-renasur.vercel.app' + ruta, mode: 'navigate' }, respondWith: (p: Promise<Response>) => { resp.p = p; } };
        oyentes.fetch(event);
        return resp.p ? await resp.p : null;
    };
    return { oyentes, cachesBorrados, precacheadas, navegar };
}

describe('service worker', () => {
    it('no precachea "/" (para un visitante sin sesión es una redirección a /login)', async () => {
        const sw = cargarSW();
        await new Promise<void>((r) => sw.oyentes.install({ waitUntil: (p: Promise<unknown>) => p.then(() => r()) }));
        expect(sw.precacheadas).not.toContain('/');
    });

    it('al activarse borra la caché vieja renasur-v1 (la que tenía "/" guardado) y conserva la v2', async () => {
        const sw = cargarSW();
        await new Promise<void>((r) => sw.oyentes.activate({ waitUntil: (p: Promise<unknown>) => p.then(() => r()) }));
        expect(sw.cachesBorrados).toContain('renasur-v1');
        expect(sw.cachesBorrados).not.toContain('renasur-v2');
    });

    it('NO intercepta /venta ni /portal, ni con red caída (el navegador decide, nunca otra página)', async () => {
        const sw = cargarSW({ fetchFalla: true, cacheado: { '/': new Response('LOGIN') } });
        for (const ruta of ['/venta', '/venta?lote=E01MZS060P&utm_source=asistente-virtual', '/portal/login']) {
            expect(await sw.navegar(ruta)).toBeNull();
        }
    });

    it('una página de staff sin conexión muestra "Sin conexión" y NUNCA la página "/" guardada', async () => {
        const sw = cargarSW({ fetchFalla: true, cacheado: { '/': new Response('LOGIN') } });
        const r = (await sw.navegar('/dashboard'))!;
        expect(r.status).toBe(503);
        const html = await r.text();
        expect(html).toContain('Sin conexión');
        expect(html).not.toContain('LOGIN');
    });

    it('una página de staff con red sigue funcionando normal', async () => {
        const sw = cargarSW();
        const r = (await sw.navegar('/dashboard'))!;
        expect(await r.text()).toBe('ok');
    });

    it('un prefijo parecido (/ventas-internas) sí es una página normal', async () => {
        const sw = cargarSW({ fetchFalla: true });
        expect(await sw.navegar('/ventas-internas')).not.toBeNull();
    });
});
