import { describe, it, expect } from 'vitest';
import { construirMetadataVenta } from './metadataVenta';

const og = (m: ReturnType<typeof construirMetadataVenta>) => m.openGraph as { title: string; description: string; url: string; images: { url: string; width: number }[] };

describe('construirMetadataVenta', () => {
    it('sin lote: textos comerciales (no el "Sistema GIS" interno) y la foto del ingreso', () => {
        const m = construirMetadataVenta(undefined);
        expect(m.title).toBe('Terra Lima — Lotes en venta en Pucusana');
        expect(og(m).title).toBe('Terra Lima — Lotes en venta en Pucusana');
        expect(og(m).description).not.toMatch(/GIS|gestión/i);
        expect(og(m).images[0].url).toBe('https://mapa-renasur.vercel.app/venta-hero-portada.jpg');
        expect(og(m).url).toBe('https://mapa-renasur.vercel.app/venta');
    });

    it('con un lote válido: título del lote e imagen generada de ESE lote, con URL absoluta', () => {
        const m = construirMetadataVenta('E01MZS060P');
        expect(og(m).title).toBe('Mz S · Lote 60 — Terra Lima, Pucusana');
        expect(og(m).images[0].url).toBe('https://mapa-renasur.vercel.app/api/public/lote-imagen?codigo=E01MZS060P');
        expect(og(m).images[0].width).toBe(1000);
        expect(og(m).url).toBe('https://mapa-renasur.vercel.app/venta?lote=E01MZS060P');
    });

    it('lote partido y minúsculas: se normaliza (33A) y se usa el código en mayúsculas', () => {
        const m = construirMetadataVenta(' e01mzs0331 ');
        expect(og(m).title).toContain('Lote 33A');
        expect(og(m).images[0].url).toContain('codigo=E01MZS0331');
    });

    it('un código que no es de lote jamás se copia a los textos (cae al general)', () => {
        for (const raro of ['<script>alert(1)</script>', 'BASURA', '../../etc/passwd', 'E01MZS060P"><img', '']) {
            const m = construirMetadataVenta(raro);
            expect(JSON.stringify(m)).not.toMatch(/<script|alert|passwd|<img|BASURA/);
            expect(og(m).images[0].url).toContain('venta-hero-portada.jpg');
        }
    });

    it('la vista previa dice lo mismo que los anuncios y NUNCA promete título saneado', () => {
        for (const m of [construirMetadataVenta(undefined), construirMetadataVenta('E01MZS060P')]) {
            const d = og(m).description;
            expect(d).toContain('S/ 18,500');
            expect(d).toContain('84 cuotas');
            expect(d).toMatch(/habilitación urbana aprobada/i);
            expect(d).not.toMatch(/en proceso/i);
            expect(JSON.stringify(m)).not.toMatch(/saneado/i);
        }
    });

    it('enlace del bot (sinImagen) con lote válido: título del lote pero SIN imagen en la vista previa', () => {
        const m = construirMetadataVenta('E01MZS006P', undefined, { sinImagen: true });
        expect(og(m).title).toBe('Mz S · Lote 6 — Terra Lima, Pucusana');
        expect((og(m) as { images?: unknown }).images).toBeUndefined();
        expect((m.twitter as { images?: unknown }).images).toBeUndefined();
        expect(JSON.stringify(m)).not.toMatch(/lote-imagen|venta-hero-portada/);
    });

    it('sinImagen sin lote válido no quita la foto del ingreso (solo aplica a un lote)', () => {
        expect(og(construirMetadataVenta(undefined, undefined, { sinImagen: true })).images[0].url).toContain('venta-hero-portada.jpg');
        expect(og(construirMetadataVenta('BASURA', undefined, { sinImagen: true })).images[0].url).toContain('venta-hero-portada.jpg');
    });

    it('sin la opción, el lote sigue llevando su imagen (vendedores, anuncios, reenvíos)', () => {
        expect(og(construirMetadataVenta('E01MZS006P')).images[0].url).toContain('lote-imagen?codigo=E01MZS006P');
    });

    it('la base se puede cambiar (con o sin barra final) y la imagen sigue absoluta', () => {
        expect(og(construirMetadataVenta('E01MZS060P', 'https://otro.com/')).images[0].url).toBe('https://otro.com/api/public/lote-imagen?codigo=E01MZS060P');
    });
});
