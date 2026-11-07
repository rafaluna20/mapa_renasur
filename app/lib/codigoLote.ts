// P6 — UNA sola función que interpreta el código de un lote (antes había una copia de la expresión regular en cada archivo, cada
// una un poco distinta). Su gemela en Python es proyecto_inmobiliario/codigo_lote.py: las dos se prueban con los MISMOS códigos
// reales (app/lib/__fixtures__/codigosReales.json = proyecto_inmobiliario/tests/codigos_reales.json).
//
// Formatos que entiende:
//   legado  E01MZQ055P      E=etapa (2 dígitos) · MZ · manzana (1-2 letras) · lote (3 dígitos) · sufijo
//   nuevo   P01-E01MZQ055P  el mismo con el código corto del proyecto delante y un guion (SUPUESTO: es el formato recomendado en
//                           el plan; la decisión final es del usuario y solo cambiaría formatearCodigoLote).
// Sufijo: P = lote entero (parte 0) · 1-9 = parte de un lote partido (1 = A, 2 = B, 3 = C; E01MZD1241 es el lote 124, parte A) · Z = caso heredado (4 lotes E05MZY00xZ), sin parte.
// Límite conocido: el número de lote tiene 3 dígitos (máximo medido en producción: 155); con 4 sería ambiguo con la parte.

export interface PartesCodigo {
  /** 'P01', o null si el texto venía en formato legado. */
  proyecto: string | null;
  /** '01' */
  etapa: string;
  /** 'Q' */
  manzana: string;
  /** 55 */
  lote: number;
  /** 'P' | '1'..'9' | 'Z' */
  sufijo: string;
  /** 0 = entero, 1-9 = parte, null = no se sabe (sufijo Z). */
  parte: number | null;
  /** 'A' para la parte 1, 'B' para la 2… (E01MZD1241 = lote 124, parte A); null si el lote está entero o no se sabe. */
  letra: string | null;
  /** 'E01MZQ055P': el código de siempre, sin proyecto. */
  legado: string;
}

const CODIGO = /^(?:(P\d{2,3})-)?E(\d{2})MZ([A-Z]{1,2})(\d{3})([P1-9Z])$/;
const EN_REFERENCIA = /(?:P\d{2,3}-)?(E\d{2}MZ[A-Z]{1,2}\d{3}[P1-9Z])-(?:C\d+|INIT)/i;
// forma floja que leía el código anterior: se sigue aceptando (marcada como irregular) para no perder facturas raras
const EN_REFERENCIA_FLOJA = /(E\d+MZ[A-Z]+\d+[A-Z]?)-(?:C\d+|INIT)/i;

/** Parte 1 → 'A', 2 → 'B'… hasta 9 → 'I'. */
export function letraDeParte(parte: number | null): string | null {
  return parte !== null && Number.isInteger(parte) && parte >= 1 && parte <= 9 ? String.fromCharCode(64 + parte) : null;
}

export function interpretarCodigoLote(texto: unknown): PartesCodigo | null {
  if (typeof texto !== 'string') return null;
  const m = CODIGO.exec(texto.trim().toUpperCase());
  if (!m) return null;
  const [, proyecto, etapa, manzana, lote, sufijo] = m;
  const parte = sufijo === 'P' ? 0 : /^\d$/.test(sufijo) ? Number(sufijo) : null;
  return {
    proyecto: proyecto ?? null,
    etapa,
    manzana,
    lote: parseInt(lote, 10),
    sufijo,
    parte,
    letra: letraDeParte(parte),
    legado: `E${etapa}MZ${manzana}${lote}${sufijo}`,
  };
}

/** El código nuevo (P01-E01MZQ055P) a partir del código corto del proyecto; null si falta algo. */
export function formatearCodigoLote(proyectoCorto: string | null | undefined, partes: PartesCodigo | null): string | null {
  if (!proyectoCorto || !partes) return null;
  return `${proyectoCorto}-${partes.legado}`;
}

/** El código de siempre (sin proyecto) de un texto en cualquiera de los dos formatos; null si no es un código de lote. */
export function codigoLegado(texto: unknown): string | null {
  return interpretarCodigoLote(texto)?.legado ?? null;
}

/** ¿Es el mismo lote? Compara el código de siempre; si los dos traen proyecto, también deben coincidir. */
export function mismoLote(a: unknown, b: unknown): boolean {
  const pa = interpretarCodigoLote(a);
  const pb = interpretarCodigoLote(b);
  if (!pa || !pb || pa.legado !== pb.legado) return false;
  return !(pa.proyecto && pb.proyecto && pa.proyecto !== pb.proyecto);
}

/** Saca el código de lote de la referencia de una factura («CONTRATOMANUAL-E01MZD148P-C013» o «…-INIT»). */
export function extraerCodigoDeReferencia(texto: unknown): { codigo: string; irregular: boolean } | null {
  if (typeof texto !== 'string') return null;
  const m = EN_REFERENCIA.exec(texto);
  if (m) return { codigo: m[1].toUpperCase(), irregular: false };
  const f = EN_REFERENCIA_FLOJA.exec(texto);
  return f ? { codigo: f[1].toUpperCase(), irregular: true } : null;
}
