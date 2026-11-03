import { Lot } from '@/app/data/lotsData';
import { ElementoUrbano } from '@/app/data/elementosUrbanos';
import { calculateDistance, calculateMidpoint } from '@/app/utils/geometryUtils';
import { ArcoMetadata, buscarArcoPorIndice } from '@/app/utils/arcoUtils';

export interface ColindanciaDerivada {
    lado: 'frente' | 'fondo' | 'derecha' | 'izquierda';
    /** "lote" o el código de capa dinámico del elemento urbano (ver ElementoUrbano). */
    tipo: string;
    nombre: string;
    longitud: number;
    /** Presente solo si este lado es un arco de circunferencia (ver ArcoMetadata). */
    radio?: number;
    longitudArco?: number;
    sentido?: 'horario' | 'antihorario';
    /**
     * true cuando NO se pudo identificar a qué colinda este tramo y el texto
     * ("Calle") es solo un marcador de posición para no dejar el documento
     * en blanco — no es un dato verificado. Es una señal INTERNA: no viaja a
     * plan_pro (ver planoPayloadBuilder) ni aparece en el PDF; sirve para
     * avisar al staff que lo revise.
     */
    sinConfirmar?: boolean;
}

/**
 * Algo que el staff debe revisar antes de entregar el documento. No bloquea
 * la generación (decisión del negocio: avisar para poder corregir).
 */
export interface AdvertenciaColindancia {
    /**
     * - lado_sin_clasificar: un tramo no se pudo identificar (marcador "Calle").
     * - inconsistencia: una verificación interna falló — suele indicar un bug
     *   del algoritmo o geometría rara, no un dato faltante.
     */
    tipo: 'lado_sin_clasificar' | 'inconsistencia';
    mensaje: string;
    lado?: ColindanciaDerivada['lado'];
    longitud?: number;
}

export interface DimensionesDerivadas {
    frente: number;
    fondo: number;
    ladoDerecho: number;
    ladoIzquierdo: number;
    area: number;
    perimetro: number;
}

// ─── Tolerancias (cada una con su propio nombre y razón de ser) ──────────
// Antes había una sola (0.5 m) para todo: vértices, contornos y lados
// diminutos. Separarlas permite ajustar una sin tocar las demás.

/** Dos vértices (de lotes distintos) son "el mismo punto": holgura de digitación. */
const TOL_VERTICE_METROS = 0.5;

/** Un lado "descansa sobre" un contorno (de lote o elemento urbano) si lo roza a <= esto. */
const TOL_CONTORNO_METROS = 0.5;

/** Por debajo de este largo un lado se considera degenerado (vértice repetido). */
const LARGO_MINIMO_LADO_METROS = 0.01;

/**
 * Cobertura entre lotes: una arista vecina solo cuenta si es casi paralela al
 * lado. Descarta aristas que cruzan o tocan en ángulo (lados perpendiculares).
 */
const ANGULO_MAX_COBERTURA_GRADOS = 10;

/**
 * Cobertura entre lotes: tramo mínimo (m) que debe compartirse para contar
 * como colindancia. Descarta el roce de una esquina.
 */
const SOLAPE_MINIMO_METROS = 0.1;

/**
 * Un tramo de un lado sin cubrir por ningún lote, menor a esto, es holgura de
 * digitación (ej. 4.82 + 1.27 = 6.09 sobre un lado de 6.10): se absorbe en el
 * tramo contiguo en vez de inventar una colindancia de centímetros.
 */
const HUECO_MINIMO_METROS = 0.25;

/** Lado más corto que esto = vértice casi repetido: se imprime tal cual, sin pedir revisión. */
const LADO_DESPRECIABLE_METROS = 0.5;

/** La verificación cruzada de lados sin clasificar solo se aplica a tramos de al menos este largo. */
const LARGO_AUDITABLE_METROS = 1.0;

function puntosSonCercanos(p1: [number, number], p2: [number, number], tol = TOL_VERTICE_METROS): boolean {
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

/**
 * Coincidencia EXACTA: otro lote con una arista cuyos dos extremos coinciden
 * con los del lado (el caso histórico, el 100% de lo que ya se reconocía).
 *
 * Si hubiera más de uno (geometría duplicada), gana el de menor código — el
 * resultado ya no depende del orden en que vengan los lotes del arreglo.
 */
function encontrarVecinoExacto(
    a: [number, number],
    b: [number, number],
    lote: Lot,
    todosLosLotes: Lot[]
): Lot | null {
    let mejor: Lot | null = null;
    for (const otro of todosLosLotes) {
        if (otro.id === lote.id) continue;
        if (!otro.points || otro.points.length < 3) continue;
        if (edgeCompartido(a, b, otro.points) && (!mejor || otro.default_code < mejor.default_code)) {
            mejor = otro;
        }
    }
    return mejor;
}

type Punto = [number, number];

/** Parte de un lado [desde, hasta] (metros medidos desde su primer extremo) pegada a un lote. */
interface CoberturaLote {
    lote: Lot;
    desde: number;
    hasta: number;
}

/** Une intervalos que se tocan o se solapan (con 5 cm de holgura numérica). */
function fusionarIntervalos(intervalos: [number, number][]): [number, number][] {
    const ordenados = [...intervalos].sort((x, y) => x[0] - y[0]);
    const fusionados: [number, number][] = [];
    for (const [t0, t1] of ordenados) {
        const ultimo = fusionados[fusionados.length - 1];
        if (ultimo && t0 <= ultimo[1] + 0.05) ultimo[1] = Math.max(ultimo[1], t1);
        else fusionados.push([t0, t1]);
    }
    return fusionados;
}

/**
 * Qué partes del lado (a,b) descansan sobre el contorno de `otro`.
 *
 * Es la pieza que faltaba para el "encuentro en T": un lado de 4.66 m que va
 * por la mitad del borde de 6 m de un vecino comparte UN vértice con él, no
 * los dos, así que encontrarVecinoExacto no lo ve (caso real E01MZR049P: su
 * fondo, 4.66 m contra R42 y 2.00 m contra R41, salía como "Calle").
 *
 * Para cada arista del vecino casi paralela al lado (ANGULO_MAX_COBERTURA_
 * GRADOS) se proyecta sobre el lado, se recorta a [0, largo] y se exige que
 * ambos extremos del tramo recortado queden a <= TOL_CONTORNO_METROS de la
 * arista y que el solape sea >= SOLAPE_MINIMO_METROS.
 */
function coberturaDeLado(a: Punto, b: Punto, otro: Lot): [number, number][] {
    const largo = calculateDistance(a, b);
    const ux = (b[0] - a[0]) / largo;
    const uy = (b[1] - a[1]) / largo;
    const intervalos: [number, number][] = [];
    const pts = otro.points;

    for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const q = pts[(i + 1) % pts.length];
        const largoArista = calculateDistance(p, q);
        if (largoArista < LARGO_MINIMO_LADO_METROS) continue;

        const cosAngulo = Math.abs(((q[0] - p[0]) * ux + (q[1] - p[1]) * uy) / largoArista);
        const anguloGrados = (Math.acos(Math.min(1, cosAngulo)) * 180) / Math.PI;
        if (anguloGrados > ANGULO_MAX_COBERTURA_GRADOS) continue;

        // Posición a lo largo del lado (t) y distancia perpendicular a su recta (n).
        const tp = (p[0] - a[0]) * ux + (p[1] - a[1]) * uy;
        const tq = (q[0] - a[0]) * ux + (q[1] - a[1]) * uy;
        const np = -(p[0] - a[0]) * uy + (p[1] - a[1]) * ux;
        const nq = -(q[0] - a[0]) * uy + (q[1] - a[1]) * ux;
        if (Math.abs(tq - tp) < 1e-9) continue;

        const t0 = Math.max(0, Math.min(tp, tq));
        const t1 = Math.min(largo, Math.max(tp, tq));
        if (t1 - t0 < SOLAPE_MINIMO_METROS) continue;

        const distanciaPerpendicularEn = (t: number) => Math.abs(np + ((nq - np) * (t - tp)) / (tq - tp));
        if (distanciaPerpendicularEn(t0) <= TOL_CONTORNO_METROS && distanciaPerpendicularEn(t1) <= TOL_CONTORNO_METROS) {
            intervalos.push([t0, t1]);
        }
    }
    return fusionarIntervalos(intervalos);
}

interface Caja { minX: number; maxX: number; minY: number; maxY: number }
const cajasCache = new WeakMap<object, Caja>();

/** Caja envolvente de un polígono (cacheada por arreglo de puntos). */
function cajaEnvolvente(pts: Punto[]): Caja {
    let caja = cajasCache.get(pts);
    if (!caja) {
        caja = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
        for (const [x, y] of pts) {
            if (x < caja.minX) caja.minX = x;
            if (x > caja.maxX) caja.maxX = x;
            if (y < caja.minY) caja.minY = y;
            if (y > caja.maxY) caja.maxY = y;
        }
        cajasCache.set(pts, caja);
    }
    return caja;
}

function puntoCercaDeCaja(p: Punto, c: Caja): boolean {
    return (
        p[0] >= c.minX - TOL_CONTORNO_METROS &&
        p[0] <= c.maxX + TOL_CONTORNO_METROS &&
        p[1] >= c.minY - TOL_CONTORNO_METROS &&
        p[1] <= c.maxY + TOL_CONTORNO_METROS
    );
}

/** Un pedazo de un lado y a qué colinda. La suma de los tramos de un lado = su longitud. */
interface Tramo {
    longitud: number;
    vecinoLote: Lot | null;
    vecinoUrbano: ElementoUrbano | null;
    /** Extremos del tramo (para la verificación cruzada de lados sin clasificar). */
    inicio: Punto;
    fin: Punto;
}

function puntoEnLado(a: Punto, b: Punto, t: number, largo: number): Punto {
    const k = largo === 0 ? 0 : t / largo;
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
}

/**
 * Divide un lado en tramos según con qué colinda cada parte.
 *
 * 1. Coincidencia exacta con un lote → un solo tramo (comportamiento histórico).
 * 2. Si no: cobertura por lotes (ver coberturaDeLado). Puede salir 1 lote que
 *    cubre parte del lado, o varios lotes seguidos (un lado de 6.09 m contra
 *    dos vecinos: 1.27 m + 4.82 m).
 * 3. Lo que ningún lote cubre (huecos >= HUECO_MINIMO_METROS) se busca entre
 *    calles/parques; si tampoco, queda SIN CLASIFICAR (vecinos nulos).
 *
 * Los lados curvos (arco) no pasan por la cobertura: es un cálculo de
 * segmentos rectos y la longitud real del lado es la del arco.
 */
function construirTramos(
    a: Punto,
    b: Punto,
    longitud: number,
    esArco: boolean,
    lote: Lot,
    todosLosLotes: Lot[],
    elementosUrbanos: ElementoUrbano[]
): Tramo[] {
    const exacto = encontrarVecinoExacto(a, b, lote, todosLosLotes);
    if (exacto) return [{ longitud, vecinoLote: exacto, vecinoUrbano: null, inicio: a, fin: b }];

    const chord = calculateDistance(a, b);
    const cubiertos: CoberturaLote[] = [];
    if (!esArco && chord >= LARGO_MINIMO_LADO_METROS) {
        const minX = Math.min(a[0], b[0]) - TOL_CONTORNO_METROS;
        const maxX = Math.max(a[0], b[0]) + TOL_CONTORNO_METROS;
        const minY = Math.min(a[1], b[1]) - TOL_CONTORNO_METROS;
        const maxY = Math.max(a[1], b[1]) + TOL_CONTORNO_METROS;
        for (const otro of todosLosLotes) {
            if (otro.id === lote.id) continue;
            if (!otro.points || otro.points.length < 3) continue;
            // Descarte rápido por caja envolvente: casi ningún lote está cerca.
            const caja = cajaEnvolvente(otro.points);
            if (caja.maxX < minX || caja.minX > maxX || caja.maxY < minY || caja.minY > maxY) continue;
            for (const [desde, hasta] of coberturaDeLado(a, b, otro)) cubiertos.push({ lote: otro, desde, hasta });
        }
    }

    if (cubiertos.length === 0) {
        return [{ longitud, vecinoLote: null, vecinoUrbano: encontrarVecinoUrbano(a, b, elementosUrbanos), inicio: a, fin: b }];
    }

    // Orden determinista (por posición y luego por código); si dos lotes se
    // solapan en el mismo tramo (geometría superpuesta), el segundo cede lo que
    // ya se asignó al primero.
    cubiertos.sort((x, y) => x.desde - y.desde || (x.lote.default_code < y.lote.default_code ? -1 : 1));

    interface Segmento { t0: number; t1: number; lote: Lot | null }
    const segmentos: Segmento[] = [];
    let cursor = 0;
    for (const c of cubiertos) {
        const desde = Math.max(c.desde, cursor);
        if (c.hasta - desde < SOLAPE_MINIMO_METROS) continue;
        const hueco = desde - cursor;
        let inicio = desde;
        if (hueco >= HUECO_MINIMO_METROS) {
            segmentos.push({ t0: cursor, t1: desde, lote: null });
        } else if (hueco > 0) {
            // Holgura de digitación: se absorbe, no es una colindancia.
            if (segmentos.length) segmentos[segmentos.length - 1].t1 = desde;
            else inicio = cursor;
        }
        segmentos.push({ t0: inicio, t1: c.hasta, lote: c.lote });
        cursor = c.hasta;
    }
    const resto = chord - cursor;
    if (resto >= HUECO_MINIMO_METROS) segmentos.push({ t0: cursor, t1: chord, lote: null });
    else if (segmentos.length) segmentos[segmentos.length - 1].t1 = chord;

    return segmentos.map((s) => {
        const p0 = puntoEnLado(a, b, s.t0, chord);
        const p1 = puntoEnLado(a, b, s.t1, chord);
        return {
            longitud: s.t1 - s.t0,
            vecinoLote: s.lote,
            vecinoUrbano: s.lote ? null : encontrarVecinoUrbano(p0, p1, elementosUrbanos),
            inicio: p0,
            fin: p1,
        };
    });
}

// Distancia de un punto al segmento p-q (no a la recta infinita).
function distanciaPuntoSegmento(pt: [number, number], p: [number, number], q: [number, number]): number {
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const largo2 = dx * dx + dy * dy;
    const t = largo2 === 0 ? 0 : Math.max(0, Math.min(1, ((pt[0] - p[0]) * dx + (pt[1] - p[1]) * dy) / largo2));
    return Math.hypot(pt[0] - (p[0] + t * dx), pt[1] - (p[1] + t * dy));
}

function distanciaPuntoContorno(pt: [number, number], pts: [number, number][]): number {
    let min = Infinity;
    for (let i = 0; i < pts.length; i++) {
        min = Math.min(min, distanciaPuntoSegmento(pt, pts[i], pts[(i + 1) % pts.length]));
    }
    return min;
}

/**
 * El lado (a,b) "descansa sobre" el contorno de un polígono si sus dos
 * extremos Y su punto medio caen a <= TOL_CONTORNO_METROS de ese contorno.
 *
 * edgeCompartido (arriba) exige que el polígono tenga un VÉRTICE en cada
 * esquina del lado: eso solo pasa si quien digitalizó puso un vértice de la
 * calle justo en cada esquina de cada lote. Una calle digitalizada con
 * tramos rectos largos no los tiene, así que un lote pegado exactamente a su
 * borde (0.00 m) quedaba sin calle reconocida y se imprimía "Calle" genérica
 * (caso real E01MZR015P: el lado de 6 m está a 0.00 m del contorno de
 * "calle 12" pero esa calle no tiene vértices ahí). El punto medio evita el
 * falso positivo de un lado perpendicular que apenas toca la calle con un
 * solo extremo.
 */
function ladoSobreContorno(a: [number, number], b: [number, number], pts: [number, number][]): boolean {
    // Un "lado" de largo ~0 (vértice duplicado en la geometría) tiene los tres
    // puntos en el mismo lugar: cualquier calle que pase por ahí lo daría por
    // colindante y aparecería como un tramo de frente de 0 m (visto en
    // E02MZW022P). No es un lado real: nunca coincide con nada.
    if (calculateDistance(a, b) < LARGO_MINIMO_LADO_METROS) return false;
    const medio: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    return [a, b, medio].every((p) => distanciaPuntoContorno(p, pts) <= TOL_CONTORNO_METROS);
}

// Busca si el lado (a,b) colinda con una calle/parque real. Se verifica
// DESPUÉS de encontrarVecino (lote): si el lado ya colinda con otro lote, no
// hace falta buscar aquí.
//
// Primero la coincidencia exacta de vértices (el comportamiento histórico:
// todo lo que ya se reconocía se sigue reconociendo igual) y solo si no hay
// ninguna, la coincidencia geométrica de ladoSobreContorno. Si el lado toca
// a la vez una calle y otro elemento (ej. una franja de jardín solapada),
// gana la calle: es lo que define el frente.
function encontrarVecinoUrbano(
    a: [number, number],
    b: [number, number],
    elementosUrbanos: ElementoUrbano[]
): ElementoUrbano | null {
    const validos = elementosUrbanos.filter((e) => e.points && e.points.length >= 3);
    const exactos = validos.filter((e) => edgeCompartido(a, b, e.points));
    const candidatos = exactos.length > 0 ? exactos : validos.filter((e) => ladoSobreContorno(a, b, e.points));
    return candidatos.find((e) => e.tipo === 'calle') ?? candidatos[0] ?? null;
}

interface Edge {
    index: number;
    a: [number, number];
    b: [number, number];
    longitud: number;
    midpoint: [number, number];
    /** A qué colinda cada parte del lado (1 tramo en el caso normal). */
    tramos: Tramo[];
    /** Algún tramo colinda con un lote. */
    tieneLote: boolean;
    /** Algún tramo no colinda con nada reconocido (se imprimirá como "Calle" sin confirmar). */
    tieneSinConfirmar: boolean;
    /** Resumen: el elemento urbano del lado (la calle si hay varios); null si no hay. */
    vecinoUrbano: ElementoUrbano | null;
    /** Presente si este lado es un arco de circunferencia (ver x_geometry_arcos en Odoo). */
    arco?: ArcoMetadata;
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
 * De las aristas candidatas a "fondo" (paralelas al frente por ángulo), se
 * queda solo con el tramo CONTIGUO (en el orden de recorrido desde el
 * frente) de mayor longitud total — no la primera que aparece, ni la de
 * más aristas. Ver nota completa donde se llama, en
 * derivarColindanciasYDimensiones: sin esto, una arista corta y aislada
 * que por ángulo también califica como "paralela" le roba el turno de
 * fondo a la que en realidad es el lado opuesto real, y descuadra toda la
 * clasificación de derecha/izquierda que viene después.
 */
function mayorTramoContiguo(
    ordenDesdeFrente: number[],
    paralelas: number[],
    edges: Edge[]
): number[] {
    const esParalela = new Set(paralelas);
    const tramos: number[][] = [];
    let actual: number[] = [];
    for (const idx of ordenDesdeFrente) {
        if (esParalela.has(idx)) {
            actual.push(idx);
        } else if (actual.length > 0) {
            tramos.push(actual);
            actual = [];
        }
    }
    if (actual.length > 0) tramos.push(actual);

    const longitudTramo = (tramo: number[]) => tramo.reduce((suma, idx) => suma + edges[idx].longitud, 0);
    return tramos.reduce((mejor, t) => (longitudTramo(t) > longitudTramo(mejor) ? t : mejor));
}

// Área con signo (fórmula del shoelace, sin dividir entre 2: el signo es lo
// único que importa acá). Con Este=x creciendo al este y Norte=y creciendo
// al norte (UTM estándar), un polígono digitalizado en sentido antihorario
// da signo positivo — pero el sentido real de digitalización varía entre
// lotes (depende de cómo se trazó cada uno en Odoo/el editor), así que NO
// se puede asumir un sentido fijo: hay que calcularlo por lote.
function areaConSigno(pts: [number, number][]): number {
    let suma = 0;
    for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[(i + 1) % pts.length];
        suma += x1 * y2 - x2 * y1;
    }
    return suma;
}

/**
 * Deriva colindancias (qué hay en cada lado: otro lote, calle o área verde)
 * y las dimensiones con nomenclatura frente/fondo/derecha/izquierda a
 * partir de la geometría real del lote, de todos los lotes del mapa, y
 * (opcional) de los elementos urbanos (calles/parques) con geometría real.
 *
 * Regla de negocio: el frente SIEMPRE es la calle. Criterio de "frente" (en
 * 4 niveles, de más a menos confiable):
 * 1. El lado que colinda con una capa de tipo "calle" real (elementosUrbanos).
 *    La longitud NO importa acá: el frente de un lote no es necesariamente
 *    el lado más largo, puede ser cualquiera — lo que lo hace frente es dar
 *    a la vía pública, no su tamaño. Si hay más de un lado con calle
 *    confirmada (lote de esquina con dos frentes), se usa la longitud SOLO
 *    como desempate entre esos candidatos, ya que la estructura actual
 *    permite un solo "frente" por lote.
 * 2. Si ningún lado tiene una calle confirmada todavía (su geometría real
 *    aún no se cargó en elemento_urbano_geometry): el lado más largo entre
 *    los que no tienen NINGÚN vecino confirmado (ni lote ni elemento urbano)
 *    — lo más probable es una calle sin digitalizar. Mismo criterio que se
 *    usaba antes de tener capas reales, como red de seguridad.
 * 3. Si todos los lados sin lote vecino están confirmados como algo que NO
 *    es calle (parque, aporte, jardín...): el más largo de ellos. Último
 *    recurso — un lado confirmado como parque nunca le gana a uno sin
 *    confirmar (nivel 2).
 * 4. Si el lote está completamente rodeado de otros lotes (caso anómalo):
 *    el lado más largo del polígono.
 *
 * Un lado se reconoce como colindante de una calle/parque cuando comparte
 * sus vértices con el contorno del elemento o, si no, cuando descansa sobre
 * ese contorno (ver ladoSobreContorno).
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
 * Excepción de frente partido en tramos: si la calle del frente es curva o
 * poligonal, puede haber más de una arista contra ELLA MISMA — todas esas
 * aristas se reportan como "frente" sin importar en qué tramo de la máquina
 * de estados cayeron por ángulo (comparación por código del elemento
 * urbano, no solo por tipo "calle"). Un lote de esquina real entre DOS
 * calles distintas sigue teniendo un solo frente: el lado de la otra calle
 * se clasifica como derecha/fondo/izquierda igual que un lote normal. Ver
 * lote E02MZV001P: 4 tramos sobre "Calle 15" (curva) son frente, pero el
 * tramo sobre "Calle 16" es un lado normal (izquierda).
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
): { colindancias: ColindanciaDerivada[]; dimensiones: DimensionesDerivadas; advertencias: AdvertenciaColindancia[] } {
    const pts = lote.points;
    const n = pts.length;

    if (!pts || n < 3) {
        throw new Error(`El lote ${lote.default_code} no tiene geometría válida (menos de 3 vértices)`);
    }

    const edges: Edge[] = [];
    for (let i = 0; i < n; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % n];
        const arco = buscarArcoPorIndice(lote.x_geometry_arcos, i);
        // Lado curvo: usar la longitud de arco real, no la distancia
        // recta (cuerda) entre los 2 extremos.
        const longitud = arco ? arco.longitudArco : calculateDistance(a, b);
        const tramos = construirTramos(a, b, longitud, !!arco, lote, todosLosLotes, elementosUrbanos);
        const urbanos = tramos.map((t) => t.vecinoUrbano).filter((u): u is ElementoUrbano => !!u);
        edges.push({
            index: i,
            a,
            b,
            longitud,
            midpoint: calculateMidpoint(a, b),
            tramos,
            tieneLote: tramos.some((t) => !!t.vecinoLote),
            tieneSinConfirmar: tramos.some((t) => !t.vecinoLote && !t.vecinoUrbano),
            vecinoUrbano: urbanos.find((u) => u.tipo === 'calle') ?? urbanos[0] ?? null,
            arco,
        });
    }

    const edgesCalleConfirmada = edges.filter((e) => e.vecinoUrbano?.tipo === 'calle');
    // Ni lote ni elemento urbano reconocido: lo más probable es una calle
    // cuya geometría todavía no se digitalizó.
    const edgesSinConfirmar = edges.filter((e) => e.tieneSinConfirmar);
    // Confirmado como parque/aporte/jardín/etc. (no calle): nunca debe ganarle
    // a un lado sin confirmar. Antes, con ambos extremos de igual largo (ej.
    // un lote de 6x20 entre un parque y una calle) `reduce` se quedaba con el
    // primero del orden de vértices — a veces el parque (E01MZR015P).
    const edgesUrbanoNoCalle = edges.filter((e) => !e.tieneLote && e.vecinoUrbano && e.vecinoUrbano.tipo !== 'calle');
    const candidatosFrente =
        edgesCalleConfirmada.length > 0 ? edgesCalleConfirmada
        : edgesSinConfirmar.length > 0 ? edgesSinConfirmar
        : edgesUrbanoNoCalle.length > 0 ? edgesUrbanoNoCalle
        : edges;
    const frente = candidatosFrente.reduce((max, e) =>
        e.longitud > max.longitud ? e : max
    );

    // Orden de recorrido del polígono empezando justo después del frente.
    const ordenDesdeFrente: number[] = [];
    for (let paso = 1; paso < n; paso++) {
        ordenDesdeFrente.push((frente.index + paso) % n);
    }

    // Aristas que en realidad son tramos ADICIONALES del frente (calle
    // curva/poligonal partida en varios segmentos rectos, ver
    // mismaCalleQueFrente más abajo) — se calcula ACÁ, antes de elegir el
    // fondo, para poder excluirlas de la carrera por "fondo". Sin esto: una
    // arista que da a la MISMA calle que el frente y que además, por pura
    // geometría, cae casi paralela a él (ej. el segundo tramo de una curva
    // suave) compite y hasta puede GANAR el puesto de fondo por ángulo/
    // longitud — para terminar igual reclasificada como frente más abajo,
    // dejando fondo vacío sin necesidad aunque hubiera otra arista real que
    // sí calificaba. Verificado con el lote E01MZS081P (frente partido en 2
    // tramos sobre "calle 08": el tramo corto también era la arista más
    // paralela al frente y se quedaba con el turno de fondo antes de ser
    // reclasificado).
    const esTramoDeFrenteExtra = (edge: Edge): boolean =>
        frente.vecinoUrbano?.tipo === 'calle' && edge.vecinoUrbano?.codigo === frente.vecinoUrbano.codigo;

    // Clasificar cada arista restante por ángulo respecto al frente (ver
    // anguloEntreAristas más arriba): "paralela" = candidata a fondo,
    // "lateral" = candidata a derecha/izquierda. Si ninguna califica
    // (polígono muy irregular), se usa la de menor ángulo como único fondo
    // — mismo respaldo que antes, para que fondo nunca quede vacío.
    const ordenParaFondo = ordenDesdeFrente.filter((idx) => !esTramoDeFrenteExtra(edges[idx]));
    const anguloPorIndice = new Map<number, number>(
        ordenDesdeFrente.map((idx) => [idx, anguloEntreAristas(frente, edges[idx])])
    );
    const paralelas = ordenParaFondo.filter((idx) => anguloPorIndice.get(idx)! <= UMBRAL_PARALELO_GRADOS);

    // El fondo real es UN SOLO tramo contiguo del recorrido (la máquina de
    // estados de más abajo solo avanza hacia adelante: derecha -> fondo ->
    // izquierda, sin poder volver a entrar a "fondo"). Con polígonos
    // irregulares (5+ lados) puede haber DOS aristas "paralelas" al frente
    // no contiguas entre sí — ej. una arista corta de esquina que por
    // ángulo también cae bajo el umbral, separada de la arista larga que
    // es el verdadero lado opuesto. Si se tratan ambas como fondo, la
    // primera (corta) dispara la transición de estado antes de tiempo y la
    // segunda (la real) termina mal clasificada como derecha/izquierda —
    // y de paso "derecha" puede quedar completamente vacío. Verificado con
    // el lote E01MZR045P: una arista de 5.70ml (36° del frente) y otra de
    // 20.00ml —el verdadero fondo, casi exactamente paralelo, 1°— quedaban
    // ambas marcadas como candidatas; solo el tramo contiguo más largo
    // (por longitud total, no por cantidad de aristas) se queda con el
    // rótulo de fondo; el resto vuelve a ser lateral.
    const indicesFondo = new Set(
        paralelas.length > 0
            ? mayorTramoContiguo(ordenDesdeFrente, paralelas, edges)
            : ordenParaFondo.length > 0
                ? [ordenParaFondo.reduce((min, idx) => (anguloPorIndice.get(idx)! < anguloPorIndice.get(min)! ? idx : min))]
                : []
    );

    let ladoDerechoLongitud = 0;
    let ladoIzquierdoLongitud = 0;
    let fondoLongitud = 0;
    // Tramos de frente adicionales al principal, en lotes de esquina con más
    // de un lado dando a la vía pública (ver más abajo).
    let frenteLongitudExtra = 0;
    const colindancias: ColindanciaDerivada[] = [];

    const advertencias: AdvertenciaColindancia[] = [];
    const aristasAsignadas = new Set<number>();

    const agregarColindancia = (edge: Edge, lado: ColindanciaDerivada['lado']) => {
        aristasAsignadas.add(edge.index);
        const infoArco = edge.arco
            ? { radio: edge.arco.radio, longitudArco: edge.arco.longitudArco, sentido: edge.arco.sentido }
            : {};

        // Los tramos deben sumar exactamente el largo (redondeado) del lado: el
        // último absorbe el residuo del redondeo (p. ej. 4.66 + 2.00 = 6.66).
        const totalLado = parseFloat(edge.longitud.toFixed(2));
        let acumulado = 0;
        edge.tramos.forEach((tramo, k) => {
            const esUltimo = k === edge.tramos.length - 1;
            const longitud = esUltimo
                ? parseFloat((totalLado - acumulado).toFixed(2))
                : parseFloat(tramo.longitud.toFixed(2));
            acumulado += longitud;

            if (tramo.vecinoLote) {
                colindancias.push({
                    lado,
                    tipo: 'lote',
                    nombre: tramo.vecinoLote.name || tramo.vecinoLote.default_code,
                    longitud,
                    ...infoArco,
                });
            } else if (tramo.vecinoUrbano) {
                colindancias.push({
                    lado,
                    tipo: tramo.vecinoUrbano.tipo,
                    nombre: tramo.vecinoUrbano.nombre,
                    longitud,
                    ...infoArco,
                });
            } else {
                // Sin vecino reconocido: marcador de posición "Calle" (mismo
                // texto de siempre) pero MARCADO como no confirmado, para que
                // el staff lo revise en vez de creer que es un dato real.
                colindancias.push({
                    lado,
                    tipo: 'calle',
                    nombre: 'Calle',
                    longitud,
                    sinConfirmar: true,
                    ...infoArco,
                });
                // Los lados despreciables (< LADO_DESPRECIABLE_METROS) se
                // imprimen tal cual, sin pedir revisión (decisión del negocio).
                if (longitud >= LADO_DESPRECIABLE_METROS) {
                    advertencias.push({
                        tipo: 'lado_sin_clasificar',
                        lado,
                        longitud,
                        mensaje: `Lado ${lado} de ${longitud.toFixed(2)} m: no se identificó a qué colinda; se imprimió "Calle" como marcador.`,
                    });
                    // Verificación cruzada con OTRO criterio que la cobertura
                    // (el de ladoSobreContorno: extremos y punto medio sobre el
                    // contorno): si un tramo largo sin clasificar descansa
                    // sobre un lote, el algoritmo se equivocó → avisar. En
                    // tramos cortos no se aplica: junto a una esquina todo
                    // "roza" a un vecino y daría falsas alarmas.
                    const sospechoso = longitud >= LARGO_AUDITABLE_METROS
                        ? todosLosLotes.find(
                              (otro) =>
                                  otro.id !== lote.id &&
                                  otro.points &&
                                  otro.points.length >= 3 &&
                                  puntoCercaDeCaja(tramo.inicio, cajaEnvolvente(otro.points)) &&
                                  ladoSobreContorno(tramo.inicio, tramo.fin, otro.points)
                          )
                        : undefined;
                    if (sospechoso) {
                        advertencias.push({
                            tipo: 'inconsistencia',
                            lado,
                            longitud,
                            mensaje: `Lado ${lado} de ${longitud.toFixed(2)} m quedó sin clasificar pero toca al lote ${sospechoso.default_code}: revisar a mano.`,
                        });
                    }
                }
            }
        });
    };

    agregarColindancia(frente, 'frente');

    // "Derecha"/"izquierda" son relativos a alguien parado en el frente,
    // mirando hacia adentro del lote — no al orden en que Odoo/el editor
    // haya digitalizado los vértices, que varía de lote a lote. Con
    // Este=x/Norte=y (UTM), recorrer un polígono antihorario en orden
    // creciente de índice pasa primero por el lado derecho de esa persona;
    // uno horario pasa primero por el izquierdo. Por eso el punto de
    // partida de la máquina de estados se decide por el signo del área
    // (antihorario = signo positivo), en vez de asumir siempre "derecha".
    const esAntihorario = areaConSigno(pts) > 0;
    const [primerLado, segundoLado]: [ColindanciaDerivada['lado'], ColindanciaDerivada['lado']] =
        esAntihorario ? ['derecha', 'izquierda'] : ['izquierda', 'derecha'];

    // Máquina de estados recorriendo el polígono en orden desde el frente:
    // empieza en el primer lado (según el sentido de digitalización, ver
    // arriba), pasa a "fondo" en cuanto aparece la primera arista candidata
    // (paralela), y al segundo lado en cuanto esa racha termina. Así
    // fondo/derecha/izquierda admiten cada uno varias aristas contiguas
    // (varios vecinos), no solo una.
    let estado: ColindanciaDerivada['lado'] = primerLado;
    ordenDesdeFrente.forEach((idx) => {
        const edge = edges[idx];
        const esFondoCandidata = indicesFondo.has(idx);

        if (estado === primerLado && esFondoCandidata) {
            estado = 'fondo';
        } else if (estado === 'fondo' && !esFondoCandidata) {
            estado = segundoLado;
        }

        // Lote con el frente sobre una calle curva/poligonal: si esta arista
        // da a la MISMA calle que el frente principal (mismo elemento
        // urbano, comparado por código), se reporta como frente también,
        // sin importar su posición topológica — así se redacta una memoria
        // descriptiva real cuando el frente está partido en varios tramos
        // rectos que aproximan una curva. Ver lote E02MZV001P: los 4 tramos
        // sobre "Calle 15" (curva) son todos frente.
        //
        // Importante: esto NO aplica si la arista da a una calle DISTINTA
        // (lote de esquina real entre dos calles distintas, ej. "Calle 16"
        // en el mismo lote) — ese lado sigue la clasificación normal de la
        // máquina de estados (derecha/fondo/izquierda), porque un lote de
        // esquina entre dos calles tiene un solo frente, no dos.
        const ladoFinal: ColindanciaDerivada['lado'] = esTramoDeFrenteExtra(edge) ? 'frente' : estado;

        if (ladoFinal === 'frente') frenteLongitudExtra += edge.longitud;
        else if (ladoFinal === 'derecha') ladoDerechoLongitud += edge.longitud;
        else if (ladoFinal === 'fondo') fondoLongitud += edge.longitud;
        else ladoIzquierdoLongitud += edge.longitud;

        agregarColindancia(edge, ladoFinal);
    });

    const area = lote.measurements?.area ?? lote.x_area;
    const perimetro = lote.measurements?.perimeter ?? edges.reduce((s, e) => s + e.longitud, 0);

    // ─── Invariantes: lo que SIEMPRE debe cumplirse. Si no, es un bug o una
    // geometría rara y se avisa (nunca se bloquea). ───
    const perimetroGeometrico = edges.reduce((s, e) => s + e.longitud, 0);
    const sumaColindancias = colindancias.reduce((s, c) => s + c.longitud, 0);
    if (aristasAsignadas.size !== n) {
        advertencias.push({
            tipo: 'inconsistencia',
            mensaje: `Solo ${aristasAsignadas.size} de ${n} lados quedaron asignados a una colindancia.`,
        });
    }
    if (Math.abs(sumaColindancias - perimetroGeometrico) > 0.01 * n) {
        advertencias.push({
            tipo: 'inconsistencia',
            mensaje: `Las colindancias suman ${sumaColindancias.toFixed(2)} m y el perímetro del polígono es ${perimetroGeometrico.toFixed(2)} m.`,
        });
    }
    const sumaDimensiones = ladoDerechoLongitud + ladoIzquierdoLongitud + fondoLongitud + frente.longitud + frenteLongitudExtra;
    if (Math.abs(sumaDimensiones - perimetroGeometrico) > 0.01) {
        advertencias.push({
            tipo: 'inconsistencia',
            mensaje: `Frente+fondo+laterales suman ${sumaDimensiones.toFixed(2)} m y el perímetro es ${perimetroGeometrico.toFixed(2)} m.`,
        });
    }

    return {
        advertencias,
        colindancias,
        dimensiones: {
            frente: parseFloat((frente.longitud + frenteLongitudExtra).toFixed(2)),
            fondo: parseFloat(fondoLongitud.toFixed(2)),
            ladoDerecho: parseFloat(ladoDerechoLongitud.toFixed(2)),
            ladoIzquierdo: parseFloat(ladoIzquierdoLongitud.toFixed(2)),
            area,
            perimetro: parseFloat(perimetro.toFixed(2)),
        },
    };
}
