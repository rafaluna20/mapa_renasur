import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MENCIONES_TERRA_LIMA, resumenPorCategoria } from './constantesDeProyecto';

const RAIZ = join(process.cwd(), 'app');
const PATRON = /Terra ?Lima|TERRA LIMA|terra-lima|TerraLima/gi;

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return nombre === 'data' || nombre === 'node_modules' ? [] : archivos(ruta);
    return /\.(ts|tsx|css)$/.test(nombre) && !/\.test\./.test(nombre) && nombre !== 'constantesDeProyecto.ts' ? [ruta] : [];
  });
}

const reales = new Map<string, number>();
for (const f of archivos(RAIZ)) {
  const n = (readFileSync(f, 'utf-8').match(PATRON) ?? []).length;
  if (n > 0) reales.set(relative(process.cwd(), f).split(sep).join('/'), n);
}

describe('constantes de proyecto en el código', () => {
  it('toda mención está registrada: no se puede añadir «Terra Lima» fijo sin decidir qué es', () => {
    const nuevas = [...reales.keys()].filter((f) => !(f in MENCIONES_TERRA_LIMA));
    expect(nuevas, 'archivos con menciones nuevas: regístralos en app/lib/constantesDeProyecto.ts (o mejor, saca el dato del proyecto)').toEqual([]);
  });

  it('el registro coincide EXACTO con la realidad (si bajan las menciones, baja el número)', () => {
    const distintas = Object.entries(MENCIONES_TERRA_LIMA)
      .filter(([f, r]) => (reales.get(f) ?? 0) !== r.max)
      .map(([f, r]) => `${f}: registrado ${r.max}, real ${reales.get(f) ?? 0}`);
    expect(distintas).toEqual([]);
  });

  it('las categorías suman todas las menciones', () => {
    const total = [...reales.values()].reduce((a, b) => a + b, 0);
    expect(Object.values(resumenPorCategoria()).reduce((a, b) => a + b, 0)).toBe(total);
  });

  it('NO queda ningún texto de proyecto ni de marca escrito a mano: la deuda de P5 en este frente es cero y no puede volver', () => {
    const r = resumenPorCategoria();
    expect(r.proyecto).toBe(0);
    expect(r.marca).toBe(0);
  });
});
