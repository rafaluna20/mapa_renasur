/**
 * Prueba de POBLACIÓN del motor de colindancias: corre el algoritmo sobre los
 * 1,341 lotes reales de Terra Lima (geometría exportada del CAD el 2026-11-03,
 * ver __fixtures__) y verifica lo que siempre debe cumplirse, no solo casos
 * sueltos. Se escribió tras el error del lote E01MZR049P (un fondo de 4.66 m
 * y 2.00 m contra dos lotes se imprimía como "Calle").
 *
 * - Invariantes: ningún lote puede dar advertencias de "inconsistencia".
 * - Golden: la firma de TODOS los lotes se compara con la última aprobada. Si
 *   cambias el algoritmo y cambia algún lote, la prueba falla y lista cuáles:
 *   revisa que sean cambios buscados y regenera con `UPDATE_GOLDEN=1 npx vitest run`.
 *
 * Límite: la geometría exportada NO incluye calles/parques, así que acá todo
 * lado que da a la vía pública sale como "sin clasificar" (es lo esperado).
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import fixture from './__fixtures__/lotes_cad_2026-11-03.json';
import { derivarColindanciasYDimensiones } from './colindanciasUtils';
import type { Lot } from '@/app/data/lotsData';

const GOLDEN = path.join(__dirname, '__fixtures__', 'colindancias_golden_2026-11-03.json');

const lotes: Lot[] = Object.entries(fixture as unknown as Record<string, [number, number][]>).map(([code, points]) => ({
    id: code, name: code, x_statu: 'libre', list_price: 0, x_area: 0, x_mz: '', x_etapa: '', x_lote: '', default_code: code, points,
}));
const codigos = new Set(lotes.map((l) => l.default_code));

const resultados = new Map(lotes.map((l) => [l.default_code, derivarColindanciasYDimensiones(l, lotes, [])]));

const firma = (code: string): string => {
    const { colindancias, dimensiones } = resultados.get(code)!;
    return (
        colindancias.map((c) => `${c.lado}|${c.tipo}|${c.nombre}|${c.longitud.toFixed(2)}${c.sinConfirmar ? '|?' : ''}`).join(';') +
        ` #F${dimensiones.frente}/B${dimensiones.fondo}/D${dimensiones.ladoDerecho}/I${dimensiones.ladoIzquierdo}`
    );
};

describe('colindancias: población completa (1,341 lotes)', () => {
    it('hay 1,341 lotes', () => {
        expect(lotes).toHaveLength(1341);
    });

    it('ningún lote tiene advertencias de inconsistencia', () => {
        const malos = [...resultados].filter(([, r]) => r.advertencias.some((a) => a.tipo === 'inconsistencia'));
        expect(malos.map(([c, r]) => `${c}: ${r.advertencias.filter((a) => a.tipo === 'inconsistencia').map((a) => a.mensaje).join(' / ')}`)).toEqual([]);
    });

    it('las colindancias de cada lote suman su perímetro (nada perdido ni duplicado)', () => {
        for (const l of lotes) {
            const { colindancias, dimensiones } = resultados.get(l.default_code)!;
            const suma = colindancias.reduce((s, c) => s + c.longitud, 0);
            expect(Math.abs(suma - dimensiones.perimetro), l.default_code).toBeLessThanOrEqual(0.01 * l.points.length);
        }
    });

    it('todo vecino "lote" existe de verdad y nunca es el propio lote', () => {
        for (const l of lotes) {
            for (const c of resultados.get(l.default_code)!.colindancias) {
                if (c.tipo !== 'lote') continue;
                expect(codigos.has(c.nombre), `${l.default_code} → ${c.nombre}`).toBe(true);
                expect(c.nombre, l.default_code).not.toBe(l.default_code);
            }
        }
    });

    it('todo tramo "Calle" inventado queda marcado sinConfirmar y avisado (si no es despreciable)', () => {
        for (const l of lotes) {
            const r = resultados.get(l.default_code)!;
            const marcadores = r.colindancias.filter((c) => c.tipo === 'calle' && c.nombre === 'Calle');
            expect(marcadores.every((c) => c.sinConfirmar === true), l.default_code).toBe(true);
            const esperadas = marcadores.filter((c) => c.longitud >= 0.5).length;
            expect(r.advertencias.filter((a) => a.tipo === 'lado_sin_clasificar'), l.default_code).toHaveLength(esperadas);
        }
    });

    it('caso E01MZR049P: el fondo (6.66 m) son E01MZR042P 4.66 m y E01MZR041P 2.00 m', () => {
        const fondo = resultados.get('E01MZR049P')!.colindancias.filter((c) => c.lado === 'fondo');
        expect(fondo.map((c) => [c.tipo, c.nombre, c.longitud])).toEqual([
            ['lote', 'E01MZR042P', 4.66],
            ['lote', 'E01MZR041P', 2.0],
        ]);
    });

    it('el resultado no depende del orden en que vienen los lotes', () => {
        const invertidos = [...lotes].reverse();
        for (const code of ['E01MZR049P', 'E01MZQ013P', 'E01MZS091P', 'E01MZR045P']) {
            const l = lotes.find((x) => x.default_code === code)!;
            const a = derivarColindanciasYDimensiones(l, lotes, []);
            const b = derivarColindanciasYDimensiones(l, invertidos, []);
            expect(b.colindancias, code).toEqual(a.colindancias);
        }
    });

    it('golden: ningún lote cambió respecto a la última firma aprobada', () => {
        const actual: Record<string, string> = {};
        for (const l of lotes) actual[l.default_code] = firma(l.default_code);

        if (process.env.UPDATE_GOLDEN === '1' || !fs.existsSync(GOLDEN)) {
            fs.writeFileSync(GOLDEN, JSON.stringify(actual, null, 0) + '\n');
            return;
        }
        const esperado = JSON.parse(fs.readFileSync(GOLDEN, 'utf8')) as Record<string, string>;
        const distintos = Object.keys(actual).filter((c) => actual[c] !== esperado[c]);
        expect(distintos, 'lotes cuya colindancia cambió (revisar y regenerar con UPDATE_GOLDEN=1)').toEqual([]);
    });
});
