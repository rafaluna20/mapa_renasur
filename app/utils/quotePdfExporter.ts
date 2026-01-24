import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { QuoteCalculations, financeService } from '../services/financeService';
import { Lot } from '../data/lotsData';
import { imageUrlToBase64 } from './imageHelper';

/**
 * Paleta de Colores Corporativa TERRA LIMA - Mejorada
 * Diseño monocromático armonioso basado en verde suave
 */
const COLORS = {
    // Verde TERRA LIMA (Más suave y profesional)
    primary: {
        main: [76, 153, 117] as [number, number, number],      // #4C9975 - Verde suave principal
        dark: [55, 125, 95] as [number, number, number],       // #377D5F - Verde oscuro para títulos
        medium: [95, 175, 140] as [number, number, number],    // #5FAF8C - Verde medio
        light: [140, 200, 170] as [number, number, number],    // #8CC8AA - Verde claro para acentos
        veryLight: [235, 247, 242] as [number, number, number], // #EBF7F2 - Fondo muy suave
        pale: [245, 252, 249] as [number, number, number]      // #F5FCF9 - Casi blanco con tinte verde
    },
    
    // Grises Neutros (más suaves)
    gray: {
        dark: [60, 70, 75] as [number, number, number],        // #3C464B - Texto principal
        medium: [100, 115, 120] as [number, number, number],   // #647378 - Texto secundario
        light: [180, 190, 195] as [number, number, number],    // #B4BEC3 - Bordes suaves
        veryLight: [240, 244, 246] as [number, number, number], // #F0F4F6 - Fondos alternos
        ultraLight: [250, 252, 253] as [number, number, number] // #FAFCFD - Casi blanco
    },
    
    // Acentos Armoniosos (tonos verdes)
    accent: {
        success: [85, 170, 130] as [number, number, number],   // #55AA82 - Para valores positivos
        info: [65, 135, 105] as [number, number, number],      // #418769 - Para información
        muted: [115, 145, 130] as [number, number, number]     // #739182 - Para descuentos suaves
    },
    
    // Utilidades
    white: [255, 255, 255] as [number, number, number],
    black: [45, 55, 60] as [number, number, number]            // #2D373C - Negro más suave
};

/**
 * Exporta una cotización a un archivo PDF profesional con diseño corporativo TERRA LIMA.
 * Utiliza jsPDF y jspdf-autotable para manejar tablas multi-página.
 */
export const exportQuoteToPdf = async (
    lot: Lot,
    calcs: QuoteCalculations,
    vendorName: string = 'No especificado',
    clientName?: string,
    returnBlob: boolean = false
): Promise<Blob | void> => {
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;

    // --- 1. ENCABEZADO CORPORATIVO ---
    // Banda lateral verde
    doc.setFillColor(...COLORS.primary.main);
    doc.rect(pageWidth - margin - 10, 10, 10, 25, 'F');
    
    // Logo TERRA LIMA
    let logoLoaded = false;
    try {
        const logoBase64 = await imageUrlToBase64('/terra-lima-logo.png');
        if (logoBase64 && logoBase64.startsWith('data:image/')) {
            doc.addImage(logoBase64, 'PNG', margin, 10, 50, 20);
            logoLoaded = true;
        }
    } catch (error) {
        console.info('Logo no disponible, usando texto corporativo');
    }
    
    // Fallback: texto si no hay logo
    if (!logoLoaded) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(...COLORS.primary.main);
        doc.text('TERRA LIMA', margin, 23);
    }

    // Información de la empresa
    const headerX = logoLoaded ? margin + 52 : margin + 42;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.gray.dark);
    doc.text('RENACIMIENTO DEL SUR SAC', headerX, 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.gray.medium);
    doc.text('RUC: 20508917717', headerX, 23);
    doc.text('Cel: 977 684 050', headerX, 27);
     

    // Fecha en el encabezado
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.gray.medium);
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-PE', {
        year: 'numeric',
        month: 'long',
        day: '2-digit'
    })}`, pageWidth - margin - 12, 18, { align: 'right' });

    // Línea separadora
    doc.setDrawColor(...COLORS.gray.light);
    doc.setLineWidth(0.5);
    doc.line(margin, 38, pageWidth - margin - 12, 38);

    // --- 2. TÍTULO PRINCIPAL ---
    const titleY = 40;
    
    // Barra de título con fondo verde
    doc.setFillColor(...COLORS.primary.main);
    doc.rect(margin, titleY - 6, pageWidth - (2 * margin) - 12, 12, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...COLORS.white);
    doc.text('COTIZACIÓN DEL LOTE', pageWidth / 2, titleY, { align: 'center' });

    // --- 3. INFORMACIÓN DEL PROYECTO ---
    const infoY = titleY + 15;
    
    // Título de sección
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary.dark);
    doc.text('INFORMACIÓN DEL PROYECTO', margin, infoY);

    // Caja con fondo suave
    const boxY = infoY + 3;
    doc.setFillColor(...COLORS.primary.veryLight);
    doc.setDrawColor(...COLORS.primary.main);
    doc.setLineWidth(0.5);
    doc.rect(margin, boxY, pageWidth - (2 * margin) - 12, 28, 'FD');

    autoTable(doc, {
        startY: boxY + 2,
        margin: { left: margin + 3, right: margin + 15 },
        theme: 'plain',
        body: [
            ['Proyecto:', 'HABILITACIÓN TERRA-LIMA', 'Manzana:', lot.x_mz || '-'],
            ['Lote:', lot.name, 'Etapa:', lot.x_etapa || '-'],
            ['Área Total:', `${lot.x_area} m²`, 'Asesor:', vendorName],
            ['Cliente:', clientName || 'No especificado', 'Estado:', lot.x_statu.toUpperCase()]
        ],
        styles: {
            fontSize: 9,
            cellPadding: 1.5,
            textColor: COLORS.gray.dark
        },
        columnStyles: {
            0: { fontStyle: 'bold', textColor: COLORS.gray.medium, cellWidth: 28 },
            1: { textColor: COLORS.gray.dark, cellWidth: 48 },
            2: { fontStyle: 'bold', textColor: COLORS.gray.medium, cellWidth: 28 },
            3: { textColor: COLORS.gray.dark }
        }
    });

    // --- 4. RESUMEN FINANCIERO ---
    const finalY = (doc as any).lastAutoTable.finalY + 12;

    // Título de sección
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary.dark);
    doc.text('DETALLE FINANCIERO', margin, finalY);

    // Calcular porcentaje de descuento
    const discountPercent = (calcs.discountAmount / calcs.originalPrice * 100).toFixed(2);

    autoTable(doc, {
        startY: finalY + 3,
        margin: { left: margin, right: margin + 15 },
        theme: 'grid',
        head: [[
            { content: 'Concepto', styles: { fillColor: COLORS.primary.main, textColor: COLORS.white } },
            { content: 'Monto (Soles)', styles: { fillColor: COLORS.primary.main, textColor: COLORS.white } }
        ]],
        body: [
            ['Precio de Lista', financeService.formatCurrency(calcs.originalPrice)],
            [
                { content: `Descuento Aplicado (${discountPercent}%)`, styles: { textColor: COLORS.accent.muted } },
                { content: `-${financeService.formatCurrency(calcs.discountAmount)}`, styles: { textColor: COLORS.accent.muted } }
            ],
            [
                { content: 'VALOR TOTAL DE VENTA', styles: { fontStyle: 'bold', fillColor: COLORS.primary.veryLight, textColor: COLORS.primary.dark, fontSize: 11 } },
                { content: financeService.formatCurrency(calcs.discountedPrice), styles: { fontStyle: 'bold', fillColor: COLORS.primary.veryLight, textColor: COLORS.primary.dark, fontSize: 11 } }
            ],
            ['Pago Inicial (A la firma)', financeService.formatCurrency(calcs.initialPayment)],
            [
                { content: 'SALDO A FINANCIAR', styles: { fontStyle: 'bold', textColor: COLORS.primary.main } },
                { content: financeService.formatCurrency(calcs.remainingBalance), styles: { fontStyle: 'bold', textColor: COLORS.primary.main } }
            ],
        ],
        styles: {
            fontSize: 10,
            cellPadding: 4,
            textColor: COLORS.gray.dark
        },
        headStyles: {
            fillColor: COLORS.primary.main,
            textColor: COLORS.white,
            fontStyle: 'bold',
            halign: 'center'
        },
        columnStyles: {
            0: { cellWidth: 80 },
            1: { halign: 'right', fontStyle: 'bold' }
        }
    });

    // Cuota mensual destacada
    const cuotaY = (doc as any).lastAutoTable.finalY + 8;
    const cuotaHeight = 18;
    
    // Caja destacada para cuota mensual (más suave)
    doc.setFillColor(...COLORS.primary.pale);
    doc.setDrawColor(...COLORS.primary.main);
    doc.setLineWidth(0.8);
    doc.roundedRect(margin, cuotaY, pageWidth - (2 * margin) - 12, cuotaHeight, 3, 3, 'FD');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.primary.dark);
    doc.text('CUOTA MENSUAL:', margin + 5, cuotaY + 7);
    
    doc.setFontSize(16);
    doc.setTextColor(...COLORS.primary.main);
    doc.text(financeService.formatCurrency(calcs.monthlyInstallment), margin + 5, cuotaY + 14);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.gray.medium);
    doc.text(`Plazo: ${calcs.installments.length} meses (${(calcs.installments.length / 12).toFixed(1)} años)`, pageWidth - margin - 75, cuotaY + 11);

    // --- 5. CRONOGRAMA DE PAGOS ---
    // Calcular posición correcta después de la caja de cuota mensual
    const tableY = cuotaY + cuotaHeight + 12;

    // Título de cronograma
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary.dark);
    doc.text(`CRONOGRAMA DE PAGOS - ${calcs.installments.length} CUOTAS`, margin, tableY);

    // Preparar datos: fila inicial + cuotas
    const tableBody: any[] = [
        // Fila de pago inicial
        [
            { content: '0', styles: { fontStyle: 'bold' as const } },
            { content: 'PAGO INICIAL', styles: { fontStyle: 'bold' as const, fillColor: COLORS.primary.veryLight } },
            { content: financeService.formatCurrency(calcs.initialPayment), styles: { textColor: COLORS.primary.main, fontStyle: 'bold' as const } },
            { content: financeService.formatCurrency(calcs.remainingBalance), styles: { textColor: COLORS.gray.medium } }
        ],
        // Cuotas mensuales
        ...calcs.installments.map(inst => [
            inst.number.toString(),
            financeService.formatDate(inst.date),
            financeService.formatCurrency(inst.amount),
            financeService.formatCurrency(inst.balance)
        ])
    ];

    autoTable(doc, {
        startY: tableY + 3,
        margin: { left: margin, right: margin + 15, bottom: 25 },
        head: [[
            { content: 'N°', styles: { fillColor: COLORS.primary.main, textColor: COLORS.white } },
            { content: 'Fecha de Vencimiento', styles: { fillColor: COLORS.primary.main, textColor: COLORS.white } },
            { content: 'Monto Cuota', styles: { fillColor: COLORS.primary.main, textColor: COLORS.white } },
            { content: 'Saldo Pendiente', styles: { fillColor: COLORS.primary.main, textColor: COLORS.white } }
        ]],
        body: tableBody,
        headStyles: {
            fillColor: COLORS.primary.main,
            textColor: COLORS.white,
            fontStyle: 'bold',
            halign: 'center',
            fontSize: 9
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 15, textColor: COLORS.gray.medium },
            1: { halign: 'left', cellWidth: 45 },
            2: { halign: 'right', fontStyle: 'bold', textColor: COLORS.primary.dark },
            3: { halign: 'right', textColor: COLORS.gray.medium }
        },
        styles: {
            fontSize: 8,
            cellPadding: 2.5,
            textColor: COLORS.gray.dark
        },
        alternateRowStyles: { fillColor: COLORS.gray.veryLight },
        didParseCell: (data: any) => {
            // Destacar última fila (saldo final = 0)
            if (data.row.index === tableBody.length - 1 && data.column.index === 3) {
                data.cell.styles.textColor = COLORS.primary.main;
                data.cell.styles.fontStyle = 'bold';
            }
        }
    });

    // --- PIE DE PÁGINA ---
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        
        // Línea superior del pie
        const footerY = doc.internal.pageSize.getHeight() - 18;
        doc.setDrawColor(...COLORS.gray.light);
        doc.setLineWidth(0.3);
        doc.line(margin, footerY, pageWidth - margin - 12, footerY);
        
        // Texto legal
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.gray.medium);
        doc.text(
            '* Este documento es informativa y no tiene validez legal sin firma y sello de la empresa.',
            pageWidth / 2,
            footerY + 5,
            { align: 'center' }
        );
        
        // Número de página
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.primary.main);
        doc.text(
            `Página ${i} de ${totalPages}`,
            pageWidth - margin - 12,
            footerY + 10,
            { align: 'right' }
        );
        
        // Logo pequeño en pie (opcional)
        doc.setFontSize(6);
        doc.setTextColor(...COLORS.gray.medium);
        doc.text('TERRA LIMA - RENACIMIENTO DEL SUR SAC', margin, footerY + 10);
    }

    // Descargar
    // Si se solicita Blob (para subir a Odoo), lo devolvemos
    if (returnBlob) {
        return doc.output('blob');
    }

    // Descargar por defecto
    doc.save(`Cotizacion_TerraLima_${lot.name.replace(/\s+/g, '_')}.pdf`);
};
