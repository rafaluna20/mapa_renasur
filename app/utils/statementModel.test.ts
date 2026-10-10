import { describe, it, expect } from 'vitest';
import {
    buildStatementModel,
    commonLateFeePercentage,
    installmentLabel,
    installmentStatus,
    isHiddenLateFee,
    isLateFeeInvoice,
    lateFeeLabel,
    quotaNumberOf,
    STATUS_LABEL,
    type StatementInvoiceLike,
} from './statementModel';

const NOW = new Date('2026-10-11T12:00:00'); // un día después de generarse las moras de ejemplo

let seq = 0;
function cuota(n: number, over: Partial<StatementInvoiceLike> = {}): StatementInvoiceLike {
    seq += 1;
    return {
        id: seq, name: `B BBB-${1000 + seq}`, ref: n === 0 ? 'CONTRATOMANUAL-E01MZR041P-INIT' : `CONTRATOMANUAL-E01MZR041P-C${String(n).padStart(3, '0')}`,
        invoice_date: `2026-0${Math.min(9, 1 + (n % 9))}-01`, invoice_date_due: '2026-06-30',
        amount_total: 1097.22, amount_residual: 0, payment_state: 'paid', is_late_fee: false, ...over,
    };
}
function mora(n: number, over: Partial<StatementInvoiceLike> = {}): StatementInvoiceLike {
    seq += 1;
    return {
        id: seq, name: `B BBB-${2000 + seq}`, ref: `CONTRATOMANUAL-E01MZR041P-C${String(n).padStart(3, '0')}-MORA`,
        invoice_date: '2026-10-10', invoice_date_due: '2026-10-10',
        amount_total: 109.72, amount_residual: 109.72, payment_state: 'not_paid',
        is_late_fee: true, late_fee_days_late: 10, late_fee_percentage_applied: 10, late_fee_waived: false, state: 'posted', ...over,
    };
}

/** Réplica del caso real (contrato 280, lote E01MZR041P): 14 cuotas pagadas, C015-C017 vencidas con su mora. */
function caso280(): StatementInvoiceLike[] {
    const list: StatementInvoiceLike[] = [];
    for (let n = 1; n <= 14; n++) list.push(cuota(n));
    for (const n of [15, 16, 17]) {
        list.push(cuota(n, { payment_state: 'not_paid', amount_residual: 1097.22, invoice_date_due: `2026-0${n - 8}-30` }));
        list.push(mora(n));
    }
    return list;
}

describe('clasificación de facturas', () => {
    it('reconoce la mora por is_late_fee y, si el dato no llegó, por el sufijo -MORA de la referencia', () => {
        expect(isLateFeeInvoice(mora(17))).toBe(true);
        expect(isLateFeeInvoice(cuota(17))).toBe(false);
        const sinCampo = { ...mora(17) } as StatementInvoiceLike;
        delete sinCampo.is_late_fee;
        expect(isLateFeeInvoice(sinCampo)).toBe(true);
        expect(isLateFeeInvoice({ ...sinCampo, ref: 'CONTRATOMANUAL-E01MZR041P-C017-MORA-R2' })).toBe(true);
        expect(isLateFeeInvoice({ ...cuota(3), is_late_fee: undefined })).toBe(false);
    });

    it('la mora hereda el número de su cuota pero tiene su propia etiqueta (ya no sale como "Cuota N° 17" duplicada)', () => {
        expect(quotaNumberOf(mora(17))).toBe(17);
        expect(lateFeeLabel(mora(17))).toBe('Mora cuota 17');
        expect(installmentLabel(cuota(17))).toBe('Cuota N° 17');
        expect(installmentLabel(cuota(0))).toBe('Cuota Inicial');
    });

    it('la mora condonada, anulada o revertida queda oculta; una cuota nunca se oculta por esto', () => {
        expect(isHiddenLateFee(mora(1, { late_fee_waived: true }))).toBe(true);
        expect(isHiddenLateFee(mora(1, { state: 'cancel' }))).toBe(true);
        expect(isHiddenLateFee(mora(1, { payment_state: 'reversed' }))).toBe(true);
        expect(isHiddenLateFee(mora(1))).toBe(false);
        expect(isHiddenLateFee(cuota(1, { state: 'cancel' }))).toBe(false);
    });

    it('el estado de una cuota se llama "Vencida" (no "Mora") para no confundir con el cargo', () => {
        expect(STATUS_LABEL.overdue).toBe('Vencida');
        expect(installmentStatus(cuota(15, { payment_state: 'not_paid', amount_residual: 5 }), NOW)).toBe('overdue');
        expect(installmentStatus(cuota(18, { payment_state: 'not_paid', invoice_date_due: '2026-12-31' }), NOW)).toBe('pending');
        expect(installmentStatus(cuota(1), NOW)).toBe('paid');
    });
});

describe('buildStatementModel — caso real del contrato 280', () => {
    const model = buildStatementModel(caso280(), 99000, NOW);

    it('separa las 17 cuotas de las 3 moras', () => {
        expect(model.installments).toHaveLength(17);
        expect(model.lateFees).toHaveLength(3);
        expect(model.installments.some(isLateFeeInvoice)).toBe(false);
    });

    it('el atraso cuenta CUOTAS vencidas (3), no las moras como cuotas (antes decía 6)', () => {
        expect(model.overdueInstallments).toHaveLength(3);
        expect(model.overdueInstallmentsAmount).toBeCloseTo(3291.66, 2);
    });

    it('la mora pendiente va aparte y el total a regularizar las suma', () => {
        expect(model.lateFeesPending).toHaveLength(3);
        expect(model.lateFeesPendingAmount).toBeCloseTo(329.16, 2);
        expect(model.totalToRegularize).toBeCloseTo(3620.82, 2);
        expect(model.hasDebt).toBe(true);
    });

    it('el capital pagado y el saldo del lote solo consideran las cuotas', () => {
        expect(model.capitalPaid).toBeCloseTo(14 * 1097.22, 2);
        expect(model.pendingBalance).toBeCloseTo(99000 - 14 * 1097.22, 2);
        expect(model.lateFeePaid).toBe(0);
    });
});

describe('buildStatementModel — regresiones', () => {
    it('pagar una mora NO baja el saldo deudor del lote ni sube el % de avance', () => {
        const antes = buildStatementModel(caso280(), 99000, NOW);
        const conMoraPagada = caso280();
        conMoraPagada.forEach((i) => {
            if (isLateFeeInvoice(i)) { i.payment_state = 'paid'; i.amount_residual = 0; }
        });
        const despues = buildStatementModel(conMoraPagada, 99000, NOW);
        expect(despues.pendingBalance).toBe(antes.pendingBalance);
        expect(despues.financialProgress).toBe(antes.financialProgress);
        expect(despues.capitalPaid).toBe(antes.capitalPaid);
        expect(despues.lateFeePaid).toBeCloseTo(329.16, 2);
        expect(despues.lateFeesPendingAmount).toBe(0);
        expect(despues.hasLateFees).toBe(true);
    });

    it('una mora condonada no aparece ni suma, pero las cuotas siguen igual', () => {
        const inv = caso280();
        const oculta = inv.find(isLateFeeInvoice)!;
        oculta.late_fee_waived = true;
        oculta.state = 'cancel';
        const model = buildStatementModel(inv, 99000, NOW);
        expect(model.lateFees).toHaveLength(2);
        expect(model.lateFeesPendingAmount).toBeCloseTo(219.44, 2);
        expect(model.installments).toHaveLength(17);
    });

    it('con moras pendientes pero sin cuotas vencidas igual hay deuda exigible', () => {
        const inv = [cuota(1), cuota(2), mora(2)];
        const model = buildStatementModel(inv, 5000, NOW);
        expect(model.hasOverdueInstallments).toBe(false);
        expect(model.hasDebt).toBe(true);
        expect(model.totalToRegularize).toBeCloseTo(109.72, 2);
    });

    it('un lote sin moras se comporta exactamente como antes', () => {
        const inv = [cuota(0), cuota(1), cuota(2, { payment_state: 'not_paid', amount_residual: 1097.22, invoice_date_due: '2026-09-30' })];
        const model = buildStatementModel(inv, 10000, NOW);
        expect(model.hasLateFees).toBe(false);
        expect(model.overdueInstallments).toHaveLength(1);
        expect(model.totalToRegularize).toBeCloseTo(1097.22, 2);
        expect(model.capitalPaid).toBeCloseTo(2 * 1097.22, 2);
    });

    it('mantiene la tolerancia de redondeo (un lote 100% pagado no muestra centavos de saldo)', () => {
        const inv = Array.from({ length: 12 }, (_, i) => cuota(i + 1, { amount_total: 2333.33 }));
        expect(buildStatementModel(inv, 28000, NOW).pendingBalance).toBe(0);
    });

    it('ordena por cuota (Inicial, 1, 2…) y deja lo no reconocido al final', () => {
        const inv = [cuota(3), cuota(0), cuota(1), { ...cuota(1), ref: 'OTRO-DOCUMENTO', name: 'Factura suelta' }];
        const labels = buildStatementModel(inv, 100, NOW).installments.map(installmentLabel);
        expect(labels).toEqual(['Cuota Inicial', 'Cuota N° 1', 'Cuota N° 3', 'Factura suelta']);
    });
});

describe('commonLateFeePercentage', () => {
    it('devuelve el % si todas las moras comparten uno', () => {
        expect(commonLateFeePercentage([mora(1), mora(2)])).toBe(10);
    });
    it('devuelve null si varían o no se conocen', () => {
        expect(commonLateFeePercentage([mora(1), mora(2, { late_fee_percentage_applied: 3 })])).toBeNull();
        expect(commonLateFeePercentage([mora(1, { late_fee_percentage_applied: undefined })])).toBeNull();
        expect(commonLateFeePercentage([])).toBeNull();
    });
});
