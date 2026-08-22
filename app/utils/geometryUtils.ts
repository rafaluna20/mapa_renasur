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
 * Deriva una línea central aproximada a partir de una ruta que en realidad
 * es un anillo CERRADO (primer y último vértice casi coincidentes) — caso
 * real observado en calles digitalizadas trazando un borde de la vía "de
 * ida" y volviendo por el otro "de vuelta", en vez de un solo eje central.
 * Sin este paso, calcularPuntosEtiquetaEnRuta calcula el punto medio por
 * longitud RECORRIDA del anillo completo, que cae exactamente sobre uno de
 * los dos bordes (mitad del anillo = fin del borde de ida), no en el
 * centro visual de la calle — el bug reportado ("la etiqueta se dibuja
 * justo encima de la polilínea").
 *
 * Si la ruta NO es un anillo cerrado (caso normal: un eje/línea de
 * referencia genuino, ej. capa "Líneas"), se devuelve tal cual — cero
 * cambio de comportamiento para el caso que ya funcionaba bien.
 *
 * Técnica: recorrer el anillo desde el inicio ("ida", 0% a 50% de la
 * longitud total) y desde el final hacia atrás ("vuelta", 100% a 50%) en
 * paralelo, muestreando por longitud (no por índice de vértice — robusto
 * aunque los dos bordes tengan densidades de puntos distintas) y promediar
 * cada par de puntos opuestos. En los extremos (0%/100%, donde ambos
 * bordes casi se tocan) y en la punta (50%, el punto de retorno del
 * anillo) el promedio colapsa naturalmente al punto correcto.
 */
export function derivarLineaCentralDeRutaCerrada(
    coordinates: [number, number][],
    muestras: number = 15
): [number, number][] {
    if (coordinates.length < 4) {
        return coordinates;
    }

    const esAnilloCerrado = calculateDistance(coordinates[0], coordinates[coordinates.length - 1]) < 0.5;
    if (!esAnilloCerrado) {
        return coordinates;
    }

    const central: [number, number][] = [];
    for (let i = 0; i < muestras; i++) {
        const t = i / (muestras - 1);
        const ida = calcularPuntoYAnguloEnRuta(coordinates, t * 0.5).punto;
        const vuelta = calcularPuntoYAnguloEnRuta(coordinates, 1 - t * 0.5).punto;
        central.push([(ida[0] + vuelta[0]) / 2, (ida[1] + vuelta[1]) / 2]);
    }
    return central;
}

/**
 * Cantidad de copias de etiqueta según el largo real de la calle — tabla
 * pedida explícitamente por el usuario, sin tope: <30m -> 1, <60m -> 2,
 * <100m -> 3, <200m -> 4, y de ahí en más una etiqueta adicional por cada
 * 200m extra (piso, no redondeo: recién se suma la etiqueta al completar
 * el tramo de 200m, no a mitad de camino). `limiteSeguridad` no es parte
 * del pedido — es solo un resguardo defensivo por si algún día una línea
 * llega con una longitud absurda por un error de datos (ej. unidades mal
 * cargadas); ninguna calle real de este proyecto se acerca a ese número.
 */
function contarEtiquetasSegunLargo(totalM: number, limiteSeguridad: number): number {
    let cantidad: number;
    if (totalM < 30) cantidad = 1;
    else if (totalM < 60) cantidad = 2;
    else if (totalM < 100) cantidad = 3;
    else if (totalM < 200) cantidad = 4;
    else cantidad = 4 + Math.floor((totalM - 200) / 200);
    return Math.min(cantidad, limiteSeguridad);
}

/**
 * Puntos (con ángulo) para poner varias copias de la etiqueta de nombre a
 * lo largo de una calle larga — con una sola etiqueta en el punto medio,
 * una calle que cruza buena parte del mapa puede quedar "sin nombre
 * visible" en la mitad de la pantalla mientras se navega/hace zoom. La
 * cantidad sale de contarEtiquetasSegunLargo; se reparten centradas en
 * esa cantidad de tramos iguales a lo largo de la ruta.
 */
export function calcularPuntosEtiquetaEnRuta(
    coordinates: [number, number][],
    opciones: { limiteSeguridad?: number } = {}
): { punto: [number, number]; anguloDeg: number }[] {
    const { limiteSeguridad = 60 } = opciones;

    if (coordinates.length === 0) {
        return [];
    }
    if (coordinates.length === 1) {
        return [{ punto: coordinates[0], anguloDeg: 0 }];
    }

    let total = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
        total += calculateDistance(coordinates[i], coordinates[i + 1]);
    }
    if (total === 0) {
        return [{ punto: coordinates[0], anguloDeg: 0 }];
    }

    const cantidad = contarEtiquetasSegunLargo(total, limiteSeguridad);
    const puntos: { punto: [number, number]; anguloDeg: number }[] = [];
    for (let i = 0; i < cantidad; i++) {
        const fraccion = (i + 0.5) / cantidad;
        puntos.push(calcularPuntoYAnguloEnRuta(coordinates, fraccion));
    }
    return puntos;
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
