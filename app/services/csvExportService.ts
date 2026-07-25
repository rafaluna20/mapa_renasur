/**
 * csvExportService.ts
 * Exportación de datos crudos a CSV — complementa los reportes PDF (de solo
 * lectura) con un formato que el equipo contable puede auditar cifra por
 * cifra, filtrar y recalcular directamente en Excel/Sheets sin retipear
 * nada. Sin librerías nuevas: xlsx y exceljs (las 2 opciones evaluadas)
 * traen vulnerabilidades altas confirmadas en su cadena de dependencias
 * (prototype pollution / ReDoS) — CSV plano cumple lo mismo sin ese riesgo.
 */

import type { PaidInvoicesReportData, GeneralReportData, ReportData } from './reportService';

function csvEscape(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function rowToCsv(row: (string | number | null | undefined)[]): string {
    return row.map(csvEscape).join(',');
}

export type CsvSection = { title?: string; rows: (string | number | null | undefined)[][] };

// Separado de downloadCsv (que toca el DOM) para poder probar la
// construcción del CSV en un entorno sin navegador.
export function buildCsvContent(sections: CsvSection[]): string {
    const lines: string[] = [];
    sections.forEach((section, i) => {
        if (i > 0) lines.push('');
        if (section.title) {
            lines.push(rowToCsv([section.title]));
        }
        section.rows.forEach(row => lines.push(rowToCsv(row)));
    });
    return lines.join('\r\n');
}

function downloadCsv(filename: string, sections: CsvSection[]) {
    // BOM UTF-8: sin esto, Excel en Windows interpreta el archivo como
    // Latin-1 y las tildes/ñ salen como caracteres corruptos.
    const csvContent = '﻿' + buildCsvContent(sections);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Construcción pura (testable sin DOM) — separada de la función pública
// que además dispara la descarga en el navegador.
export function buildInvoicesSections(data: PaidInvoicesReportData): CsvSection[] {
    const sections: CsvSection[] = [
        {
            title: `REPORTE DE RECAUDACIÓN${data.dateRangeLabel ? ` — ${data.dateRangeLabel}` : ''} — Total recaudado: ${data.totalCollected.toFixed(2)}`,
            rows: [],
        },
        {
            title: 'RESUMEN POR MANZANA',
            rows: [
                ['Etapa', 'Manzana', 'Lotes con Pagos', 'Facturas Pagadas', 'Monto Recaudado'],
                ...data.blocks.map(b => [b.etapa || '', b.mz, b.uniqueLotsCount, b.invoicesCount, b.totalAmount.toFixed(2)]),
            ],
        },
        {
            title: 'FACTURAS PAGADAS (DETALLE)',
            rows: [
                ['Factura', 'Tipo de Cuota', 'Fecha de Pago', 'Etapa', 'Manzana', 'Lote', 'Cliente', 'Monto Pagado'],
                ...data.recentPayments.map(p => [p.invoice, p.cuotaLabel || '', p.date, p.etapa || '', p.mz, p.lot, p.client, p.paidAmount.toFixed(2)]),
            ],
        },
    ];

    if (data.aging && data.aging.length > 0) {
        sections.push({
            title: `ANTIGÜEDAD DE SALDOS VENCIDOS (A HOY) — Total vencido: ${(data.totalOverdue || 0).toFixed(2)}`,
            rows: [
                ['Antigüedad', 'Facturas Vencidas', 'Monto Vencido'],
                ...data.aging.map(a => [`${a.bucket} días`, a.invoicesCount, a.totalAmount.toFixed(2)]),
            ],
        });
    }

    if (data.overdueDetail && data.overdueDetail.length > 0) {
        sections.push({
            title: 'DETALLE DE FACTURAS VENCIDAS',
            rows: [
                ['Factura', 'Cliente', 'Lote', 'Días Vencido', 'Saldo Pendiente'],
                ...data.overdueDetail.map(o => [o.invoice, o.client, o.lot, o.daysOverdue, o.amountDue.toFixed(2)]),
            ],
        });
    }

    return sections;
}

export function exportInvoicesReportToCsv(data: PaidInvoicesReportData): void {
    const now = new Date();
    downloadCsv(`TerraLima_Recaudacion_Datos_${now.getFullYear()}${now.getMonth() + 1}.csv`, buildInvoicesSections(data));
}

export function buildGeneralSections(data: GeneralReportData): CsvSection[] {
    const sections: CsvSection[] = [
        {
            title: `REPORTE GENERAL DEL PROYECTO${data.dateRangeLabel ? ` — ${data.dateRangeLabel}` : ''}`,
            rows: [],
        },
        {
            title: 'INDICADORES GLOBALES',
            rows: [
                ['Concepto', 'Valor'],
                ['Ventas Consolidadas', data.kpis.totalSales.toFixed(2)],
                ['Valor Comercial del Proyecto', data.kpis.projectValue.toFixed(2)],
                ['Comisiones Asesores', data.kpis.commission.toFixed(2)],
                ['Ocupación Física (%)', data.kpis.occupationRate],
                ['Lotes Totales', data.kpis.totalLots],
                ['Lotes Vendidos', data.kpis.soldLots],
                ['Lotes Separados/Reservados', data.kpis.reservedLots],
                ['Lotes Disponibles', data.kpis.availableLots],
            ],
        },
    ];

    if (data.manzanasDistribution && data.manzanasDistribution.length > 0) {
        sections.push({
            title: 'DISTRIBUCIÓN DE INVENTARIO POR MANZANA',
            rows: [
                ['Manzana', 'Vendidos', 'Separados', 'Disponibles', 'Total Lotes'],
                ...data.manzanasDistribution.map(mz => [mz.mz, mz.sold, mz.reserved, mz.available, mz.total]),
            ],
        });
    }

    sections.push({
        title: 'RANKING DE ASESORES',
        rows: [
            ['Rango', 'Asesor', 'Lotes Vendidos', 'Facturación', 'Comisión'],
            ...data.advisorRanking.map((adv, i) => [`#${i + 1}`, adv.name, adv.lotsCount, adv.amountTotal.toFixed(2), adv.commission.toFixed(2)]),
        ],
    });

    if (data.recentActivity.length > 0) {
        sections.push({
            title: 'ACTIVIDAD RECIENTE',
            rows: [
                ['Tipo', 'Lote', 'Asesor', 'Fecha'],
                ...data.recentActivity.map(act => [act.action, act.lot, act.advisor, act.date]),
            ],
        });
    }

    return sections;
}

export function exportGeneralReportToCsv(data: GeneralReportData): void {
    const now = new Date();
    downloadCsv(`TerraLima_ReporteGeneral_Datos_${now.getFullYear()}${now.getMonth() + 1}.csv`, buildGeneralSections(data));
}

export function buildIndividualSections(data: ReportData): CsvSection[] {
    const sections: CsvSection[] = [
        {
            title: `REPORTE DE ASESOR — ${data.advisor.name}${data.dateRangeLabel ? ` — ${data.dateRangeLabel}` : ''}`,
            rows: [],
        },
        {
            title: 'INDICADORES',
            rows: [
                ['Concepto', 'Valor'],
                ['Ventas', data.kpis.totalSales.toFixed(2)],
                ['Meta', data.kpis.monthlyGoal.toFixed(2)],
                ['Comisión Devengada', data.kpis.commission.toFixed(2)],
                ['Cotizaciones Activas', data.kpis.pendingLeads],
                ['Lotes Vendidos Confirmados', data.salesCount],
            ],
        },
        {
            title: 'MIS LOTES OPERACIONALES',
            rows: [
                ['Lote', 'Cliente', 'Estado', 'Monto Negociado'],
                ...data.assignedLots.map(lot => [lot.lot, lot.client, lot.status, lot.price.toFixed(2)]),
            ],
        },
    ];

    if (data.recentActivity.length > 0) {
        sections.push({
            title: 'ACTIVIDAD RECIENTE',
            rows: [
                ['Tipo', 'Lote', 'Fecha'],
                ...data.recentActivity.map(act => [act.action, act.lot, act.date]),
            ],
        });
    }

    if (data.competedLots.length > 0) {
        sections.push({
            title: 'LOTES COMPETIDOS (COTIZACIONES PARALELAS)',
            rows: [
                ['Lote', 'Cliente', 'Asesor', 'Horas Transcurridas'],
                ...data.competedLots.flatMap(lot => lot.quotes.map(q => [lot.lot, q.client, q.advisor, q.hours])),
            ],
        });
    }

    return sections;
}

export function exportIndividualReportToCsv(data: ReportData): void {
    const now = new Date();
    downloadCsv(`TerraLima_ReporteAsesor_Datos_${data.advisor.name.replace(/\s+/g, '_')}_${now.getFullYear()}${now.getMonth() + 1}.csv`, buildIndividualSections(data));
}
