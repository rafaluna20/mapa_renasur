/**
 * Geometry calculation utilities for UTM coordinates
 * All calculations assume coordinates are in meters (UTM projection)
 */

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
 * Calculate the length of each side of a polygon
 * @param coordinates - Array of polygon vertices [[x1, y1], [x2, y2], ...]
 * @returns Array of side lengths in meters
 */
export function calculateSideLengths(
    coordinates: [number, number][]
): number[] {
    if (coordinates.length < 3) {
        return [];
    }

    const sides: number[] = [];
    const n = coordinates.length;

    for (let i = 0; i < n; i++) {
        const p1 = coordinates[i];
        const p2 = coordinates[(i + 1) % n]; // Wrap to first point
        sides.push(calculateDistance(p1, p2));
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
export function calculatePerimeter(coordinates: [number, number][]): number {
    const sides = calculateSideLengths(coordinates);
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
    coordinates: [number, number][]
): LotMeasurements {
    return {
        sides: calculateSideLengths(coordinates),
        area: calculateArea(coordinates),
        perimeter: calculatePerimeter(coordinates),
        centroid: calculateCentroid(coordinates),
    };
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
