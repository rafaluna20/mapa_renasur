import { describe, it, expect } from 'vitest';
import {
    OFERTA,
    AVISO_LEGAL_TITULO,
    FRASE_HABILITACION,
    detalleLegal,
    formatSoles,
    cuotaReferencial,
    refCampana,
    mensajeWhatsApp,
    urlWhatsApp,
} from './ofertaComercial';

describe('formatSoles', () => {
    it('separa miles con coma y redondea', () => {
        expect(formatSoles(97920)).toBe('S/ 97,920');
        expect(formatSoles(951.43)).toBe('S/ 951');
        expect(formatSoles(18000)).toBe('S/ 18,000');
    });
});

describe('cuotaReferencial', () => {
    it('(precio - inicial) / 84: el lote más barato (S/ 97,920) da ~S/ 951', () => {
        const c = cuotaReferencial(97920);
        expect(c).not.toBeNull();
        expect(c!).toBeCloseTo((97920 - 18000) / 84, 6);
        expect(formatSoles(c!)).toBe('S/ 951');
    });

    it('sin nada que financiar o con datos inválidos devuelve null', () => {
        expect(cuotaReferencial(18000)).toBeNull();
        expect(cuotaReferencial(10000)).toBeNull();
        expect(cuotaReferencial(0)).toBeNull();
        expect(cuotaReferencial(NaN)).toBeNull();
        expect(cuotaReferencial(100000, 18000, 0)).toBeNull();
    });
});

describe('refCampana', () => {
    it('prefiere utm_campaign sobre utm_source y la pasa a minúsculas', () => {
        expect(refCampana('Anuncio_A', 'facebook')).toBe('anuncio_a');
        expect(refCampana(undefined, 'Facebook')).toBe('facebook');
    });

    it('lo que no es [a-z0-9_-] nunca pasa (nada de HTML, espacios ni URLs)', () => {
        expect(refCampana('<script>alert(1)</script>')).toBe('scriptalert1script');
        expect(refCampana('a b&c=d')).toBe('abcd');
        expect(refCampana('x'.repeat(100))).toHaveLength(40);
    });

    it('vacío o solo símbolos -> null', () => {
        expect(refCampana('', '')).toBeNull();
        expect(refCampana('!!!')).toBeNull();
        expect(refCampana()).toBeNull();
    });
});

describe('mensajeWhatsApp / urlWhatsApp', () => {
    it('sin lote: mensaje general', () => {
        expect(mensajeWhatsApp()).toBe('Hola, quiero más información sobre los lotes de Terra Lima en Pucusana.');
    });

    it('con lote: código, área y precio; con ref al final', () => {
        const m = mensajeWhatsApp({ codigoLote: 'E01MZS033P', area: 120, precio: 139500, ref: 'anuncio_a' });
        expect(m).toBe('Hola, quiero separar el lote E01MZS033P (120 m²), precio S/ 139,500 de Terra Lima en Pucusana. (ref: anuncio_a)');
    });

    it('omite área y precio cuando no hay datos', () => {
        expect(mensajeWhatsApp({ codigoLote: 'E01MZS033P', area: 0, precio: 0 })).toBe(
            'Hola, quiero separar el lote E01MZS033P de Terra Lima en Pucusana.',
        );
    });

    it('la URL usa el número de la empresa y codifica el texto', () => {
        const u = urlWhatsApp({ codigoLote: 'E01MZS033P' });
        expect(u.startsWith(`https://wa.me/${OFERTA.whatsappNumero}?text=`)).toBe(true);
        expect(decodeURIComponent(u.split('?text=')[1])).toContain('E01MZS033P');
        expect(u).not.toContain(' ');
    });
});

describe('coherencia con los anuncios', () => {
    it('los datos fijados por la gerencia (2026-10-03)', () => {
        expect(OFERTA.cuotaInicial).toBe(18000);
        expect(OFERTA.nroCuotas).toBe(84);
        expect(OFERTA.whatsappNumero).toBe('51977684050');
        expect(OFERTA.distanciaPlayaKm).toBe(4.5);
    });

    it('el aviso legal dice habilitación aprobada (gerencia, 2026-10-03) y nunca "saneado" ni "en proceso"', () => {
        expect(FRASE_HABILITACION).toBe('Lotes con habilitación urbana aprobada');
        expect(AVISO_LEGAL_TITULO).toBe('Lotes con habilitación urbana aprobada.');
        expect(JSON.stringify([AVISO_LEGAL_TITULO, detalleLegal(), OFERTA])).not.toMatch(/saneado|en proceso/i);
    });

    it('detalleLegal agrega el número de resolución solo si está cargado', () => {
        expect(detalleLegal(null)).toBe('Pide los documentos a nuestro equipo antes de separar tu lote.');
        expect(detalleLegal('N° 123-2026-MDP')).toBe(
            'Resolución municipal N° 123-2026-MDP. Pide los documentos a nuestro equipo antes de separar tu lote.',
        );
    });
});
