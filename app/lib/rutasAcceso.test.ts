import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RUTAS_ACCESO } from './rutasAcceso';

const RAIZ_API = join(process.cwd(), 'app', 'api');

function rutasReales(dir = RAIZ_API): string[] {
  const salida: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) salida.push(...rutasReales(ruta));
    else if (nombre === 'route.ts') salida.push(ruta);
  }
  return salida;
}

const archivos = new Map<string, string>(
  rutasReales().map((f) => [
    '/api/' + relative(RAIZ_API, f).split(sep).join('/').replace(/\/?route\.ts$/, ''),
    readFileSync(f, 'utf-8'),
  ]),
);

describe('inventario de rutas /api', () => {
  it('toda ruta existente está clasificada', () => {
    const sinClasificar = [...archivos.keys()].filter((r) => !(r in RUTAS_ACCESO));
    expect(sinClasificar, 'rutas nuevas sin clasificar en app/lib/rutasAcceso.ts').toEqual([]);
  });

  it('no queda ninguna ruta clasificada que ya no exista', () => {
    expect(Object.keys(RUTAS_ACCESO).filter((r) => !archivos.has(r))).toEqual([]);
  });

  it('las rutas retiradas responden 410 y no tocan Odoo', () => {
    for (const [ruta, cat] of Object.entries(RUTAS_ACCESO)) {
      if (cat !== 'retirada') continue;
      const src = archivos.get(ruta)!;
      expect(src, ruta).toContain('status: 410');
      expect(src, ruta).not.toContain('fetchOdoo');
    }
  });

  it('las rutas de personal exigen sesión de staff', () => {
    for (const [ruta, cat] of Object.entries(RUTAS_ACCESO)) {
      if (!['staff-lote', 'staff-admin', 'staff-neutra', 'staff-pendiente'].includes(cat)) continue;
      expect(archivos.get(ruta)!, `${ruta} (${cat}) sin requireStaffSession`).toMatch(/requireStaffSession|getStaffSession/);
    }
  });

  it('las rutas «staff-lote» usan la guardia de proyecto', () => {
    for (const [ruta, cat] of Object.entries(RUTAS_ACCESO)) {
      if (cat !== 'staff-lote') continue;
      expect(archivos.get(ruta)!, `${ruta} sin guardiaLote`).toContain('guardiaLote(');
    }
  });

  it('las rutas «staff-admin» comprueban isSystem', () => {
    for (const [ruta, cat] of Object.entries(RUTAS_ACCESO)) {
      if (cat !== 'staff-admin') continue;
      // La comprobación REAL (un `if (!…isSystem)` que corta), no la palabra suelta: un comentario con «isSystem» no basta.
      // Acepta las dos formas que usan las rutas: `if (!auth.session.isSystem)` y `const isSystem = auth.session.isSystem; … !isSystem`.
      expect(archivos.get(ruta)!, `${ruta} sin la comprobación isSystem`).toMatch(/if\s*\(\s*!\s*auth\.session\.isSystem\s*\)|const\s+isSystem\s*=\s*auth\.session\.isSystem[\s\S]{0,240}!\s*isSystem/);
    }
  });

  it('las rutas públicas no usan la cuenta de servicio sin querer: se revisan a mano', () => {
    // Lista cerrada: si una ruta pública nueva toca fetchOdoo hay que decidirlo conscientemente.
    const publicasConOdoo = Object.entries(RUTAS_ACCESO)
      .filter(([r, c]) => c === 'publica' && /import[^;]*from\s+['"]@\/app\/services\/(odooService|odooRpc)['"]/.test(archivos.get(r)!))
      .map(([r]) => r)
      .sort();
    expect(publicasConOdoo).toEqual([
      '/api/auth/[...nextauth]', '/api/auth/request-code', '/api/chat',
    ].sort());
  });

  it('deuda de P3: las rutas de personal aún sin alcance por proyecto (se reduce, no crece)', () => {
    const pendientes = Object.entries(RUTAS_ACCESO).filter(([, c]) => c === 'staff-pendiente').map(([r]) => r).sort();
    expect(pendientes).toHaveLength(13);
  });
});

describe('la comprobación de administrador no se deja engañar por un comentario', () => {
  const REGEX = /if\s*\(\s*!\s*auth\.session\.isSystem\s*\)|const\s+isSystem\s*=\s*auth\.session\.isSystem[\s\S]{0,240}!\s*isSystem/;
  it('un comentario que nombra isSystem no cuenta', () => {
    expect(REGEX.test('// ver el gate isSystem ahí\nconst auth = await requireStaffSession(request);')).toBe(false);
  });
  it('las dos formas reales sí cuentan', () => {
    expect(REGEX.test('if (!auth.session.isSystem) { return x; }')).toBe(true);
    expect(REGEX.test('const isSystem = auth.session.isSystem;\nif (!userId || !isSystem) {')).toBe(true);
  });
});
