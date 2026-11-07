import { interpretarCodigoLote } from '@/app/lib/codigoLote';

// P6: cómo se llama un lote en pantalla, planos y mensajes. Un lote entero se llama como siempre (su `x_lote`). Un lote PARTIDO
// (E01MZD1241 = lote 124, parte A) se llama «124A»: el número SIN el sufijo de la parte, más la letra (1 = A, 2 = B, 3 = C).
// Se deduce del CÓDIGO y no de `x_lote`, para que se vea igual antes y después de corregir `x_lote` en Odoo
// (hoy `x_lote` de esos lotes trae la parte pegada: «1241»; después será «124»).

export interface ConNumeroDeLote {
  default_code?: string | false | null;
  x_lote?: string | false | null;
}

/** «124A» para una parte; el `x_lote` de siempre para un lote entero o un código que no se entiende; '' si no hay nada. */
export function numeroDeLote(lote: ConNumeroDeLote | null | undefined): string {
  if (!lote) return '';
  const p = interpretarCodigoLote(lote.default_code);
  if (p && p.letra) return `${p.lote}${p.letra}`;
  return typeof lote.x_lote === 'string' ? lote.x_lote : '';
}
