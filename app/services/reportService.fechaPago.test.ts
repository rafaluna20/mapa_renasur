import { describe, it, expect } from 'vitest';
import { getFechaPagoRawPdf, calcularDiasPdf, type ClientStatementInvoice } from './reportService';

function factura(overrides: Partial<ClientStatementInvoice>): ClientStatementInvoice {
    return {
        id: 1,
        name: 'B BBB-00001247',
        invoice_date: '2026-05-31',
        invoice_date_due: '2026-05-31',
        amount_total: 328.57,
        amount_residual: 0,
        payment_state: 'paid',
        ...overrides,
    };
}

describe('getFechaPagoRawPdf — fecha de pago del Estado de Cuenta', () => {
    // Caso real reportado: cuota 6 del lote E01MZQ029P. El cobro bancario fue el
    // 01/06/26 (1 día tarde) pero el PDF decía 30/06/26 (30 días de atraso)
    // porque el asiento de "Diferencia de cambio" que Odoo genera al conciliar
    // una factura en USD también viene en la lista de pagos, con fecha de fin de mes.
    it('ignora el asiento de diferencia de cambio: la fecha de pago es la del cobro real', () => {
        const inv = factura({
            invoice_payments_widget: {
                content: [
                    { date: '2026-06-01', is_exchange: false }, // BCP Renasur Dolares, PBNK4/2026/00027
                    { date: '2026-06-30', is_exchange: true },  // Exchange Difference, EXCH/2026/06/0005
                ],
            },
        });
        const fecha = getFechaPagoRawPdf(inv);
        expect(fecha).toBe('2026-06-01');
        expect(calcularDiasPdf(fecha, inv.invoice_date_due).texto).toBe('1d atraso');
    });

    it('sin diferencia de cambio sigue igual: cobro único y varios abonos (gana el último real)', () => {
        expect(getFechaPagoRawPdf(factura({ invoice_payments_widget: { content: [{ date: '2026-07-27' }] } }))).toBe('2026-07-27');
        // Cuota inicial pagada en dos abonos el mismo día y cuota saldada con dos abonos en días distintos.
        expect(getFechaPagoRawPdf(factura({ invoice_payments_widget: { content: [{ date: '2025-10-28' }, { date: '2025-10-28' }] } }))).toBe('2025-10-28');
        expect(getFechaPagoRawPdf(factura({ invoice_payments_widget: { content: [{ date: '2026-03-10' }, { date: '2026-03-25' }] } }))).toBe('2026-03-25');
    });

    it('sin ningún cobro real (solo ajustes contables), datos faltantes o cuota no pagada: no hay fecha', () => {
        expect(getFechaPagoRawPdf(factura({ invoice_payments_widget: { content: [{ date: '2026-06-30', is_exchange: true }] } }))).toBeNull();
        expect(getFechaPagoRawPdf(factura({ invoice_payments_widget: false }))).toBeNull();
        expect(getFechaPagoRawPdf(factura({ invoice_payments_widget: undefined }))).toBeNull();
        expect(getFechaPagoRawPdf(factura({ invoice_payments_widget: { content: [] } }))).toBeNull();
        expect(getFechaPagoRawPdf(factura({ payment_state: 'not_paid', invoice_payments_widget: { content: [{ date: '2026-06-01' }] } }))).toBeNull();
    });
});

describe('calcularDiasPdf', () => {
    it('adelanto, a tiempo y atraso', () => {
        expect(calcularDiasPdf('2025-12-29', '2025-12-31').texto).toBe('2d antes');
        expect(calcularDiasPdf('2026-02-28', '2026-02-28').texto).toBe('A tiempo');
        expect(calcularDiasPdf('2026-04-04', '2026-03-31').texto).toBe('4d atraso');
    });
});
