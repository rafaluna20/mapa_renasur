import { describe, expect, it } from 'vitest';
import codigosReales from './__fixtures__/codigosReales.json';
import {
  codigoLegado,
  extraerCodigoDeReferencia,
  formatearCodigoLote,
  interpretarCodigoLote,
  mismoLote,
} from './codigoLote';

// La gemela en Python (proyecto_inmobiliario/codigo_lote.py) se prueba con la MISMA lista de códigos reales.

describe('interpretarCodigoLote', () => {
  it('interpreta TODOS los códigos reales (538 de producción + 807 por crear + 2 renombrados) y vuelven al mismo texto', () => {
    expect(codigosReales.length).toBeGreaterThanOrEqual(1300);
    for (const c of codigosReales) {
      const p = interpretarCodigoLote(c);
      expect(p, c).not.toBeNull();
      expect(p!.legado, c).toBe(c);
      expect(interpretarCodigoLote(formatearCodigoLote('P01', p))!.legado, c).toBe(c);
    }
  });

  it('no hay dos códigos reales iguales', () => {
    expect(new Set(codigosReales).size).toBe(codigosReales.length);
  });

  it('separa las partes (también en minúsculas)', () => {
    expect(interpretarCodigoLote('e01mzq055p')).toEqual({
      proyecto: null, etapa: '01', manzana: 'Q', lote: 55, sufijo: 'P', parte: 0, letra: null, legado: 'E01MZQ055P',
    });
    const p = interpretarCodigoLote('P02-E03MZAB1241')!;
    expect([p.proyecto, p.manzana, p.lote, p.parte]).toEqual(['P02', 'AB', 124, 1]);
    expect(interpretarCodigoLote('E05MZY001Z')!.parte).toBeNull();
  });

  it('la parte tiene letra: E01MZD1241 es el lote 124, parte A; 2 = B; 3 = C; entero y Z sin letra', () => {
    expect(['1', '2', '3'].map((n) => interpretarCodigoLote(`E01MZD124${n}`)!.letra)).toEqual(['A', 'B', 'C']);
    expect(interpretarCodigoLote('E01MZD1241')!.lote).toBe(124);
    expect(interpretarCodigoLote('E01MZD124P')!.letra).toBeNull();
    expect(interpretarCodigoLote('E05MZY001Z')!.letra).toBeNull();
  });

  it('lo que no es un código de lote no se interpreta', () => {
    for (const malo of [null, undefined, '', 'E01MZQ055', 'E1MZQ055P', 'E01MZQ55P', 'E01MZQ0555P', 'X01-E01MZQ055P', 'P1-E01MZQ055P',
      'E01MZQ055P-C001', 'E01MZQ055A', 'E01MZQ0550', 12, {}, 'P01E01MZQ055P']) {
      expect(interpretarCodigoLote(malo), String(malo)).toBeNull();
    }
  });

  it('la manzana P no se confunde con el proyecto ni con el sufijo', () => {
    const p = interpretarCodigoLote('P01-E01MZP012P')!;
    expect([p.proyecto, p.manzana, p.sufijo]).toEqual(['P01', 'P', 'P']);
  });
});

describe('formatear / legado / mismoLote', () => {
  it('sin código corto del proyecto no hay código nuevo', () => {
    expect(formatearCodigoLote(null, interpretarCodigoLote('E01MZQ055P'))).toBeNull();
    expect(formatearCodigoLote('P01', null)).toBeNull();
    expect(formatearCodigoLote('P01', interpretarCodigoLote('E01MZQ055P'))).toBe('P01-E01MZQ055P');
  });

  it('codigoLegado acepta los dos formatos', () => {
    expect(codigoLegado('P01-E01MZQ055P')).toBe('E01MZQ055P');
    expect(codigoLegado('e01mzq055p')).toBe('E01MZQ055P');
    expect(codigoLegado('hola')).toBeNull();
  });

  it('mismoLote: el viejo y el nuevo son el mismo; dos proyectos distintos no', () => {
    expect(mismoLote('E01MZQ055P', 'P01-E01MZQ055P')).toBe(true);
    expect(mismoLote('P01-E01MZQ055P', 'P02-E01MZQ055P')).toBe(false);
    expect(mismoLote('E01MZQ055P', 'E01MZQ056P')).toBe(false);
    expect(mismoLote('E01MZQ055P', 'basura')).toBe(false);
  });
});

describe('extraerCodigoDeReferencia', () => {
  it('lee la referencia de la factura de cuota y de la inicial', () => {
    expect(extraerCodigoDeReferencia('CONTRATOMANUAL-E01MZD148P-C013')).toEqual({ codigo: 'E01MZD148P', irregular: false });
    expect(extraerCodigoDeReferencia('CONTRATOMANUAL-P01-E01MZD148P-INIT')).toEqual({ codigo: 'E01MZD148P', irregular: false });
    expect(extraerCodigoDeReferencia('x-e01mzs0252-c002')).toEqual({ codigo: 'E01MZS0252', irregular: false });
  });

  it('la forma floja de antes se sigue leyendo, marcada como irregular', () => {
    expect(extraerCodigoDeReferencia('X-E1MZD14P-C001')).toEqual({ codigo: 'E1MZD14P', irregular: true });
  });

  it('sin código o sin -C/-INIT final no hay nada', () => {
    expect(extraerCodigoDeReferencia('sin codigo')).toBeNull();
    expect(extraerCodigoDeReferencia('E01MZD148P')).toBeNull();
    expect(extraerCodigoDeReferencia(undefined)).toBeNull();
  });
});
