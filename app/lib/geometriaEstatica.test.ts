import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import geometriesEnrichedRaw from '@/app/data/geometries-enriched.json';
import { mergeLotsData, type EnrichedGeometry } from '@/app/utils/dataMerger';
import type { OdooProduct } from '@/app/services/odooService';
import { geometriasEstaticas, usarGeometriaEstatica } from './geometriaEstatica';

const json = geometriesEnrichedRaw as unknown as Record<string, EnrichedGeometry>;
const CODIGOS = Object.keys(json);

describe('interruptor de la geometría estática', () => {
  it('por defecto (sin variable) se usa el JSON: comportamiento de hoy', () => {
    expect(usarGeometriaEstatica(undefined)).toBe(true);
    // 1,342 del JSON menos 2 entradas que no son lotes aparte (E02MZU0221 y E02MZU0222): ver GEOMETRIAS_ESTATICAS_DESCARTADAS.
    expect(Object.keys(geometriasEstaticas(undefined))).toHaveLength(1340);
  });

  it('«no» la apaga (y no distingue mayúsculas ni espacios); cualquier otro valor la deja encendida', () => {
    for (const v of ['no', 'NO', ' No ']) {
      expect(usarGeometriaEstatica(v)).toBe(false);
      expect(Object.keys(geometriasEstaticas(v))).toHaveLength(0);
    }
    for (const v of ['si', 'SI', '', 'quizas', 'false']) expect(usarGeometriaEstatica(v)).toBe(true);
  });

  it('apagada devuelve un objeto congelado: nadie puede meterle lotes por error', () => {
    const vacia = geometriasEstaticas('no');
    expect(Object.isFrozen(vacia)).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Prueba «golden» (P4.4): la salida de hoy (Odoo trae 538 lotes y el JSON cubre el resto) contra la de DESPUÉS de P4.1/P4.2
// (Odoo trae los 1,342 lotes con su geometría y el JSON ya no se usa). Si esta prueba pasa, apagar el JSON no cambia lo
// que se dibuja, ni las medidas, ni el estado de los lotes.
// ---------------------------------------------------------------------------------------------------------------------

function productoOdoo(codigo: string, i: number, g: EnrichedGeometry): OdooProduct {
  const m = codigo.match(/^E(\d{2})MZ([A-Z]+)(\d+)/)!;
  return {
    id: 100000 + i,
    name: `etapa ${Number(m[1])} mz ${m[2]} lote ${Number(m[3])} A=${g.measurements.area}m2`,
    default_code: codigo,
    list_price: 0,
    qty_available: 0,
    x_statu: 'no vender',
    x_area: g.measurements.area,
    x_mz: m[2],
    x_etapa: String(Number(m[1])),
    x_lote: String(Number(m[3])),
    x_geometry_utm: g.coordinates,
    x_proyecto_id: [2, 'Terra Lima'],
  } as unknown as OdooProduct;
}

describe('golden: JSON de respaldo contra solo-Odoo', () => {
  const hoy = mergeLotsData([], [], json); // todo sale del respaldo (peor caso: Odoo no tiene ninguno)
  const despues = mergeLotsData(CODIGOS.map((c, i) => productoOdoo(c, i, json[c])), [], {});
  const porCodigo = (lotes: typeof hoy) => new Map(lotes.map((l) => [l.default_code, l]));
  const A = porCodigo(hoy);
  const B = porCodigo(despues);

  it('salen los mismos 1,342 lotes, ni uno más ni uno menos', () => {
    expect(hoy).toHaveLength(1342);
    expect(despues).toHaveLength(1342);
    expect([...B.keys()].sort()).toEqual([...A.keys()].sort());
  });

  it('los vértices son idénticos (misma limpieza de vértices repetidos)', () => {
    let distintos = 0;
    for (const [codigo, a] of A) {
      const b = B.get(codigo)!;
      const igual = a.points.length === b.points.length && a.points.every((p, i) => p[0] === b.points[i][0] && p[1] === b.points[i][1]);
      if (!igual) distintos += 1;
    }
    expect(distintos).toBe(0);
  });

  // Los 9 lotes cuyo centroide en el JSON está SESGADO: tienen un vértice repetido y el script que generó el JSON promedió
  // los vértices incluyendo el repetido. Desde Odoo el mapa limpia el vértice repetido ANTES de calcular, así que el valor
  // nuevo es el correcto (hasta 12 m de diferencia en el más irregular). Lista cerrada: cualquier otro lote que difiera falla.
  const CENTROIDE_SESGADO_EN_EL_JSON = [
    'E02MZO003P', 'E02MZV001P', 'E02MZW022P', 'E03MZD049P', 'E04MZA015P', 'E04MZZ001P', 'E04MZZ003P', 'E04MZZ004P', 'E04MZZ005P',
  ];

  it('lados, área y perímetro calculados desde Odoo coinciden con los del JSON (tolerancia 2 cm / 2 cm²)', () => {
    const peor = { lado: 0, area: 0, perimetro: 0, lados: 0 };
    for (const [codigo, a] of A) {
      const ma = a.measurements!;
      const mb = B.get(codigo)!.measurements!;
      if (ma.sides.length !== mb.sides.length) peor.lados += 1;
      ma.sides.forEach((s, i) => { peor.lado = Math.max(peor.lado, Math.abs(s - (mb.sides[i] ?? NaN))); });
      peor.area = Math.max(peor.area, Math.abs(ma.area - mb.area));
      peor.perimetro = Math.max(peor.perimetro, Math.abs(ma.perimeter - mb.perimeter));
    }
    expect(peor.lados, 'lotes con distinta cantidad de lados').toBe(0);
    expect(peor.lado).toBeLessThanOrEqual(0.02);
    expect(peor.area).toBeLessThanOrEqual(0.02);
    expect(peor.perimetro).toBeLessThanOrEqual(0.02);
  });

  it('el centroide coincide (2 cm) salvo en los 9 lotes con vértice repetido, donde el JSON estaba sesgado', () => {
    const distintos: string[] = [];
    for (const [codigo, a] of A) {
      const ca = a.measurements!.centroid;
      const cb = B.get(codigo)!.measurements!.centroid;
      if (Math.hypot(ca[0] - cb[0], ca[1] - cb[1]) > 0.02) distintos.push(codigo);
    }
    expect(distintos.sort()).toEqual(CENTROIDE_SESGADO_EN_EL_JSON);
  });

  it('en esos 9 lotes el centroide nuevo es el promedio de los vértices SIN el repetido (el JSON lo incluía)', () => {
    for (const codigo of CENTROIDE_SESGADO_EN_EL_JSON) {
      const bruto = json[codigo].coordinates;
      const limpio = bruto.filter((p, i) => Math.hypot(p[0] - bruto[(i + 1) % bruto.length][0], p[1] - bruto[(i + 1) % bruto.length][1]) >= 0.01);
      const media = [limpio.reduce((s, p) => s + p[0], 0) / limpio.length, limpio.reduce((s, p) => s + p[1], 0) / limpio.length];
      const nuevo = B.get(codigo)!.measurements!.centroid;
      expect(Math.hypot(media[0] - nuevo[0], media[1] - nuevo[1]), codigo).toBeLessThan(0.02);
      const viejo = A.get(codigo)!.measurements!.centroid;
      expect(Math.hypot(viejo[0] - nuevo[0], viejo[1] - nuevo[1]), codigo).toBeGreaterThan(0.02);
    }
  });

  it('el estado, el precio y el área comercial son los mismos: ninguno aparece como disponible', () => {
    for (const [codigo, a] of A) {
      const b = B.get(codigo)!;
      expect(b.x_statu, codigo).toBe(a.x_statu);
      expect(b.list_price, codigo).toBe(a.list_price);
      expect(b.x_statu).toBe('no vender');
    }
    const aprox = [...A.values()].filter((a) => Math.abs(a.x_area - B.get(a.default_code)!.x_area) > 0.011);
    expect(aprox).toHaveLength(0);
  });

  it('manzana, etapa y número salen igual de la columna de Odoo que del código', () => {
    for (const [codigo, a] of A) {
      const b = B.get(codigo)!;
      expect(b.x_mz, codigo).toBe(a.x_mz);
      expect(Number(b.x_etapa), codigo).toBe(Number(a.x_etapa));
    }
  });

  it('lo único que cambia es la identidad del registro: id numérico de Odoo en vez de «fb-…» y el proyecto', () => {
    const muestra = [...A.values()][0];
    expect(muestra.id.startsWith('fb-')).toBe(true);
    expect(B.get(muestra.default_code)!.id).toMatch(/^\d+$/);
    expect(B.get(muestra.default_code)!.x_proyectoId).toBe(2);
  });
});

describe('carga con 3,000 lotes (objetivo de rendimiento de P4)', () => {
  it('fusionar 3,000 lotes con geometría de Odoo tarda menos de 3 s', () => {
    const base = CODIGOS.slice(0, 1000);
    const productos: OdooProduct[] = [];
    for (let k = 0; k < 3; k += 1) {
      base.forEach((c, i) => {
        const g = json[c];
        const desplazada: EnrichedGeometry = {
          coordinates: g.coordinates.map(([x, y]) => [x + k * 5000, y] as [number, number]),
          measurements: g.measurements,
        };
        productos.push({ ...productoOdoo(c.replace(/P$/, `P${k}`), k * 1000 + i, desplazada), default_code: `${c}-${k}` });
      });
    }
    const t0 = performance.now();
    const lotes = mergeLotsData(productos, [], {});
    const ms = performance.now() - t0;
    expect(lotes).toHaveLength(3000);
    expect(ms).toBeLessThan(3000);
  });
});

describe('nadie lee el JSON por su cuenta', () => {
  function archivos(dir: string): string[] {
    return readdirSync(dir).flatMap((n) => {
      const ruta = join(dir, n);
      if (statSync(ruta).isDirectory()) return n === 'node_modules' || n === '.next' ? [] : archivos(ruta);
      return /\.(ts|tsx)$/.test(n) ? [ruta] : [];
    });
  }

  it('solo app/lib/geometriaEstatica.ts importa geometries(-enriched).json (así apagarlo es un solo interruptor)', () => {
    const intrusos = archivos(join(process.cwd(), 'app'))
      .filter((f) => !/geometriaEstatica\.(test\.)?ts$/.test(f))
      .filter((f) => /from\s+['"][^'"]*geometries(-enriched)?\.json['"]/.test(readFileSync(f, 'utf-8')));
    expect(intrusos).toEqual([]);
  });
});

describe('geometrías estáticas que no son lotes aparte', () => {
  it('E02MZU0221 y E02MZU0222 no se dibujan como lotes «solo geometría» (el lote 22 se llama E02MZU022P en Odoo)', async () => {
    const { geometriasEstaticas, GEOMETRIAS_ESTATICAS_DESCARTADAS } = await import('./geometriaEstatica');
    const g = geometriasEstaticas('si');
    for (const c of GEOMETRIAS_ESTATICAS_DESCARTADAS) expect(g[c], c).toBeUndefined();
    expect(Object.keys(g).length).toBeGreaterThan(1300);
    expect(g['E02MZU021P']).toBeDefined();
  });
});
