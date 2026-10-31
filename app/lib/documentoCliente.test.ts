import { describe, it, expect } from 'vitest';
import {
    clasificarCoincidencia,
    digitoVerificadorRuc,
    dniDeRucPersonaNatural,
    documentosDeVat,
    documentosEquivalentes,
    dominioBusquedaClientes,
    esDocumentoValido,
    rucDePersonaNatural,
    soloDigitos,
} from './documentoCliente';

describe('documentoCliente', () => {
    it('soloDigitos limpia espacios, guiones y letras', () => {
        expect(soloDigitos(' 4316-0220 ')).toBe('43160220');
        expect(soloDigitos(null)).toBe('');
    });

    it('el RUC de una persona natural es 10 + DNI + dígito verificador', () => {
        expect(rucDePersonaNatural('43160220')).toBe('10431602208');
    });

    it('el dígito verificador respeta los casos límite de SUNAT (10 → 0, 11 → 1)', () => {
        // 10414869641 es un RUC real cuyo cálculo da 11 → dígito 1
        expect(digitoVerificadorRuc('1041486964')).toBe(1);
        // base 1010000016 da 10 → dígito 0 ; base 1010000010 da 11 → dígito 1
        expect(digitoVerificadorRuc('1010000016')).toBe(0);
        expect(digitoVerificadorRuc('1010000010')).toBe(1);
    });

    it('dniDeRucPersonaNatural recupera el DNI solo de un RUC 10 válido', () => {
        expect(dniDeRucPersonaNatural('10431602208')).toBe('43160220');
        expect(dniDeRucPersonaNatural('10431602209')).toBeNull(); // dígito verificador mal
        expect(dniDeRucPersonaNatural('20131312955')).toBeNull(); // empresa
        expect(dniDeRucPersonaNatural('4316022')).toBeNull();
    });

    it('documentosEquivalentes une DNI y RUC 10 de la misma persona, y deja solo uno si es empresa', () => {
        expect(documentosEquivalentes('43160220')).toEqual(['43160220', '10431602208']);
        expect(documentosEquivalentes('10431602208')).toEqual(['10431602208', '43160220']);
        expect(documentosEquivalentes('20131312955')).toEqual(['20131312955']);
    });

    it('documentosDeVat separa los dos titulares guardados en un solo campo', () => {
        expect(documentosDeVat('08285418 / 08722210')).toEqual(['08285418', '08722210']);
        expect(documentosDeVat('46798173/72929042')).toEqual(['46798173', '72929042']);
        expect(documentosDeVat(false)).toEqual([]);
    });

    it('clasificarCoincidencia: exacta, equivalente (DNI↔RUC 10) o ninguna', () => {
        expect(clasificarCoincidencia('43160220', '43160220')).toBe('exacta');
        expect(clasificarCoincidencia('10242342 / 28587662', '10242342')).toBe('exacta'); // titular dentro de un campo doble
        expect(clasificarCoincidencia('10431602208', '43160220')).toBe('equivalente');
        expect(clasificarCoincidencia('43160220', '10431602208')).toBe('equivalente');
        expect(clasificarCoincidencia('43160221', '43160220')).toBeNull();
        expect(clasificarCoincidencia('1043160220', '43160220')).toBeNull(); // no confundir por prefijo/substring
    });

    it('esDocumentoValido acepta solo 8 u 11 dígitos', () => {
        expect(esDocumentoValido('43160220')).toBe(true);
        expect(esDocumentoValido('10431602208')).toBe(true);
        expect(esDocumentoValido('123456789')).toBe(false);
        expect(esDocumentoValido('')).toBe(false);
    });
});

describe('dominioBusquedaClientes', () => {
    it('un DNI busca por el DNI y por el RUC 10 de la misma persona', () => {
        expect(dominioBusquedaClientes('43160220')).toEqual([
            ['active', '=', true], '|', ['vat', 'ilike', '43160220'], ['vat', 'ilike', '10431602208'],
        ]);
    });

    it('un RUC de empresa busca solo por ese RUC', () => {
        expect(dominioBusquedaClientes('20131312955')).toEqual([['active', '=', true], ['vat', 'ilike', '20131312955']]);
    });

    it('un nombre exige todas las palabras, en cualquier orden', () => {
        expect(dominioBusquedaClientes('Percy Zambrano')).toEqual([
            ['active', '=', true], '|', '|', '&', ['name', 'ilike', 'Percy'], ['name', 'ilike', 'Zambrano'],
            ['email', 'ilike', 'Percy Zambrano'], ['vat', 'ilike', 'Percy Zambrano'],
        ]);
    });

    it('una sola palabra no lleva operador AND', () => {
        expect(dominioBusquedaClientes('Zambrano')).toEqual([
            ['active', '=', true], '|', '|', ['name', 'ilike', 'Zambrano'], ['email', 'ilike', 'Zambrano'], ['vat', 'ilike', 'Zambrano'],
        ]);
    });

    it('consulta vacía solo filtra por activos', () => {
        expect(dominioBusquedaClientes('  ')).toEqual([['active', '=', true]]);
    });
});
