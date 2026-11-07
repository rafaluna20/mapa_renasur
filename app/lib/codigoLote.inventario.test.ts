import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// P6: el código de lote se interpreta en UN solo lugar (app/lib/codigoLote.ts). Esta prueba impide que vuelva a aparecer una
// copia de la expresión regular en otro archivo (había 5, cada una un poco distinta).

const RAIZ = join(process.cwd(), 'app');
// huellas de una expresión regular que lee el código de lote: «E\d…MZ…» o «E\d+MZ[A-Z]»
const HUELLA = /E\\d[^/\n]{0,12}MZ|MZ\(?\[A-Z\]|MZ\[A-Z/;

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return nombre === 'data' || nombre === 'node_modules' ? [] : archivos(ruta);
    return /\.(ts|tsx)$/.test(nombre) && !/\.test\./.test(nombre) ? [ruta] : [];
  });
}

describe('el código de lote se interpreta en un solo lugar', () => {
  it('ningún archivo, salvo codigoLote.ts, tiene su propia expresión para leer el código', () => {
    const con = archivos(RAIZ)
      .map((f) => relative(process.cwd(), f).split(sep).join('/'))
      .filter((f) => f !== 'app/lib/codigoLote.ts')
      .filter((f) => HUELLA.test(readFileSync(f, 'utf-8')));
    expect(con, 'usa interpretarCodigoLote / extraerCodigoDeReferencia de app/lib/codigoLote.ts en vez de una expresión propia').toEqual([]);
  });

  it('la huella detecta una copia (la prueba no es vacía)', () => {
    expect(HUELLA.test("const m = /^E(\\d+)MZ([A-Z]+)(\\d+)$/.exec(c)")).toBe(true);
    expect(HUELLA.test("/^E\\d{2}MZ([A-Z]{1,2})/")).toBe(true);
    expect(HUELLA.test('const x = "E01MZD092P"')).toBe(false);
  });
});
