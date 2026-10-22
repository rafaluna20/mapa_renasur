import { describe, it, expect } from 'vitest';
import {
    armarSeparacion,
    bordeSeparacion,
    calcularEstado,
    coincideFiltroSeparacion,
    diasEntre,
    etiquetaAntiguedad,
    etiquetaSeparacion,
    fechaLimaDeOdoo,
    hoyLima,
} from './separacionUtils';

const base = { orderId: 1, orderName: 'S00001', vendedor: 'Ana', extensiones: 0, tieneContrato: false };

describe('fechas', () => {
    it('hoyLima usa la fecha de Lima, no la de UTC', () => {
        // 2026-10-16 02:00 UTC = 2026-10-15 21:00 en Lima
        expect(hoyLima(new Date('2026-10-16T02:00:00Z'))).toBe('2026-10-15');
    });
    it('fechaLimaDeOdoo convierte el datetime UTC de Odoo a fecha de Lima', () => {
        expect(fechaLimaDeOdoo('2026-10-16 02:30:00')).toBe('2026-10-15');
        expect(fechaLimaDeOdoo('2026-10-15 14:50:39')).toBe('2026-10-15');
    });
    it('diasEntre cuenta días enteros, también entre meses', () => {
        expect(diasEntre('2026-10-15', '2026-10-30')).toBe(15);
        expect(diasEntre('2026-10-30', '2026-11-02')).toBe(3);
        expect(diasEntre('2026-10-15', '2026-10-10')).toBe(-5);
    });
});

describe('calcularEstado', () => {
    it('contrato vigente gana sobre cualquier plazo', () => {
        expect(calcularEstado(-30, true)).toBe('contratada');
    });
    it('umbrales: vigente > 3 días, por vencer 0..3, vencida < 0', () => {
        expect(calcularEstado(4, false)).toBe('vigente');
        expect(calcularEstado(3, false)).toBe('por_vencer');
        expect(calcularEstado(0, false)).toBe('por_vencer');
        expect(calcularEstado(-1, false)).toBe('vencida');
    });
});

describe('armarSeparacion y etiquetas', () => {
    it('calcula antigüedad y días restantes', () => {
        const s = armarSeparacion({ ...base, inicio: '2026-10-01', limite: '2026-10-16', hoy: '2026-10-14' });
        expect(s.diasSeparado).toBe(13);
        expect(s.diasRestantes).toBe(2);
        expect(s.estado).toBe('por_vencer');
        expect(etiquetaSeparacion(s)).toBe('Vence en 2 días');
        expect(etiquetaAntiguedad(s.diasSeparado)).toBe('Separado hace 13 días');
    });
    it('singular, hoy y vencida', () => {
        const uno = armarSeparacion({ ...base, inicio: '2026-10-01', limite: '2026-10-15', hoy: '2026-10-14' });
        expect(etiquetaSeparacion(uno)).toBe('Vence en 1 día');
        const hoy = armarSeparacion({ ...base, inicio: '2026-10-01', limite: '2026-10-14', hoy: '2026-10-14' });
        expect(etiquetaSeparacion(hoy)).toBe('Vence hoy');
        const vencida = armarSeparacion({ ...base, inicio: '2026-09-01', limite: '2026-09-16', hoy: '2026-10-14' });
        expect(vencida.estado).toBe('vencida');
        expect(etiquetaSeparacion(vencida)).toBe('Vencida hace 28 días');
        expect(etiquetaAntiguedad(0)).toBe('Separado hoy');
    });
    it('la antigüedad nunca es negativa', () => {
        const s = armarSeparacion({ ...base, inicio: '2026-10-20', limite: '2026-11-04', hoy: '2026-10-14' });
        expect(s.diasSeparado).toBe(0);
    });
});

describe('filtros y borde del mapa', () => {
    const mk = (limite: string, tieneContrato = false) => ({
        separacion: armarSeparacion({ ...base, inicio: '2026-10-01', limite, tieneContrato, hoy: '2026-10-14' }),
    });
    it('cada filtro toma solo su estado', () => {
        const vigente = mk('2026-10-30');
        const porVencer = mk('2026-10-16');
        const vencida = mk('2026-10-10');
        expect(coincideFiltroSeparacion(vigente, 'sep_vigente')).toBe(true);
        expect(coincideFiltroSeparacion(porVencer, 'sep_por_vencer')).toBe(true);
        expect(coincideFiltroSeparacion(vencida, 'sep_vencida')).toBe(true);
        expect(coincideFiltroSeparacion(vigente, 'sep_vencida')).toBe(false);
        expect(coincideFiltroSeparacion(vencida, 'sep_vigente')).toBe(false);
    });
    it('la reserva administrativa no entra en los filtros de plazo y viceversa', () => {
        const admin = { reservaAdmin: true };
        expect(coincideFiltroSeparacion(admin, 'sep_admin')).toBe(true);
        expect(coincideFiltroSeparacion(admin, 'sep_vencida')).toBe(false);
        expect(coincideFiltroSeparacion(mk('2026-10-10'), 'sep_admin')).toBe(false);
    });
    it('un lote sin datos de separación nunca coincide', () => {
        expect(coincideFiltroSeparacion({}, 'sep_vigente')).toBe(false);
    });
    it('solo se destaca el borde de por vencer y vencida', () => {
        expect(bordeSeparacion(mk('2026-10-30'))).toBeNull();
        expect(bordeSeparacion(mk('2026-10-16'))?.color).toBe('#F59E0B');
        expect(bordeSeparacion(mk('2026-10-10'))?.color).toBe('#DC2626');
        expect(bordeSeparacion(mk('2026-10-10', true))).toBeNull();
        expect(bordeSeparacion({})).toBeNull();
    });
});
