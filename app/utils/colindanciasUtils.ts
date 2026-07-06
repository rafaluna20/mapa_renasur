import { Lot } from '@/app/data/lotsData';
import { calculateDistance, calculateMidpoint } from '@/app/utils/geometryUtils';

export interface ColindanciaDerivada {
    lado: 'frente' | 'fondo' | 'derecha' | 'izquierda';
    tipo: 'lote' | 'calle';
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

function edgeCompartidoConLote(a: [number, number], b: [number, number], otroLote: Lot): boolean {
    const pts = otroLote.points;
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
        if (edgeCompartidoConLote(a, b, otro)) return otro;
    }
    return null;
}

interface Edge {
    index: number;
    a: [number, number];
    b: [number, number];
    longitud: number;
    midpoint: [number, number];
    vecino: Lot | null;
}

/**
 * Deriva colindancias (qué hay en cada lado: otro lote o calle) y las
 * dimensiones con nomenclatura frente/fondo/derecha/izquierda a partir de
 * la geometría real del lote y de todos los lotes del mapa.
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
 */
export function derivarColindanciasYDimensiones(
    lote: Lot,
    todosLosLotes: Lot[]
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
        edges.push({
            index: i,
            a,
            b,
            longitud: calculateDistance(a, b),
            midpoint: calculateMidpoint(a, b),
            vecino: encontrarVecino(a, b, lote, todosLosLotes),
        });
    }

    const edgesCalle = edges.filter((e) => !e.vecino);
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
        colindancias.push({
            lado,
            tipo: edge.vecino ? 'lote' : 'calle',
            nombre: edge.vecino ? edge.vecino.name || edge.vecino.default_code : 'Calle',
            longitud: parseFloat(edge.longitud.toFixed(2)),
        });
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
