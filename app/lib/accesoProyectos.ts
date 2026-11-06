import { NextResponse } from 'next/server';

// Módulo ÚNICO de acceso por proyecto (P3 multiproyecto).
//
// Qué proyectos ve un usuario lo decide Odoo (`res.users.proyecto_ids` / `proyecto_acceso_todos`, módulo
// proyecto_inmobiliario >= 1.9.0). Aquí se lee, se guarda en una caché corta (para que quitar un acceso surta efecto en
// ~1 minuto, no cuando venza la sesión de 8 h) y se aplica en el SERVIDOR antes de enviar nada al navegador.
//
// MODOS (variable ACCESO_PROYECTOS_MODO; por defecto «observar»):
//   off       no hace nada (comportamiento anterior);
//   observar  calcula lo que BLOQUEARÍA y lo registra, pero deja pasar todo. Se usa 1-2 semanas para corregir falsos
//             positivos antes de bloquear;
//   bloquear  aplica el filtro de verdad.
//
// REGLAS (supuestos del plan, ver PLAN_MULTIPROYECTO.md §4):
//   · Quien ve «todos» (administrador del sistema, Administrador de proyectos o «Ve todos») ve todo, también lo que
//     aún no tiene proyecto.
//   · Los demás ven SOLO los proyectos habilitados. Lo que no tiene proyecto queda en «cuarentena»: solo lo ven
//     quienes ven todo.
//   · Si no se puede leer el acceso (Odoo caído, módulo sin desplegar): en «observar» se deja pasar y se registra;
//     en «bloquear» se DENIEGA (cerrado ante la duda).

export type ModoAcceso = 'off' | 'observar' | 'bloquear';

export interface AccesoProyectos {
  todos: boolean;
  ids: ReadonlySet<number>;
  origen: 'sistema' | 'odoo' | 'error' | 'apagado';
}

type Rpc = (model: string, method: string, args: unknown[], kwargs?: Record<string, unknown>) => Promise<unknown>;

export interface SesionAcceso {
  odooUid: number;
  isSystem: boolean;
}

export const TTL_CACHE_MS = 60_000;

const cache = new Map<number, { acceso: AccesoProyectos; vence: number }>();

export function vaciarCacheAcceso(): void {
  cache.clear();
}

export function modoAcceso(env: Record<string, string | undefined> = process.env): ModoAcceso {
  const valor = (env.ACCESO_PROYECTOS_MODO ?? '').trim().toLowerCase();
  return valor === 'off' || valor === 'bloquear' || valor === 'observar' ? valor : 'observar';
}

const TODOS = (origen: AccesoProyectos['origen']): AccesoProyectos => ({ todos: true, ids: new Set(), origen });
const NADA = (): AccesoProyectos => ({ todos: false, ids: new Set(), origen: 'error' });

interface Opciones {
  rpc?: Rpc;
  ahora?: () => number;
  modo?: ModoAcceso;
}

async function rpcPorDefecto(): Promise<Rpc> {
  const { fetchOdoo } = await import('@/app/services/odooService');
  return fetchOdoo as Rpc;
}

/** Acceso del usuario de la sesión. Nunca lanza: ante un fallo decide según el modo (ver arriba). */
export async function obtenerAcceso(sesion: SesionAcceso, opciones: Opciones = {}): Promise<AccesoProyectos> {
  const modo = opciones.modo ?? modoAcceso();
  if (modo === 'off') return TODOS('apagado');
  if (sesion.isSystem) return TODOS('sistema');

  const ahora = (opciones.ahora ?? Date.now)();
  const guardado = cache.get(sesion.odooUid);
  if (guardado && guardado.vence > ahora) return guardado.acceso;

  try {
    const rpc = opciones.rpc ?? (await rpcPorDefecto());
    const filas = (await rpc('res.users', 'read', [[sesion.odooUid], ['proyecto_acceso_todos', 'proyecto_ids']])) as
      | Array<{ proyecto_acceso_todos?: boolean; proyecto_ids?: number[] }>
      | undefined;
    const fila = Array.isArray(filas) ? filas[0] : undefined;
    if (!fila || typeof fila.proyecto_acceso_todos !== 'boolean' || !Array.isArray(fila.proyecto_ids)) {
      throw new Error('respuesta sin los campos de acceso por proyecto');
    }
    const acceso: AccesoProyectos = {
      todos: fila.proyecto_acceso_todos,
      ids: new Set(fila.proyecto_ids.filter((n) => typeof n === 'number')),
      origen: 'odoo',
    };
    cache.set(sesion.odooUid, { acceso, vence: ahora + TTL_CACHE_MS });
    return acceso;
  } catch (error) {
    console.error(
      `[acceso] No se pudo leer el acceso por proyecto del uid ${sesion.odooUid} (¿proyecto_inmobiliario >= 1.9.0 desplegado?):`,
      error instanceof Error ? error.message : error,
    );
    return modo === 'bloquear' ? NADA() : TODOS('error');
  }
}

/** ¿Puede ver este proyecto? `null`/`undefined`/0 = sin proyecto → cuarentena (solo quien ve todo). */
export function puedeVer(acceso: AccesoProyectos, proyectoId: number | null | undefined): boolean {
  if (acceso.todos) return true;
  if (!proyectoId) return false;
  return acceso.ids.has(proyectoId);
}

/** Id de proyecto de un campo Many2one de Odoo (`[id, nombre]` o `false`) o de un id suelto. */
export function idProyecto(valor: unknown): number | null {
  if (Array.isArray(valor) && typeof valor[0] === 'number') return valor[0];
  if (typeof valor === 'number' && valor > 0) return valor;
  return null;
}

function registrar(modo: ModoAcceso, datos: Record<string, unknown>): void {
  if (modo === 'observar') {
    console.warn(`[acceso][observar] bloquearía: ${JSON.stringify(datos)}`);
  }
}

/**
 * Filtra una lista por proyecto. En «observar» devuelve la lista COMPLETA y registra lo que habría ocultado.
 * `recurso` nombra qué se filtra (para el registro).
 */
export function aplicarAcceso<T>(
  items: readonly T[],
  acceso: AccesoProyectos,
  proyectoDe: (item: T) => number | null | undefined,
  contexto: { uid: number; recurso: string; modo?: ModoAcceso },
): T[] {
  const modo = contexto.modo ?? modoAcceso();
  if (modo === 'off' || acceso.todos) return [...items];

  const visibles: T[] = [];
  const sinProyecto = { n: 0 };
  const ocultosPorProyecto = new Map<number, number>();
  for (const item of items) {
    const proyecto = proyectoDe(item);
    if (puedeVer(acceso, proyecto)) {
      visibles.push(item);
    } else if (!proyecto) {
      sinProyecto.n += 1;
    } else {
      ocultosPorProyecto.set(proyecto, (ocultosPorProyecto.get(proyecto) ?? 0) + 1);
    }
  }
  const ocultos = items.length - visibles.length;
  if (ocultos > 0) {
    registrar(modo, {
      uid: contexto.uid,
      recurso: contexto.recurso,
      ocultos,
      sinProyecto: sinProyecto.n,
      porProyecto: Object.fromEntries(ocultosPorProyecto),
    });
  }
  return modo === 'bloquear' ? visibles : [...items];
}

export type ResultadoGuardia = { ok: true } | { ok: false; response: NextResponse };

/**
 * Guardia de UN recurso (lote, contrato…) para las rutas: dado el proyecto del recurso, deja pasar o responde 403.
 * En «observar» siempre deja pasar y registra lo que habría bloqueado.
 */
export function guardiaProyecto(
  acceso: AccesoProyectos,
  proyectoId: number | null | undefined,
  contexto: { uid: number; ruta: string; recurso?: string; modo?: ModoAcceso },
): ResultadoGuardia {
  const modo = contexto.modo ?? modoAcceso();
  if (modo === 'off' || puedeVer(acceso, proyectoId)) return { ok: true };
  registrar(modo, { uid: contexto.uid, ruta: contexto.ruta, recurso: contexto.recurso, proyecto: proyectoId ?? null });
  if (modo === 'observar') return { ok: true };
  return {
    ok: false,
    response: NextResponse.json(
      { success: false, error: 'No tienes acceso al proyecto de este recurso.' },
      { status: 403 },
    ),
  };
}

/** Proyecto de un lote (por id de product.product/template o por código), o `undefined` si el lote no existe. */
export async function proyectoDeLote(
  ref: { productId?: number; templateId?: number; codigo?: string },
  rpc?: Rpc,
): Promise<number | null | undefined> {
  const llamar = rpc ?? (await rpcPorDefecto());
  let modelo = 'product.product';
  let dominio: unknown[];
  if (ref.productId) dominio = [['id', '=', ref.productId]];
  else if (ref.templateId) { modelo = 'product.template'; dominio = [['id', '=', ref.templateId]]; }
  else if (ref.codigo) dominio = [['default_code', '=', ref.codigo]];
  else return undefined;
  const filas = (await llamar(modelo, 'search_read', [dominio], { fields: ['x_proyecto_id'], limit: 1, context: { active_test: false } })) as
    Array<{ x_proyecto_id?: unknown }> | undefined;
  if (!Array.isArray(filas) || filas.length === 0) return undefined;
  return idProyecto(filas[0].x_proyecto_id);
}

/**
 * Guardia completa para las rutas que reciben un LOTE: resuelve su proyecto en Odoo y aplica el modo.
 * Si el lote no existe deja pasar (la ruta responde su propio 404). Si no se puede resolver el proyecto:
 * en «observar» se deja pasar y se registra; en «bloquear» se deniega.
 */
export async function guardiaLote(
  sesion: SesionAcceso,
  ref: { productId?: number; templateId?: number; codigo?: string },
  ruta: string,
  opciones: Opciones = {},
): Promise<ResultadoGuardia> {
  const modo = opciones.modo ?? modoAcceso();
  if (modo === 'off') return { ok: true };
  const acceso = await obtenerAcceso(sesion, { ...opciones, modo });
  if (acceso.todos) return { ok: true };
  try {
    const proyecto = await proyectoDeLote(ref, opciones.rpc);
    if (proyecto === undefined) return { ok: true };
    return guardiaProyecto(acceso, proyecto, { uid: sesion.odooUid, ruta, recurso: JSON.stringify(ref), modo });
  } catch (error) {
    console.error(`[acceso] No se pudo resolver el proyecto del lote en ${ruta}:`, error instanceof Error ? error.message : error);
    if (modo === 'observar') return { ok: true };
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: 'No se pudo verificar el acceso al proyecto.' }, { status: 503 }),
    };
  }
}
