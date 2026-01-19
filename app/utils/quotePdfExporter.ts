import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { QuoteCalculations, financeService } from '../services/financeService';
import { Lot } from '../data/lotsData';

/**
 * Exporta una cotización a un archivo PDF profesional.
 * Utiliza jsPDF y jspdf-autotable para manejar tablas multi-página.
 */
export const exportQuoteToPdf = async (lot: Lot, calcs: QuoteCalculations, vendorName: string = 'No especificado') => {
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;

    // --- 1. ENCABEZADO ---
    // Simulación de Logo y Título
    doc.setFillColor(79, 70, 229); // Indigo 600
    doc.rect(margin, 15, 10, 10, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59); // Slate 800
    doc.text('RENASUR', margin + 14, 23);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-PE')}`, pageWidth - margin, 22, { align: 'right' });

    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.line(margin, 30, pageWidth - margin, 30);

    // --- 2. TÍTULO DE DOCUMENTO ---
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(79, 70, 229);
    doc.text('COTIZACIÓN PRELIMINAR DE LOTE', margin, 45);

    // --- 3. INFORMACIÓN DEL LOTE ---
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('DETALLES DEL PROYECTO', margin, 55);

    autoTable(doc, {
        startY: 58,
        margin: { left: margin, right: margin },
        theme: 'plain',
        body: [
            ['Proyecto:', 'Condominio Renasur', 'Manzana:', lot.x_mz || '-'],
            ['Lote:', lot.name, 'Etapa:', lot.x_etapa || '-'],
            ['Área Total:', `${lot.x_area} m²`, 'Asesor:', vendorName],
            ['Estado Lote:', lot.x_statu.toUpperCase(), '', '']
        ],
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: {
            0: { fontStyle: 'bold', textColor: [71, 85, 105], cellWidth: 30 },
            1: { textColor: [30, 41, 59], cellWidth: 50 },
            2: { fontStyle: 'bold', textColor: [71, 85, 105], cellWidth: 30 },
            3: { textColor: [30, 41, 59] }
        }
    });

    // --- 4. RESUMEN FINANCIERO ---
    const finalY = (doc as any).lastAutoTable.finalY + 10;

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('RESUMEN FINANCIERO', margin, finalY);

    autoTable(doc, {
        startY: finalY + 3,
        margin: { left: margin, right: margin },
        theme: 'grid',
        head: [['Concepto', 'Monto (Soles)']],
        body: [
            ['Precio de Lista', financeService.formatCurrency(calcs.originalPrice)],
            [`Descuento Aplicado (${(calcs.discountAmount / calcs.originalPrice * 100).toFixed(1)}%)`, `-${financeService.formatCurrency(calcs.discountAmount)}`],
            [{ content: 'VALOR TOTAL DE VENTA', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } }, { content: financeService.formatCurrency(calcs.discountedPrice), styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } }],
            ['Pago Inicial (A la firma)', financeService.formatCurrency(calcs.initialPayment)],
            [{ content: 'SALDO A FINANCIAR', styles: { fontStyle: 'bold', textColor: [79, 70, 229] } }, { content: financeService.formatCurrency(calcs.remainingBalance), styles: { fontStyle: 'bold', textColor: [79, 70, 229] } }],
        ],
        styles: { fontSize: 10, cellPadding: 4 },
        headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255] },
        columnStyles: {
            1: { halign: 'right', fontStyle: 'bold' }
        }
    });

    // --- 5. TABLA DE CUOTAS ---
    const tableY = (doc as any).lastAutoTable.finalY + 15;

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`CRONOGRAMA DE PAGOS (${calcs.installments.length} CUOTAS)`, margin, tableY);

    autoTable(doc, {
        startY: tableY + 3,
        margin: { left: margin, right: margin, bottom: 20 },
        head: [['N°', 'Fecha de Vencimiento', 'Monto Cuota', 'Saldo Pendiente']],
        body: calcs.installments.map(inst => [
            inst.number.toString(),
            financeService.formatDate(inst.date),
            financeService.formatCurrency(inst.amount),
            financeService.formatCurrency(inst.balance)
        ]),
        headStyles: { fillColor: [79, 70, 229], halign: 'center' },
        columnStyles: {
            0: { halign: 'center', cellWidth: 15 },
            1: { halign: 'left' },
            2: { halign: 'right', fontStyle: 'bold' },
            3: { halign: 'right' }
        },
        styles: { fontSize: 8, cellPadding: 2 },
        alternateRowStyles: { fillColor: [249, 250, 251] }
    });

    // --- Pie de página (se añade en cada página) ---
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
            `* Este documento es una simulación informativa y no tiene validez legal sin firma y sello de la empresa. Página ${i} de ${totalPages}`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: 'center' }
        );
    }

    // Descargar
    doc.save(`Cotizacion_Renasur_${lot.name.replace(/\s+/g, '_')}.pdf`);
};
