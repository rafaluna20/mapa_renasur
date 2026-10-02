import { describe, it, expect } from 'vitest';
import { esRutaPublica } from './rutasPublicas';

describe('esRutaPublica', () => {
    it('/venta y /portal (y lo que cuelga de ellas) son públicas', () => {
        expect(esRutaPublica('/venta')).toBe(true);
        expect(esRutaPublica('/venta/')).toBe(true);
        expect(esRutaPublica('/portal')).toBe(true);
        expect(esRutaPublica('/portal/login')).toBe(true);
        expect(esRutaPublica('/portal/pagos')).toBe(true);
    });

    it('las pantallas de staff NO lo son', () => {
        for (const p of ['/', '/dashboard', '/manager', '/quote/12', '/login']) expect(esRutaPublica(p)).toBe(false);
    });

    it('un prefijo parecido no cuenta (ej. /ventas-internas, /portalx)', () => {
        expect(esRutaPublica('/ventas-internas')).toBe(false);
        expect(esRutaPublica('/portalx')).toBe(false);
    });

    it('sin ruta conocida se trata como privada (nunca se asume público)', () => {
        expect(esRutaPublica(null)).toBe(false);
        expect(esRutaPublica(undefined)).toBe(false);
        expect(esRutaPublica('')).toBe(false);
    });
});
