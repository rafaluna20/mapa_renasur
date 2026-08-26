import { describe, it, expect } from 'vitest';
import { buildCsvContent, buildInvoicesSections, buildGeneralSections, buildIndividualSections, buildOperacionesSections } from './csvExportService';

describe('buildCsvContent', () => {
    it('escapa valores con comas, comillas y saltos de línea', () => {
        const csv = buildCsvContent([
            { rows: [['Normal', 'Con, coma', 'Con "comillas"', 'Con\nsalto']] },
        ]);
        expect(csv).toBe('Normal,"Con, coma","Con ""comillas""","Con\nsalto"');
    });

    it('separa secciones con título y línea en blanco entre ellas', () => {
        const csv = buildCsvContent([
            { title: 'SECCIÓN A', rows: [['a', 'b']] },
            { title: 'SECCIÓN B', rows: [['c', 'd']] },
        ]);
        expect(csv).toBe('SECCIÓN A\r\na,b\r\n\r\nSECCIÓN B\r\nc,d');
    });

    it('valores null/undefined se convierten en celda vacía, no en "null"/"undefined"', () => {
        const csv = buildCsvContent([{ rows: [[null, undefined, 'x']] }]);
        expect(csv).toBe(',,x');
    });
});

describe('buildInvoicesSections', () => {
    it('incluye manzanas, facturas pagadas y omite secciones de aging cuando no hay vencidos', () => {
        const sections = buildInvoicesSections({
            totalCollected: 125000,
            blocks: [{ mz: 'D', etapa: 'E01', totalAmount: 125000, invoicesCount: 5, uniqueLotsCount: 3 }],
            recentPayments: [{ invoice: 'FAC-001', cuotaLabel: 'Cuota N° 1', date: '2026-06-01', client: 'Juan Perez', lot: 'E01MZD148P', etapa: 'E01', mz: 'D', paidAmount: 25000 }],
        });
        const titles = sections.map(s => s.title);
        expect(titles).toContain('RESUMEN POR MANZANA');
        expect(titles).toContain('FACTURAS PAGADAS (DETALLE)');
        expect(titles.some(t => t?.includes('ANTIGÜEDAD'))).toBe(false);

        const manzanaSection = sections.find(s => s.title === 'RESUMEN POR MANZANA')!;
        expect(manzanaSection.rows[1]).toEqual(['E01', 'D', 3, 5, '125000.00']);
    });

    it('incluye antigüedad y detalle de vencidos cuando existen', () => {
        const sections = buildInvoicesSections({
            totalCollected: 50000,
            blocks: [],
            recentPayments: [],
            totalOverdue: 4000,
            aging: [{ bucket: '90+', totalAmount: 4000, invoicesCount: 1 }],
            overdueDetail: [{ invoice: 'FAC-099', client: 'Maria Lopez', lot: 'E01MZC022P', daysOverdue: 145, amountDue: 4000 }],
        });
        const agingSection = sections.find(s => s.title?.includes('ANTIGÜEDAD'));
        expect(agingSection).toBeDefined();
        expect(agingSection!.rows[1]).toEqual(['90+ días', 1, '4000.00']);

        const detailSection = sections.find(s => s.title === 'DETALLE DE FACTURAS VENCIDAS');
        expect(detailSection!.rows[1]).toEqual(['FAC-099', 'Maria Lopez', 'E01MZC022P', 145, '4000.00']);
    });
});

describe('buildGeneralSections', () => {
    it('incluye KPIs, manzanas y ranking de asesores con formato numérico correcto', () => {
        const sections = buildGeneralSections({
            kpis: {
                totalSales: 1850000, projectValue: 6200000, commission: 111000,
                occupationRate: 62, totalLots: 210, soldLots: 98, reservedLots: 32, availableLots: 80,
            },
            salesTrend: [],
            manzanasDistribution: [{ mz: 'A', total: 20, sold: 10, reserved: 5, available: 5 }],
            advisorRanking: [{ name: 'Ana Torres', lotsCount: 12, amountTotal: 200000, commission: 12000 }],
            recentActivity: [],
        });

        const kpiSection = sections.find(s => s.title === 'INDICADORES GLOBALES')!;
        expect(kpiSection.rows).toContainEqual(['Ventas Consolidadas', '1850000.00']);

        const rankingSection = sections.find(s => s.title === 'RANKING DE ASESORES')!;
        expect(rankingSection.rows[1]).toEqual(['#1', 'Ana Torres', 12, '200000.00', '12000.00']);
    });
});

describe('buildOperacionesSections', () => {
    it('incluye el resumen por estado y una fila por lote', () => {
        const sections = buildOperacionesSections({
            kpis: {
                totalSales: 0, projectValue: 0, commission: 0,
                occupationRate: 0, totalLots: 5, soldLots: 1, reservedLots: 1, availableLots: 3,
            },
            salesTrend: [],
            advisorRanking: [],
            recentActivity: [],
            estadoSummary: { noVender: 1, disponible: 2, cotizacion: 0, reservado: 1, vendido: 1, otros: 0 },
            operaciones: [
                { tipo: 'Venta', propiedad: 'E01MZD148P', asesor: 'Ana Torres', asignado: 'Jorge Basadre', fecha: '2026-08-20 10:00:00' },
            ],
        });

        const resumenSection = sections.find(s => s.title === 'RESUMEN POR ESTADO')!;
        expect(resumenSection.rows).toContainEqual(['Vendido', 1]);

        const opsSection = sections.find(s => s.title === 'OPERACIONES POR LOTE')!;
        expect(opsSection.rows[1]).toEqual(['Venta', 'E01MZD148P', 'Ana Torres', 'Jorge Basadre', '2026-08-20 10:00:00']);
    });

    it('omite las secciones opcionales cuando no vienen datos', () => {
        const sections = buildOperacionesSections({
            kpis: { totalSales: 0, projectValue: 0, commission: 0, occupationRate: 0, totalLots: 0, soldLots: 0, reservedLots: 0, availableLots: 0 },
            salesTrend: [],
            advisorRanking: [],
            recentActivity: [],
        });

        expect(sections.find(s => s.title === 'RESUMEN POR ESTADO')).toBeUndefined();
        expect(sections.find(s => s.title === 'OPERACIONES POR LOTE')).toBeUndefined();
    });
});

describe('buildIndividualSections', () => {
    it('incluye lotes competidos solo cuando hay conflictos', () => {
        const sinConflictos = buildIndividualSections({
            advisor: { name: 'Ana Torres', username: 'ana' },
            kpis: { totalSales: 100000, monthlyGoal: 500000, commission: 6000, pendingLeads: 2 },
            salesTrend: [],
            assignedLots: [{ lot: 'E01MZD148P', client: 'Juan Perez', status: 'Vendido', stage: 'E01', price: 85000 }],
            competedLots: [],
            recentActivity: [],
            salesCount: 3,
        });
        expect(sinConflictos.some(s => s.title?.includes('COMPETIDOS'))).toBe(false);

        const conConflictos = buildIndividualSections({
            advisor: { name: 'Ana Torres', username: 'ana' },
            kpis: { totalSales: 100000, monthlyGoal: 500000, commission: 6000, pendingLeads: 2 },
            salesTrend: [],
            assignedLots: [],
            competedLots: [{ lot: 'E01MZD148P', stage: 'E01', quotes: [{ client: 'Juan Perez', advisor: 'Ana Torres', hours: 5 }] }],
            recentActivity: [],
            salesCount: 3,
        });
        const competedSection = conConflictos.find(s => s.title?.includes('COMPETIDOS'));
        expect(competedSection!.rows[1]).toEqual(['E01MZD148P', 'Juan Perez', 'Ana Torres', 5]);
    });
});
