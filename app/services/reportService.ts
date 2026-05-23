/**
 * reportService.ts
 * Generador de Reportes Empresariales PDF — Terra Lima
 * Paleta de Colores Light/Editorial (Print-Friendly) optimizada para ahorro de tinta
 * Usa jsPDF v4 + jspdf-autotable v5
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface ReportData {
    advisor: {
        name: string;
        username: string;
    };
    kpis: {
        totalSales: number;
        monthlyGoal: number;
        commission: number;
        pendingLeads: number;
    };
    salesTrend: { name: string; ventas: number }[];
    assignedLots: { lot: string; stage: string; client: string; status: string; price: number }[];
    competedLots: { lot: string; stage: string; quotes: { client: string; advisor: string; hours: number }[] }[];
    recentActivity: { id: number; action: string; lot: string; date: string }[];
    salesCount: number;
    dateRangeLabel?: string; // Etiqueta de periodo dinámico (ej. "Mayo 2026" o "01/04 - 30/04/2026")
}

// ─── Paleta corporativa Terra Lima (Diseño Light Premium para Ahorro de Tinta) ───
const BRAND = {
    green:      [46,  125, 94]  as [number, number, number], // #2E7D5E (acento verde)
    greenLight: [33,  115, 70]  as [number, number, number], // verde oscuro legible para valores
    purple:     [141, 49,  225] as [number, number, number], // #8D32DF (acento púrpura)
    pageBg:     [255, 255, 255] as [number, number, number], // fondo blanco puro (0% tinta)
    panelBg:    [248, 250, 252] as [number, number, number], // slate-50 (paneles y cabeceras)
    borderLight:[226, 232, 240] as [number, number, number], // slate-200 (bordes)
    darkBg:     [15,  23,  42]  as [number, number, number], // slate-950 (texto principal)
    dark2:      [51,  65,  85]  as [number, number, number], // slate-700 (texto secundario)
    dark3:      [203, 213, 225] as [number, number, number], // slate-300 (líneas divisoras)
    textLight:  [51,  65,  85]  as [number, number, number], // slate-700 (cuerpo de tablas)
    textMuted:  [71,  85,  105] as [number, number, number], // slate-600 (subtítulos y pies)
    amber:      [180, 83,  9]   as [number, number, number], // amber-700 (alertas legibles)
    indigo:     [67,  56,  202] as [number, number, number], // indigo-700 (valores/actividades)
    white:      [255, 255, 255] as [number, number, number],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const currency = (n: number) =>
    `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const pct = (v: number, total: number) =>
    total > 0 ? `${Math.min(100, Math.round((v / total) * 100))}%` : '0%';

function drawRect(
    doc: jsPDF,
    x: number, y: number, w: number, h: number,
    fillColor: [number, number, number],
    rounded = 0
) {
    doc.setFillColor(...fillColor);
    if (rounded > 0) {
        doc.roundedRect(x, y, w, h, rounded, rounded, 'F');
    } else {
        doc.rect(x, y, w, h, 'F');
    }
}

function drawLine(
    doc: jsPDF,
    x1: number, y1: number, x2: number, y2: number,
    color: [number, number, number],
    width = 0.3
) {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    doc.line(x1, y1, x2, y2);
}

function setFont(
    doc: jsPDF,
    size: number,
    color: [number, number, number],
    style: 'normal' | 'bold' = 'normal'
) {
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.setFont('helvetica', style);
}

// Dibuja una cabecera de sección estilizada con un rectángulo vertical de color
function drawSectionHeader(
    doc: jsPDF,
    title: string,
    x: number,
    y: number,
    color: [number, number, number]
) {
    // Rectángulo indicador vertical con esquinas redondeadas
    drawRect(doc, x, y - 3.2, 1.8, 4.2, color, 0.4);
    
    // Texto en gris oscuro/negro para alta legibilidad en fondo blanco
    setFont(doc, 8.5, BRAND.darkBg, 'bold');
    doc.text(title, x + 4, y);
}

// ─── Reporte Individual del Vendedor ──────────────────────────────────────────
export async function generateEnterpriseReport(data: ReportData): Promise<void> {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210; // ancho A4
    const H = 297; // alto A4
    const margin = 14;
    const contentW = W - margin * 2;

    const now = new Date();
    const dateLabel = now.toLocaleDateString('es-PE', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const timeLabel = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    const year = now.getFullYear();

    // ══════════════════════════════════════════════════════════════════════════
    // PÁGINA 1 — PORTADA + KPIs
    // ══════════════════════════════════════════════════════════════════════════

    // — Fondo completo blanco para ahorro de tinta
    drawRect(doc, 0, 0, W, H, BRAND.pageBg);

    // — Banda superior de fondo suave (slate-50)
    drawRect(doc, 0, 0, W, 52, BRAND.panelBg);
    drawLine(doc, 0, 52, W, 52, BRAND.borderLight, 0.3);

    // — Barra de color superior (accent line corporativa)
    drawRect(doc, 0, 0, W / 2, 2, BRAND.green);
    drawRect(doc, W / 2, 0, W / 2, 2, BRAND.purple);

    // — Logo corporativo
    try {
        const logoResponse = await fetch('/terra-lima-logo.png');
        const logoBlob = await logoResponse.blob();
        const logoBase64: string = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(logoBlob);
        });
        doc.addImage(logoBase64, 'PNG', margin, 8, 44, 14);
    } catch {
        setFont(doc, 14, BRAND.darkBg, 'bold');
        doc.text('TERRA LIMA', margin, 18);
    }

    // — Información de empresa (derecha)
    setFont(doc, 7, BRAND.textMuted);
    doc.text('Sistema de Gestión Inmobiliaria', W - margin, 11, { align: 'right' });
    doc.text('Portal GIS · Renasur', W - margin, 16, { align: 'right' });
    doc.text(`Generado: ${dateLabel} · ${timeLabel}`, W - margin, 21, { align: 'right' });

    // — Separador
    drawLine(doc, margin, 26, W - margin, 26, BRAND.borderLight, 0.2);

    // — Título del reporte
    setFont(doc, 22, BRAND.darkBg, 'bold');
    doc.text('REPORTE EJECUTIVO', margin, 40);
    setFont(doc, 10, BRAND.textMuted);
    const subtitleIndividual = data.dateRangeLabel
        ? `Periodo de Análisis: ${data.dateRangeLabel}`
        : 'Desempeño Comercial · Asesor de Ventas';
    doc.text(subtitleIndividual, margin, 47);

    // — Nombre del asesor (badge con borde suave y fondo blanco)
    doc.setFillColor(...BRAND.white);
    doc.setDrawColor(...BRAND.borderLight);
    doc.setLineWidth(0.3);
    doc.roundedRect(W - margin - 70, 32, 70, 16, 2, 2, 'FD');

    setFont(doc, 7, BRAND.textMuted);
    doc.text('ASESOR', W - margin - 4, 38, { align: 'right' });
    setFont(doc, 10, BRAND.darkBg, 'bold');
    doc.text(data.advisor.name, W - margin - 4, 45, { align: 'right' });

    // ── Sección: KPIs ─────────────────────────────────────────────────────────
    let y = 62;
    drawSectionHeader(doc, 'INDICADORES CLAVE DE DESEMPEÑO (KPI)', margin, y, BRAND.green);
    drawLine(doc, margin, y + 2.5, W - margin, y + 2.5, BRAND.borderLight, 0.15);
    y += 8;

    const goalPct = data.kpis.monthlyGoal > 0
        ? Math.min(100, Math.round((data.kpis.totalSales / data.kpis.monthlyGoal) * 100))
        : 0;

    const kpiCards = [
        {
            label: `VENTAS ${year}`,
            value: currency(data.kpis.totalSales),
            sub: `${data.salesCount} lotes confirmados`,
            color: BRAND.greenLight,
        },
        {
            label: 'META ANUAL',
            value: currency(data.kpis.monthlyGoal),
            sub: `${goalPct}% completado`,
            color: BRAND.amber,
        },
        {
            label: 'COMISIÓN DEVENGADA',
            value: currency(data.kpis.commission),
            sub: 'Tasa: 6% sobre ventas',
            color: BRAND.indigo,
        },
        {
            label: 'COTIZACIONES ACTIVAS',
            value: `${data.kpis.pendingLeads}`,
            sub: 'Órdenes en borrador',
            color: BRAND.purple,
        },
    ];

    const cardW = (contentW - 6) / 4;
    kpiCards.forEach((card, i) => {
        const cx = margin + i * (cardW + 2);
        // Tarjeta con fondo slate-50 y borde slate-200
        doc.setFillColor(...BRAND.panelBg);
        doc.setDrawColor(...BRAND.borderLight);
        doc.setLineWidth(0.3);
        doc.roundedRect(cx, y, cardW, 28, 2, 2, 'FD');

        // — barra superior de color
        drawRect(doc, cx, y, cardW, 1.5, card.color, 0);
        // — label
        setFont(doc, 6, BRAND.textMuted, 'bold');
        doc.text(card.label, cx + 4, y + 7);
        // — valor
        setFont(doc, card.value.length > 12 ? 9 : 11, BRAND.darkBg, 'bold');
        doc.text(card.value, cx + 4, y + 17);
        // — sub
        setFont(doc, 6, card.color);
        doc.text(card.sub, cx + 4, y + 24);
    });
    y += 36;

    // — Barra de progreso de meta
    setFont(doc, 6.5, BRAND.textMuted);
    doc.text(`Progreso hacia la meta ${year}: ${goalPct}%`, margin, y);
    y += 3;
    drawRect(doc, margin, y, contentW, 3, BRAND.borderLight, 1);
    if (goalPct > 0) {
        drawRect(doc, margin, y, contentW * goalPct / 100, 3, BRAND.amber, 1);
    }
    y += 10;

    // ── Sección: Tendencia de Facturación ─────────────────────────────────────
    drawSectionHeader(doc, 'TENDENCIA DE FACTURACIÓN — AÑO ' + year, margin, y, BRAND.purple);
    drawLine(doc, margin, y + 2.5, W - margin, y + 2.5, BRAND.borderLight, 0.15);
    y += 6;

    const currentMonth = now.getMonth();
    const trendSlice = data.salesTrend.slice(0, currentMonth + 1);
    const maxVenta = Math.max(...trendSlice.map(d => d.ventas), 1);
    const barAreaH = 32;
    const barW = Math.min(14, (contentW - 4) / trendSlice.length - 2);
    const barSpacing = (contentW - 4) / trendSlice.length;

    trendSlice.forEach((month, i) => {
        const barH = month.ventas > 0 ? (month.ventas / maxVenta) * barAreaH : 1;
        const bx = margin + 2 + i * barSpacing + (barSpacing - barW) / 2;
        const by = y + barAreaH - barH;

        // — barra en color índigo o gris de borde si no hay ventas
        const color: [number, number, number] = month.ventas > 0 ? BRAND.indigo : BRAND.borderLight;
        drawRect(doc, bx, by, barW, barH, color, 1);

        // — valor sobre la barra
        if (month.ventas > 0) {
            setFont(doc, 4.5, BRAND.indigo);
            const label = month.ventas >= 1000
                ? `${(month.ventas / 1000).toFixed(0)}k`
                : `${month.ventas}`;
            doc.text(label, bx + barW / 2, by - 1.5, { align: 'center' });
        }

        // — etiqueta mes
        setFont(doc, 5.5, i <= currentMonth ? BRAND.darkBg : BRAND.dark3);
        doc.text(month.name, bx + barW / 2, y + barAreaH + 5, { align: 'center' });
    });
    y += barAreaH + 10;

    // ── Sección: Mis Lotes Operacionales ─────────────────────────────────────
    drawSectionHeader(doc, 'MIS LOTES OPERACIONALES', margin, y, BRAND.green);
    drawLine(doc, margin, y + 2.5, W - margin, y + 2.5, BRAND.borderLight, 0.15);
    y += 4;

    const statusColor = (status: string): [number, number, number] => {
        if (status === 'Vendido')    return BRAND.greenLight;
        if (status === 'Separado')   return BRAND.amber;
        if (status === 'Disponible') return BRAND.indigo;
        return BRAND.textMuted;
    };

    if (data.assignedLots.length === 0) {
        setFont(doc, 7, BRAND.textMuted);
        doc.text('No hay lotes operacionales registrados.', margin, y + 6);
    } else {
        autoTable(doc, {
            startY: y,
            head: [['LOTE', 'CLIENTE', 'ESTADO', 'MONTO NEGOCIADO']],
            body: data.assignedLots.map(lot => [
                lot.lot,
                lot.client,
                lot.status,
                currency(lot.price),
            ]),
            theme: 'plain',
            styles: {
                font: 'helvetica',
                fontSize: 7.5,
                cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
                textColor: BRAND.textLight,
                fillColor: BRAND.white,
                lineColor: BRAND.borderLight,
                lineWidth: 0.1,
            },
            headStyles: {
                fillColor: BRAND.panelBg,
                textColor: BRAND.darkBg,
                fontStyle: 'bold',
                fontSize: 6.5,
                halign: 'left',
            },
            alternateRowStyles: {
                fillColor: [250, 252, 254] as [number, number, number],
            },
            columnStyles: {
                0: { fontStyle: 'bold', textColor: BRAND.darkBg },
                2: { fontStyle: 'bold' },
                3: { halign: 'right', fontStyle: 'bold', textColor: BRAND.greenLight },
            },
            didParseCell: (hookData) => {
                if (hookData.section === 'body' && hookData.column.index === 2) {
                    const status = data.assignedLots[hookData.row.index]?.status || '';
                    hookData.cell.styles.textColor = statusColor(status);
                }
            },
            margin: { left: margin, right: margin },
        });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PÁGINA 2 — ACTIVIDAD RECIENTE + LOTES COMPETIDOS + PIE DE PÁGINA
    // ══════════════════════════════════════════════════════════════════════════

    doc.addPage();
    // — Fondo blanco
    drawRect(doc, 0, 0, W, H, BRAND.pageBg);
    y = 22; // Inicia debajo del encabezado de página

    // ── Actividad Reciente ────────────────────────────────────────────────
    drawSectionHeader(doc, 'ACTIVIDAD RECIENTE', margin, y, BRAND.indigo);
    drawLine(doc, margin, y + 2.5, W - margin, y + 2.5, BRAND.borderLight, 0.15);
    y += 4;

    if (data.recentActivity.length === 0) {
        setFont(doc, 7, BRAND.textMuted);
        doc.text('Sin actividad reciente registrada.', margin, y + 6);
        y += 12;
    } else {
        autoTable(doc, {
            startY: y,
            head: [['TIPO', 'LOTE / PROPIEDAD', 'FECHA']],
            body: data.recentActivity.map(act => [act.action, act.lot, act.date]),
            theme: 'plain',
            styles: {
                font: 'helvetica',
                fontSize: 7.5,
                cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
                textColor: BRAND.textLight,
                fillColor: BRAND.white,
                lineColor: BRAND.borderLight,
                lineWidth: 0.1,
            },
            headStyles: {
                fillColor: BRAND.panelBg,
                textColor: BRAND.darkBg,
                fontStyle: 'bold',
                fontSize: 6.5,
            },
            alternateRowStyles: { fillColor: [250, 252, 254] as [number, number, number] },
            columnStyles: {
                0: { fontStyle: 'bold', textColor: BRAND.indigo },
                1: { fontStyle: 'bold', textColor: BRAND.darkBg },
                2: { textColor: BRAND.textMuted, halign: 'right' },
            },
            didParseCell: (hookData) => {
                if (hookData.section === 'body' && hookData.column.index === 0) {
                    const action = data.recentActivity[hookData.row.index]?.action || '';
                    if (action === 'Venta')   hookData.cell.styles.textColor = BRAND.greenLight;
                    if (action === 'Reserva') hookData.cell.styles.textColor = BRAND.amber;
                    if (action === 'Cotización') hookData.cell.styles.textColor = BRAND.indigo;
                }
            },
            margin: { left: margin, right: margin },
        });
        y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    }

    // ── Lotes Competidos / Monitoreo de Colisión ──────────────────────────
    const hasConflicts = data.competedLots.length > 0;
    drawSectionHeader(
        doc,
        'MONITOREO DE COLISIONES (LOTES COMPETIDOS)',
        margin,
        y,
        hasConflicts ? BRAND.amber : BRAND.greenLight
    );
    drawLine(doc, margin, y + 2.5, W - margin, y + 2.5, hasConflicts ? BRAND.amber : BRAND.borderLight, 0.15);
    y += 6;

    if (hasConflicts) {
        // Alerta suave (fondo ámbar claro, borde ámbar)
        drawRect(doc, margin, y - 1, contentW, 8, [254, 243, 199] as [number, number, number], 1);
        drawRect(doc, margin, y - 1, 1.5, 8, BRAND.amber, 0);
        setFont(doc, 7, BRAND.amber, 'bold');
        doc.text(
            `ALERTA DE DUPLICIDAD: ${data.competedLots.length} lote(s) en conflicto. La primera reserva confirmada en Odoo asegura la propiedad.`,
            margin + 4, y + 4.5
        );
        y += 12;

        const competedRows = data.competedLots.flatMap(lot =>
            lot.quotes.map(q => [lot.lot, q.client, q.advisor, `Hace ${q.hours}h`])
        );

        autoTable(doc, {
            startY: y,
            head: [['LOTE', 'CLIENTE', 'ASESOR', 'TIEMPO']],
            body: competedRows,
            theme: 'plain',
            styles: {
                font: 'helvetica',
                fontSize: 7.5,
                cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
                textColor: BRAND.textLight,
                fillColor: [254, 251, 243] as [number, number, number], // fondo cálido suave
                lineColor: BRAND.borderLight,
                lineWidth: 0.1,
            },
            headStyles: {
                fillColor: [254, 243, 199] as [number, number, number],
                textColor: BRAND.amber,
                fontStyle: 'bold',
                fontSize: 6.5,
            },
            columnStyles: {
                0: { fontStyle: 'bold', textColor: BRAND.darkBg },
                3: { halign: 'right', textColor: BRAND.amber },
            },
            margin: { left: margin, right: margin },
        });
        y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    } else {
        // Indicador de estado seguro (fondo verde claro, borde verde)
        drawRect(doc, margin, y - 1, contentW, 8, [220, 252, 231] as [number, number, number], 1);
        drawRect(doc, margin, y - 1, 1.5, 8, BRAND.greenLight, 0);
        setFont(doc, 7, BRAND.greenLight, 'bold');
        doc.text(
            "ESTADO COMERCIAL: Sin conflictos. Todos los lotes en cartera están libres de cotizaciones paralelas concurrentes.",
            margin + 4, y + 4.5
        );
        y += 14;
    }

    // ── Resumen financiero ────────────────────────────────────────────────
    drawSectionHeader(doc, 'RESUMEN FINANCIERO', margin, y, BRAND.green);
    drawLine(doc, margin, y + 2.5, W - margin, y + 2.5, BRAND.borderLight, 0.15);
    y += 5;

    const financialRows = [
        ['Total Facturado ' + year,     currency(data.kpis.totalSales),      pct(data.kpis.totalSales, data.kpis.monthlyGoal) + ' de meta'],
        ['Meta Comercial Anual',          currency(data.kpis.monthlyGoal),     '—'],
        ['Comisión Devengada (6%)',        currency(data.kpis.commission),      'Sobre ventas confirmadas'],
        ['Cotizaciones en Cartera',        `${data.kpis.pendingLeads} órdenes`, 'Estado: Borrador activo'],
        ['Lotes Vendidos Confirmados',     `${data.salesCount} lotes`,          'Estado: sale / done'],
    ];

    autoTable(doc, {
        startY: y,
        head: [['CONCEPTO', 'VALOR', 'OBSERVACIÓN']],
        body: financialRows,
        theme: 'plain',
        styles: {
            font: 'helvetica',
            fontSize: 7.5,
            cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
            textColor: BRAND.textLight,
            fillColor: BRAND.white,
            lineColor: BRAND.borderLight,
            lineWidth: 0.1,
        },
        headStyles: {
            fillColor: BRAND.panelBg,
            textColor: BRAND.darkBg,
            fontStyle: 'bold',
            fontSize: 6.5,
        },
        alternateRowStyles: { fillColor: [250, 252, 254] as [number, number, number] },
        columnStyles: {
            0: { fontStyle: 'bold', textColor: BRAND.darkBg },
            1: { fontStyle: 'bold', textColor: BRAND.greenLight, halign: 'right' },
            2: { textColor: BRAND.textMuted },
        },
        margin: { left: margin, right: margin },
    });

    // ── Post-procesamiento: Cabeceras y Pies de Página ───────────────────────
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        
        // — Franja divisoria inferior elegante (sin sólido oscuro para ahorrar tinta)
        drawLine(doc, margin, H - 15, W - margin, H - 15, BRAND.borderLight, 0.3);
        drawLine(doc, margin, H - 15, margin + (contentW / 3), H - 15, BRAND.green, 0.8);
        drawLine(doc, margin + (contentW / 3), H - 15, margin + (contentW / 3) * 2, H - 15, BRAND.purple, 0.8);
        drawLine(doc, margin + (contentW / 3) * 2, H - 15, W - margin, H - 15, BRAND.green, 0.8);

        setFont(doc, 6, BRAND.textMuted);
        doc.text('Terra Lima © ' + year + ' · Documento Confidencial', margin, H - 10);
        const footerPeriodLabel = data.dateRangeLabel ? `Periodo: ${data.dateRangeLabel}` : `Reporte generado el ${dateLabel}`;
        doc.text(footerPeriodLabel, W / 2, H - 10, { align: 'center' });
        doc.text(`Pág. ${p} / ${totalPages}`, W - margin, H - 10, { align: 'right' });

        // — Cabecera secundaria en páginas posteriores (p > 1)
        if (p > 1) {
            drawRect(doc, 0, 0, W, 16, BRAND.panelBg);
            drawLine(doc, 0, 16, W, 16, BRAND.borderLight, 0.3);
            drawRect(doc, 0, 0, W / 2, 1.5, BRAND.green);
            drawRect(doc, W / 2, 0, W / 2, 1.5, BRAND.purple);

            setFont(doc, 7, BRAND.textMuted);
            doc.text(`Terra Lima · Reporte Ejecutivo ${year} · ${data.advisor.name}`, margin, 10);
            doc.text(`Pág. ${p}`, W - margin, 10, { align: 'right' });
        }
    }

    // ── Descargar ──────────────────────────────────────────────────────────────
    const filename = `TerraLima_Reporte_${data.advisor.name.replace(/\s+/g, '_')}_${year}_${now.getMonth() + 1 < 10 ? '0' : ''}${now.getMonth() + 1}.pdf`;
    doc.save(filename);
}

// ─── Interfaces del Reporte General del Proyecto ──────────────────────────────
export interface GeneralReportData {
    kpis: {
        totalSales: number;
        projectValue: number;
        commission: number;
        occupationRate: number;
        totalLots: number;
        soldLots: number;
        reservedLots: number;
        availableLots: number;
    };
    salesTrend: { name: string; ventas: number }[];
    advisorRanking: { name: string; lotsCount: number; amountTotal: number; commission: number }[];
    recentActivity: { id: number; action: string; lot: string; advisor: string; date: string }[];
}

// ─── Reporte General Consolidado (Administrador) ──────────────────────────────
export async function generateProjectGeneralReport(data: GeneralReportData): Promise<void> {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210; // ancho A4
    const H = 297; // alto A4
    const margin = 14;
    const contentW = W - margin * 2;

    const now = new Date();
    const dateLabel = now.toLocaleDateString('es-PE', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const timeLabel = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    const year = now.getFullYear();

    // ══════════════════════════════════════════════════════════════════════════
    // PÁGINA 1 — PORTADA + KPIs GLOBALES + TENDENCIA
    // ══════════════════════════════════════════════════════════════════════════

    // — Fondo completo blanco
    drawRect(doc, 0, 0, W, H, BRAND.pageBg);

    // — Banda superior de fondo suave (slate-50)
    drawRect(doc, 0, 0, W, 52, BRAND.panelBg);
    drawLine(doc, 0, 52, W, 52, BRAND.borderLight, 0.3);

    // — Barra de color superior (accent line corporativa)
    drawRect(doc, 0, 0, W / 2, 2, BRAND.green);
    drawRect(doc, W / 2, 0, W / 2, 2, BRAND.purple);

    // — Logo corporativo
    try {
        const logoResponse = await fetch('/terra-lima-logo.png');
        const logoBlob = await logoResponse.blob();
        const logoBase64: string = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(logoBlob);
        });
        doc.addImage(logoBase64, 'PNG', margin, 8, 44, 14);
    } catch {
        setFont(doc, 14, BRAND.darkBg, 'bold');
        doc.text('TERRA LIMA', margin, 18);
    }

    // — Información de empresa (derecha)
    setFont(doc, 7, BRAND.textMuted);
    doc.text('Sistema de Gestión Inmobiliaria', W - margin, 11, { align: 'right' });
    doc.text('Portal GIS · Renasur', W - margin, 16, { align: 'right' });
    doc.text(`Generado: ${dateLabel} · ${timeLabel}`, W - margin, 21, { align: 'right' });

    // — Separador
    drawLine(doc, margin, 26, W - margin, 26, BRAND.borderLight, 0.2);

    // — Título del reporte
    setFont(doc, 22, BRAND.darkBg, 'bold');
    doc.text('REPORTE GENERAL', margin, 40);
    setFont(doc, 10, BRAND.textMuted);
    doc.text('Consolidado Ejecutivo de Proyecto Inmobiliario', margin, 47);

    // — Badge de Reporte Consolidado (derecha con borde y fondo blanco)
    doc.setFillColor(...BRAND.white);
    doc.setDrawColor(...BRAND.borderLight);
    doc.setLineWidth(0.3);
    doc.roundedRect(W - margin - 70, 32, 70, 16, 2, 2, 'FD');

    setFont(doc, 7, BRAND.textMuted);
    doc.text('ENTIDAD', W - margin - 4, 38, { align: 'right' });
    setFont(doc, 10, BRAND.purple, 'bold');
    doc.text('CONSOLIDADO GLOBAL', W - margin - 4, 45, { align: 'right' });

    // ── Sección: KPIs Globales ────────────────────────────────────────────────
    let y = 62;
    drawSectionHeader(doc, 'INDICADORES GLOBALES DE PROYECTO', margin, y, BRAND.green);
    drawLine(doc, margin, y + 2.5, W - margin, y + 2.5, BRAND.borderLight, 0.15);
    y += 8;

    const goalPct = data.kpis.occupationRate;

    const kpiCards = [
        {
            label: 'VENTAS CONSOLIDADAS',
            value: currency(data.kpis.totalSales),
            sub: 'Facturación confirmada',
            color: BRAND.greenLight,
        },
        {
            label: 'VALOR COMERCIAL',
            value: currency(data.kpis.projectValue),
            sub: `${data.kpis.totalLots} lotes en proyecto`,
            color: BRAND.purple,
        },
        {
            label: 'COMISIONES ASESORES',
            value: currency(data.kpis.commission),
            sub: 'Tasa: 6% global',
            color: BRAND.indigo,
        },
        {
            label: 'OCUPACIÓN FÍSICA',
            value: `${goalPct}%`,
            sub: `${data.kpis.soldLots} reservados/vendidos`,
            color: BRAND.amber,
        },
    ];

    const cardW = (contentW - 6) / 4;
    kpiCards.forEach((card, i) => {
        const cx = margin + i * (cardW + 2);
        // Tarjeta con fondo slate-50 y borde slate-200
        doc.setFillColor(...BRAND.panelBg);
        doc.setDrawColor(...BRAND.borderLight);
        doc.setLineWidth(0.3);
        doc.roundedRect(cx, y, cardW, 28, 2, 2, 'FD');

        // — barra superior de color
        drawRect(doc, cx, y, cardW, 1.5, card.color, 0);
        // — label
        setFont(doc, 6, BRAND.textMuted, 'bold');
        doc.text(card.label, cx + 4, y + 7);
        // — valor
        setFont(doc, card.value.length > 12 ? 9 : 11, BRAND.darkBg, 'bold');
        doc.text(card.value, cx + 4, y + 17);
        // — sub
        setFont(doc, 6, card.color);
        doc.text(card.sub, cx + 4, y + 24);
    });
    y += 36;

    // — Barra de progreso de ocupación
    setFont(doc, 6.5, BRAND.textMuted);
    doc.text(`Porcentaje de ocupación física del proyecto: ${goalPct}%`, margin, y);
    y += 3;
    drawRect(doc, margin, y, contentW, 3, BRAND.borderLight, 1);
    if (goalPct > 0) {
        drawRect(doc, margin, y, contentW * goalPct / 100, 3, BRAND.amber, 1);
    }
    y += 10;

    // ── Sección: Tendencia Mensual Global ─────────────────────────────────────
    drawSectionHeader(doc, 'CURVA DE VENTAS MENSUALES DEL PROYECTO', margin, y, BRAND.purple);
    drawLine(doc, margin, y + 2.5, W - margin, y + 2.5, BRAND.borderLight, 0.15);
    y += 6;

    const currentMonth = now.getMonth();
    const trendSlice = data.salesTrend.slice(0, currentMonth + 1);
    const maxVenta = Math.max(...trendSlice.map(d => d.ventas), 1);
    const barAreaH = 32;
    const barW = Math.min(14, (contentW - 4) / trendSlice.length - 2);
    const barSpacing = (contentW - 4) / trendSlice.length;

    trendSlice.forEach((month, i) => {
        const barH = month.ventas > 0 ? (month.ventas / maxVenta) * barAreaH : 1;
        const bx = margin + 2 + i * barSpacing + (barSpacing - barW) / 2;
        const by = y + barAreaH - barH;

        const color: [number, number, number] = month.ventas > 0 ? BRAND.greenLight : BRAND.borderLight;
        drawRect(doc, bx, by, barW, barH, color, 1);

        if (month.ventas > 0) {
            setFont(doc, 4.5, BRAND.greenLight);
            const label = month.ventas >= 1000
                ? `${(month.ventas / 1000).toFixed(0)}k`
                : `${month.ventas}`;
            doc.text(label, bx + barW / 2, by - 1.5, { align: 'center' });
        }

        setFont(doc, 5.5, i <= currentMonth ? BRAND.darkBg : BRAND.dark3);
        doc.text(month.name, bx + barW / 2, y + barAreaH + 5, { align: 'center' });
    });
    y += barAreaH + 10;

    // ── Sección: Inventario Físico del Proyecto ──────────────────────────────
    drawSectionHeader(doc, 'DISTRIBUCIÓN GENERAL DE INVENTARIO', margin, y, BRAND.green);
    drawLine(doc, margin, y + 2.5, W - margin, y + 2.5, BRAND.borderLight, 0.15);
    y += 4;

    const inventoryRows = [
        ['Lotes Vendidos', `${data.kpis.soldLots} unidades`, pct(data.kpis.soldLots, data.kpis.totalLots), 'Estado comercial de cierre absoluto'],
        ['Lotes Separados/Reservados', `${data.kpis.reservedLots} unidades`, pct(data.kpis.reservedLots, data.kpis.totalLots), 'Con órdenes de venta en borrador/reserva'],
        ['Lotes Disponibles', `${data.kpis.availableLots} unidades`, pct(data.kpis.availableLots, data.kpis.totalLots), 'Disposición libre inmediata para cotización'],
        ['Lotes Totales del Proyecto', `${data.kpis.totalLots} unidades`, '100%', 'Inventario catastral GIS integrado'],
    ];

    autoTable(doc, {
        startY: y,
        head: [['ESTADO DE LOTE', 'CANTIDAD', 'PORCENTAJE', 'DETALLE OPERACIONAL']],
        body: inventoryRows,
        theme: 'plain',
        styles: {
            font: 'helvetica',
            fontSize: 7.5,
            cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
            textColor: BRAND.textLight,
            fillColor: BRAND.white,
            lineColor: BRAND.borderLight,
            lineWidth: 0.1,
        },
        headStyles: {
            fillColor: BRAND.panelBg,
            textColor: BRAND.darkBg,
            fontStyle: 'bold',
            fontSize: 6.5,
            halign: 'left',
        },
        alternateRowStyles: {
            fillColor: [250, 252, 254] as [number, number, number],
        },
        columnStyles: {
            0: { fontStyle: 'bold', textColor: BRAND.darkBg },
            1: { fontStyle: 'bold', textColor: BRAND.darkBg },
            2: { fontStyle: 'bold', textColor: BRAND.amber },
            3: { textColor: BRAND.textMuted },
        },
        margin: { left: margin, right: margin },
    });

    // ══════════════════════════════════════════════════════════════════════════
    // PÁGINA 2 — LEADERBOARD DE ASESORES + ACTIVIDAD RECIENTE GLOBAL
    // ══════════════════════════════════════════════════════════════════════════

    doc.addPage();
    drawRect(doc, 0, 0, W, H, BRAND.pageBg);
    y = 22;

    // ── Leaderboard de Asesores ─────────────────────────────────────────────
    drawSectionHeader(doc, 'DESEMPEÑO Y RANKING DE ASESORES (LEADERBOARD)', margin, y, BRAND.purple);
    drawLine(doc, margin, y + 2.5, W - margin, y + 2.5, BRAND.borderLight, 0.15);
    y += 4;

    if (data.advisorRanking.length === 0) {
        setFont(doc, 7, BRAND.textMuted);
        doc.text('No hay transacciones registradas de asesores.', margin, y + 6);
        y += 12;
    } else {
        autoTable(doc, {
            startY: y,
            head: [['RANGO', 'ASESOR DE VENTAS', 'LOTES TRASPASADOS', 'FACTURACIÓN REAL', 'COMISIÓN DEVENGADA (6%)']],
            body: data.advisorRanking.map((adv, idx) => [
                `#${idx + 1}`,
                adv.name,
                `${adv.lotsCount} lotes`,
                currency(adv.amountTotal),
                currency(adv.commission)
            ]),
            theme: 'plain',
            styles: {
                font: 'helvetica',
                fontSize: 7.5,
                cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
                textColor: BRAND.textLight,
                fillColor: BRAND.white,
                lineColor: BRAND.borderLight,
                lineWidth: 0.1,
            },
            headStyles: {
                fillColor: BRAND.panelBg,
                textColor: BRAND.darkBg,
                fontStyle: 'bold',
                fontSize: 6.5,
            },
            alternateRowStyles: { fillColor: [250, 252, 254] as [number, number, number] },
            columnStyles: {
                0: { fontStyle: 'bold', textColor: BRAND.amber, halign: 'center' },
                1: { fontStyle: 'bold', textColor: BRAND.darkBg },
                2: { halign: 'center' },
                3: { fontStyle: 'bold', textColor: BRAND.darkBg, halign: 'right' },
                4: { fontStyle: 'bold', textColor: BRAND.greenLight, halign: 'right' },
            },
            margin: { left: margin, right: margin },
        });
        y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    }

    // ── Historial Operacional del Proyecto ──────────────────────────────────
    drawSectionHeader(doc, 'HISTORIAL OPERACIONAL DEL PROYECTO (CONSOLIDADO)', margin, y, BRAND.indigo);
    drawLine(doc, margin, y + 2.5, W - margin, y + 2.5, BRAND.borderLight, 0.15);
    y += 4;

    if (data.recentActivity.length === 0) {
        setFont(doc, 7, BRAND.textMuted);
        doc.text('Sin actividad reciente registrada en el proyecto.', margin, y + 6);
    } else {
        autoTable(doc, {
            startY: y,
            head: [['TIPO', 'LOTE / PROPIEDAD', 'ASESOR ASOCIADO', 'FECHA DE REGISTRO']],
            body: data.recentActivity.map(act => [act.action, act.lot, act.advisor, act.date]),
            theme: 'plain',
            styles: {
                font: 'helvetica',
                fontSize: 7.5,
                cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
                textColor: BRAND.textLight,
                fillColor: BRAND.white,
                lineColor: BRAND.borderLight,
                lineWidth: 0.1,
            },
            headStyles: {
                fillColor: BRAND.panelBg,
                textColor: BRAND.darkBg,
                fontStyle: 'bold',
                fontSize: 6.5,
            },
            alternateRowStyles: { fillColor: [250, 252, 254] as [number, number, number] },
            columnStyles: {
                0: { fontStyle: 'bold', textColor: BRAND.indigo },
                1: { fontStyle: 'bold', textColor: BRAND.darkBg },
                2: { textColor: BRAND.textLight },
                3: { textColor: BRAND.textMuted, halign: 'right' },
            },
            didParseCell: (hookData) => {
                if (hookData.section === 'body' && hookData.column.index === 0) {
                    const action = data.recentActivity[hookData.row.index]?.action || '';
                    if (action === 'Venta')   hookData.cell.styles.textColor = BRAND.greenLight;
                    if (action === 'Reserva') hookData.cell.styles.textColor = BRAND.amber;
                    if (action === 'Cotización') hookData.cell.styles.textColor = BRAND.indigo;
                }
            },
            margin: { left: margin, right: margin },
        });
    }

    // ── Post-procesamiento: Cabeceras y Pies de Página ───────────────────────
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        
        // — Franja divisoria inferior elegante (sin sólido oscuro para ahorrar tinta)
        drawLine(doc, margin, H - 15, W - margin, H - 15, BRAND.borderLight, 0.3);
        drawLine(doc, margin, H - 15, margin + (contentW / 3), H - 15, BRAND.green, 0.8);
        drawLine(doc, margin + (contentW / 3), H - 15, margin + (contentW / 3) * 2, H - 15, BRAND.purple, 0.8);
        drawLine(doc, margin + (contentW / 3) * 2, H - 15, W - margin, H - 15, BRAND.green, 0.8);

        setFont(doc, 6, BRAND.textMuted);
        doc.text('Terra Lima © ' + year + ' · Documento Confidencial Gerencial', margin, H - 10);
        doc.text(
            `Reporte de Proyecto generado el ${dateLabel}`,
            W / 2, H - 10, { align: 'center' }
        );
        doc.text(`Pág. ${p} / ${totalPages}`, W - margin, H - 10, { align: 'right' });

        // — Cabecera secundaria en páginas posteriores (p > 1)
        if (p > 1) {
            drawRect(doc, 0, 0, W, 16, BRAND.panelBg);
            drawLine(doc, 0, 16, W, 16, BRAND.borderLight, 0.3);
            drawRect(doc, 0, 0, W / 2, 1.5, BRAND.green);
            drawRect(doc, W / 2, 0, W / 2, 1.5, BRAND.purple);

            setFont(doc, 7, BRAND.textMuted);
            doc.text(`Terra Lima · Reporte de Proyecto Consolidado ${year}`, margin, 10);
            doc.text(`Pág. ${p}`, W - margin, 10, { align: 'right' });
        }
    }

    // ── Descargar ──────────────────────────────────────────────────────────────
    const filename = `TerraLima_Reporte_General_Proyecto_${year}_${now.getMonth() + 1 < 10 ? '0' : ''}${now.getMonth() + 1}.pdf`;
    doc.save(filename);
}
