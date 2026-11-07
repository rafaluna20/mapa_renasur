import { describe, expect, it } from 'vitest';
import { atributosOpcionales } from '@/app/utils/dataMerger';
import { atributosParaMostrar, resumenAtributos } from './atributosLote';

describe('atributosLote', () => {
  it('muestra frente y potencia con su unidad', () => {
    expect(atributosParaMostrar({ x_frente: 30, x_potencia_kw: 250 })).toEqual([
      { etiqueta: 'Frente', valor: '30 m' }, { etiqueta: 'Potencia', valor: '250 kW' },
    ]);
    expect(resumenAtributos({ x_frente: 30.5, x_potencia_kw: 250 })).toBe('frente 30.5 m · 250 kW');
  });

  it('sin dato (vacío, 0, false, negativo) no muestra nada', () => {
    for (const v of [undefined, 0, false, -1, Number.NaN] as const) {
      expect(atributosParaMostrar({ x_frente: v as never, x_potencia_kw: v as never })).toEqual([]);
    }
    expect(resumenAtributos({})).toBe('');
  });

  it('solo uno de los dos', () => {
    expect(resumenAtributos({ x_potencia_kw: 400 })).toBe('400 kW');
    expect(resumenAtributos({ x_frente: 18 })).toBe('frente 18 m');
  });

  it('atributosOpcionales (lectura de Odoo) descarta 0 y false', () => {
    expect(atributosOpcionales({ x_frente: 0, x_potencia_kw: false })).toEqual({});
    expect(atributosOpcionales({ x_frente: 30, x_potencia_kw: 250 })).toEqual({ x_frente: 30, x_potencia_kw: 250 });
    expect(atributosOpcionales({})).toEqual({});
  });
});
