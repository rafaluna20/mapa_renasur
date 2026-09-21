import { describe, it, expect } from 'vitest';
import { derivarColindanciasYDimensiones } from './colindanciasUtils';
import type { Lot } from '@/app/data/lotsData';
import type { ElementoUrbano } from '@/app/data/elementosUrbanos';

function makeLot(overrides: Partial<Lot> & { points: [number, number][] }): Lot {
    return {
        id: overrides.default_code || 'TEST',
        name: overrides.name || 'Lote Test',
        x_statu: 'Disponible',
        list_price: 0,
        x_area: 0,
        x_mz: 'X',
        x_etapa: '1',
        x_lote: '0',
        default_code: 'TEST',
        ...overrides,
    };
}

function makeElemento(overrides: Partial<ElementoUrbano> & { codigo: string; nombre: string; tipo: string; points: [number, number][] }): ElementoUrbano {
    return {
        colorBorde: '#000',
        colorRelleno: '#000',
        mostrarEtiqueta: true,
        mostrarEnMapa: true,
        esArea: true,
        sinRelleno: false,
        sinBorde: false,
        ...overrides,
    };
}

describe('derivarColindanciasYDimensiones', () => {
    // Caso real reportado: E01MZR045P — un pentágono donde dos aristas no
    // consecutivas (5.70ml a 36° del frente, y 20.00ml a ~1° del frente)
    // calificaban ambas como "paralelas" (candidatas a fondo). Antes del fix,
    // la de 5.70ml (la primera en el recorrido) disparaba la transición de
    // estado, "DERECHA" quedaba vacío, y el verdadero fondo (20.00ml,
    // colindante con el lote 44) terminaba mal clasificado como izquierda.
    it('no deja "derecha" vacío cuando hay dos aristas casi-paralelas al frente no contiguas (lote real E01MZR045P)', () => {
        const lote45 = makeLot({
            default_code: 'E01MZR045P',
            name: 'Etapa 1 Mz R Lote 45',
            points: [
                [308455.89935399895, 8622837.624256909],
                [308468.30102672393, 8622821.933542663],
                [308474.556297455, 8622826.87766899],
                [308465.01542792737, 8622838.948653106],
                [308459.5282881172, 8622840.492570965],
            ],
        });
        const lote44 = makeLot({
            default_code: 'E01MZR044P',
            name: 'Etapa 1 Mz R Lote 44',
            points: [
                [308455.89935399895, 8622837.624256909],
                [308451.19218162843, 8622833.90370199],
                [308463.5940312466, 8622818.213127559],
                [308468.3012036172, 8622821.933682477],
            ],
        });
        const lote46 = makeLot({
            default_code: 'E01MZR046P',
            name: 'Etapa 1 Mz R Lote 46',
            points: [
                [308474.556310096, 8622826.877611874],
                [308468.3012036172, 8622821.933682477],
                [308473.5413436034, 8622798.25597848],
                [308478.9818279959, 8622799.39440464],
                [308480.13413443655, 8622801.675664565],
            ],
        });

        const { colindancias, dimensiones } = derivarColindanciasYDimensiones(
            lote45,
            [lote45, lote44, lote46],
            []
        );

        const porLado = (lado: string) => colindancias.filter((c) => c.lado === lado);

        expect(porLado('frente')).toHaveLength(1);
        expect(porLado('frente')[0].longitud).toBeCloseTo(15.39, 1);

        // El bug reportado: esto quedaba vacío.
        expect(porLado('derecha').length).toBeGreaterThan(0);
        expect(dimensiones.ladoDerecho).toBeCloseTo(10.33, 1);

        // El verdadero fondo (colindante con el lote 44) debe quedar como
        // fondo, no como izquierda.
        const fondo = porLado('fondo');
        expect(fondo).toHaveLength(1);
        expect(fondo[0].tipo).toBe('lote');
        expect(fondo[0].nombre).toContain('44');
        expect(dimensiones.fondo).toBeCloseTo(20.0, 1);

        const izquierda = porLado('izquierda');
        expect(izquierda).toHaveLength(1);
        expect(izquierda[0].nombre).toContain('46');
        expect(dimensiones.ladoIzquierdo).toBeCloseTo(7.97, 1);
    });

    // Caso real reportado: E01MZS081P — un lote con el frente partido en 2
    // tramos sobre una calle curva ("calle 08"). Uno de esos 2 tramos
    // también calificaba, por ángulo, como la arista más "paralela" al
    // frente (candidata a fondo) — y hasta ganaba esa carrera por longitud
    // (ver mayorTramoContiguo) — para terminar igual reclasificado como
    // frente por dar a la misma calle, dejando el fondo real (otra arista,
    // más corta, con menos coincidencia angular) totalmente vacío.
    it('no deja "fondo" vacío cuando un tramo extra del frente también calificaba como candidata a fondo (lote real E01MZS081P)', () => {
        const v1: [number, number] = [308334.8837, 8623081.6040];
        const v2: [number, number] = [308330.3076, 8623079.4776];
        const v3: [number, number] = [308329.7650, 8623061.5199];
        const v4: [number, number] = [308336.6098, 8623061.8678];
        const v5: [number, number] = [308343.3118, 8623063.4666];

        const lote81 = makeLot({
            default_code: 'E01MZS081P',
            name: 'Etapa 1 Mz S Lote 81',
            points: [v1, v2, v3, v4, v5],
        });
        const lote80 = makeLot({
            default_code: 'E01MZS080P',
            name: 'Etapa 1 Mz S Lote 80',
            points: [v2, v3, [v3[0] - 5, v3[1] - 5], [v2[0] - 5, v2[1] - 5]],
        });
        const lote82 = makeLot({
            default_code: 'E01MZS082P',
            name: 'Etapa 1 Mz S Lote 82',
            points: [v5, v1, [v1[0] + 5, v1[1] + 5], [v5[0] + 5, v5[1] + 5]],
        });
        const calle08: ElementoUrbano = {
            codigo: 'CALLE08',
            nombre: 'calle 08',
            tipo: 'calle',
            colorBorde: '#000',
            colorRelleno: '#000',
            mostrarEtiqueta: true,
            mostrarEnMapa: true,
            esArea: false,
            sinRelleno: false,
            sinBorde: false,
            points: [v3, v4, v5, [v3[0], v3[1] - 5]],
        };

        const { colindancias, dimensiones } = derivarColindanciasYDimensiones(
            lote81,
            [lote81, lote80, lote82],
            [calle08]
        );

        const porLado = (lado: string) => colindancias.filter((c) => c.lado === lado);

        // Los 2 tramos sobre la misma calle deben seguir sumando a frente.
        expect(porLado('frente')).toHaveLength(2);
        expect(dimensiones.frente).toBeCloseTo(13.74, 1);

        // El bug reportado: esto quedaba vacío.
        expect(porLado('fondo').length).toBeGreaterThan(0);
        expect(dimensiones.fondo).toBeGreaterThan(0);

        expect(porLado('derecha')[0]?.nombre).toContain('82');
        expect(porLado('izquierda')[0]?.nombre).toContain('80');
    });

    // ── Frente = calle, siempre (caso real E01MZR015P) ─────────────────────
    // Lote de 6x20 entre un parque (lado V1-V2) y una calle (lado V3-V4).
    // Ambos extremos miden 6.00: el desempate por orden de vértices dejaba el
    // parque como frente. Además la calle está digitalizada con un tramo recto
    // largo SIN vértices en las esquinas del lote, así que la coincidencia
    // vértice-a-vértice no la reconocía y salía "Calle" genérica.
    const V1: [number, number] = [0, 0];
    const V2: [number, number] = [6, 0];
    const V3: [number, number] = [6, 20];
    const V4: [number, number] = [0, 20];

    const armarEntornoR015 = (opciones: { conCalle: boolean; loteAlFondo?: boolean; elementosExtra?: ElementoUrbano[] } = { conCalle: true }) => {
        const lote = makeLot({ default_code: 'E01MZR015P', name: 'Etapa 1 Mz R Lote 15', points: [V1, V2, V3, V4] });
        const lote16 = makeLot({ default_code: 'E01MZR016P', name: 'Etapa 1 Mz R Lote 16', points: [V2, V3, [12, 20], [12, 0]] });
        const lote14 = makeLot({ default_code: 'E01MZR014P', name: 'Etapa 1 Mz R Lote 14', points: [V4, V1, [-6, 0], [-6, 20]] });
        const lotes = [lote, lote16, lote14];
        if (opciones.loteAlFondo) lotes.push(makeLot({ default_code: 'E01MZR020P', name: 'Etapa 1 Mz R Lote 20', points: [V3, V4, [0, 26], [6, 26]] }));
        const aporte = makeElemento({ codigo: 'APORTEREC05', nombre: 'Aporte Recreación Pública 05', tipo: 'aporte_recreacion', points: [V1, V2, [6, -30], [0, -30]] });
        // Tramo recto de 110 m que pasa POR ENCIMA del lado V3-V4 sin ningún vértice en V3 ni V4.
        const calle = makeElemento({ codigo: 'CALLE12', nombre: 'calle 12', tipo: 'calle', points: [[-50, 20], [60, 20], [60, 60], [-50, 60]] });
        const elementos = [aporte, ...(opciones.conCalle ? [calle] : []), ...(opciones.elementosExtra ?? [])];
        return { lote, lotes, elementos };
    };

    it('el frente es la calle y no el parque, aunque la calle no tenga vértices en las esquinas del lote (lote real E01MZR015P)', () => {
        const { lote, lotes, elementos } = armarEntornoR015();
        const { colindancias, dimensiones } = derivarColindanciasYDimensiones(lote, lotes, elementos);
        const porLado = (lado: string) => colindancias.filter((c) => c.lado === lado);

        expect(porLado('frente')).toHaveLength(1);
        expect(porLado('frente')[0]).toMatchObject({ tipo: 'calle', nombre: 'calle 12', longitud: 6 });
        expect(porLado('fondo')).toHaveLength(1);
        expect(porLado('fondo')[0]).toMatchObject({ tipo: 'aporte_recreacion', nombre: 'Aporte Recreación Pública 05', longitud: 6 });
        expect(dimensiones.frente).toBeCloseTo(6, 2);
        expect(dimensiones.fondo).toBeCloseTo(6, 2);
        // Los dos lotes vecinos quedan uno a cada lado.
        const laterales = [...porLado('derecha'), ...porLado('izquierda')];
        expect(laterales).toHaveLength(2);
        expect(laterales.every((c) => c.tipo === 'lote')).toBe(true);
        expect(porLado('derecha')).toHaveLength(1);
        expect(porLado('izquierda')).toHaveLength(1);
    });

    it('sin la calle digitalizada, el lado sin confirmar es el frente y el parque queda de fondo — sin depender del orden de los vértices', () => {
        const { lote, lotes, elementos } = armarEntornoR015({ conCalle: false });
        // Mismo polígono con dos puntos de partida distintos: antes el resultado
        // dependía de cuál extremo aparecía primero.
        const rotado = makeLot({ ...lote, points: [V3, V4, V1, V2] });
        for (const candidato of [lote, rotado]) {
            const { colindancias } = derivarColindanciasYDimensiones(candidato, lotes, elementos);
            const frente = colindancias.filter((c) => c.lado === 'frente');
            const fondo = colindancias.filter((c) => c.lado === 'fondo');
            expect(frente).toHaveLength(1);
            expect(frente[0]).toMatchObject({ tipo: 'calle', nombre: 'Calle' });
            expect(fondo).toHaveLength(1);
            expect(fondo[0].tipo).toBe('aporte_recreacion');
        }
    });

    it('el parque solo es frente como último recurso, cuando no queda ningún otro lado sin lote vecino', () => {
        const { lote, lotes, elementos } = armarEntornoR015({ conCalle: false, loteAlFondo: true });
        const { colindancias } = derivarColindanciasYDimensiones(lote, lotes, elementos);
        const frente = colindancias.filter((c) => c.lado === 'frente');
        expect(frente).toHaveLength(1);
        expect(frente[0].tipo).toBe('aporte_recreacion');
    });

    it('una calle que solo toca una esquina del lote (lado perpendicular) NO se toma como colindante', () => {
        // Contorno que arranca en V3 y se aleja en perpendicular: solo un extremo del
        // lado V2-V3 (o V3-V4) cae sobre él, el otro queda a metros.
        const calleQueRoza = makeElemento({ codigo: 'CALLE99', nombre: 'calle 99', tipo: 'calle', points: [[6, 20], [6, 60], [60, 60], [60, 20]] });
        const { lote, lotes, elementos } = armarEntornoR015({ conCalle: false, elementosExtra: [calleQueRoza] });
        const { colindancias } = derivarColindanciasYDimensiones(lote, lotes, elementos);
        expect(colindancias.some((c) => c.nombre === 'calle 99')).toBe(false);
    });

    it('si un lado toca a la vez una calle y otro elemento solapado (ej. jardín), gana la calle', () => {
        const jardin = makeElemento({ codigo: 'JARDIN1', nombre: 'jardin 1', tipo: 'jardin', points: [[-50, 20], [60, 20], [60, 30], [-50, 30]] });
        // El jardín va PRIMERO en la lista: antes ganaba el primero que coincidía.
        const { lote, lotes, elementos } = armarEntornoR015({ conCalle: true });
        const { colindancias } = derivarColindanciasYDimensiones(lote, lotes, [jardin, ...elementos]);
        const frente = colindancias.filter((c) => c.lado === 'frente');
        expect(frente).toHaveLength(1);
        expect(frente[0]).toMatchObject({ tipo: 'calle', nombre: 'calle 12' });
    });

    it('un lado de largo cero (vértice duplicado) no se toma como colindante de la calle (visto en E02MZW022P)', () => {
        // Mismo lote de 6x20 pero con V3 repetido: el "lado" V3-V3 vale 0 m y cae justo sobre el contorno de la calle.
        const { lotes, elementos } = armarEntornoR015();
        const conDuplicado = makeLot({ default_code: 'E01MZR015P', name: 'Etapa 1 Mz R Lote 15', points: [V1, V2, V3, V3, V4] });
        const { colindancias } = derivarColindanciasYDimensiones(conDuplicado, [conDuplicado, ...lotes.slice(1)], elementos);
        const frente = colindancias.filter((c) => c.lado === 'frente');
        expect(frente.every((c) => c.longitud > 0)).toBe(true);
    });

    // Regresión: un rectángulo simple (el caso común, sin ninguna arista
    // "paralela" ambigua) debe seguir dando exactamente un lado por cada
    // rótulo, igual que antes del fix.
    it('sigue clasificando un rectángulo simple con un solo lado por rótulo', () => {
        const rectangulo = makeLot({
            default_code: 'E01MZX001P',
            points: [
                [0, 0],
                [10, 0],
                [10, 5],
                [0, 5],
            ],
        });

        const { colindancias, dimensiones } = derivarColindanciasYDimensiones(
            rectangulo,
            [rectangulo],
            []
        );

        const porLado = (lado: string) => colindancias.filter((c) => c.lado === lado);
        expect(porLado('frente')).toHaveLength(1);
        expect(porLado('fondo')).toHaveLength(1);
        expect(porLado('derecha')).toHaveLength(1);
        expect(porLado('izquierda')).toHaveLength(1);
        expect(dimensiones.frente).toBeCloseTo(10, 1);
        expect(dimensiones.fondo).toBeCloseTo(10, 1);
        expect(dimensiones.ladoDerecho).toBeCloseTo(5, 1);
        expect(dimensiones.ladoIzquierdo).toBeCloseTo(5, 1);
    });
});
