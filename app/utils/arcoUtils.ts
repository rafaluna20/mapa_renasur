/**
 * Geometría de lados curvos (arcos de circunferencia) en lotes/elementos
 * urbanos. Formato de metadata (mismo que Odoo, ver product_lot_geometry y
 * elemento_urbano_geometry): { indiceVertice, radio, longitudArco, sentido }.
 * indiceVertice es el vértice donde EMPIEZA ese lado del polígono.
 */

export interface ArcoMetadata {
    indiceVertice: number;
    radio: number;
    longitudArco: number;
    sentido: 'horario' | 'antihorario';
}

interface CentroYSweepArco {
    centro: [number, number];
    anguloInicial: number; // radianes, ángulo de p1 respecto al centro
    anguloBarrido: number; // radianes con signo: positivo = antihorario (CCW), negativo = horario (CW)
}

/**
 * Dados 2 puntos y un radio, existen 2 circunferencias posibles que pasan
 * por ambos (una a cada lado de la cuerda). "sentido" indica hacia qué lado
 * se abomba el arco caminando de p1 a p2 (horario = hacia la derecha,
 * antihorario = hacia la izquierda). Combinado con si el arco es menor o
 * mayor a media circunferencia (deducido de longitudArco vs. 2*PI*radio),
 * esto determina sin ambigüedad cuál de los 2 centros usar:
 * - Arco MENOR (≤180°): se abomba LEJOS del centro (lado contrario).
 * - Arco MAYOR (>180°): se abomba hacia el MISMO lado del centro (da la
 *   vuelta larga, pasando cerca del centro).
 */
function calcularCentroYSweepArco(
    p1: [number, number],
    p2: [number, number],
    arco: Pick<ArcoMetadata, 'radio' | 'longitudArco' | 'sentido'>
): CentroYSweepArco {
    const { radio, longitudArco, sentido } = arco;
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const cuerda = Math.sqrt(dx * dx + dy * dy);

    if (cuerda > 2 * radio) {
        throw new Error(
            `Radio (${radio}) demasiado chico para conectar estos 2 puntos ` +
            `(distancia recta ${cuerda.toFixed(3)}m) — el radio debe ser al menos la mitad de esa distancia.`
        );
    }

    const mid: [number, number] = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
    const dirX = dx / cuerda;
    const dirY = dy / cuerda;
    // Perpendicular a la IZQUIERDA de la dirección p1->p2 (rotación +90°, CCW).
    const perpX = -dirY;
    const perpY = dirX;

    const h = Math.sqrt(Math.max(0, radio * radio - (cuerda / 2) * (cuerda / 2)));

    const centroIzquierda: [number, number] = [mid[0] + h * perpX, mid[1] + h * perpY];
    const centroDerecha: [number, number] = [mid[0] - h * perpX, mid[1] - h * perpY];

    const anguloCentral = longitudArco / radio; // radianes, siempre positivo
    const esMenor = anguloCentral <= Math.PI;

    const centro: [number, number] = esMenor
        ? (sentido === 'horario' ? centroIzquierda : centroDerecha)
        : (sentido === 'horario' ? centroDerecha : centroIzquierda);

    const anguloInicial = Math.atan2(p1[1] - centro[1], p1[0] - centro[0]);
    const anguloFinalCandidato = Math.atan2(p2[1] - centro[1], p2[0] - centro[0]);

    // Diferencia normalizada a (-PI, PI]: el camino "corto" entre los 2 ángulos.
    let delta = anguloFinalCandidato - anguloInicial;
    while (delta <= -Math.PI) delta += 2 * Math.PI;
    while (delta > Math.PI) delta -= 2 * Math.PI;

    let anguloBarrido: number;
    if (esMenor) {
        anguloBarrido = delta;
    } else {
        // Recorrido largo: mismo punto de partida, sentido contrario a delta,
        // con magnitud (2*PI - |delta|).
        const signo = delta >= 0 ? -1 : 1;
        anguloBarrido = signo * (2 * Math.PI - Math.abs(delta));
    }

    return { centro, anguloInicial, anguloBarrido };
}

/**
 * Genera puntos muestreados a lo largo del arco circular real entre p1 y
 * p2 (ambos incluidos), para reemplazar ese lado recto del polígono al
 * dibujar o calcular longitudes — en vez de la línea recta entre los 2
 * extremos.
 */
export function muestrearArco(
    p1: [number, number],
    p2: [number, number],
    arco: Pick<ArcoMetadata, 'radio' | 'longitudArco' | 'sentido'>,
    numPuntos: number = 16
): [number, number][] {
    const { centro, anguloInicial, anguloBarrido } = calcularCentroYSweepArco(p1, p2, arco);
    const puntos: [number, number][] = [];
    for (let i = 0; i <= numPuntos; i++) {
        const t = i / numPuntos;
        const angulo = anguloInicial + anguloBarrido * t;
        puntos.push([
            centro[0] + arco.radio * Math.cos(angulo),
            centro[1] + arco.radio * Math.sin(angulo),
        ]);
    }
    return puntos;
}

/**
 * Busca la metadata de arco (si existe) cuyo indiceVertice coincide con el
 * vértice donde empieza el lado (a, b) — helper para no repetir el .find()
 * en cada sitio que necesita saber si un lado es curvo.
 */
export function buscarArcoPorIndice(
    arcos: ArcoMetadata[] | undefined | null,
    indiceVertice: number
): ArcoMetadata | undefined {
    if (!arcos) return undefined;
    return arcos.find((a) => a.indiceVertice === indiceVertice);
}
