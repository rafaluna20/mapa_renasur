/**
 * Escena para la imagen "lote en su entorno" que el bot de ventas envía por
 * Telegram (endpoint /api/public/lote-imagen). Geometría pura: recibe
 * polígonos UTM en metros y devuelve polígonos en píxeles listos para dibujar
 * (sin dependencias de React ni de Odoo, para poder probarla con vitest).
 *
 * La ventana se centra en el lote y su tamaño depende del propio lote más un
 * margen: así un lote de 90 m² y uno de 300 m² se ven igual de claros, con las
 * calles y el parque de alrededor visibles.
 */

export type Punto = [number, number];

export interface ElementoEscena {
    puntos: Punto[];
    tipo: string;
    nombre: string;
    colorBorde: string;
    colorRelleno: string;
}

export interface VecinoEscena {
    puntos: Punto[];
    etiqueta: string;
}

export interface EntradaEscena {
    lote: Punto[];
    vecinos: VecinoEscena[];
    elementos: ElementoEscena[];
    /** Lado (px) del cuadro donde se dibuja el plano (la imagen es cuadrada). */
    lado: number;
    /** Margen alrededor del lote, en metros. */
    margenM?: number;
}

export interface PoligonoPx {
    puntos: Punto[];
    /** Centro (px) del polígono, para colocar su etiqueta. */
    centro: Punto;
    /** Ancho y alto (px) de su caja, para decidir si cabe una etiqueta. */
    ancho: number;
    alto: number;
}

export interface Escena {
    lote: PoligonoPx;
    vecinos: (PoligonoPx & { etiqueta: string })[];
    elementos: (PoligonoPx & Omit<ElementoEscena, 'puntos'>)[];
    /** Píxeles por metro. */
    escala: number;
}

export const MARGEN_POR_DEFECTO_M = 32;

function limpiar(p: Punto[]): Punto[] {
    const r = p.map((q) => [q[0], q[1]] as Punto);
    if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r.pop();
    return r;
}

function bbox(p: Punto[]): [number, number, number, number] {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of p) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }
    return [minX, minY, maxX, maxY];
}

/** Centro de masa del polígono (fórmula del área con signo); cae al centro de la caja si el área es 0. */
export function centroide(p: Punto[]): Punto {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < p.length; i++) {
        const [x0, y0] = p[i];
        const [x1, y1] = p[(i + 1) % p.length];
        const f = x0 * y1 - x1 * y0;
        a += f;
        cx += (x0 + x1) * f;
        cy += (y0 + y1) * f;
    }
    if (Math.abs(a) < 1e-9) {
        const [minX, minY, maxX, maxY] = bbox(p);
        return [(minX + maxX) / 2, (minY + maxY) / 2];
    }
    return [cx / (3 * a), cy / (3 * a)];
}

export function construirEscena(entrada: EntradaEscena): Escena | null {
    const lote = limpiar(entrada.lote);
    if (lote.length < 3) return null;

    const [minX, minY, maxX, maxY] = bbox(lote);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const margen = entrada.margenM ?? MARGEN_POR_DEFECTO_M;
    const mitad = Math.max(maxX - minX, maxY - minY) / 2 + margen;
    const escala = entrada.lado / (2 * mitad);
    const l = entrada.lado;

    // y crece hacia el norte en UTM y hacia abajo en pantalla.
    const px = (p: Punto): Punto => [(p[0] - cx) * escala + l / 2, l / 2 - (p[1] - cy) * escala];
    const enVentana = (p: Punto[]) => {
        const [a, b, c, d] = bbox(p);
        return a <= cx + mitad && c >= cx - mitad && b <= cy + mitad && d >= cy - mitad;
    };
    const aPx = (puntos: Punto[]): PoligonoPx => {
        const pp = puntos.map(px);
        const [a, b, c, d] = bbox(pp);
        return { puntos: pp, centro: px(centroide(puntos)), ancho: c - a, alto: d - b };
    };

    const elementos = entrada.elementos
        .map((e) => ({ ...e, puntos: limpiar(e.puntos) }))
        .filter((e) => e.puntos.length >= 3 && enVentana(e.puntos))
        .map((e) => ({ ...aPx(e.puntos), tipo: e.tipo, nombre: e.nombre, colorBorde: e.colorBorde, colorRelleno: e.colorRelleno }));

    const vecinos = entrada.vecinos
        .map((v) => ({ ...v, puntos: limpiar(v.puntos) }))
        .filter((v) => v.puntos.length >= 3 && enVentana(v.puntos))
        .map((v) => ({ ...aPx(v.puntos), etiqueta: v.etiqueta }));

    return { lote: aPx(lote), vecinos, elementos, escala };
}

/** "E01MZV0011" → { manzana: 'V', etiqueta: '1A', numero: '1A' }; null si el código no tiene el formato de un lote. */
export function partesDeCodigo(codigo: string): { manzana: string; lote: string } | null {
    const m = /^E\d{2}MZ([A-Z]{1,2})(\d{3})([P123])$/i.exec(codigo.trim());
    if (!m) return null;
    return { manzana: m[1].toUpperCase(), lote: String(parseInt(m[2], 10)) + (m[3].toUpperCase() === 'P' ? '' : 'ABC'[Number(m[3]) - 1]) };
}
