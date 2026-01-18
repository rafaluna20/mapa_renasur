import { jsPDF } from 'jspdf';
import * as htmlToImage from 'html-to-image';

/**
 * Exports a specific DOM element to a PDF file.
 * @param elementId The ID of the HTML element to export (e.g., the map container).
 * @param fileName The name of the resulting PDF file.
 */
export async function exportToPdf(elementId: string, fileName: string = 'mapa.pdf') {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error(`Element with id ${elementId} not found`);
        return;
    }

    try {
        // Use html-to-image which supports modern CSS (lab/oklch) better than html2canvas
        // pixelRatio: 2 improves quality (similar to scale: 2 in html2canvas)
        const imgData = await htmlToImage.toPng(element, {
            cacheBust: true,
            pixelRatio: 2,
            backgroundColor: '#ffffff' // Force white background
        });

        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgProps = pdf.getImageProperties(imgData);

        const ratio = Math.min(pdfWidth / imgProps.width, pdfHeight / imgProps.height);
        const w = imgProps.width * ratio;
        const h = imgProps.height * ratio;

        const x = (pdfWidth - w) / 2;
        const y = (pdfHeight - h) / 2;

        pdf.addImage(imgData, 'PNG', x, y, w, h);
        pdf.save(fileName);

    } catch (error) {
        console.error('Error exporting PDF:', error);
        alert('Hubo un error al generar el PDF. (Posible incompatibilidad de colores modernos).');
    }
}
