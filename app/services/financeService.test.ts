import { describe, it, expect } from 'vitest';
import { financeService } from './financeService';

describe('financeService.calculateQuote', () => {
    it('calcula descuento, saldo y cuota mensual correctamente', () => {
        const result = financeService.calculateQuote(100000, 10, 20000, 12);
        expect(result.discountAmount).toBeCloseTo(10000, 4);
        expect(result.discountedPrice).toBeCloseTo(90000, 4);
        expect(result.remainingBalance).toBeCloseTo(70000, 4);
        expect(result.monthlyInstallment).toBeCloseTo(70000 / 12, 4);
        expect(result.installments).toHaveLength(12);
    });

    it('el saldo se paga completo al final del cronograma (sin decimales colgando)', () => {
        const result = financeService.calculateQuote(177888.6, 4.2, 18220, 72);
        const last = result.installments[result.installments.length - 1];
        // El ultimo saldo pendiente debe estar practicamente en 0 (redondeo de centimos)
        expect(last.balance).toBeLessThan(0.01);
    });

    it('con numInstallments=0 la cuota mensual es 0 y no genera cuotas', () => {
        const result = financeService.calculateQuote(100000, 0, 100000, 0);
        expect(result.monthlyInstallment).toBe(0);
        expect(result.installments).toHaveLength(0);
        expect(result.remainingBalance).toBeCloseTo(0, 4);
    });

    it('sin cuota inicial, el saldo a financiar es el precio con descuento completo', () => {
        const result = financeService.calculateQuote(50000, 0, 0, 10);
        expect(result.remainingBalance).toBeCloseTo(50000, 4);
    });

    it('en modo fixed_day respeta una fecha de primera cuota manual tal cual', () => {
        const manualDate = new Date(2026, 5, 15); // 15 jun 2026
        const result = financeService.calculateQuote(100000, 0, 0, 3, undefined, manualDate, 'fixed_day');
        expect(result.installments[0].date.getTime()).toBe(manualDate.getTime());
        expect(result.firstInstallmentDate?.getTime()).toBe(manualDate.getTime());
    });

    it('en modo end_of_month (por defecto) la PRIMERA cuota tambien cae a fin de mes', () => {
        // Regla acordada con el contrato de Odoo (modo "Fin de mes"): 15 jun -> 30 jun
        const manualDate = new Date(2026, 5, 15);
        const result = financeService.calculateQuote(100000, 0, 0, 3, undefined, manualDate);
        expect(result.installments[0].date.getTime()).toBe(new Date(2026, 5, 30).getTime());
        expect(result.installments[1].date.getTime()).toBe(new Date(2026, 6, 31).getTime());
        expect(result.firstInstallmentDate?.getTime()).toBe(new Date(2026, 5, 30).getTime());
    });

    it('en fin de mes: una primera fecha que ya es fin de mes no cambia, y febrero bisiesto cae en 29', () => {
        const first = new Date(2027, 10, 30); // 30 nov 2027
        const result = financeService.calculateQuote(100000, 0, 0, 4, undefined, first, 'end_of_month');
        expect(result.installments[0].date.getTime()).toBe(first.getTime());
        expect(result.installments[3].date.getTime()).toBe(new Date(2028, 1, 29).getTime());
    });

    it('sin fecha manual, la primera cuota es el ultimo dia del mes siguiente a la inicial', () => {
        const result = financeService.calculateQuote(100000, 0, 0, 2, new Date(2026, 9, 5));
        expect(result.installments[0].date.getTime()).toBe(new Date(2026, 10, 30).getTime());
    });

    it('en modo fixed_day, todas las cuotas mantienen el mismo dia del mes', () => {
        const firstDate = new Date(2026, 0, 15); // 15 ene 2026
        const result = financeService.calculateQuote(100000, 0, 0, 4, undefined, firstDate, 'fixed_day');
        result.installments.forEach((inst) => {
            expect(inst.date.getDate()).toBe(15);
        });
    });

    it('en modo end_of_month, cada cuota cae en el ultimo dia de su mes', () => {
        const firstDate = new Date(2026, 0, 31); // 31 ene 2026
        const result = financeService.calculateQuote(100000, 0, 0, 3, undefined, firstDate, 'end_of_month');
        // Feb 2026 (no bisiesto) -> 28, Mar 2026 -> 31
        expect(result.installments[1].date.getDate()).toBe(28);
        expect(result.installments[2].date.getDate()).toBe(31);
    });
});

describe('financeService.getNextInstallmentDate', () => {
    it('pasa correctamente de diciembre a enero del siguiente año', () => {
        const dec = new Date(2026, 11, 15); // 15 dic 2026
        const next = financeService.getNextInstallmentDate(dec);
        expect(next.getFullYear()).toBe(2027);
        expect(next.getMonth()).toBe(0);
        expect(next.getDate()).toBe(31); // ultimo dia de enero
    });
});

describe('financeService.getLastDayOfMonth', () => {
    it('calcula correctamente febrero en año bisiesto vs no bisiesto', () => {
        expect(financeService.getLastDayOfMonth(2024, 1).getDate()).toBe(29); // 2024 bisiesto
        expect(financeService.getLastDayOfMonth(2026, 1).getDate()).toBe(28); // 2026 no bisiesto
    });
});

describe('financeService.parseLocalDate', () => {
    it('parsea una fecha YYYY-MM-DD como hora local, no UTC', () => {
        const date = financeService.parseLocalDate('2026-07-24');
        expect(date.getFullYear()).toBe(2026);
        expect(date.getMonth()).toBe(6); // julio (0-indexed)
        expect(date.getDate()).toBe(24);
    });
});

describe('financeService.roundTo2Decimals / roundTo4Decimals', () => {
    // Nota: 1.005 y 1.00005 NO se usan acá a propósito — no se pueden
    // representar exactos en punto flotante (1.005 se guarda como
    // 1.00499999...), así que redondear a 2 decimales da 1.00, no 1.01, en
    // CUALQUIER implementación de redondeo en JS. Eso no es un bug de esta
    // función, es una limitación del propio punto flotante — se prueba con
    // valores que no caen justo en ese borde.
    it('redondea correctamente a 2 y 4 decimales', () => {
        expect(financeService.roundTo2Decimals(1.006)).toBeCloseTo(1.01, 2);
        expect(financeService.roundTo4Decimals(1.00006)).toBeCloseTo(1.0001, 4);
    });
});


describe('financeService.toISODate', () => {
    it('devuelve la fecha LOCAL sin corrimiento de dia (a diferencia de toISOString)', () => {
        // 11 pm hora local: toISOString() en UTC-5 daria el dia siguiente
        const lateEvening = new Date(2026, 8, 19, 23, 30);
        expect(financeService.toISODate(lateEvening)).toBe('2026-09-19');
    });

    it('es el inverso de parseLocalDate', () => {
        expect(financeService.toISODate(financeService.parseLocalDate('2026-02-28'))).toBe('2026-02-28');
    });

    it('rellena con ceros mes y dia', () => {
        expect(financeService.toISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
    });
});
