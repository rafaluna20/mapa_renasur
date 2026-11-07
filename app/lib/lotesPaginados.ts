// Lectura de lotes (product.template) sin el tope fijo de 1000 y respetando los proyectos desactivados.
//
// Antes: `limit: 1000` en seis consultas. Con más de 1000 lotes (hoy ~1,350 más el proyecto industrial de 350+) el
// recorte era silencioso: lotes faltaban en el mapa sin ningún aviso. Ahora se pagina y, si se alcanza el tope de
// seguridad, se devuelve `truncado: true` para avisarlo en pantalla.

type Rpc = (model: string, method: string, args: unknown[], kwargs?: Record<string, unknown>) => Promise<unknown>;

/** Un lote es visible si no tiene proyecto (por ahora, hasta asignarlo) o si su proyecto está ACTIVO. */
export const DOMINIO_PROYECTO_ACTIVO: unknown[] = ['|', ['x_proyecto_id', '=', false], ['x_proyecto_id.active', '=', true]];

export const PAGINA_LOTES = 500;
export const TOPE_LOTES = 20000;

export interface LotesLeidos<T> {
  registros: T[];
  truncado: boolean;
}

export async function leerLotesPaginados<T>(
  rpc: Rpc,
  dominio: unknown[],
  campos: string[],
  opciones: { model?: string; pagina?: number; tope?: number; context?: Record<string, unknown>; camposOpcionales?: string[] } = {},
): Promise<LotesLeidos<T>> {
  // Campos que solo existen en un Odoo más nuevo (p. ej. x_frente / x_potencia_kw, proyecto_inmobiliario >= 1.12.0): se piden con
  // los demás y, si Odoo no los conoce y la consulta falla, se repite SIN ellos. Así desplegar la app antes que Odoo no deja el
  // mapa vacío.
  const opcionales = opciones.camposOpcionales ?? [];
  if (opcionales.length > 0) {
    try {
      return await leerLotesPaginados<T>(rpc, dominio, [...campos, ...opcionales], { ...opciones, camposOpcionales: [] });
    } catch (error) {
      console.warn('[lotes] No se pudieron leer los campos opcionales; se leen sin ellos:', error instanceof Error ? error.message : error);
      return leerLotesPaginados<T>(rpc, dominio, campos, { ...opciones, camposOpcionales: [] });
    }
  }
  const model = opciones.model ?? 'product.template';
  const pagina = opciones.pagina ?? PAGINA_LOTES;
  const tope = opciones.tope ?? TOPE_LOTES;
  const completo = [...dominio, ...DOMINIO_PROYECTO_ACTIVO];
  const registros: T[] = [];
  let truncado = false;

  for (let offset = 0; ; offset += pagina) {
    const filas = (await rpc(model, 'search_read', [completo], {
      fields: campos,
      limit: pagina,
      offset,
      order: 'id',
      ...(opciones.context ? { context: opciones.context } : {}),
    })) as T[];
    registros.push(...filas);
    if (filas.length < pagina) break;
    if (registros.length >= tope) {
      truncado = true;
      break;
    }
  }
  return { registros, truncado };
}
