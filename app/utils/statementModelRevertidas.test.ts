import { describe, it, expect } from 'vitest';
import { buildStatementModel, installmentStatus, type ScheduleLineLike, type StatementInvoiceLike } from './statementModel';

/**
 * Una factura REVERTIDA (anulada con nota de credito: payment_state = 'reversed') no es una cuota vencida ni una deuda.
 * Antes el estado de cuenta la mostraba como «Vencida» (conteo +1, monto 0), la sumaba al saldo deudor y bajaba el avance.
 * Datos ficticios, con la forma real de lo que devuelve Odoo (saldo 0 en las revertidas).
 */
const NOW = new Date('2026-11-18T12:00:00');

let seq = 0;
function cuota(n: number, over: Partial<StatementInvoiceLike> = {}): StatementInvoiceLike {
    seq += 1;
    return {
        id: seq, name: `B-${seq}`, ref: `CONTRATOMANUAL-E01MZT042P-C${String(n).padStart(3, '0')}`, invoice_date: '2026-06-06',
        invoice_date_due: '2026-06-06', amount_total: 1300, amount_residual: 0, payment_state: 'paid', is_late_fee: false,
        contract_quota_number: n, ...over,
    };
}
const revertida = (n: number, over: Partial<StatementInvoiceLike> = {}) => cuota(n, { payment_state: 'reversed', amount_residual: 0, ...over });

describe('facturas revertidas en el estado de cuenta', () => {
    it('una cuota revertida NO es vencida: no cuenta como atraso ni suma deuda', () => {
        const m = buildStatementModel([cuota(1), cuota(2), revertida(9), revertida(10)], 23400, NOW);
        expect(m.overdueQuotaCount).toBe(0);
        expect(m.overdueQuotaAmount).toBe(0);
        expect(m.totalToRegularize).toBe(0);
        expect(m.hasOverdueInstallments).toBe(false);
        expect(m.hasDebt).toBe(false);
    });

    it('no aparece en el historial de cuotas', () => {
        const m = buildStatementModel([cuota(1), cuota(2), revertida(9)], 23400, NOW);
        expect(m.installments.map((i) => i.contract_quota_number)).toEqual([1, 2]);
    });

    it('no cuenta como capital pagado (el dinero no entro por esa factura)', () => {
        const m = buildStatementModel([cuota(1), revertida(9)], 23400, NOW);
        expect(m.capitalPaid).toBe(1300);
    });

    it('con una reemision, la cuota aparece UNA sola vez: la factura nueva, no la revertida', () => {
        const nueva = cuota(9, { payment_state: 'not_paid', amount_residual: 1300, ref: 'CONTRATOMANUAL-E01MZT042P-C009-R1', invoice_date: '2026-11-18' });
        const m = buildStatementModel([cuota(1), revertida(9), nueva], 23400, NOW);
        expect(m.installments.filter((i) => i.contract_quota_number === 9)).toHaveLength(1);
        expect(m.installments.find((i) => i.contract_quota_number === 9)?.id).toBe(nueva.id);
        expect(m.overdueQuotaCount).toBe(1);          // la nueva, pendiente y vencida
        expect(m.overdueQuotaAmount).toBe(1300);
    });

    it('la reemitida ya pagada suma como capital pagado y no deja deuda', () => {
        const nueva = cuota(9, { payment_state: 'paid', amount_residual: 0, ref: 'CONTRATOMANUAL-E01MZT042P-C009-R1' });
        const m = buildStatementModel([revertida(9), nueva], 23400, NOW);
        expect(m.capitalPaid).toBe(1300);
        expect(m.hasDebt).toBe(false);
    });

    it('una cuota vencida de verdad sigue contando (control: el cambio no esconde deuda real)', () => {
        const vencida = cuota(5, { payment_state: 'not_paid', amount_residual: 1300 });
        const m = buildStatementModel([revertida(9), vencida], 23400, NOW);
        expect(m.overdueQuotaCount).toBe(1);
        expect(m.overdueQuotaAmount).toBe(1300);
        expect(m.totalToRegularize).toBe(1300);
    });

    it('una cuota PARCIALMENTE pagada sigue siendo deuda (solo "reversed" se excluye)', () => {
        const parcial = cuota(5, { payment_state: 'partial', amount_residual: 400 });
        const m = buildStatementModel([parcial], 23400, NOW);
        expect(m.overdueQuotaCount).toBe(1);
        expect(m.overdueQuotaAmount).toBe(400);
    });

    it('una mora revertida sigue oculta (comportamiento anterior intacto)', () => {
        const mora = cuota(5, { payment_state: 'reversed', is_late_fee: true, ref: 'CONTRATOMANUAL-E01MZT042P-C005-MORA' });
        const m = buildStatementModel([mora], 23400, NOW);
        expect(m.lateFees).toHaveLength(0);
    });

    it('para un contrato Manual, una cuota revertida cuenta como facturada: no aparece como «vencida sin factura»', () => {
        const cronograma: ScheduleLineLike[] = [{ sequence: 9, date: '2026-06-06', amount: 1300, portal_emitted: false }];
        const m = buildStatementModel([revertida(9)], 23400, NOW, cronograma);
        expect(m.unbilledOverdue).toEqual([]);
        expect(m.overdueQuotaCount).toBe(0);
    });

    it('el estado de una revertida, si se pidiera directamente, no es «pagada» ni «vencida con deuda»', () => {
        // la funcion de estado se mantiene como estaba: el filtro vive en el modelo, que ya no le entrega revertidas
        expect(installmentStatus(revertida(9), NOW)).not.toBe('paid');
    });

    it('sin facturas revertidas el resultado es identico al de siempre', () => {
        const lista = [cuota(1), cuota(2), cuota(3, { payment_state: 'not_paid', amount_residual: 1300 })];
        const m = buildStatementModel(lista, 23400, NOW);
        expect(m.installments).toHaveLength(3);
        expect(m.capitalPaid).toBe(2600);
        expect(m.overdueQuotaCount).toBe(1);
    });
});
