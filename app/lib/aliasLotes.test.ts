import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/services/odooPublicService', () => ({ fetchOdooPublic: vi.fn() }));

import { mapaDeAlias, resolverCodigoViejo } from './aliasLotes';
import { obtenerMapaAlias, resolverCodigoViejoEnServidor, vaciarCacheAlias } from './aliasLotesServidor';

const filas = [
  { alias: 'E01MZD129P', codigo_actual: 'E01MZD1293' },
  { alias: 'E02MZU022P', codigo_actual: 'E02MZU0222' },
];

describe('mapaDeAlias', () => {
  it('arma código viejo → código vigente', () => {
    expect(mapaDeAlias(filas)).toEqual({ E01MZD129P: 'E01MZD1293', E02MZU022P: 'E02MZU0222' });
  });

  it('ignora filas incompletas, que no son códigos o que apuntan a sí mismas', () => {
    expect(mapaDeAlias([
      { alias: false, codigo_actual: 'E01MZD1293' }, { alias: 'E01MZD129P', codigo_actual: false }, { alias: 'hola', codigo_actual: 'E01MZD1293' },
      { alias: 'E01MZD129P', codigo_actual: 'E01MZD129P' },
    ])).toEqual({});
  });

  it('un alias que dos lotes reclaman se descarta (no se adivina)', () => {
    expect(mapaDeAlias([{ alias: 'E01MZD129P', codigo_actual: 'E01MZD1293' }, { alias: 'E01MZD129P', codigo_actual: 'E05MZD1293' }])).toEqual({});
  });
});

describe('resolverCodigoViejo', () => {
  const mapa = mapaDeAlias(filas);

  it('traduce el alias al código vigente, también en minúsculas', () => {
    expect(resolverCodigoViejo('E01MZD129P', mapa)).toBe('E01MZD1293');
    expect(resolverCodigoViejo(' e01mzd129p ', mapa)).toBe('E01MZD1293');
  });

  it('conserva el proyecto si venía', () => {
    expect(resolverCodigoViejo('p01-E01MZD129P', mapa)).toBe('P01-E01MZD1293');
  });

  it('un código vigente o desconocido queda igual; lo que no es código también', () => {
    expect(resolverCodigoViejo('E01MZD1293', mapa)).toBe('E01MZD1293');
    expect(resolverCodigoViejo('E01MZQ055P', mapa)).toBe('E01MZQ055P');
    expect(resolverCodigoViejo('hola', mapa)).toBe('hola');
    expect(resolverCodigoViejo(undefined, mapa)).toBeUndefined();
    expect(resolverCodigoViejo('', mapa)).toBeUndefined();
  });
});

describe('lectura del servidor', () => {
  beforeEach(() => vaciarCacheAlias());

  it('lee una vez y guarda 5 minutos', async () => {
    const leer = vi.fn().mockResolvedValue(filas);
    let t = 0;
    const o = { leer, ahora: () => t };
    expect(await resolverCodigoViejoEnServidor('E01MZD129P', o)).toBe('E01MZD1293');
    t = 4 * 60 * 1000;
    await obtenerMapaAlias(o);
    expect(leer).toHaveBeenCalledTimes(1);
    t = 6 * 60 * 1000;
    await obtenerMapaAlias(o);
    expect(leer).toHaveBeenCalledTimes(2);
  });

  it('si Odoo falla (o no tiene el módulo) el código se usa tal cual', async () => {
    const leer = vi.fn().mockRejectedValue(new Error('Object proyecto.lote.alias doesn\'t exist'));
    expect(await resolverCodigoViejoEnServidor('E01MZD129P', { leer })).toBe('E01MZD129P');
  });

  it('si falla DESPUÉS de una lectura buena, sigue sirviendo el último mapa', async () => {
    let t = 0;
    const bien = { leer: vi.fn().mockResolvedValue(filas), ahora: () => t };
    await obtenerMapaAlias(bien);
    t = 10 * 60 * 1000;
    const mal = { leer: vi.fn().mockRejectedValue(new Error('caído')), ahora: () => t };
    expect(await resolverCodigoViejoEnServidor('E01MZD129P', mal)).toBe('E01MZD1293');
  });
});
