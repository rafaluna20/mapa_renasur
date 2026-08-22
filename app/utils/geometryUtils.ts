/**
 * Geometry calculation utilities for UTM coordinates
 * All calculations assume coordinates are in meters (UTM projection)
 */

import { ArcoMetadata } from '@/app/utils/arcoUtils';

export interface Point {
    x: number;
    y: number;
}

export interface LotMeasurements {
    sides: number[];              // Length of each side in meters
    area: number;                 // Area in square meters
    perimeter: number;            // Total perimeter in meters
    centroid: [number, number];   // Centroid coordinates [x, y]
}

/**
 * Calculate Euclidean distance between two UTM points
 * @param p1 - First point [x, y]
 * @param p2 - Second point [x, y]
 * @returns Distance in meters
 */
export function calculateDistance(
    p1: [number, number],
    p2: [number, number]
): number {
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate the midpoint between two coordinates
 * @param p1 - First point [x, y]
 * @param p2 - Second point [x, y]
 * @returns Midpoint coordinates [x, y]
 */
export function calculateMidpoint(
    p1: [number, number],
    p2: [number, number]
): [number, number] {
    return [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
}

/**
 * Calculate the length of each side of a polygon. Si `arcos` marca un lado
 * como curvo (ver x_geometry_arcos en Odoo), se usa su longitudArco real en
 * vez de la distancia recta entre los 2 vértices — mismo criterio que ya
 * usa colindanciasUtils.ts para el lado en la Memoria Descriptiva, para que
 * la etiqueta de longitud en el mapa (SideMeasurementTooltips) no muestre la
 * cuerda recta de un lado que en realidad es un arco.
 * @param coordinates - Array of polygon vertices [[x1, y1], [x2, y2], ...]
 * @returns Array of side lengths in meters
 */
export function calculateSideLengths(
    coordinates: [number, number][],
    arcos?: ArcoMetadata[]
): number[] {
    if (coordinates.length < 3) {
        return [];
    }

    const arcoPorIndice = new Map((arcos || []).map((a) => [a.indiceVertice, a]));
    const sides: number[] = [];
    const n = coordinates.length;

    for (let i = 0; i < n; i++) {
        const p1 = coordinates[i];
        const p2 = coordinates[(i + 1) % n]; // Wrap to first point
        const arco = arcoPorIndice.get(i);
        sides.push(arco ? arco.longitudArco : calculateDistance(p1, p2));
    }

    return sides;
}

/**
 * Calculate polygon area using the Shoelace formula
 * @param coordinates - Array of polygon vertices [[x1, y1], [x2, y2], ...]
 * @returns Area in square meters
 */
export function calculateArea(coordinates: [number, number][]): number {
    if (coordinates.length < 3) {
        return 0;
    }

    let area = 0;
    const n = coordinates.length;

    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += coordinates[i][0] * coordinates[j][1];
        area -= coordinates[j][0] * coordinates[i][1];
    }

    return Math.abs(area / 2);
}

/**
 * Calculate the perimeter of a polygon
 * @param coordinates - Array of polygon vertices [[x1, y1], [x2, y2], ...]
 * @returns Perimeter in meters
 */
export function calculatePerimeter(coordinates: [number, number][], arcos?: ArcoMetadata[]): number {
    const sides = calculateSideLengths(coordinates, arcos);
    return sides.reduce((sum, side) => sum + side, 0);
}

/**
 * Calculate the centroid (geometric center) of a polygon
 * @param coordinates - Array of polygon vertices [[x1, y1], [x2, y2], ...]
 * @returns Centroid coordinates [x, y]
 */
export function calculateCentroid(
    coordinates: [number, number][]
): [number, number] {
    if (coordinates.length === 0) {
        return [0, 0];
    }

    let sumX = 0;
    let sumY = 0;

    for (const [x, y] of coordinates) {
        sumX += x;
        sumY += y;
    }

    return [sumX / coordinates.length, sumY / coordinates.length];
}

/**
 * Calculate all measurements for a lot polygon
 * @param coordinates - Array of polygon vertices [[x1, y1], [x2, y2], ...]
 * @returns Complete measurements object
 */
export function calculateLotMeasurements(
    coordinates: [number, number][],
    arcos?: ArcoMetadata[]
): LotMeasurements {
    return {
        sides: calculateSideLengths(coordinates, arcos),
        area: calculateArea(coordinates),
        perimeter: calculatePerimeter(coordinates, arcos),
        centroid: calculateCentroid(coordinates),
    };
}

/**
 * Punto a una fracción de la longitud acumulada de una ruta (polilínea
 * abierta), más el ángulo de pantalla del tramo local ahí — se usa para
 * ubicar la etiqueta de nombre de una calle en su punto medio REAL (por
 * longitud recorrida, no el centro del bounding box, que para una calle
 * con recodos puede caer lejos del trazo) y orientarla en la dirección de
 * la calle.
 *
 * anguloDeg ya viene listo para `transform: rotate(${anguloDeg}deg)` en
 * CSS: el mapa siempre se dibuja norte-arriba (sin rotación), así que el
 * eje Y de pantalla es el inverso del eje Y (norte) de UTM — de ahí el
 * signo invertido en el atan2. Se normaliza a [-90°, 90°] para que el
 * texto nunca quede "cabeza abajo".
 *
 * @param coordinates - Vértices de la ruta en UTM (metros), en orden
 * @param fraccion - 0 a 1 (0.5 = punto medio, default)
 */
export function calcularPuntoYAnguloEnRuta(
    coordinates: [number, number][],
    fraccion: number = 0.5
): { punto: [number, number]; anguloDeg: number } {
    if (coordinates.length === 0) {
        return { punto: [0, 0], anguloDeg: 0 };
    }
    if (coordinates.length === 1) {
        return { punto: coordinates[0], anguloDeg: 0 };
    }

    const segLengths: number[] = [];
    let total = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
        const d = calculateDistance(coordinates[i], coordinates[i + 1]);
        segLengths.push(d);
        total += d;
    }

    if (total === 0) {
        return { punto: coordinates[0], anguloDeg: 0 };
    }

    const objetivo = total * Math.min(1, Math.max(0, fraccion));
    let acumulado = 0;
    for (let i = 0; i < segLengths.length; i++) {
        const d = segLengths[i];
        if (acumulado + d >= objetivo || i === segLengths.length - 1) {
            const t = d === 0 ? 0 : (objetivo - acumulado) / d;
            const [x1, y1] = coordinates[i];
            const [x2, y2] = coordinates[i + 1];
            const punto: [number, number] = [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];

            let anguloDeg = Math.atan2(-(y2 - y1), x2 - x1) * (180 / Math.PI);
            if (anguloDeg > 90) anguloDeg -= 180;
            if (anguloDeg < -90) anguloDeg += 180;

            return { punto, anguloDeg };
        }
        acumulado += d;
    }

    return { punto: coordinates[coordinates.length - 1], anguloDeg: 0 };
}

/**
 * Format a measurement value for display
 * @param value - Measurement value in meters
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with unit
 */
export function formatMeters(value: number, decimals: number = 2): string {
    return `${value.toFixed(decimals)}m`;
}

/**
 * Format area value for display
 * @param value - Area value in square meters
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with unit
 */
export function formatSquareMeters(
    value: number,
    decimals: number = 2
): string {
    return `${value.toFixed(decimals)}m²`;
}
