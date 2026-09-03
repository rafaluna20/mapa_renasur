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
    // Comparación real vs. período anterior de igual duración — ya se calcula
    // en stats/detailed para el dashboard en vivo, ahora también se refleja
    // en el PDF individual del asesor.
    comparison?: {
        totalSales: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
        commission: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
        salesCount: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
    };
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
    red:        [185, 28,  28]  as [number, number, number], // red-700 (saldos vencidos/críticos)
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

// Dibuja un panel de "Resumen Ejecutivo": 2-3 líneas narrativas que
// sintetizan el período en lenguaje natural, en vez de dejar que el
// lector infiera la lectura solo a partir de tarjetas KPI sueltas.
// Devuelve el nuevo cursor Y para continuar dibujando debajo del panel.
function drawNarrativeSummary(
    doc: jsPDF,
    x: number,
    y: number,
    width: number,
    paragraph: string,
    accentColor: [number, number, number]
): number {
    const textX = x + 6;
    const textWidth = width - 12;
    const lines = doc.splitTextToSize(paragraph, textWidth) as string[];
    const lineHeight = 4;
    const titleAreaH = 8;
    const boxH = titleAreaH + lines.length * lineHeight + 4;

    doc.setFillColor(...BRAND.panelBg);
    doc.roundedRect(x, y, width, boxH, 1.5, 1.5, 'F');
    drawRect(doc, x, y, 1.8, boxH, accentColor);

    setFont(doc, 6.5, accentColor, 'bold');
    doc.text('RESUMEN EJECUTIVO', textX, y + 5.5);

    setFont(doc, 7.8, BRAND.dark2);
    lines.forEach((line, i) => {
        doc.text(line, textX, y + titleAreaH + 3 + i * lineHeight);
    });

    return y + boxH + 8;
}

// Dibuja un gráfico de dona (pie con hueco central) aproximando cada
// porción con abanicos de triángulos delgados desde el centro — jsPDF no
// trae un primitivo de arco relleno, pero triángulos de ~3° son
// visualmente indistinguibles de una curva real a escala de impresión.
function drawDonutChart(
    doc: jsPDF,
    cx: number,
    cy: number,
    radius: number,
    slices: { value: number; color: [number, number, number] }[]
) {
    const total = slices.reduce((s, sl) => s + sl.value, 0);
    if (total <= 0) {
        doc.setFillColor(...BRAND.borderLight);
        doc.circle(cx, cy, radius, 'F');
    } else {
        let angleStart = 0;
        const stepDeg = 3;
        slices.forEach(slice => {
            if (slice.value <= 0) return;
            const angleEnd = angleStart + (slice.value / total) * 360;
            doc.setFillColor(...slice.color);
            for (let a = angleStart; a < angleEnd; a += stepDeg) {
                const a2 = Math.min(a + stepDeg, angleEnd);
                const r1 = (a * Math.PI) / 180;
                const r2 = (a2 * Math.PI) / 180;
                const x1 = cx + radius * Math.sin(r1);
                const y1 = cy - radius * Math.cos(r1);
                const x2 = cx + radius * Math.sin(r2);
                const y2 = cy - radius * Math.cos(r2);
                doc.triangle(cx, cy, x1, y1, x2, y2, 'F');
            }
            angleStart = angleEnd;
        });
    }
    // Hueco central (efecto dona) + borde exterior
    doc.setFillColor(...BRAND.white);
    doc.circle(cx, cy, radius * 0.55, 'F');
    doc.setDrawColor(...BRAND.borderLight);
    doc.setLineWidth(0.3);
    doc.circle(cx, cy, radius, 'S');
}

// Dibuja una flecha de tendencia (▲/▼/―) como triángulo vectorial en vez
// de un carácter Unicode: la fuente estándar "helvetica" de jsPDF solo
// soporta WinAnsiEncoding (Latin-1) y no incluye glifos de flecha — un
// triángulo dibujado con las mismas primitivas del donut es inmune a
// ese problema de fuente/encoding.
function drawTrendArrow(
    doc: jsPDF,
    x: number,
    y: number,
    size: number,
    trend: 'up' | 'down' | 'stable',
    color: [number, number, number]
) {
    doc.setFillColor(...color);
    if (trend === 'up') {
        doc.triangle(x, y - size, x - size / 2, y, x + size / 2, y, 'F');
    } else if (trend === 'down') {
        doc.triangle(x, y, x - size / 2, y - size, x + size / 2, y - size, 'F');
    } else {
        drawRect(doc, x - size / 2, y - size / 3, size, size * 0.35, color);
    }
}

// ID de reporte único para trazabilidad (referenciable en auditorías o
// reclamos de cliente sin necesitar volver a generar el PDF exacto).
function generateReportId(prefix: string, date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `RPT-${prefix}-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

// Dibuja el bloque de cierre de "Trazabilidad y Aprobación": el ID único
// del documento y 3 líneas en blanco para firma manual (Elaborado /
// Revisado / Aprobado) — estándar en reportes financieros/contables
// corporativos, ausente hasta ahora en estos PDFs.
function drawTraceabilitySection(
    doc: jsPDF,
    x: number,
    y: number,
    width: number,
    reportId: string
): number {
    drawSectionHeader(doc, 'TRAZABILIDAD Y APROBACIÓN', x, y, BRAND.dark2);
    drawLine(doc, x, y + 2.5, x + width, y + 2.5, BRAND.borderLight, 0.15);
    y += 8;

    setFont(doc, 6.5, BRAND.textMuted);
    doc.text(`ID de Reporte: ${reportId}`, x, y);
    y += 4;
    const lines = doc.splitTextToSize(
        'Documento generado automáticamente por el Sistema Financiero Terra Lima. Requiere validación y firma según el flujo de aprobación interno.',
        width
    ) as string[];
    doc.text(lines, x, y);
    y += lines.length * 3.6 + 10;

    const colW = width / 3;
    const labels = ['ELABORADO POR', 'REVISADO POR', 'APROBADO POR'];
    labels.forEach((label, i) => {
        const cx = x + i * colW;
        drawLine(doc, cx + 6, y, cx + colW - 6, y, BRAND.dark3, 0.3);
        setFont(doc, 6, BRAND.textMuted, 'bold');
        doc.text(label, cx + colW / 2, y + 5, { align: 'center' });
        setFont(doc, 5.5, BRAND.textMuted);
        doc.text('Nombre y firma', cx + colW / 2, y + 9, { align: 'center' });
    });

    return y + 14;
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
    const reportId = generateReportId('IND', now);

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
    doc.text('Sistema de Gestión Inmobiliaria', W - margin, 9, { align: 'right' });
    doc.text('Portal GIS · Renasur', W - margin, 13, { align: 'right' });
    doc.text(`Generado: ${dateLabel} · ${timeLabel}`, W - margin, 17, { align: 'right' });
    setFont(doc, 6, BRAND.textMuted);
    doc.text(`ID: ${reportId}`, W - margin, 21, { align: 'right' });

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

    // Tasa implícita = comisión real / ventas reales — no se asume 6% fijo:
    // cada asesor puede tener su propia tasa acordada (ver commissionRates.ts).
    const impliedCommissionRate = data.kpis.totalSales > 0
        ? Math.round((data.kpis.commission / data.kpis.totalSales) * 100)
        : 6;

    const kpiCards: {
        label: string; value: string; sub: string; color: [number, number, number];
        comparison?: { change: number; trend: 'up' | 'down' | 'stable' };
    }[] = [
        {
            label: `VENTAS ${year}`,
            value: currency(data.kpis.totalSales),
            sub: `${data.salesCount} lotes confirmados`,
            color: BRAND.greenLight,
            comparison: data.comparison?.totalSales,
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
            sub: `Tasa: ${impliedCommissionRate}% sobre ventas`,
            color: BRAND.indigo,
            comparison: data.comparison?.commission,
        },
        {
            label: 'COTIZACIONES ACTIVAS',
            value: `${data.kpis.pendingLeads}`,
            sub: 'Órdenes en borrador',
            color: BRAND.purple,
        },
    ];

    const cardH = 32;
    const cardW = (contentW - 6) / 4;
    kpiCards.forEach((card, i) => {
        const cx = margin + i * (cardW + 2);
        // Tarjeta con fondo slate-50 y borde slate-200
        doc.setFillColor(...BRAND.panelBg);
        doc.setDrawColor(...BRAND.borderLight);
        doc.setLineWidth(0.3);
        doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'FD');

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

        // — comparativo vs. período anterior (solo si aplica a esta tarjeta)
        if (card.comparison) {
            const { change, trend } = card.comparison;
            const deltaColor: [number, number, number] =
                trend === 'up' ? BRAND.greenLight : trend === 'down' ? BRAND.red : BRAND.textMuted;
            drawTrendArrow(doc, cx + 5.5, y + 29.5, 2.4, trend, deltaColor);
            setFont(doc, 6, deltaColor, 'bold');
            doc.text(`${Math.abs(change)}% vs. período anterior`, cx + 8.5, y + 30);
        }
    });
    y += cardH + 8;

    // — Barra de progreso de meta
    setFont(doc, 6.5, BRAND.textMuted);
    doc.text(`Progreso hacia la meta ${year}: ${goalPct}%`, margin, y);
    y += 3;
    drawRect(doc, margin, y, contentW, 3, BRAND.borderLight, 1);
    if (goalPct > 0) {
        drawRect(doc, margin, y, contentW * goalPct / 100, 3, BRAND.amber, 1);
    }
    y += 10;

    // ── Resumen Ejecutivo Narrativo ────────────────────────────────────────────
    const individualNarrative =
        `Durante el período ${data.dateRangeLabel || 'analizado'}, ${data.advisor.name} registró ventas por ${currency(data.kpis.totalSales)} (${data.salesCount} lote${data.salesCount === 1 ? '' : 's'} confirmado${data.salesCount === 1 ? '' : 's'}), alcanzando el ${goalPct}% de la meta ${year} de ${currency(data.kpis.monthlyGoal)}.` +
        ` La comisión devengada en el período es de ${currency(data.kpis.commission)}, con ${data.kpis.pendingLeads} ${data.kpis.pendingLeads === 1 ? 'cotización activa' : 'cotizaciones activas'} en cartera.` +
        (data.competedLots.length > 0
            ? ` Atención: ${data.competedLots.length} lote${data.competedLots.length === 1 ? '' : 's'} en cartera tiene${data.competedLots.length === 1 ? '' : 'n'} cotizaciones paralelas de otros asesores.`
            : ' Sin conflictos de cotizaciones paralelas en la cartera actual.');
    y = drawNarrativeSummary(doc, margin, y, contentW, individualNarrative, BRAND.green);

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
        [`Comisión Devengada (${impliedCommissionRate}%)`, currency(data.kpis.commission), 'Sobre ventas confirmadas'],
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
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

    y = drawTraceabilitySection(doc, margin, y, contentW, reportId);

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
        otherProducts?: number;
    };
    salesTrend: { name: string; ventas: number }[];
    manzanasDistribution?: { mz: string; total: number; sold: number; reserved: number; available: number }[];
    advisorRanking: { name: string; lotsCount: number; amountTotal: number; commission: number }[];
    recentActivity: { id: number; action: string; lot: string; advisor: string; date: string }[];
    dateRangeLabel?: string; // Etiqueta de periodo dinámico (ej. "Mayo 2026" o "01/04 - 30/04/2026")
    // Comparación real vs. período anterior de igual duración (ausente hasta
    // ahora en el PDF: los KPIs eran solo el número absoluto, sin indicar
    // si mejoraron o empeoraron respecto al período previo).
    comparison?: {
        totalSales: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
        commission: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
        salesCount: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
    };
    // Reporte de operaciones (solo administrador, app/dashboard) — opcional
    // porque el generador de PDF de este archivo no lo imprime (no pedido);
    // solo lo consumen el CSV y la tabla nueva del dashboard.
    estadoSummary?: {
        noVender: number;
        disponible: number;
        cotizacion: number;
        reservado: number;
        vendido: number;
        otros: number;
    };
    // Una fila POR LOTE (la operación más reciente de cada uno), no un
    // historial completo — ver route.ts de /api/odoo/stats/general.
    operaciones?: { tipo: string; propiedad: string; asesor: string; asignado: string; fecha: string }[];
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
    const reportId = generateReportId('GEN', now);

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
    doc.text('Sistema de Gestión Inmobiliaria', W - margin, 9, { align: 'right' });
    doc.text('Portal GIS · Renasur', W - margin, 13, { align: 'right' });
    doc.text(`Generado: ${dateLabel} · ${timeLabel}`, W - margin, 17, { align: "right" });
    setFont(doc, 6, BRAND.textMuted);
    doc.text(`ID: ${reportId}`, W - margin, 21, { align: "right" });

    // — Separador
    drawLine(doc, margin, 26, W - margin, 26, BRAND.borderLight, 0.2);

    // — Título del reporte
    setFont(doc, 22, BRAND.darkBg, 'bold');
    doc.text('REPORTE GENERAL', margin, 40);
    setFont(doc, 10, BRAND.textMuted);
    const subtitleGeneral = data.dateRangeLabel
        ? `Periodo: ${data.dateRangeLabel} · Consolidado Inmobiliario`
        : 'Consolidado Ejecutivo de Proyecto Inmobiliario';
    doc.text(subtitleGeneral, margin, 47);

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

    // Tasa promedio ponderada = comisión real / ventas reales — cada asesor
    // puede tener su propia tasa acordada (ver commissionRates.ts), así que
    // ya no es necesariamente un 6% uniforme para todo el equipo.
    const impliedCommissionRate = data.kpis.totalSales > 0
        ? Math.round((data.kpis.commission / data.kpis.totalSales) * 100)
        : 6;

    const kpiCards: {
        label: string; value: string; sub: string; color: [number, number, number];
        comparison?: { change: number; trend: 'up' | 'down' | 'stable' };
    }[] = [
        {
            label: 'VENTAS CONSOLIDADAS',
            value: currency(data.kpis.totalSales),
            sub: 'Facturación confirmada',
            color: BRAND.greenLight,
            comparison: data.comparison?.totalSales,
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
            sub: `Tasa promedio: ${impliedCommissionRate}%`,
            color: BRAND.indigo,
            comparison: data.comparison?.commission,
        },
        {
            label: 'OCUPACIÓN FÍSICA',
            value: `${goalPct}%`,
            sub: `${data.kpis.soldLots} reservados/vendidos`,
            color: BRAND.amber,
        },
    ];

    const cardH = 32;
    const cardW = (contentW - 6) / 4;
    kpiCards.forEach((card, i) => {
        const cx = margin + i * (cardW + 2);
        // Tarjeta con fondo slate-50 y borde slate-200
        doc.setFillColor(...BRAND.panelBg);
        doc.setDrawColor(...BRAND.borderLight);
        doc.setLineWidth(0.3);
        doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'FD');

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

        // — comparativo vs. período anterior (solo si aplica a esta tarjeta)
        if (card.comparison) {
            const { change, trend } = card.comparison;
            const deltaColor: [number, number, number] =
                trend === 'up' ? BRAND.greenLight : trend === 'down' ? BRAND.red : BRAND.textMuted;
            drawTrendArrow(doc, cx + 5.5, y + 29.5, 2.4, trend, deltaColor);
            setFont(doc, 6, deltaColor, 'bold');
            doc.text(`${Math.abs(change)}% vs. período anterior`, cx + 8.5, y + 30);
        }
    });
    y += cardH + 8;

    // — Barra de progreso de ocupación
    setFont(doc, 6.5, BRAND.textMuted);
    doc.text(`Porcentaje de ocupación física del proyecto: ${goalPct}%`, margin, y);
    y += 3;
    drawRect(doc, margin, y, contentW, 3, BRAND.borderLight, 1);
    if (goalPct > 0) {
        drawRect(doc, margin, y, contentW * goalPct / 100, 3, BRAND.amber, 1);
    }
    y += 10;

    // ── Resumen Ejecutivo Narrativo ────────────────────────────────────────────
    const topAdvisor = data.advisorRanking.length > 0 ? data.advisorRanking[0] : null;
    const unitsMoved = data.kpis.soldLots + data.kpis.reservedLots;
    const generalNarrative =
        `Durante el período ${data.dateRangeLabel || 'analizado'}, el proyecto registró ventas consolidadas por ${currency(data.kpis.totalSales)} sobre un valor comercial total de ${currency(data.kpis.projectValue)}, alcanzando una ocupación física del ${goalPct}% (${unitsMoved} de ${data.kpis.totalLots} lotes).` +
        (topAdvisor ? ` El asesor líder del período fue ${topAdvisor.name}, con ${topAdvisor.lotsCount} lote${topAdvisor.lotsCount === 1 ? '' : 's'} vendido${topAdvisor.lotsCount === 1 ? '' : 's'} (${currency(topAdvisor.amountTotal)}).` : '') +
        ` Quedan ${data.kpis.availableLots} lotes disponibles (${pct(data.kpis.availableLots, data.kpis.totalLots)}) para comercialización.`;
    y = drawNarrativeSummary(doc, margin, y, contentW, generalNarrative, BRAND.green);

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

    // ── Sección: Inventario por Manzana ───────────────────────────────────────
    if (data.manzanasDistribution && data.manzanasDistribution.length > 0) {
        drawSectionHeader(doc, 'DISTRIBUCIÓN DE INVENTARIO POR MANZANA', margin, y, BRAND.purple);
        drawLine(doc, margin, y + 2.5, W - margin, y + 2.5, BRAND.borderLight, 0.15);
        y += 4;

        const mzRows = data.manzanasDistribution.map(mz => [
            `Manzana ${mz.mz}`,
            `${mz.sold} (${pct(mz.sold, mz.total)})`,
            `${mz.reserved} (${pct(mz.reserved, mz.total)})`,
            `${mz.available} (${pct(mz.available, mz.total)})`,
            `${mz.total}`
        ]);

        autoTable(doc, {
            startY: y,
            head: [['MANZANA', 'VENDIDOS', 'SEPARADOS', 'DISPONIBLES', 'TOTAL LOTES']],
            body: mzRows,
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
            halign: 'center',
        },
        alternateRowStyles: {
            fillColor: [250, 252, 254] as [number, number, number],
        },
        columnStyles: {
            0: { fontStyle: 'bold', textColor: BRAND.darkBg, halign: 'left' },
            1: { textColor: BRAND.greenLight, halign: 'center', fontStyle: 'bold' },
            2: { textColor: BRAND.amber, halign: 'center', fontStyle: 'bold' },
            3: { textColor: BRAND.indigo, halign: 'center', fontStyle: 'bold' },
            4: { textColor: BRAND.darkBg, halign: 'center', fontStyle: 'bold' },
        },
        margin: { left: margin, right: margin },
    });

        y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    }

    // ── Sección: Inventario Físico del Proyecto ──────────────────────────────
    drawSectionHeader(doc, 'DISTRIBUCIÓN GENERAL DE INVENTARIO', margin, y, BRAND.green);
    drawLine(doc, margin, y + 2.5, W - margin, y + 2.5, BRAND.borderLight, 0.15);
    y += 4;

    // ── Donut de distribución (lectura visual a un vistazo) ──────────────────
    const donutRadius = 15;
    const donutCx = margin + donutRadius + 3;
    const donutCy = y + donutRadius + 3;
    const invSlices = [
        { label: 'Vendidos', value: data.kpis.soldLots, color: BRAND.greenLight },
        { label: 'Separados/Reservados', value: data.kpis.reservedLots, color: BRAND.amber },
        { label: 'Disponibles', value: data.kpis.availableLots, color: BRAND.indigo },
    ];
    drawDonutChart(doc, donutCx, donutCy, donutRadius, invSlices);

    setFont(doc, 8, BRAND.darkBg, 'bold');
    doc.text(`${data.kpis.totalLots}`, donutCx, donutCy - 1, { align: 'center' });
    setFont(doc, 5, BRAND.textMuted);
    doc.text('LOTES', donutCx, donutCy + 3.5, { align: 'center' });

    let legendY = y + 4;
    const legendX = donutCx + donutRadius + 12;
    invSlices.forEach(slice => {
        drawRect(doc, legendX, legendY - 3, 3, 3, slice.color);
        setFont(doc, 7, BRAND.darkBg, 'bold');
        doc.text(slice.label, legendX + 5, legendY);
        setFont(doc, 6.5, BRAND.textMuted);
        doc.text(`${slice.value} unidades (${pct(slice.value, data.kpis.totalLots)})`, legendX + 5, legendY + 4);
        legendY += 10;
    });

    y += donutRadius * 2 + 10;

    const inventoryRows = [
        ['Lotes Vendidos', `${data.kpis.soldLots} unidades`, pct(data.kpis.soldLots, data.kpis.totalLots), 'Estado comercial de cierre absoluto'],
        ['Lotes Separados/Reservados', `${data.kpis.reservedLots} unidades`, pct(data.kpis.reservedLots, data.kpis.totalLots), 'Con órdenes de venta en borrador/reserva'],
        ['Lotes Disponibles', `${data.kpis.availableLots} unidades`, pct(data.kpis.availableLots, data.kpis.totalLots), 'Disposición libre inmediata para cotización'],
        ['Lotes Totales del Proyecto', `${data.kpis.totalLots} unidades`, '100%', 'Inventario catastral GIS integrado'],
    ];

    if (data.kpis.otherProducts !== undefined && data.kpis.otherProducts > 0) {
        inventoryRows.push([
            'Otros Productos', 
            `${data.kpis.otherProducts} unidades`, 
            '—', 
            'Materiales, servicios, etc. (Excluidos de KPIs de lotes)'
        ]);
    }

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
        doc.text('No hay datos suficientes de asesores.', margin, y + 6);
        y += 12;
    } else {
        autoTable(doc, {
            startY: y,
            head: [['RANGO', 'ASESOR COMERCIAL', 'LOTES VENDIDOS', 'FACTURACIÓN', 'COMISIÓN ESTIMADA']],
            body: data.advisorRanking.map((adv, i) => [
                `#${i + 1}`,
                adv.name,
                `${adv.lotsCount} unidades`,
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
                halign: 'left',
            },
            alternateRowStyles: { fillColor: [250, 252, 254] as [number, number, number] },
            columnStyles: {
                0: { fontStyle: 'bold', textColor: BRAND.purple },
                1: { fontStyle: 'bold', textColor: BRAND.darkBg },
                3: { fontStyle: 'bold', textColor: BRAND.greenLight, halign: 'right' },
                4: { textColor: BRAND.indigo, halign: 'right' },
            },
            margin: { left: margin, right: margin },
        });
        y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    }

    // ── Actividad Reciente Global ─────────────────────────────────────────────
    drawSectionHeader(doc, 'ÚLTIMAS TRANSACCIONES COMERCIALES (GLOBAL)', margin, y, BRAND.indigo);
    drawLine(doc, margin, y + 2.5, W - margin, y + 2.5, BRAND.borderLight, 0.15);
    y += 4;

    if (data.recentActivity.length === 0) {
        setFont(doc, 7, BRAND.textMuted);
        doc.text('Sin actividad reciente.', margin, y + 6);
        y += 14;
    } else {
        autoTable(doc, {
            startY: y,
            head: [['TIPO', 'PROPIEDAD / LOTE', 'ASESOR ASIGNADO', 'FECHA']],
            body: data.recentActivity.map(act => [act.action, act.lot, act.advisor, act.date]),
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
                0: { fontStyle: 'bold' },
                1: { fontStyle: 'bold', textColor: BRAND.darkBg },
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
        y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
    }

    y = drawTraceabilitySection(doc, margin, y, contentW, reportId);

    // ── Pies de Página Globales ───────────────────────────────────────────────
    const totalGeneralPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalGeneralPages; p++) {
        doc.setPage(p);
        drawLine(doc, margin, H - 15, W - margin, H - 15, BRAND.borderLight, 0.3);
        drawLine(doc, margin, H - 15, margin + (contentW / 3), H - 15, BRAND.green, 0.8);
        drawLine(doc, margin + (contentW / 3), H - 15, margin + (contentW / 3) * 2, H - 15, BRAND.purple, 0.8);
        drawLine(doc, margin + (contentW / 3) * 2, H - 15, W - margin, H - 15, BRAND.green, 0.8);

        setFont(doc, 6, BRAND.textMuted);
        doc.text('Terra Lima © ' + year + ' · Documento Corporativo Confidencial', margin, H - 10);
        doc.text(`Reporte generado el ${dateLabel}`, W / 2, H - 10, { align: 'center' });
        doc.text(`Pág. ${p} / ${totalGeneralPages}`, W - margin, H - 10, { align: 'right' });

        if (p > 1) {
            drawRect(doc, 0, 0, W, 16, BRAND.panelBg);
            drawLine(doc, 0, 16, W, 16, BRAND.borderLight, 0.3);
            drawRect(doc, 0, 0, W / 2, 1.5, BRAND.green);
            drawRect(doc, W / 2, 0, W / 2, 1.5, BRAND.purple);

            setFont(doc, 7, BRAND.textMuted);
            doc.text(`Terra Lima · Reporte General Consolidado ${year}`, margin, 10);
            doc.text(`Pág. ${p}`, W - margin, 10, { align: 'right' });
        }
    }

    const genFilename = `TerraLima_ReporteGlobal_${year}_${now.getMonth() + 1 < 10 ? '0' : ''}${now.getMonth() + 1}.pdf`;
    doc.save(genFilename);
}

// ─── Interfaces del Reporte de Facturas Pagadas (Recaudación) ──────────────────────────────
export interface PaidInvoicesReportData {
    totalCollected: number;
    blocks: { mz: string; etapa?: string; totalAmount: number; invoicesCount: number; uniqueLotsCount: number }[];
    recentPayments: { invoice: string; cuotaLabel?: string; date: string; client: string; lot: string; etapa?: string; mz: string; paidAmount: number }[];
    dateRangeLabel?: string;
    // Antigüedad de saldos vencidos ("aging") — foto a hoy, independiente del rango de fechas anterior.
    totalOverdue?: number;
    aging?: { bucket: '0-30' | '31-60' | '61-90' | '90+'; totalAmount: number; invoicesCount: number }[];
    overdueDetail?: { invoice: string; client: string; lot: string; daysOverdue: number; amountDue: number }[];
    // Comparación real vs. período anterior de igual duración (solo presente
    // cuando el reporte tiene un rango de fechas explícito).
    comparison?: {
        totalCollected: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
        invoicesCount: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
    };
}

export async function generatePaidInvoicesReport(data: PaidInvoicesReportData): Promise<void> {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210; 
    const H = 297; 
    const margin = 14;
    const contentW = W - margin * 2;

    const now = new Date();
    const dateLabel = now.toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeLabel = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    const year = now.getFullYear();
    const reportId = generateReportId('REC', now);

    // Fondo y cabecera principal
    drawRect(doc, 0, 0, W, H, BRAND.pageBg);
    drawRect(doc, 0, 0, W, 52, BRAND.panelBg);
    drawLine(doc, 0, 52, W, 52, BRAND.borderLight, 0.3);
    drawRect(doc, 0, 0, W, 2, BRAND.greenLight); // Línea verde acentuada superior

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

    setFont(doc, 7, BRAND.textMuted);
    doc.text('Sistema Financiero y Contable', W - margin, 11, { align: 'right' });
    doc.text(`Generado: ${dateLabel} · ${timeLabel}`, W - margin, 16, { align: 'right' });
    setFont(doc, 6, BRAND.textMuted);
    doc.text(`ID: ${reportId}`, W - margin, 20, { align: 'right' });

    setFont(doc, 22, BRAND.darkBg, 'bold');
    doc.text('REPORTE DE RECAUDACIÓN', margin, 40);
    setFont(doc, 10, BRAND.textMuted);
    
    // Si hay un rango de fechas, mostrarlo en el subtítulo
    if (data.dateRangeLabel) {
        doc.text(`Flujo de Caja Real: Facturas Pagadas | ${data.dateRangeLabel}`, margin, 47);
    } else {
        doc.text('Flujo de Caja Real: Facturas Pagadas por Manzana y Lote', margin, 47);
    }

    // Kpi Recaudación Total
    const kpiBoxH = data.comparison ? 24 : 20;
    doc.setFillColor(...BRAND.white);
    doc.setDrawColor(...BRAND.greenLight);
    doc.setLineWidth(0.5);
    doc.roundedRect(W - margin - 75, 28, 75, kpiBoxH, 2, 2, 'FD');
    setFont(doc, 8, BRAND.greenLight, 'bold');
    doc.text('TOTAL RECAUDADO EFECTIVO', W - margin - 4, 34, { align: 'right' });
    setFont(doc, 14, BRAND.darkBg, 'bold');
    doc.text(currency(data.totalCollected), W - margin - 4, 43, { align: 'right' });

    if (data.comparison) {
        const { change, trend } = data.comparison.totalCollected;
        const deltaColor: [number, number, number] =
            trend === 'up' ? BRAND.greenLight : trend === 'down' ? BRAND.red : BRAND.textMuted;
        const deltaLabel = `${Math.abs(change)}% vs. período anterior`;
        setFont(doc, 6.5, deltaColor, 'bold');
        const rightEdge = W - margin - 4;
        doc.text(deltaLabel, rightEdge, 49.5, { align: 'right' });
        drawTrendArrow(doc, rightEdge - doc.getTextWidth(deltaLabel) - 4, 49, 2.2, trend, deltaColor);
    }

    let y = 62;

    // ── Resumen Ejecutivo Narrativo ────────────────────────────────────────────
    const topBlock = data.blocks.length > 0
        ? data.blocks.reduce((max, b) => (b.totalAmount > max.totalAmount ? b : max), data.blocks[0])
        : null;
    const overdue90 = data.aging?.find(a => a.bucket === '90+');

    let invoicesNarrative =
        `Durante el período ${data.dateRangeLabel || 'analizado'}, se recaudaron ${currency(data.totalCollected)} en ${data.recentPayments.length} factura${data.recentPayments.length === 1 ? '' : 's'} pagada${data.recentPayments.length === 1 ? '' : 's'}` +
        (topBlock ? `, concentradas principalmente en la Manzana ${topBlock.mz} (${pct(topBlock.totalAmount, data.totalCollected)} del total recaudado)` : '') + '.';
    if (data.totalOverdue && data.totalOverdue > 0) {
        invoicesNarrative +=
            ` Adicionalmente, existen ${currency(data.totalOverdue)} en saldos vencidos a la fecha` +
            (overdue90 && overdue90.totalAmount > 0 ? `, de los cuales ${currency(overdue90.totalAmount)} corresponden a mora mayor a 90 días y requieren atención prioritaria de cobranza` : '') + '.';
    } else {
        invoicesNarrative += ' No se registran saldos vencidos a la fecha de este reporte.';
    }
    y = drawNarrativeSummary(doc, margin, y, contentW, invoicesNarrative, BRAND.green);

    // ── Resumen de Recaudación por Manzanas
    drawSectionHeader(doc, 'RESUMEN FINANCIERO POR MANZANA (CASH FLOW REAL)', margin, y, BRAND.green);
    drawLine(doc, margin, y + 2.5, W - margin, y + 2.5, BRAND.borderLight, 0.15);
    y += 5;

    const blockRows = data.blocks.map(b => [
        `${b.etapa || ''} – Mz ${b.mz}`.trim(),
        `${b.uniqueLotsCount} lotes`,
        `${b.invoicesCount} facturas`,
        currency(b.totalAmount),
        pct(b.totalAmount, data.totalCollected)
    ]);

    autoTable(doc, {
        startY: y,
        head: [['ETAPA / MANZANA', 'LOTES CON PAGOS', 'FACTURAS PAGADAS', 'MONTO RECAUDADO', 'PARTICIPACIÓN']],
        body: blockRows,
        theme: 'plain',
        styles: { font: 'helvetica', fontSize: 7.5, cellPadding: { top: 4, bottom: 4, left: 4, right: 4 }, textColor: BRAND.textLight, lineColor: BRAND.borderLight, lineWidth: 0.1 },
        headStyles: { fillColor: BRAND.panelBg, textColor: BRAND.darkBg, fontStyle: 'bold', fontSize: 6.5 },
        alternateRowStyles: { fillColor: [250, 252, 254] as [number, number, number] },
        columnStyles: {
            0: { fontStyle: 'bold', textColor: BRAND.darkBg },
            3: { fontStyle: 'bold', textColor: BRAND.greenLight, halign: 'right' },
            4: { textColor: BRAND.textMuted, halign: 'center' }
        },
        margin: { left: margin, right: margin },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

    // ── Listado Detallado
    // Igual que el detalle de vencidos (TOP 15 más urgentes, más abajo), esta
    // tabla se acota por CANTIDAD de filas, no por fecha: recortar por un
    // segundo rango temporal propio (ej. "solo el último mes") rompería la
    // reconciliación con el KPI/resumen de arriba, que sí reflejan el rango
    // de fechas elegido por el admin en el dashboard. El CSV de exportación
    // (csvExportService.ts) sigue entregando recentPayments completo.
    const DETAIL_ROW_LIMIT = 50;
    const isDetailTruncated = data.recentPayments.length > DETAIL_ROW_LIMIT;

    drawSectionHeader(
        doc,
        `DESGLOSE DE FACTURAS PAGADAS POR LOTE${isDetailTruncated ? ` (ÚLTIMAS ${DETAIL_ROW_LIMIT})` : ''}`,
        margin, y, BRAND.purple
    );
    drawLine(doc, margin, y + 2.5, W - margin, y + 2.5, BRAND.borderLight, 0.15);
    y += 5;

    const detailRows = data.recentPayments.slice(0, DETAIL_ROW_LIMIT).map(p => [
        p.cuotaLabel || p.invoice,       // Cuota N° 13 / Cuota Inicial
        p.date,
        `${p.etapa} – Mz ${p.mz} – ${p.lot}`,  // E01 – Mz D – E01MZD148P
        p.client,
        currency(p.paidAmount)
    ]);

    autoTable(doc, {
        startY: y,
        head: [['TIPO DE CUOTA', 'FECHA DE PAGO', 'LOTE / PROPIEDAD', 'CLIENTE', 'MONTO PAGADO']],
        body: detailRows,
        theme: 'plain',
        styles: { font: 'helvetica', fontSize: 7.5, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 }, textColor: BRAND.textLight, lineColor: BRAND.borderLight, lineWidth: 0.1 },
        headStyles: { fillColor: BRAND.panelBg, textColor: BRAND.darkBg, fontStyle: 'bold', fontSize: 6.5 },
        alternateRowStyles: { fillColor: [250, 252, 254] as [number, number, number] },
        columnStyles: {
            0: { fontStyle: 'bold', textColor: BRAND.purple },
            2: { fontStyle: 'bold', textColor: BRAND.darkBg },
            4: { fontStyle: 'bold', textColor: BRAND.greenLight, halign: 'right' }
        },
        margin: { left: margin, right: margin },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + (isDetailTruncated ? 5 : 12);

    if (isDetailTruncated) {
        setFont(doc, 6.5, BRAND.textMuted);
        const noteLines = doc.splitTextToSize(
            `Se muestran los ${DETAIL_ROW_LIMIT} pagos más recientes de ${data.recentPayments.length} registrados en ${data.dateRangeLabel || 'el período analizado'}. Para el detalle completo, use el botón de exportar CSV.`,
            contentW
        ) as string[];
        noteLines.forEach((line, i) => doc.text(line, margin, y + i * 3.2));
        y += noteLines.length * 3.2 + 6;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PÁGINA 2 — ANTIGÜEDAD DE SALDOS VENCIDOS (AGING, FOTO A HOY)
    // ══════════════════════════════════════════════════════════════════════════
    // Se registra desde qué página física arranca esta sección: el pie de
    // página necesita saber cuáles páginas son "de riesgo/vencidos" (banda
    // roja) vs "de cash flow" (banda verde) — antes la banda de páginas 2+
    // era siempre verde aunque su contenido fuera sobre deuda vencida.
    let agingStartPage: number | null = null;
    if (data.aging && data.aging.length > 0) {
        doc.addPage();
        agingStartPage = doc.getNumberOfPages();
        drawRect(doc, 0, 0, W, H, BRAND.pageBg);
        y = 22;

        // Kpi Total Vencido
        doc.setFillColor(...BRAND.white);
        doc.setDrawColor(...BRAND.red);
        doc.setLineWidth(0.5);
        doc.roundedRect(W - margin - 75, y - 6, 75, 20, 2, 2, 'FD');
        setFont(doc, 8, BRAND.red, 'bold');
        doc.text('TOTAL SALDO VENCIDO (A HOY)', W - margin - 4, y, { align: 'right' });
        setFont(doc, 14, BRAND.darkBg, 'bold');
        doc.text(currency(data.totalOverdue || 0), W - margin - 4, y + 9, { align: 'right' });

        drawSectionHeader(doc, 'ANTIGÜEDAD DE SALDOS VENCIDOS (AGING)', margin, y, BRAND.red);
        drawLine(doc, margin, y + 2.5, W - margin, y + 2.5, BRAND.borderLight, 0.15);
        y += 18;

        const totalOverdueForPct = data.totalOverdue || 0;
        const agingRows = data.aging.map(a => [
            `${a.bucket} días`,
            `${a.invoicesCount} facturas`,
            currency(a.totalAmount),
            pct(a.totalAmount, totalOverdueForPct)
        ]);

        autoTable(doc, {
            startY: y,
            head: [['ANTIGÜEDAD', 'FACTURAS VENCIDAS', 'MONTO VENCIDO', 'PARTICIPACIÓN']],
            body: agingRows,
            theme: 'plain',
            styles: { font: 'helvetica', fontSize: 7.5, cellPadding: { top: 4, bottom: 4, left: 4, right: 4 }, textColor: BRAND.textLight, lineColor: BRAND.borderLight, lineWidth: 0.1 },
            headStyles: { fillColor: BRAND.panelBg, textColor: BRAND.darkBg, fontStyle: 'bold', fontSize: 6.5 },
            alternateRowStyles: { fillColor: [250, 252, 254] as [number, number, number] },
            columnStyles: {
                0: { fontStyle: 'bold', textColor: BRAND.darkBg },
                2: { fontStyle: 'bold', textColor: BRAND.red, halign: 'right' },
                3: { textColor: BRAND.textMuted, halign: 'center' }
            },
            margin: { left: margin, right: margin },
        });
        y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

        if (data.overdueDetail && data.overdueDetail.length > 0) {
            drawSectionHeader(doc, 'DETALLE DE FACTURAS VENCIDAS (TOP 15 MÁS URGENTES)', margin, y, BRAND.amber);
            drawLine(doc, margin, y + 2.5, W - margin, y + 2.5, BRAND.borderLight, 0.15);
            y += 5;

            const overdueRows = data.overdueDetail.map(o => [
                o.invoice,
                o.client,
                o.lot,
                `${o.daysOverdue} días`,
                currency(o.amountDue)
            ]);

            autoTable(doc, {
                startY: y,
                head: [['FACTURA', 'CLIENTE', 'LOTE', 'DÍAS VENCIDO', 'SALDO PENDIENTE']],
                body: overdueRows,
                theme: 'plain',
                styles: { font: 'helvetica', fontSize: 7.5, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 }, textColor: BRAND.textLight, lineColor: BRAND.borderLight, lineWidth: 0.1 },
                headStyles: { fillColor: BRAND.panelBg, textColor: BRAND.darkBg, fontStyle: 'bold', fontSize: 6.5 },
                alternateRowStyles: { fillColor: [250, 252, 254] as [number, number, number] },
                columnStyles: {
                    0: { fontStyle: 'bold', textColor: BRAND.darkBg },
                    3: { fontStyle: 'bold', textColor: BRAND.amber, halign: 'center' },
                    4: { fontStyle: 'bold', textColor: BRAND.red, halign: 'right' }
                },
                margin: { left: margin, right: margin },
            });
            y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
        }
    }

    y = drawTraceabilitySection(doc, margin, y, contentW, reportId);

    // ── Post Procesamiento
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        drawLine(doc, margin, H - 15, W - margin, H - 15, BRAND.borderLight, 0.3);
        setFont(doc, 6, BRAND.textMuted);
        doc.text('Terra Lima © ' + year + ' · Documento Contable Confidencial', margin, H - 10);
        doc.text(`Pág. ${p} / ${totalPages}`, W - margin, H - 10, { align: 'right' });

        if (p > 1) {
            // Banda roja en las páginas de antigüedad/vencidos, verde en el
            // resto — antes esta banda era siempre verde sin importar que
            // la página tratara de deuda vencida (contradecía sus propias
            // secciones en rojo).
            const isAgingPage = agingStartPage !== null && p >= agingStartPage;
            const bannerColor = isAgingPage ? BRAND.red : BRAND.greenLight;
            const bannerLabel = isAgingPage
                ? 'Terra Lima · Antigüedad de Saldos Vencidos'
                : 'Terra Lima · Reporte de Recaudación (Facturas Pagadas)';

            drawRect(doc, 0, 0, W, 16, BRAND.panelBg);
            drawLine(doc, 0, 16, W, 16, BRAND.borderLight, 0.3);
            drawRect(doc, 0, 0, W, 1.5, bannerColor);
            setFont(doc, 7, BRAND.textMuted);
            doc.text(bannerLabel, margin, 10);
            doc.text(`Pág. ${p}`, W - margin, 10, { align: 'right' });
        }
    }

    doc.save(`TerraLima_Recaudacion_Global_${year}${now.getMonth()+1}.pdf`);
}

// ─── Interfaces del Reporte de Estado de Cuenta (Cliente) ──────────────────────
// Fuente única del PDF "Estado de Cuenta": la usan tanto el botón del
// cliente en /portal/pagos como el botón "Descargar Estado de Cuenta" del
// staff en LotDetailModal.tsx — mismo documento exacto en ambos casos, para
// que lo que el staff reenvíe a un cliente sea idéntico a lo que ese cliente
// vería si lo bajara él mismo (ver discusión: no mantener 2 plantillas que
// puedan divergir).
export interface ClientStatementInvoice {
    id: number;
    name: string;
    ref?: string;
    payment_reference?: string;
    invoice_date: string;
    invoice_date_due: string;
    amount_total: number;
    amount_residual: number;
    payment_state: string;
}

export interface ClientStatementLot {
    /** Ej. "Etapa 01 Mz D Lote 148" — se omite el encabezado de sección si
     *  solo hay 1 lote (no hace falta aclarar de cuál se trata). */
    label: string;
    /** Manzana/etapa/número de lote por separado — a diferencia de `label`
     *  (que solo encabeza la sección con más de 1 lote), estos se imprimen
     *  siempre debajo del título "ESTADO DE CUENTA" para identificar el
     *  lote aunque el cliente tenga uno solo. */
    mz?: string | null;
    etapa?: string | null;
    numeroLote?: string | null;
    listPrice: number;
    invoices: ClientStatementInvoice[];
}

export interface ClientStatementReportData {
    clientName: string;
    lots: ClientStatementLot[];
}

// Mismo parser de referencia que ya usa LotFinancialStatement.tsx (portal)
// y LotDetailModal.tsx (staff) — duplicado a propósito, no extraído a un
// módulo compartido, siguiendo la misma convención ya documentada en esos
// 2 archivos (es solo formato, y cada uno tiene contexto propio alrededor).
function parseCuotaLabelPdf(inv: { name: string; ref?: string; payment_reference?: string }): string {
    const ref = inv.ref || inv.payment_reference || inv.name || '';
    if (/[-_]INIT(\b|$|-)/i.test(ref)) return 'Cuota Inicial';
    const m = ref.match(/[-_]C(\d+)(?:\b|$|-)/i);
    if (m) return `Cuota N° ${parseInt(m[1], 10)}`;
    return inv.name || 'Factura';
}

// Clave numérica para ordenar el historial por cuota (Inicial, N° 1, N° 2,
// ...) en vez de por fecha de factura — la fecha de emisión de una cuota no
// siempre coincide con su orden real (ej. cuotas facturadas por adelantado
// o con retraso administrativo). Las referencias sin cuota reconocida
// (facturas sueltas, "Otros pagos") quedan al final, ordenadas por fecha.
function getCuotaOrderKeyPdf(inv: { name: string; ref?: string; payment_reference?: string }): number {
    const ref = inv.ref || inv.payment_reference || inv.name || '';
    if (/[-_]INIT(\b|$|-)/i.test(ref)) return 0;
    const m = ref.match(/[-_]C(\d+)(?:\b|$|-)/i);
    if (m) return parseInt(m[1], 10);
    return Number.MAX_SAFE_INTEGER;
}

// Formato DD/MM/AA pedido para el PDF — el resto del sistema (pantalla)
// sigue mostrando la fecha cruda de Odoo (YYYY-MM-DD), este formateador es
// exclusivo del documento descargable.
function formatDDMMYY(fecha: string): string {
    const d = new Date(fecha + 'T00:00:00');
    if (isNaN(d.getTime())) return fecha;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
}

/**
 * Genera el PDF "Estado de Cuenta" de un cliente: mismo Resumen Financiero
 * (Valor Total, Saldo Deudor, Total Pagado + %) e Historial de Cuotas y
 * Pagos que ya se muestra en pantalla (LotFinancialStatement.tsx), con el
 * mismo tono suavizado para la alerta de mora ("Regulariza cuanto antes...")
 * — nunca el lenguaje interno de gestión de cartera que usa el staff
 * puertas adentro. Es un documento INFORMATIVO, no un comprobante fiscal
 * (se aclara explícitamente en el pie), y no lleva bloque de firmas de
 * aprobación interna (a diferencia de generatePaidInvoicesReport, que sí es
 * un documento contable interno).
 */
export async function generateClientStatementReport(data: ClientStatementReportData): Promise<void> {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210;
    const H = 297;
    const margin = 14;
    const contentW = W - margin * 2;

    const now = new Date();
    const dateLabel = now.toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeLabel = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    const year = now.getFullYear();
    const reportId = generateReportId('EDC', now);
    const mostrarLabelLote = data.lots.length > 1;

    const drawHeader = () => {
        drawRect(doc, 0, 0, W, H, BRAND.pageBg);
        drawRect(doc, 0, 0, W, 40, BRAND.panelBg);
        drawLine(doc, 0, 40, W, 40, BRAND.borderLight, 0.3);
        drawRect(doc, 0, 0, W, 2, BRAND.greenLight);

        setFont(doc, 7, BRAND.textMuted);
        doc.text(`Generado: ${dateLabel} · ${timeLabel}`, W - margin, 11, { align: 'right' });
        setFont(doc, 6, BRAND.textMuted);
        doc.text(`ID: ${reportId}`, W - margin, 15, { align: 'right' });

        setFont(doc, 18, BRAND.darkBg, 'bold');
        doc.text('ESTADO DE CUENTA', margin, 22);
        setFont(doc, 9, BRAND.textMuted);
        doc.text(data.clientName, margin, 29);
        setFont(doc, 7, BRAND.textMuted);
        doc.text('Terra Lima · Documento Informativo', margin, 34);

        return 50;
    };

    let y = drawHeader();

    data.lots.forEach((lot, lotIdx) => {
        if (lotIdx > 0) {
            doc.addPage();
            drawRect(doc, 0, 0, W, H, BRAND.pageBg);
            y = 16;
        }

        if (mostrarLabelLote) {
            drawSectionHeader(doc, lot.label.toUpperCase(), margin, y, BRAND.purple);
            drawLine(doc, margin, y + 2.5, W - margin, y + 2.5, BRAND.borderLight, 0.15);
            y += 8;
        }

        // Mz/etapa/lote por separado — se imprime siempre (aunque haya un
        // solo lote y no se muestre el label de arriba), para identificar
        // de qué lote es el estado de cuenta.
        const metadataChips = [
            lot.etapa && `Etapa ${lot.etapa}`,
            lot.mz && `Mz ${lot.mz}`,
            lot.numeroLote && `Lote ${lot.numeroLote}`,
        ].filter(Boolean) as string[];
        if (metadataChips.length > 0) {
            setFont(doc, 7.5, BRAND.textMuted, 'bold');
            doc.text(metadataChips.join('   ·   '), margin, y);
            y += 6;
        }

        const realTotalPaid = lot.invoices
            .filter((i) => i.payment_state === 'paid')
            .reduce((sum, inv) => sum + (inv.amount_total || 0), 0);
        const pendingBalance = Math.max(0, lot.listPrice - realTotalPaid);
        const financialProgress = lot.listPrice > 0 ? Math.min(100, Math.round((realTotalPaid / lot.listPrice) * 100)) : 0;

        const overdueInvoices = lot.invoices.filter(
            (inv) => inv.payment_state !== 'paid' && inv.invoice_date_due && new Date(inv.invoice_date_due) < now
        );
        const isOverdue = overdueInvoices.length > 0;
        const totalOverdueAmount = overdueInvoices.reduce((sum, inv) => sum + (inv.amount_residual || 0), 0);

        // ── Resumen Financiero
        drawSectionHeader(doc, 'RESUMEN FINANCIERO', margin, y, BRAND.green);
        drawLine(doc, margin, y + 2.5, W - margin, y + 2.5, BRAND.borderLight, 0.15);
        y += 8;

        drawRect(doc, margin, y, contentW, 26, BRAND.panelBg, 2);
        setFont(doc, 7, BRAND.textMuted, 'bold');
        doc.text('VALOR TOTAL (PRECIO)', margin + 5, y + 7);
        doc.text('SALDO DEUDOR PENDIENTE', W - margin - 5, y + 7, { align: 'right' });
        setFont(doc, 12, BRAND.darkBg, 'bold');
        doc.text(currency(lot.listPrice), margin + 5, y + 13.5);
        setFont(doc, 12, BRAND.red, 'bold');
        doc.text(currency(pendingBalance), W - margin - 5, y + 13.5, { align: 'right' });

        setFont(doc, 7.5, BRAND.greenLight, 'bold');
        doc.text(`Total Pagado: ${currency(realTotalPaid)}`, margin + 5, y + 20.5);
        doc.text(`${financialProgress}%`, W - margin - 5, y + 20.5, { align: 'right' });
        drawRect(doc, margin + 5, y + 22.5, contentW - 10, 1.8, BRAND.borderLight, 0.9);
        // roundedRect con ancho 0 (0% pagado, ej. cuota inicial aún sin
        // registrar) puede dar un radio mayor que el propio ancho — se omite
        // el relleno en ese caso en vez de arriesgar un rect degenerado.
        if (financialProgress > 0) {
            drawRect(doc, margin + 5, y + 22.5, (contentW - 10) * (financialProgress / 100), 1.8, BRAND.greenLight, 0.9);
        }
        y += 32;

        // ── Estado de morosidad — mismo tono que LotFinancialStatement.tsx
        // (portal del cliente), nunca el lenguaje interno de cobranza.
        const bannerH = 16;
        if (isOverdue) {
            drawRect(doc, margin, y, contentW, bannerH, [254, 242, 242] as [number, number, number], 2);
            setFont(doc, 8, BRAND.red, 'bold');
            doc.text(
                `ATRASO DETECTADO (${overdueInvoices.length} ${overdueInvoices.length === 1 ? 'CUOTA' : 'CUOTAS'}) · DEUDA EXIGIBLE: ${currency(totalOverdueAmount)}`,
                margin + 5, y + 6
            );
            setFont(doc, 6.5, BRAND.textMuted);
            doc.text('Regulariza cuanto antes para evitar recargos. Podés subir tu comprobante desde el portal.', margin + 5, y + 11.5);
        } else {
            drawRect(doc, margin, y, contentW, bannerH, [236, 253, 245] as [number, number, number], 2);
            setFont(doc, 8, BRAND.greenLight, 'bold');
            doc.text('FINANCIAMIENTO AL DÍA', margin + 5, y + 6);
            setFont(doc, 6.5, BRAND.textMuted);
            doc.text('No tenés cuotas vencidas registradas.', margin + 5, y + 11.5);
        }
        y += bannerH + 8;

        // ── Historial de Cuotas y Pagos
        drawSectionHeader(doc, 'HISTORIAL DE CUOTAS Y PAGOS', margin, y, BRAND.purple);
        drawLine(doc, margin, y + 2.5, W - margin, y + 2.5, BRAND.borderLight, 0.15);
        y += 5;

        const sortedInvoices = [...lot.invoices].sort((a, b) => {
            const ordenA = getCuotaOrderKeyPdf(a);
            const ordenB = getCuotaOrderKeyPdf(b);
            if (ordenA !== ordenB) return ordenA - ordenB;
            // Empate (ambas sin cuota reconocida, o mismo número — no
            // debería pasar): desempata por fecha de emisión.
            return new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime();
        });

        const filaEstado = (inv: ClientStatementInvoice) => {
            if (inv.payment_state === 'paid') return 'Pagado';
            const vencida = inv.invoice_date_due && new Date(inv.invoice_date_due) < now;
            return vencida ? 'Mora' : 'Pendiente';
        };

        const rows = sortedInvoices.map((inv) => [
            parseCuotaLabelPdf(inv),
            formatDDMMYY(inv.invoice_date_due || inv.invoice_date),
            inv.name || inv.ref || 'S/N',
            filaEstado(inv),
            currency(inv.amount_total),
            inv.payment_state === 'paid' ? '—' : currency(inv.amount_residual),
        ]);

        autoTable(doc, {
            startY: y,
            head: [['CUOTA', 'VENCIMIENTO', 'FACTURA', 'ESTADO', 'MONTO', 'SALDO']],
            body: rows.length > 0 ? rows : [['Aún no hay cuotas facturadas.', '', '', '', '', '']],
            theme: 'plain',
            styles: { font: 'helvetica', fontSize: 7.5, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 }, textColor: BRAND.textLight, lineColor: BRAND.borderLight, lineWidth: 0.1 },
            headStyles: { fillColor: BRAND.panelBg, textColor: BRAND.darkBg, fontStyle: 'bold', fontSize: 6.5 },
            alternateRowStyles: { fillColor: [250, 252, 254] as [number, number, number] },
            columnStyles: {
                0: { fontStyle: 'bold', textColor: BRAND.purple },
                3: { halign: 'center' },
                4: { halign: 'right' },
                5: { fontStyle: 'bold', textColor: BRAND.red, halign: 'right' },
            },
            margin: { left: margin, right: margin },
        });
        y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    });

    // ── Pie: disclaimer informativo (sin bloque de firmas — no aplica a un
    // documento dirigido al cliente) + numeración de página.
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        drawLine(doc, margin, H - 18, W - margin, H - 18, BRAND.borderLight, 0.3);
        setFont(doc, 6, BRAND.textMuted);
        const disclaimerLines = doc.splitTextToSize(
            'Documento informativo — no constituye comprobante de pago válido para efectos tributarios.',
            contentW - 30
        ) as string[];
        doc.text(disclaimerLines, margin, H - 13);
        doc.text(`ID: ${reportId}`, margin, H - 5);
        doc.text(`Pág. ${p} / ${totalPages}`, W - margin, H - 5, { align: 'right' });
    }

    doc.save(`TerraLima_EstadoCuenta_${year}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.pdf`);
}
