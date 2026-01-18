import { Lot } from '@/app/data/lotsData';

export function exportToSvg(lots: Lot[], filename: string = 'mapa_renasur.svg') {
    if (!lots || lots.length === 0) {
        alert("No hay lotes para exportar.");
        return;
    }

    // 1. Calculate Bounding Box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    lots.forEach(lot => {
        if (lot.points && lot.points.length > 0) {
            lot.points.forEach(([x, y]) => {
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            });
        }
    });

    if (minX === Infinity) {
        alert("Los lotes seleccionados no tienen geometría.");
        return;
    }

    // Add some padding (e.g. 10 meters)
    const padding = 10;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const width = maxX - minX;
    const height = maxY - minY;

    // 2. Generate SVG Content
    // Note: SVG Y coordinates increase downwards. UTM Y increases upwards.
    // We need to transform Y: svgY = maxY - utmY (relative to bounding box)
    // Actually, simple viewbox is minX -minY (flipped?)
    // Let's stick to standard Cartesian:
    // To make it viewable in standard viewers, we usually flip Y.
    // SVG transform="scale(1, -1)" might be easier, but let's do manual calc.
    // svgX = x - minX
    // svgY = maxY - y  (Top of SVG is max Y of UTM)

    const paths = lots.map(lot => {
        if (!lot.points || lot.points.length === 0) return '';

        const d = lot.points.map((p, i) => {
            const x = p[0] - minX;
            const y = maxY - p[1];
            return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
        }).join(' ') + ' Z';

        // Colors
        let fill = '#cbd5e1'; // Default slate-300
        if (lot.x_statu === 'libre') fill = '#10B981'; // Emerald
        else if (lot.x_statu === 'separado') fill = '#F59E0B'; // Amber
        else if (lot.x_statu === 'vendido') fill = '#EF4444'; // Red

        return `<path d="${d}" fill="${fill}" stroke="white" stroke-width="0.5" id="${lot.id}" data-name="${lot.name}" />`;
    }).join('\n');

    const svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg width="${width.toFixed(2)}" height="${height.toFixed(2)}" viewBox="0 0 ${width.toFixed(2)} ${height.toFixed(2)}" xmlns="http://www.w3.org/2000/svg">
    <desc>Exported from Mapa Renasur</desc>
    <style>
        path { vector-effect: non-scaling-stroke; }
        path:hover { stroke: black; stroke-width: 1; }
    </style>
    <g>
        ${paths}
    </g>
</svg>`;

    // 3. Trigger Download
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
