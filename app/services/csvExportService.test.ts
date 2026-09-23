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

describe('buildInvoicesSections — dólares aparte', () => {
    it('las cifras en dólares van en secciones propias con la moneda en el título, sin tocar las de soles', () => {
        const sections = buildInvoicesSections({
            totalCollected: 2000,
            blocks: [{ mz: 'S', etapa: 'E01', totalAmount: 2000, invoicesCount: 1, uniqueLotsCount: 1 }],
            recentPayments: [],
            foreignCurrencies: {
                USD: {
                    currency: 'USD',
                    totalCollected: 1500,
                    blocks: [{ mz: 'S', etapa: 'E01', totalAmount: 1500, invoicesCount: 1, uniqueLotsCount: 1 }],
                    recentPayments: [{ invoice: 'B-6', date: '2026-09-02', client: 'Cliente Dolares', lot: 'E01MZS090P', mz: 'S', paidAmount: 1500 }],
                    totalOverdue: 11676,
                    aging: [{ bucket: '90+', totalAmount: 11676, invoicesCount: 2 }],
                    overdueDetail: [{ invoice: 'B-3', client: 'Cliente Dolares', lot: 'E01MZS090P', daysOverdue: 200, amountDue: 10176 }],
                },
            },
        });
        const titles = sections.map((s) => s.title || '');
        // soles intacto
        const solesManzana = sections.find((s) => s.title === 'RESUMEN POR MANZANA')!;
        expect(solesManzana.rows[1]).toEqual(['E01', 'S', 1, 1, '2000.00']);
        // dólares aparte, con la moneda en cada título
        expect(titles.some((t) => t.startsWith('EN USD') && t.includes('NO SE SUMAN A SOLES'))).toBe(true);
        const usdManzana = sections.find((s) => s.title === 'RESUMEN POR MANZANA (USD)')!;
        expect(usdManzana.rows[0]).toContain('Monto Recaudado (USD)');
        expect(usdManzana.rows[1]).toEqual(['E01', 'S', 1, 1, '1500.00']);
        expect(sections.find((s) => s.title === 'DETALLE DE FACTURAS VENCIDAS EN USD')!.rows[1])
            .toEqual(['B-3', 'Cliente Dolares', 'E01MZS090P', 200, '10176.00']);
    });

    it('sin datos en dólares no agrega secciones nuevas', () => {
        const base = { totalCollected: 10, blocks: [], recentPayments: [] };
        expect(buildInvoicesSections({ ...base, foreignCurrencies: {} }).length).toBe(buildInvoicesSections(base).length);
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
        expect(sections.find(s => s.title === 'LEADS DEL ASISTENTE VIRTUAL — RESUMEN')).toBeUndefined();
    });

    it('incluye el resumen y el detalle de los leads del bot cuando vienen datos', () => {
        const sections = buildOperacionesSections({
            kpis: { totalSales: 0, projectValue: 0, commission: 0, occupationRate: 0, totalLots: 0, soldLots: 0, reservedLots: 0, availableLots: 0 },
            salesTrend: [],
            advisorRanking: [],
            recentActivity: [],
            botLeads: {
                resumen: { total: 2, porCanal: { telegram: 2 }, porTemperatura: { sin_clasificar: 1, caliente: 1 }, derivadosAAsesor: 2, conLoteInteres: 1, conConsentimiento: 2 },
                leads: [
                    { nombre: 'Yulisa Cuarez', canal: 'telegram', lote: 'E01MZS0252', temperatura: 'caliente', modalidadPago: 'por_definir', botActivo: false, fecha: '2026-09-21 03:48:40' },
                    { nombre: 'Rafael', canal: 'telegram', lote: null, temperatura: 'sin_clasificar', modalidadPago: 'contado', botActivo: false, fecha: '2026-09-20 20:36:23' },
                ],
            },
        });

        const resumenSection = sections.find(s => s.title === 'LEADS DEL ASISTENTE VIRTUAL — RESUMEN')!;
        expect(resumenSection.rows).toContainEqual(['Total', 2]);
        expect(resumenSection.rows).toContainEqual(['Canal: telegram', 2]);
        expect(resumenSection.rows).toContainEqual(['Temperatura: caliente', 1]);

        const detalleSection = sections.find(s => s.title === 'LEADS DEL ASISTENTE VIRTUAL — DETALLE')!;
        expect(detalleSection.rows[1]).toEqual(['Yulisa Cuarez', 'telegram', 'E01MZS0252', 'caliente', 'por_definir', 'Con un asesor', '2026-09-21 03:48:40']);
        expect(detalleSection.rows[2]).toEqual(['Rafael', 'telegram', '', 'sin_clasificar', 'contado', 'Con un asesor', '2026-09-20 20:36:23']);
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
