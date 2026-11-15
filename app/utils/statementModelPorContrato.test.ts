import { describe, it, expect } from 'vitest';
import {
    billedQuotaNumberOf,
    buildStatementModel,
    unbilledOverdueQuotas,
    unbilledQuotaLabel,
    resumenSinFactura,
    type ScheduleLineLike,
    type StatementInvoiceLike,
} from './statementModel';

/**
 * Estado de cuenta POR CONTRATO (ficha mapa_estado_cuenta_por_contrato, bloque 2 / criterio C2).
 * Con la facturación al cobro de un contrato Manual, una cuota vencida que nadie cobró NO tiene factura:
 * hay que tomarla del cronograma. Datos ficticios (sin clientes reales).
 */
const NOW = new Date('2026-11-14T12:00:00');

let seq = 0;
function cuota(n: number, over: Partial<StatementInvoiceLike> = {}): StatementInvoiceLike {
    seq += 1;
    return {
        id: seq, name: `F-${seq}`, ref: n === 0 ? 'CONTRATOMANUAL-E01MZX001P-INIT' : `CONTRATOMANUAL-E01MZX001P-C${String(n).padStart(3, '0')}`,
        invoice_date: '2026-06-01', invoice_date_due: '2026-06-30',
        amount_total: 1000, amount_residual: 0, payment_state: 'paid', is_late_fee: false, ...over,
    };
}
function linea(sequence: number, date: string, over: Partial<ScheduleLineLike> = {}): ScheduleLineLike {
    return { sequence, date, amount: 1000, portal_emitted: false, ...over };
}

/** Cronograma: 1 y 2 facturadas, 3 vencida sin factura, 4 vencida pero marcada del portal, 5 futura. */
function cronograma(): ScheduleLineLike[] {
    return [
        linea(1, '2026-08-15'),
        linea(2, '2026-09-15'),
        linea(3, '2026-10-15'),
        linea(4, '2026-11-01', { portal_emitted: true }),
        linea(5, '2026-12-15'),
    ];
}

describe('billedQuotaNumberOf', () => {
    it('prefiere el número estructurado del contrato sobre el de la referencia', () => {
        expect(billedQuotaNumberOf(cuota(3, { contract_quota_number: 7 }))).toBe(7);
    });
    it('sin número estructurado, lo toma de la referencia', () => {
        expect(billedQuotaNumberOf(cuota(3))).toBe(3);
        expect(billedQuotaNumberOf(cuota(0))).toBe(0);
    });
    it('una referencia irreconocible y sin número estructurado da null', () => {
        expect(billedQuotaNumberOf(cuota(3, { ref: 'texto libre' }))).toBeNull();
    });
});

describe('unbilledOverdueQuotas', () => {
    it('lista solo la cuota vencida, sin factura y sin marca de portal', () => {
        const r = unbilledOverdueQuotas([cuota(1), cuota(2)], cronograma(), NOW);
        expect(r.map((q) => q.sequence)).toEqual([3]);
        expect(r[0].amount).toBe(1000);
    });

    it('una cuota marcada como emitida en el portal NO figura', () => {
        const r = unbilledOverdueQuotas([cuota(1), cuota(2), cuota(3)], cronograma(), NOW);
        expect(r).toEqual([]);
    });

    it('una cuota futura sin factura no figura (todavía no es exigible)', () => {
        const r = unbilledOverdueQuotas([], [linea(5, '2026-12-15')], NOW);
        expect(r).toEqual([]);
    });

    it('la factura de la cuota cuenta aunque esté pendiente de pago (ya está facturada)', () => {
        const pendiente = cuota(3, { payment_state: 'not_paid', amount_residual: 1000 });
        const r = unbilledOverdueQuotas([cuota(1), cuota(2), pendiente], cronograma(), NOW);
        expect(r).toEqual([]);
    });

    it('una MORA con el número de la cuota no cuenta como factura de la cuota', () => {
        seq += 1;
        const mora3: StatementInvoiceLike = {
            id: seq, name: 'M-1', ref: 'CONTRATOMANUAL-E01MZX001P-C003-MORA', invoice_date: '2026-11-10',
            invoice_date_due: '2026-11-10', amount_total: 100, amount_residual: 100, payment_state: 'not_paid',
            is_late_fee: true, contract_quota_number: 3,
        };
        const r = unbilledOverdueQuotas([cuota(1), cuota(2), mora3], cronograma(), NOW);
        expect(r.map((q) => q.sequence)).toEqual([3]);
    });

    it('usa contract_quota_number cuando la referencia no se puede leer', () => {
        const rara = cuota(3, { ref: 'texto libre', contract_quota_number: 3 });
        const r = unbilledOverdueQuotas([cuota(1), cuota(2), rara], cronograma(), NOW);
        expect(r).toEqual([]);
    });

    it('ignora cuotas de monto 0 y líneas sin fecha', () => {
        const r = unbilledOverdueQuotas([], [linea(1, '2026-08-15', { amount: 0 }), { sequence: 2, date: false, amount: 1000 }], NOW);
        expect(r).toEqual([]);
    });

    it('las devuelve ordenadas por número de cuota', () => {
        const r = unbilledOverdueQuotas([], [linea(3, '2026-10-15'), linea(1, '2026-08-15'), linea(2, '2026-09-15')], NOW);
        expect(r.map((q) => q.sequence)).toEqual([1, 2, 3]);
    });

    it('sin cronograma devuelve vacío', () => {
        expect(unbilledOverdueQuotas([cuota(1)], undefined, NOW)).toEqual([]);
        expect(unbilledOverdueQuotas([cuota(1)], [], NOW)).toEqual([]);
    });
});

describe('buildStatementModel con cronograma (contrato Manual)', () => {
    const facturas = () => [cuota(1), cuota(2)];

    it('la cuota vencida sin factura suma en el total a regularizar y marca deuda', () => {
        const m = buildStatementModel(facturas(), 5000, NOW, cronograma());
        expect(m.unbilledOverdue.map((q) => q.sequence)).toEqual([3]);
        expect(m.unbilledOverdueAmount).toBe(1000);
        expect(m.totalToRegularize).toBe(1000);
        expect(m.hasOverdueInstallments).toBe(true);
        expect(m.hasDebt).toBe(true);
    });

    it('no cambia el capital pagado, el saldo ni el avance (solo cuentan los pagos reales)', () => {
        const sin = buildStatementModel(facturas(), 5000, NOW);
        const con = buildStatementModel(facturas(), 5000, NOW, cronograma());
        expect(con.capitalPaid).toBe(sin.capitalPaid);
        expect(con.pendingBalance).toBe(sin.pendingBalance);
        expect(con.financialProgress).toBe(sin.financialProgress);
    });

    it('suma junto con una cuota facturada vencida y una mora pendiente', () => {
        seq += 1;
        const vencida = cuota(2, { payment_state: 'not_paid', amount_residual: 800, invoice_date_due: '2026-09-15' });
        const mora2: StatementInvoiceLike = {
            id: seq, name: 'M-2', ref: 'CONTRATOMANUAL-E01MZX001P-C002-MORA', invoice_date: '2026-11-10', invoice_date_due: '2026-11-10',
            amount_total: 80, amount_residual: 80, payment_state: 'not_paid', is_late_fee: true, late_fee_waived: false, state: 'posted',
        };
        const m = buildStatementModel([cuota(1), vencida, mora2], 5000, NOW, cronograma());
        expect(m.overdueInstallmentsAmount).toBe(800);
        expect(m.lateFeesPendingAmount).toBe(80);
        expect(m.unbilledOverdueAmount).toBe(1000);
        expect(m.totalToRegularize).toBe(1880);
    });

    it('sin cuotas vencidas sin factura queda igual que sin cronograma', () => {
        const todas = [cuota(1), cuota(2), cuota(3)];
        const sin = buildStatementModel(todas, 5000, NOW);
        const con = buildStatementModel(todas, 5000, NOW, cronograma());
        expect(con.unbilledOverdue).toEqual([]);
        expect(con.totalToRegularize).toBe(sin.totalToRegularize);
        expect(con.hasDebt).toBe(sin.hasDebt);
    });
});

describe('conteo y monto de cuotas vencidas (aviso de atraso)', () => {
    it('cuenta juntas las vencidas con factura y las vencidas sin factura', () => {
        const vencida = cuota(2, { payment_state: 'not_paid', amount_residual: 800, invoice_date_due: '2026-09-15' });
        const m = buildStatementModel([cuota(1), vencida], 5000, NOW, cronograma());
        expect(m.overdueInstallments).toHaveLength(1);
        expect(m.unbilledOverdue.map((q) => q.sequence)).toEqual([3]);
        expect(m.overdueQuotaCount).toBe(2);
        expect(m.overdueQuotaAmount).toBe(1800);
    });
    it('sin cronograma coinciden con las facturas vencidas de siempre', () => {
        const vencida = cuota(2, { payment_state: 'not_paid', amount_residual: 800, invoice_date_due: '2026-09-15' });
        const m = buildStatementModel([cuota(1), vencida], 5000, NOW);
        expect(m.overdueQuotaCount).toBe(1);
        expect(m.overdueQuotaAmount).toBe(800);
    });
});

describe('unbilledQuotaLabel', () => {
    it('rotula igual que una cuota facturada', () => {
        expect(unbilledQuotaLabel({ sequence: 0 })).toBe('Cuota Inicial');
        expect(unbilledQuotaLabel({ sequence: 3 })).toBe('Cuota N° 3');
    });
});

describe('buildStatementModel sin cronograma (contrato Automático): igual que siempre', () => {
    it('los campos nuevos quedan vacíos y no alteran el resultado', () => {
        const m = buildStatementModel([cuota(1), cuota(2)], 5000, NOW);
        expect(m.unbilledOverdue).toEqual([]);
        expect(m.unbilledOverdueAmount).toBe(0);
        expect(m.totalToRegularize).toBe(0);
        expect(m.hasDebt).toBe(false);
    });
});

describe('resumenSinFactura (tarjetas del portal: cuotas vencidas sin factura de todos los lotes)', () => {
    const lote = (currency: 'PEN' | 'USD', invoices: StatementInvoiceLike[], scheduleLines?: ScheduleLineLike[]) =>
        ({ currency, invoices, scheduleLines });

    it('cuenta las cuotas vencidas sin factura de todos los lotes y devuelve su monto en la moneda de cada lote', () => {
        const r = resumenSinFactura([
            lote('PEN', [cuota(1), cuota(2)], cronograma()),                       // vence la 3 (1000)
            lote('USD', [], [linea(1, '2026-09-01', { amount: 500 }), linea(2, '2026-10-01', { amount: 500 })]), // 2 cuotas
        ], NOW);
        expect(r.count).toBe(3);
        expect(r.amounts).toEqual([
            { currency: 'PEN', amount: 1000 },
            { currency: 'USD', amount: 1000 },
        ]);
    });

    it('un lote sin cuotas vencidas sin factura no aporta nada (marcadas del portal y futuras no cuentan)', () => {
        const r = resumenSinFactura([lote('PEN', [cuota(1), cuota(2), cuota(3)], cronograma())], NOW);
        expect(r).toEqual({ count: 0, amounts: [] });
    });

    it('lotes de contratos Automaticos (sin cronograma) o sin lotes devuelven vacio', () => {
        expect(resumenSinFactura([lote('PEN', [cuota(1)], undefined)], NOW)).toEqual({ count: 0, amounts: [] });
        expect(resumenSinFactura([], NOW)).toEqual({ count: 0, amounts: [] });
    });
});
