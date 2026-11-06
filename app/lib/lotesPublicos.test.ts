import { describe, expect, it } from 'vitest';
import { esPublicable } from './lotesPublicos';

describe('esPublicable (landing /venta)', () => {
  it('publica los lotes reales de Odoo en estados comerciales', () => {
    for (const x_statu of ['disponible', 'libre', 'reservado', 'separado', 'vendido', 'cotizacion']) {
      expect(esPublicable({ id: '123', x_statu }), x_statu).toBe(true);
    }
  });

  it('NO publica un lote «no vender», aunque sea un producto real de Odoo (los 807 de P4)', () => {
    expect(esPublicable({ id: '4001', x_statu: 'no vender' })).toBe(false);
    expect(esPublicable({ id: '4001', x_statu: ' No Vender ' })).toBe(false);
  });

  it('sigue sin publicar lo que no es un producto real (local-… / fb-…)', () => {
    expect(esPublicable({ id: 'fb-E01MZQ055P', x_statu: 'disponible' })).toBe(false);
    expect(esPublicable({ id: 'local-12', x_statu: 'disponible' })).toBe(false);
  });

  it('un estado ausente se trata como publicable si el id es real (comportamiento anterior)', () => {
    expect(esPublicable({ id: '9' })).toBe(true);
    expect(esPublicable({ id: '9', x_statu: null })).toBe(true);
  });
});
