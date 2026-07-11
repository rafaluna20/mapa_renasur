import { Lot } from '@/app/data/lotsData';
import { ElementoUrbano } from '@/app/data/elementosUrbanos';
import { calculateDistance, calculateMidpoint } from '@/app/utils/geometryUtils';

export interface ColindanciaDerivada {
    lado: 'frente' | 'fondo' | 'derecha' | 'izquierda';
    /** "lote" o el código de capa dinámico del elemento urbano (ver ElementoUrbano). */
    tipo: string;
    nombre: string;
    longitud: number;
}

export interface DimensionesDerivadas {
    frente: number;
    fondo: number;
    ladoDerecho: number;
    ladoIzquierdo: number;
    area: number;
    perimetro: number;
}

// Tolerancia para considerar que dos vértices son "el mismo punto" al buscar
// bordes compartidos entre lotes vecinos (pequeñas diferencias de digitación).
const TOLERANCIA_METROS = 0.5;

function puntosSonCercanos(p1: [number, number], p2: [number, number], tol = TOLERANCIA_METROS): boolean {
    return calculateDistance(p1, p2) <= tol;
}

function edgeCompartido(a: [number, number], b: [number, number], pts: [number, number][]): boolean {
    for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const q = pts[(i + 1) % pts.length];
        const mismoBorde =
            (puntosSonCercanos(a, p) && puntosSonCercanos(b, q)) ||
            (puntosSonCercanos(a, q) && puntosSonCercanos(b, p));
        if (mismoBorde) return true;
    }
    return false;
}

function encontrarVecino(
    a: [number, number],
    b: [number, number],
    lote: Lot,
    todosLosLotes: Lot[]
): Lot | null {
    for (const otro of todosLosLotes) {
        if (otro.id === lote.id) continue;
        if (!otro.points || otro.points.length < 3) continue;
        if (edgeCompartido(a, b, otro.points)) return otro;
    }
    return null;
}

// Busca si el lado (a,b) coincide con el borde de una calle/parque real. Se
// verifica DESPUÉS de encontrarVecino (lote): si el lado ya colinda con otro
// lote, no hace falta buscar aquí.
function encontrarVecinoUrbano(
    a: [number, number],
    b: [number, number],
    elementosUrbanos: ElementoUrbano[]
): ElementoUrbano | null {
    for (const elemento of elementosUrbanos) {
        if (!elemento.points || elemento.points.length < 3) continue;
        if (edgeCompartido(a, b, elemento.points)) return elemento;
    }
    return null;
}

interface Edge {
    index: number;
    a: [number, number];
    b: [number, number];
    longitud: number;
    midpoint: [number, number];
    vecinoLote: Lot | null;
    vecinoUrbano: ElementoUrbano | null;
}

// Ángulo agudo (0°-90°) entre las direcciones de dos aristas, ignorando el
// sentido de recorrido del polígono: una arista "antiparalela" a otra
// (misma línea, sentido contrario) es tan paralela geométricamente como una
// en el mismo sentido, por eso se usa |coseno|. 0° = paralelas, 90° =
// perpendiculares.
function anguloEntreAristas(
    edgeA: { a: [number, number]; b: [number, number] },
    edgeB: { a: [number, number]; b: [number, number] }
): number {
    const v1 = [edgeA.b[0] - edgeA.a[0], edgeA.b[1] - edgeA.a[1]];
    const v2 = [edgeB.b[0] - edgeB.a[0], edgeB.b[1] - edgeB.a[1]];
    const mag1 = Math.hypot(v1[0], v1[1]);
    const mag2 = Math.hypot(v2[0], v2[1]);
    if (mag1 === 0 || mag2 === 0) return 90; // arista degenerada (largo ~0): no debe "robar" el fondo
    const cos = (v1[0] * v2[0] + v1[1] * v2[1]) / (mag1 * mag2);
    const anguloRad = Math.acos(Math.min(1, Math.max(-1, Math.abs(cos))));
    return (anguloRad * 180) / Math.PI;
}

// Umbral para considerar una arista "paralela" al frente (candidata a
// fondo) vs "lateral" (candidata a derecha/izquierda). 45° es el punto
// medio natural entre paralelo (0°) y perpendicular (90°).
const UMBRAL_PARALELO_GRADOS = 45;

/**
 * Deriva colindancias (qué hay en cada lado: otro lote, calle o área verde)
 * y las dimensiones con nomenclatura frente/fondo/derecha/izquierda a
 * partir de la geometría real del lote, de todos los lotes del mapa, y
 * (opcional) de los elementos urbanos (calles/parques) con geometría real.
 *
 * Criterio de "frente" (en 3 niveles, de más a menos confiable):
 * 1. El lado que colinda con una capa de tipo "calle" real (elementosUrbanos).
 *    La longitud NO importa acá: el frente de un lote no es necesariamente
 *    el lado más largo, puede ser cualquiera — lo que lo hace frente es dar
 *    a la vía pública, no su tamaño. Si hay más de un lado con calle
 *    confirmada (lote de esquina con dos frentes), se usa la longitud SOLO
 *    como desempate entre esos candidatos, ya que la estructura actual
 *    permite un solo "frente" por lote.
 * 2. Si ningún lado tiene una calle confirmada todavía (su geometría real
 *    aún no se cargó en elemento_urbano_geometry): el lado más largo entre
 *    los que no colindan con otro lote — mismo criterio que se usaba antes
 *    de tener capas reales, como red de seguridad mientras se completa la
 *    digitalización de calles.
 * 3. Si el lote está completamente rodeado de otros lotes (caso anómalo):
 *    el lado más largo del polígono.
 *
 * Fondo/Derecha/Izquierda: caso general con N vecinos por lado. Ninguno de
 * los 3 se elige como una única arista "opuesta" por índice — eso solo
 * soporta un vecino por lado. En cambio, cada arista (menos el frente) se
 * clasifica primero por ÁNGULO respecto a la dirección del frente:
 * - "paralela" (dentro de UMBRAL_PARALELO_GRADOS de 0°/180°): candidata a
 *   fondo — en un lote razonablemente rectangular, el lado opuesto al
 *   frente corre en su misma dirección, sin importar cuántos vecinos lo
 *   dividan en tramos.
 * - "lateral" (más cerca de 90°): candidata a derecha/izquierda.
 * Luego se recorre el polígono en orden desde el frente con una máquina de
 * estados (derecha → fondo → izquierda, en ese orden, cada uno pudiendo
 * abarcar varias aristas contiguas): así un lote con, por ejemplo, 2 vecinos
 * de fondo, 2 de derecha y 3 de izquierda genera las 7 colindancias
 * correctas, cada una con su propio vecino — no solo una por lado.
 * Si NINGUNA arista cae dentro del umbral (polígono muy irregular), se usa
 * la de ángulo más chico como único fondo, para garantizar que "fondo"
 * nunca quede vacío (dimensiones.fondo es un número, no un arreglo).
 *
 * Para lotes de esquina o polígonos irregulares (más de 4 lados) puede
 * haber más de una colindancia por lado — es intencional, el schema de
 * plan_pro acepta un array.
 *
 * Si un lado no colinda con otro lote, se verifica contra elementosUrbanos
 * (calle/área verde reales) para obtener el nombre real de la vía/parque en
 * vez del texto genérico "Calle". Si tampoco hay coincidencia (todavía no
 * se cargó la geometría de esa calle), cae al comportamiento anterior.
 */
export function derivarColindanciasYDimensiones(
    lote: Lot,
    todosLosLotes: Lot[],
    elementosUrbanos: ElementoUrbano[] = []
): { colindancias: ColindanciaDerivada[]; dimensiones: DimensionesDerivadas } {
    const pts = lote.points;
    const n = pts.length;

    if (!pts || n < 3) {
        throw new Error(`El lote ${lote.default_code} no tiene geometría válida (menos de 3 vértices)`);
    }

    const edges: Edge[] = [];
    for (let i = 0; i < n; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % n];
        const vecinoLote = encontrarVecino(a, b, lote, todosLosLotes);
        edges.push({
            index: i,
            a,
            b,
            longitud: calculateDistance(a, b),
            midpoint: calculateMidpoint(a, b),
            vecinoLote,
            vecinoUrbano: vecinoLote ? null : encontrarVecinoUrbano(a, b, elementosUrbanos),
        });
    }

    const edgesCalleConfirmada = edges.filter((e) => e.vecinoUrbano?.tipo === 'calle');
    const edgesSinLote = edges.filter((e) => !e.vecinoLote);
    const candidatosFrente =
        edgesCalleConfirmada.length > 0 ? edgesCalleConfirmada
        : edgesSinLote.length > 0 ? edgesSinLote
        : edges;
    const frente = candidatosFrente.reduce((max, e) =>
        e.longitud > max.longitud ? e : max
    );

    // Orden de recorrido del polígono empezando justo después del frente.
    const ordenDesdeFrente: number[] = [];
    for (let paso = 1; paso < n; paso++) {
        ordenDesdeFrente.push((frente.index + paso) % n);
    }

    // Clasificar cada arista restante por ángulo respecto al frente (ver
    // anguloEntreAristas más arriba): "paralela" = candidata a fondo,
    // "lateral" = candidata a derecha/izquierda. Si ninguna califica
    // (polígono muy irregular), se usa la de menor ángulo como único fondo
    // — mismo respaldo que antes, para que fondo nunca quede vacío.
    const anguloPorIndice = new Map<number, number>(
        ordenDesdeFrente.map((idx) => [idx, anguloEntreAristas(frente, edges[idx])])
    );
    const paralelas = ordenDesdeFrente.filter((idx) => anguloPorIndice.get(idx)! <= UMBRAL_PARALELO_GRADOS);
    const indicesFondo = new Set(
        paralelas.length > 0
            ? paralelas
            : [ordenDesdeFrente.reduce((min, idx) => (anguloPorIndice.get(idx)! < anguloPorIndice.get(min)! ? idx : min))]
    );

    let ladoDerechoLongitud = 0;
    let ladoIzquierdoLongitud = 0;
    let fondoLongitud = 0;
    const colindancias: ColindanciaDerivada[] = [];

    const agregarColindancia = (edge: Edge, lado: ColindanciaDerivada['lado']) => {
        if (edge.vecinoLote) {
            colindancias.push({
                lado,
                tipo: 'lote',
                nombre: edge.vecinoLote.name || edge.vecinoLote.default_code,
                longitud: parseFloat(edge.longitud.toFixed(2)),
            });
        } else if (edge.vecinoUrbano) {
            colindancias.push({
                lado,
                tipo: edge.vecinoUrbano.tipo,
                nombre: edge.vecinoUrbano.nombre,
                longitud: parseFloat(edge.longitud.toFixed(2)),
            });
        } else {
            // Fallback: todavía no se cargó la geometría real de la
            // calle/parque de este lado — mismo comportamiento de antes.
            colindancias.push({
                lado,
                tipo: 'calle',
                nombre: 'Calle',
                longitud: parseFloat(edge.longitud.toFixed(2)),
            });
        }
    };

    agregarColindancia(frente, 'frente');

    // Máquina de estados recorriendo el polígono en orden desde el frente:
    // empieza en "derecha", pasa a "fondo" en cuanto aparece la primera
    // arista candidata (paralela), y a "izquierda" en cuanto esa racha
    // termina. Así fondo/derecha/izquierda admiten cada uno varias aristas
    // contiguas (varios vecinos), no solo una.
    let estado: ColindanciaDerivada['lado'] = 'derecha';
    ordenDesdeFrente.forEach((idx) => {
        const edge = edges[idx];
        const esFondoCandidata = indicesFondo.has(idx);

        if (estado === 'derecha' && esFondoCandidata) {
            estado = 'fondo';
        } else if (estado === 'fondo' && !esFondoCandidata) {
            estado = 'izquierda';
        }

        if (estado === 'derecha') ladoDerechoLongitud += edge.longitud;
        else if (estado === 'fondo') fondoLongitud += edge.longitud;
        else ladoIzquierdoLongitud += edge.longitud;

        agregarColindancia(edge, estado);
    });

    const area = lote.measurements?.area ?? lote.x_area;
    const perimetro = lote.measurements?.perimeter ?? edges.reduce((s, e) => s + e.longitud, 0);

    return {
        colindancias,
        dimensiones: {
            frente: parseFloat(frente.longitud.toFixed(2)),
            fondo: parseFloat(fondoLongitud.toFixed(2)),
            ladoDerecho: parseFloat(ladoDerechoLongitud.toFixed(2)),
            ladoIzquierdo: parseFloat(ladoIzquierdoLongitud.toFixed(2)),
            area,
            perimetro: parseFloat(perimetro.toFixed(2)),
        },
    };
}
