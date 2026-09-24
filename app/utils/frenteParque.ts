/**
 * Clasifica si un lote está "frente al parque" — pedido comercial real de
 * clientes ("quiero lotes frente al parque"). Definición acordada con el
 * negocio (2026-09-24):
 *   - 'colindante'   : el lote COMPARTE lindero con un parque (≥ 3 m de lado
 *                      pegado; un roce en un solo vértice NO cuenta).
 *   - 'al_otro_lado' : el lote da a una calle y, cruzando esa calle, hay un
 *                      parque a ≤ 25 m. Lo que un cliente entiende por "frente
 *                      al parque" casi siempre es esto, no colindar.
 * "Parque" = SOLO la capa aporte_recreacion. Jardines y "aportes otros" no
 * cuentan (decisión explícita del negocio).
 *
 * Geometría pura (sin dependencias), en metros UTM. Pensado para correr en
 * el servidor sobre pocos cientos de lotes con los polígonos de calles y
 * parques ya cargados: prefiltra por bounding box para no comparar cada lote
 * contra todas las calles del proyecto.
 */

export type Punto = [number, number];

export type TipoFrenteParque = 'colindante' | 'al_otro_lado';

export interface ResultadoFrenteParque {
    tipo: TipoFrenteParque | null;
    /** Distancia mínima (m) del lote al parque más cercano; null si no hay parques. */
    distanciaM: number | null;
}

export const UMBRAL_LADO_COMPARTIDO_M = 3;
export const TOLERANCIA_CONTACTO_M = 0.8;
export const DISTANCIA_MAX_OTRO_LADO_M = 25;
const TOLERANCIA_FRENTE_M = 2;
const PASO_MUESTREO_M = 0.5;
const MARGEN_BBOX_M = 30;
// Un vértice SOBRE el contorno del otro polígono no es traslape: solo cuenta
// si está claramente adentro (más de 5 cm del borde).
const EPS_TRASLAPE_M = 0.05;

interface Anillo {
    puntos: Punto[];
    bbox: [number, number, number, number]; // minX, minY, maxX, maxY
}

export interface ContextoFrenteParque {
    calles: Anillo[];
    parques: Anillo[];
}

function limpiar(puntos: Punto[]): Punto[] {
    const p = puntos.map((q) => [q[0], q[1]] as Punto);
    if (p.length > 1) {
        const a = p[0];
        const b = p[p.length - 1];
        if (a[0] === b[0] && a[1] === b[1]) p.pop();
    }
    return p;
}

function bboxDe(puntos: Punto[]): [number, number, number, number] {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of puntos) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }
    return [minX, minY, maxX, maxY];
}

function crearAnillo(puntos: Punto[]): Anillo | null {
    const p = limpiar(puntos);
    if (p.length < 3) return null;
    return { puntos: p, bbox: bboxDe(p) };
}

/** Prepara calles y parques (anillos de puntos UTM) una sola vez para reusar en muchos lotes. */
export function crearContextoFrenteParque(calles: Punto[][], parques: Punto[][]): ContextoFrenteParque {
    return {
        calles: calles.map(crearAnillo).filter((a): a is Anillo => a !== null),
        parques: parques.map(crearAnillo).filter((a): a is Anillo => a !== null),
    };
}

function bboxCerca(a: [number, number, number, number], b: [number, number, number, number], margen: number): boolean {
    return a[0] - margen <= b[2] && a[2] + margen >= b[0] && a[1] - margen <= b[3] && a[3] + margen >= b[1];
}

function distPuntoSegmento(p: Punto, a: Punto, b: Punto): { d: number; q: Punto } {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    let t = l2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    const q: Punto = [a[0] + t * dx, a[1] + t * dy];
    return { d: Math.hypot(p[0] - q[0], p[1] - q[1]), q };
}

/** Distancia (y punto más cercano) de un punto al CONTORNO de un anillo. */
function distPuntoContorno(p: Punto, pts: Punto[]): { d: number; q: Punto } {
    let mejor = { d: Infinity, q: pts[0] };
    for (let i = 0; i < pts.length; i++) {
        const r = distPuntoSegmento(p, pts[i], pts[(i + 1) % pts.length]);
        if (r.d < mejor.d) mejor = r;
    }
    return mejor;
}

function enPoligono(p: Punto, pts: Punto[]): boolean {
    let dentro = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) dentro = !dentro;
    }
    return dentro;
}

/** Puntos a lo largo de un segmento cada ~paso metros (incluye extremos). */
function muestrearSegmento(a: Punto, b: Punto, paso: number): Punto[] {
    const largo = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(largo / paso));
    const out: Punto[] = [];
    for (let i = 0; i <= n; i++) {
        const t = i / n;
        out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
    return out;
}

function distMinAContornos(p: Punto, anillos: Anillo[]): number {
    let m = Infinity;
    for (const an of anillos) {
        const d = distPuntoContorno(p, an.puntos).d;
        if (d < m) m = d;
    }
    return m;
}

/**
 * Clasifica un lote (polígono UTM) contra las calles y parques del contexto.
 * Devuelve tipo=null si no está frente a ningún parque.
 */
export function clasificarFrenteParque(lote: Punto[], ctx: ContextoFrenteParque): ResultadoFrenteParque {
    const pts = limpiar(lote);
    if (pts.length < 3 || ctx.parques.length === 0) return { tipo: null, distanciaM: null };

    const bl = bboxDe(pts);
    const parquesCerca = ctx.parques.filter((p) => bboxCerca(bl, p.bbox, MARGEN_BBOX_M));
    if (parquesCerca.length === 0) {
        // Sin parque en 30 m: la distancia exacta no importa para el filtro,
        // pero se reporta algo coherente (mayor que el máximo).
        let m = Infinity;
        for (const pq of ctx.parques) {
            for (const v of pts) m = Math.min(m, distPuntoContorno(v, pq.puntos).d);
        }
        return { tipo: null, distanciaM: Number.isFinite(m) ? m : null };
    }

    // 1) Distancia mínima lote↔parque y el par de puntos más cercanos
    //    (vértice del lote → contorno del parque, y vértice del parque → contorno del lote).
    let minD = Infinity;
    let pLote: Punto = pts[0];
    let pParque: Punto = pts[0];
    let solapa = false;
    for (const pq of parquesCerca) {
        for (const v of pts) {
            const r = distPuntoContorno(v, pq.puntos);
            if (r.d < minD) {
                minD = r.d;
                pLote = v;
                pParque = r.q;
            }
            if (r.d > EPS_TRASLAPE_M && enPoligono(v, pq.puntos)) solapa = true;
        }
        for (const v of pq.puntos) {
            const r = distPuntoContorno(v, pts);
            if (r.d < minD) {
                minD = r.d;
                pLote = r.q;
                pParque = v;
            }
            if (r.d > EPS_TRASLAPE_M && enPoligono(v, pts)) solapa = true;
        }
    }

    // 2) Colindante: largo del contorno del lote pegado (≤0.8 m) al contorno de un parque.
    let largoCompartido = 0;
    for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        const largo = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const muestras = muestrearSegmento(a, b, PASO_MUESTREO_M);
        let pegadas = 0;
        for (const m of muestras) {
            if (distMinAContornos(m, parquesCerca) <= TOLERANCIA_CONTACTO_M) pegadas++;
        }
        largoCompartido += (largo * pegadas) / muestras.length;
    }
    if (solapa || largoCompartido >= UMBRAL_LADO_COMPARTIDO_M) {
        return { tipo: 'colindante', distanciaM: solapa ? 0 : minD };
    }

    // 3) Al otro lado de la calle: parque a ≤ 25 m, el segmento que los une
    //    cruza una calle, y ese punto del lote está sobre su frente a calle.
    if (minD > DISTANCIA_MAX_OTRO_LADO_M) return { tipo: null, distanciaM: minD };

    const callesCerca = ctx.calles.filter((c) => bboxCerca(bl, c.bbox, MARGEN_BBOX_M));
    if (callesCerca.length === 0) return { tipo: null, distanciaM: minD };

    let cruzaCalle = false;
    for (let i = 1; i < 10 && !cruzaCalle; i++) {
        const t = i / 10;
        const m: Punto = [pLote[0] + t * (pParque[0] - pLote[0]), pLote[1] + t * (pParque[1] - pLote[1])];
        if (callesCerca.some((c) => enPoligono(m, c.puntos))) cruzaCalle = true;
    }
    if (!cruzaCalle) return { tipo: null, distanciaM: minD };

    // Lado(s) del lote que corren pegados a una calle (frente): ≥2 m de largo
    // y ≥60 % de sus muestras a ≤0.8 m del contorno de calle.
    let mirandoALaCalle = false;
    for (let i = 0; i < pts.length && !mirandoALaCalle; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        const largo = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (largo < 2) continue;
        const muestras = muestrearSegmento(a, b, PASO_MUESTREO_M);
        const pegadas = muestras.filter((m) => distMinAContornos(m, callesCerca) <= TOLERANCIA_CONTACTO_M).length;
        if (pegadas / muestras.length >= 0.6 && distPuntoSegmento(pLote, a, b).d <= TOLERANCIA_FRENTE_M) {
            mirandoALaCalle = true;
        }
    }

    return { tipo: mirandoALaCalle ? 'al_otro_lado' : null, distanciaM: minD };
}
