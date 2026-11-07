import { describe, expect, it } from 'vitest';
import codigosReales from './__fixtures__/codigosReales.json';
import { interpretarCodigoLote } from './codigoLote';
import { numeroDeLote } from './etiquetaLote';

describe('numeroDeLote', () => {
  it('una parte se llama con el número sin la parte y su letra, con x_lote antes o después de corregirse', () => {
    for (const x_lote of ['1241', '124']) {
      expect(numeroDeLote({ default_code: 'E01MZD1241', x_lote })).toBe('124A');
      expect(numeroDeLote({ default_code: 'E01MZD1242', x_lote })).toBe('124B');
      expect(numeroDeLote({ default_code: 'E01MZD1243', x_lote })).toBe('124C');
    }
    expect(numeroDeLote({ default_code: 'E01MZS0251', x_lote: '251' })).toBe('25A');
  });

  it('las tres partes de un lote se ven DISTINTAS entre sí', () => {
    const nombres = ['E01MZD1241', 'E01MZD1242', 'E01MZD1243'].map((c) => numeroDeLote({ default_code: c, x_lote: '124' }));
    expect(new Set(nombres).size).toBe(3);
  });

  it('un lote entero conserva su x_lote tal cual (no cambia nada de lo que ya se ve)', () => {
    expect(numeroDeLote({ default_code: 'E01MZD092P', x_lote: '92' })).toBe('92');
    expect(numeroDeLote({ default_code: 'E01MZD092P', x_lote: '092' })).toBe('092');
  });

  it('código raro, vacío o con sufijo Z: usa x_lote; sin nada: cadena vacía', () => {
    expect(numeroDeLote({ default_code: 'E05MZY001Z', x_lote: 'E' })).toBe('E');
    expect(numeroDeLote({ default_code: 'RARO', x_lote: '7' })).toBe('7');
    expect(numeroDeLote({ default_code: false, x_lote: false })).toBe('');
    expect(numeroDeLote(null)).toBe('');
    expect(numeroDeLote(undefined)).toBe('');
  });

  it('con los códigos reales: toda parte sale con letra y ninguna etiqueta de parte se repite dentro de su manzana y etapa', () => {
    const vistos = new Map<string, string>();
    for (const c of codigosReales) {
      const p = interpretarCodigoLote(c)!;
      const e = numeroDeLote({ default_code: c, x_lote: String(p.lote) });
      if (p.letra) expect(e).toMatch(/^\d+[A-I]$/);
      const clave = `${p.etapa}|${p.manzana}|${e}`;
      expect(vistos.get(clave), `${c} repite la etiqueta de ${vistos.get(clave)}`).toBeUndefined();
      vistos.set(clave, c);
    }
  });
});
