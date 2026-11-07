import { describe, expect, it, vi } from 'vitest';
import codigosReales from './__fixtures__/codigosReales.json';

vi.mock('@/app/services/odooService', () => ({ fetchOdoo: vi.fn() }));

import { paymentService } from '@/app/services/paymentService';
import { partesDeCodigo } from '@/app/utils/escenaLote';
import { mergeLotsData } from '@/app/utils/dataMerger';
import type { EnrichedGeometry } from '@/app/utils/dataMerger';
import { extraerCodigoDeReferencia } from './codigoLote';

// P6: al reemplazar las copias de expresiones regulares por el intérprete único, NADA cambia para los códigos reales.
// Cada prueba reproduce la expresión de ANTES (el «oráculo») y exige el mismo resultado con los 1,347 códigos.

describe('equivalencia con las expresiones de antes (códigos reales)', () => {
  it('parsePaymentReference: mismo etapa/manzana/lote/cuota que la expresión anterior', () => {
    for (const c of codigosReales) {
      const ref = `CONTRATOMANUAL-${c}-C013-20260105`;
      const viejo = ref.match(/E(\d+)(MZ[A-Z]+)(\d+)([A-Z])?-C(\d+)-(\d{8})/);
      const esperado = viejo ? { etapa: viejo[1], manzana: viejo[2], lote: viejo[3], quota: viejo[5], totalQuotas: undefined } : undefined;
      // la expresión vieja deja la parte numérica pegada al lote; solo el sufijo letra (P, Z) queda aparte
      expect(paymentService.parsePaymentReference(ref), c).toEqual(esperado);
    }
  });

  it('parsePaymentReference: sin fecha de 8 dígitos o sin cuota sigue sin devolver nada', () => {
    expect(paymentService.parsePaymentReference('CONTRATOMANUAL-E01MZD148P-C013')).toBeUndefined();
    expect(paymentService.parsePaymentReference('CONTRATOMANUAL-E01MZD148P-INIT')).toBeUndefined();
  });

  it('partesDeCodigo: igual que la expresión anterior en todos los códigos reales', () => {
    for (const c of codigosReales) {
      const m = /^E\d{2}MZ([A-Z]{1,2})(\d{3})([P123])$/i.exec(c);
      const esperado = m ? { manzana: m[1].toUpperCase(), lote: String(parseInt(m[2], 10)) + (m[3].toUpperCase() === 'P' ? '' : 'ABC'[Number(m[3]) - 1]) } : null;
      expect(partesDeCodigo(c), c).toEqual(esperado);
    }
  });

  it('extraer de la referencia: igual que la expresión anterior', () => {
    for (const c of codigosReales) {
      for (const sufijo of ['-C008', '-INIT']) {
        const texto = `CONTRATOMANUAL-${c}${sufijo}`;
        const viejo = texto.match(/(E\d+MZ[A-Z]+\d+[A-Z]?)-(?:C\d+|INIT)/i);
        expect(extraerCodigoDeReferencia(texto)?.codigo ?? null, texto).toBe(viejo ? viejo[1].toUpperCase() : null);
      }
    }
  });

  it('lotes que solo existen en la geometría estática: misma manzana, etapa y número que la expresión anterior', () => {
    const cuadrado = { coordinates: [[0, 0], [1, 0], [1, 1], [0, 1]], measurements: { area: 1 } } as unknown as EnrichedGeometry;
    const geometrias = Object.fromEntries(codigosReales.map((c) => [c, cuadrado]));
    const lotes = mergeLotsData([], [], geometrias);
    expect(lotes.length).toBe(codigosReales.length);
    for (const l of lotes) {
      const m = String(l.default_code).match(/E(\d+)MZ([A-Z]+)(\w+)/);
      expect([l.x_etapa, l.x_mz, l.x_lote], String(l.default_code)).toEqual([m![1], m![2], m![3]]);
    }
  });
});
