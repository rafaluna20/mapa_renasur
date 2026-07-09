import { Lot } from '@/app/data/lotsData';
import { ElementoUrbano } from '@/app/data/elementosUrbanos';
import { calculateDistance, calculateMidpoint } from '@/app/utils/geometryUtils';

export interface ColindanciaDerivada {
    lado: 'frente' | 'fondo' | 'derecha' | 'izquierda';
    tipo: 'lote' | 'calle' | 'area_verde';
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

/**
 * Deriva colindancias (qué hay en cada lado: otro lote, calle o área verde)
 * y las dimensiones con nomenclatura frente/fondo/derecha/izquierda a
 * partir de la geometría real del lote, de todos los lotes del mapa, y
 * (opcional) de los elementos urbanos (calles/parques) con geometría real.
 *
 * Heurística (no hay dato de negocio que diga "cuál lado es el frente"):
 * - Frente = el lado más largo entre los que NO colindan con otro lote
 *   (asumiendo que el frente da a una calle).
 * - Fondo = el lado restante geométricamente más opuesto al frente.
 * - Derecha/Izquierda = el resto, clasificado por el signo del producto
 *   cruzado respecto a la dirección del frente.
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

    const edgesCalle = edges.filter((e) => !e.vecinoLote);
    const frente = (edgesCalle.length > 0 ? edgesCalle : edges).reduce((max, e) =>
        e.longitud > max.longitud ? e : max
    );

    // Fondo = la arista topológicamente opuesta al frente (a mitad de camino
    // recorriendo el polígono), no la geométricamente "más lejana" por
    // distancia de punto medio. Verificado con datos reales: en un lote con
    // forma de paralelogramo, una arista ADYACENTE al frente puede tener su
    // punto medio más lejos que la arista realmente opuesta, dando un fondo
    // incorrecto (topológicamente pegado al frente) y dejando todo el resto
    // de lados del mismo lado (derecha vacío).
    const indiceFondo = (frente.index + Math.round(n / 2)) % n;
    const fondo = edges[indiceFondo];

    let ladoDerechoLongitud = 0;
    let ladoIzquierdoLongitud = 0;
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
    agregarColindancia(fondo, 'fondo');

    // Clasificar el resto por orden de recorrido del polígono (topológico, no
    // geométrico): caminando desde el frente hacia el fondo en un sentido son
    // "derecha", caminando desde el fondo de vuelta al frente son "izquierda".
    // Un producto cruzado relativo al punto medio del frente no sirve aquí:
    // para polígonos reales dio el mismo signo en ambos lados (verificado).
    const ordenDesdeFrente: number[] = [];
    for (let paso = 1; paso < n; paso++) {
        ordenDesdeFrente.push((frente.index + paso) % n);
    }
    const posicionFondo = ordenDesdeFrente.indexOf(fondo.index);

    ordenDesdeFrente.forEach((idx, posicion) => {
        if (idx === fondo.index) return;
        const edge = edges[idx];
        const lado: ColindanciaDerivada['lado'] = posicion < posicionFondo ? 'derecha' : 'izquierda';
        if (lado === 'derecha') ladoDerechoLongitud += edge.longitud;
        else ladoIzquierdoLongitud += edge.longitud;
        agregarColindancia(edge, lado);
    });

    const area = lote.measurements?.area ?? lote.x_area;
    const perimetro = lote.measurements?.perimeter ?? edges.reduce((s, e) => s + e.longitud, 0);

    return {
        colindancias,
        dimensiones: {
            frente: parseFloat(frente.longitud.toFixed(2)),
            fondo: parseFloat(fondo.longitud.toFixed(2)),
            ladoDerecho: parseFloat(ladoDerechoLongitud.toFixed(2)),
            ladoIzquierdo: parseFloat(ladoIzquierdoLongitud.toFixed(2)),
            area,
            perimetro: parseFloat(perimetro.toFixed(2)),
        },
    };
}
