// Frente y potencia del lote (proyectos industriales). Opcionales: sin el dato no se muestra nada, nunca «0» ni un guion.

export interface AtributosLote {
  x_frente?: number | false;
  x_potencia_kw?: number | false;
}

const formato = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 });
const positivo = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** Lo que se muestra de un lote: [{ etiqueta, valor }]; vacío si no tiene frente ni potencia. */
export function atributosParaMostrar(lote: AtributosLote): { etiqueta: string; valor: string }[] {
  const filas: { etiqueta: string; valor: string }[] = [];
  if (positivo(lote.x_frente)) filas.push({ etiqueta: 'Frente', valor: `${formato.format(lote.x_frente)} m` });
  if (positivo(lote.x_potencia_kw)) filas.push({ etiqueta: 'Potencia', valor: `${formato.format(lote.x_potencia_kw)} kW` });
  return filas;
}

/** Una línea corta para el panel público: «frente 30 m · 250 kW». */
export function resumenAtributos(lote: AtributosLote): string {
  return atributosParaMostrar(lote)
    .map((a) => (a.etiqueta === 'Frente' ? `frente ${a.valor}` : a.valor))
    .join(' · ');
}
