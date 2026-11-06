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
      expect(archivos.get(ruta)!, `${ruta} sin isSystem`).toContain('isSystem');
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
