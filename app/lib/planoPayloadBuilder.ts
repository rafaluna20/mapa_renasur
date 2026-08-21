import { NextResponse } from 'next/server';
import { fetchOdoo, fetchElementosUrbanos, fetchProyectos, OdooProduct, Proyecto } from '@/app/services/odooService';
import { lotsData, Lot } from '@/app/data/lotsData';
import { mergeLotsData, normalizeCode } from '@/app/utils/dataMerger';
import { derivarColindanciasYDimensiones } from '@/app/utils/colindanciasUtils';
import { calculateCentroid, calculateDistance } from '@/app/utils/geometryUtils';
import geometriesEnrichedRaw from '@/app/data/geometries-enriched.json';
import { mergeElementosUrbanos } from '@/app/data/elementosUrbanos';

// Extraído de app/api/planos/generar/route.ts para que
// app/api/planos/generar-resumen/route.ts pueda armar exactamente el mismo
// payload (geometría, colindancias, contexto urbano) sin duplicar esta
// lógica — ambas rutas solo difieren en el `config` que le mandan a
// plan_pro y en el gate de sesión (admin vs. cualquier staff).

const RADIO_CONTEXTO_METROS = 250;

interface UbicacionProyecto {
  departamento: string;
  provincia: string;
  distrito: string;
  urbanizacion: string;
  zonaUTM?: number; // Solo si el proyecto NO cae en zona 18S (default de plan_pro)
}

// Único proyecto que existía antes de que proyecto.inmobiliario (Odoo)
// existiera — fallback SOLO para lotes sin x_proyectoId NI x_proyecto
// asignado (comportamiento histórico, el 100% de los lotes de antes de esta
// migración). En cuanto el proyecto "terra-lima" se cargue en Odoo, este
// fallback deja de usarse: resolverUbicacionProyecto siempre prioriza el
// dato real de Odoo por sobre este valor fijo.
const FALLBACK_TERRA_LIMA: UbicacionProyecto = {
  departamento: 'Lima',
  provincia: 'Lima',
  distrito: 'Pucusana',
  urbanizacion: 'Terra Lima',
};
/**
 * Resuelve la ubicación administrativa (y zona UTM) de un lote contra los
 * proyectos reales de Odoo (proyecto.inmobiliario) — reemplaza al
 * diccionario UBICACION_POR_PROYECTO que antes vivía hardcodeado acá:
 * crear un proyecto nuevo ya no requiere tocar este archivo.
 *
 * Orden de resolución:
 * 1. x_proyectoId (Many2one real) contra el id del proyecto — sin ambigüedad.
 * 2. x_proyecto (texto libre, deprecado) contra el código del proyecto —
 *    cubre lotes que todavía no pasaron por la migración de datos.
 * 3. Si el lote no tiene NINGUNO de los dos asignado: Terra Lima por
 *    defecto (mismo comportamiento histórico).
 * 4. Si tiene alguno asignado pero no matchea contra ningún proyecto real
 *    (código no registrado, o proyecto_inmobiliario recién desplegándose):
 *    undefined — mejor sin ubicación que mostrar la de otro proyecto.
 */
function resolverUbicacionProyecto(lote: Lot, proyectos: Proyecto[]): UbicacionProyecto | undefined {
  let proyecto = lote.x_proyectoId
    ? proyectos.find((p) => p.id === lote.x_proyectoId)
    : undefined;

  if (!proyecto) {
    const codigo = lote.x_proyecto?.trim();
    if (codigo) {
      proyecto = proyectos.find((p) => p.codigo === codigo);
    }
  }

  if (proyecto) {
    return {
      departamento: proyecto.departamento,
      provincia: proyecto.provincia,
      distrito: proyecto.distrito,
      urbanizacion: proyecto.urbanizacion,
      zonaUTM: proyecto.zonaUTM ? Number(proyecto.zonaUTM) : undefined,
    };
  }

  if (!lote.x_proyectoId && !lote.x_proyecto?.trim()) {
    return FALLBACK_TERRA_LIMA;
  }

  console.warn(
    `[planoPayloadBuilder] Proyecto del lote ${lote.default_code} ` +
    `(x_proyectoId=${lote.x_proyectoId}, x_proyecto="${lote.x_proyecto}") ` +
    `no resuelto contra proyecto.inmobiliario — el plano se generará sin ubicación administrativa.`
  );
  return undefined;
}

const geometriesJson = geometriesEnrichedRaw as unknown as Record<string, {
  coordinates: [number, number][];
  measurements: { sides: number[]; area: number; perimeter: number; centroid: [number, number] };
}>;

/**
 * Limpia el valor crudo de x_ubicacion (texto libre cargado por el equipo
 * comercial): recorta espacios y descarta valores placeholder/basura que
 * aparecen en los datos reales (ej. una fila de guiones usada como
 * separador visual en Odoo, o un solo espacio en blanco).
 */
function limpiarUbicacionCalle(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (/^[-_.\s]+$/.test(trimmed)) return undefined;
  return trimmed;
}

/**
 * Arma una dirección completa (calle/referencia + manzana + lote) a partir
 * de x_ubicacion (ej. "CALLE 13" -> "Calle 13, Mz. Q Lote 72"). Si no hay
 * dato de calle para este lote (24% de cobertura faltante hoy), no se manda
 * 'direccion' en absoluto — plan_pro ya sintetiza "Mz. X Lote Y" como
 * fallback en ese caso, así que no hace falta duplicar esa lógica acá.
 */
function construirDireccion(lote: Lot): string | undefined {
  const calle = limpiarUbicacionCalle(lote.x_ubicacion);
  if (!calle) return undefined;
  return `${calle}, Mz. ${lote.x_mz} Lote ${lote.x_lote}`;
}

function mapEstadoParaPlanoPro(xStatu: string): 'libre' | 'separado' | 'vendido' {
  const normalizado = (xStatu || '').toLowerCase();
  if (normalizado.includes('vendido')) return 'vendido';
  if (normalizado.includes('separado') || normalizado.includes('cotizacion') || normalizado.includes('cotización')) {
    return 'separado';
  }
  return 'libre';
}

export type PlanoPayloadResult =
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; response: NextResponse };

/**
 * Arma el payload completo (geometría, colindancias, contexto urbano) que
 * se le manda a plan_pro para un lote dado, a partir de su defaultCode.
 * No incluye `config` ni `staff` — eso lo agrega cada ruta llamante según
 * qué documento necesite y quién lo pidió.
 */
export async function construirPayloadPlano(defaultCode: string): Promise<PlanoPayloadResult> {
  // 1. Traer todos los lotes (Odoo + JSON estático) para poder derivar
  //    colindancias — necesitamos la geometría de los vecinos, no solo la del lote objetivo.
  const odooProducts: OdooProduct[] = await fetchOdoo(
    'product.template',
    'search_read',
    [[['active', '=', true]]],
    {
      fields: ['id', 'name', 'default_code', 'list_price', 'qty_available', 'x_statu', 'x_area', 'x_mz', 'x_etapa', 'x_lote', 'x_cliente', 'x_geometry_utm', 'x_proyecto', 'x_proyecto_id', 'x_ubicacion', 'x_geometry_arcos'],
      limit: 1000,
      context: { lang: 'es_PE' },
    }
  );

  const allLots: Lot[] = mergeLotsData(odooProducts, lotsData, geometriesJson);

  const normCode = normalizeCode(defaultCode);
  const lote = allLots.find((l) => normalizeCode(l.default_code) === normCode);

  if (!lote) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: { code: 'LOT_NOT_FOUND', message: `Lote ${defaultCode} no encontrado` } },
        { status: 404 }
      ),
    };
  }

  if (!lote.points || lote.points.length < 3) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: { code: 'NO_GEOMETRY', message: `El lote ${defaultCode} no tiene geometría cargada` } },
        { status: 400 }
      ),
    };
  }

  // 2. Derivar colindancias y dimensiones por geometría (frente/fondo/derecha/izquierda)
  const [elementosUrbanosOdoo, proyectos] = await Promise.all([
    fetchElementosUrbanos(),
    fetchProyectos(),
  ]);
  const elementosUrbanos = mergeElementosUrbanos(elementosUrbanosOdoo);
  // DIAGNOSTICO TEMPORAL: confirmar si el color ya llega mal desde Odoo o
  // se pierde despues, al armar el payload hacia plan_pro. Quitar una vez
  // resuelto el bug de "colores en escala de grises en el PDF".
  console.log('[planoPayloadBuilder][DIAG] elementosUrbanos desde Odoo:', JSON.stringify(
    elementosUrbanos.map((e) => ({ codigo: e.codigo, tipo: e.tipo, colorBorde: e.colorBorde, colorRelleno: e.colorRelleno, mostrarEtiqueta: e.mostrarEtiqueta }))
  ));
  const { colindancias, dimensiones } = derivarColindanciasYDimensiones(lote, allLots, elementosUrbanos);

  // 3. Contexto de entorno: todos los lotes cuyo centroide cae dentro de un
  //    radio fijo del centroide del lote objetivo, para dibujar el entorno
  //    real (no solo los colindantes directos que comparten borde).
  const centroidLote = calculateCentroid(lote.points);
  const elementosContexto = allLots
    .filter((l) => {
      if (l.default_code === lote.default_code) return false;
      if (!l.points || l.points.length < 3) return false;
      const centroidVecino = calculateCentroid(l.points);
      return calculateDistance(centroidLote, centroidVecino) <= RADIO_CONTEXTO_METROS;
    })
    .map((l) => ({
      tipo: 'LOTE',
      codigo: l.default_code,
      texto: l.x_lote || l.default_code,
      estado: l.x_statu,
      vertices: l.points,
    }));

  // 3b. Calles y áreas verdes reales (elemento.urbano, ver
  // derivarColindanciasYDimensiones más arriba): antes solo se usaban
  // para el texto de colindancias en la Memoria Descriptiva, nunca se
  // dibujaban en el plano. Sin filtro de radio — son pocos elementos por
  // proyecto y suelen ser relevantes aunque el centroide caiga un poco
  // afuera del radio de lotes vecinos.
  // "tipo" ya no pasa por una convención de mayúsculas fija: viaja tal
  // cual el código de capa dinámico (elemento.urbano.capa en Odoo), junto
  // con su color/mostrarEtiqueta — así una capa nueva no requiere tocar
  // este archivo ni el adaptador de plan_pro.
  const elementosUrbanosContexto = elementosUrbanos.map((e) => ({
    tipo: e.tipo,
    colorBorde: e.colorBorde,
    colorRelleno: e.colorRelleno,
    mostrarEtiqueta: e.mostrarEtiqueta,
    esArea: e.esArea,
    sinRelleno: e.sinRelleno,
    sinBorde: e.sinBorde,
    codigo: e.codigo,
    texto: e.nombre,
    estado: '',
    vertices: e.points,
    arcos: e.arcos,
    circulo: e.circulo,
  }));
  // DIAGNOSTICO TEMPORAL: ver el mismo dato tal cual queda armado para el
  // payload final hacia plan_pro (justo antes del fetch en cada ruta llamante).
  console.log('[planoPayloadBuilder][DIAG] elementosUrbanosContexto (payload hacia plan_pro):', JSON.stringify(
    elementosUrbanosContexto.map((e) => ({ codigo: e.codigo, tipo: e.tipo, colorBorde: e.colorBorde, colorRelleno: e.colorRelleno, mostrarEtiqueta: e.mostrarEtiqueta }))
  ));

  // 4. Armar el payload para plan_pro
  const ubicacionProyecto = resolverUbicacionProyecto(lote, proyectos);
  const direccion = construirDireccion(lote);
  // Combina la ubicación administrativa (por proyecto) con la dirección
  // real del lote (por x_ubicacion) si alguna de las dos existe. Si el
  // proyecto no está registrado en el mapa Y tampoco hay x_ubicacion,
  // queda undefined — mismo comportamiento que antes de este cambio.
  const ubicacion = ubicacionProyecto || direccion
    ? { ...(ubicacionProyecto ?? {}), ...(direccion ? { direccion } : {}) }
    : undefined;

  const payload = {
    vertices: lote.points,
    // Metadata de lados curvos del polígono principal (ver
    // x_geometry_arcos en Odoo/product_lot_geometry) — permite a plan_pro
    // dibujar la curva real en vez de una línea recta entre esos 2 vértices.
    arcos: lote.x_geometry_arcos,
    dimensiones,
    lote: {
      codigo: lote.default_code,
      nombre: lote.name,
      manzana: lote.x_mz,
      etapa: lote.x_etapa,
      numeroLote: lote.x_lote,
      estado: mapEstadoParaPlanoPro(lote.x_statu),
      ubicacion,
    },
    colindancias: colindancias.map((c) => ({
      lado: c.lado,
      tipo: c.tipo,
      nombre: c.nombre,
      longitud: c.longitud,
      radio: c.radio,
      longitudArco: c.longitudArco,
      sentido: c.sentido,
    })),
    propietario: lote.x_cliente ? { nombre: lote.x_cliente } : undefined,
    contexto: (elementosContexto.length > 0 || elementosUrbanosContexto.length > 0)
      ? { elementos: [...elementosContexto, ...elementosUrbanosContexto] }
      : undefined,
  };

  return { ok: true, payload };
}

/**
 * Arma el payload de plano perimétrico para una MATRIZ (el predio original
 * completo antes de la subdivisión en lotes — elemento.urbano, capa
 * "matriz") en vez de un lote-producto individual. Reusa exactamente el
 * mismo pipeline de colindancias/contexto que construirPayloadPlano,
 * tratando la matriz como si fuera "un lote" con manzana/etapa/numeroLote
 * vacíos — plan_pro ya sabe mostrar esos campos en blanco de forma
 * elegante cuando no aplican (ver PlanoPerimetricoGeneratorV2.ts).
 */
export async function construirPayloadPlanoMatriz(codigoElemento: string): Promise<PlanoPayloadResult> {
  const [odooProducts, elementosUrbanosOdoo, proyectos] = await Promise.all([
    fetchOdoo(
      'product.template',
      'search_read',
      [[['active', '=', true]]],
      {
        fields: ['id', 'name', 'default_code', 'list_price', 'qty_available', 'x_statu', 'x_area', 'x_mz', 'x_etapa', 'x_lote', 'x_cliente', 'x_geometry_utm', 'x_proyecto', 'x_proyecto_id', 'x_ubicacion', 'x_geometry_arcos'],
        limit: 1000,
        context: { lang: 'es_PE' },
      }
    ) as Promise<OdooProduct[]>,
    fetchElementosUrbanos(),
    fetchProyectos(),
  ]);

  const allLots: Lot[] = mergeLotsData(odooProducts, lotsData, geometriesJson);
  const elementosUrbanos = mergeElementosUrbanos(elementosUrbanosOdoo);

  const normCode = normalizeCode(codigoElemento);
  const matriz = elementosUrbanos.find(
    (e) => e.tipo === 'matriz' && normalizeCode(e.codigo) === normCode
  );

  if (!matriz) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: { code: 'MATRIZ_NOT_FOUND', message: `Matriz ${codigoElemento} no encontrada` } },
        { status: 404 }
      ),
    };
  }

  if (!matriz.points || matriz.points.length < 3) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: { code: 'NO_GEOMETRY', message: `La matriz ${codigoElemento} no tiene geometría cargada` } },
        { status: 400 }
      ),
    };
  }

  // Objeto "lote" sintético: derivarColindanciasYDimensiones solo necesita
  // points/x_geometry_arcos para el cálculo geométrico — el resto de campos
  // de Lot no aplican a una matriz, quedan en blanco/neutros.
  const loteFalso: Lot = {
    id: `matriz-${matriz.codigo}`,
    name: matriz.nombre,
    x_statu: 'no vender',
    list_price: 0,
    x_area: 0,
    points: matriz.points,
    x_mz: '',
    x_etapa: '',
    x_lote: '',
    default_code: matriz.codigo,
    x_geometry_arcos: matriz.arcos,
  };

  // La matriz misma no debe aparecer como "vecina de sí misma" en la
  // búsqueda de colindancias por coincidencia de arista.
  const elementosUrbanosSinMatriz = elementosUrbanos.filter((e) => e.codigo !== matriz.codigo);

  const { colindancias, dimensiones } = derivarColindanciasYDimensiones(loteFalso, allLots, elementosUrbanosSinMatriz);

  const centroidMatriz = calculateCentroid(matriz.points);
  const elementosContexto = allLots
    .filter((l) => {
      if (!l.points || l.points.length < 3) return false;
      const centroidVecino = calculateCentroid(l.points);
      return calculateDistance(centroidMatriz, centroidVecino) <= RADIO_CONTEXTO_METROS;
    })
    .map((l) => ({
      tipo: 'LOTE',
      codigo: l.default_code,
      texto: l.x_lote || l.default_code,
      estado: l.x_statu,
      vertices: l.points,
    }));

  const elementosUrbanosContexto = elementosUrbanosSinMatriz.map((e) => ({
    tipo: e.tipo,
    colorBorde: e.colorBorde,
    colorRelleno: e.colorRelleno,
    mostrarEtiqueta: e.mostrarEtiqueta,
    esArea: e.esArea,
    sinRelleno: e.sinRelleno,
    sinBorde: e.sinBorde,
    codigo: e.codigo,
    texto: e.nombre,
    estado: '',
    vertices: e.points,
    arcos: e.arcos,
    circulo: e.circulo,
  }));

  const proyecto = matriz.proyectoId ? proyectos.find((p) => p.id === matriz.proyectoId) : undefined;
  const ubicacion = proyecto
    ? {
        departamento: proyecto.departamento,
        provincia: proyecto.provincia,
        distrito: proyecto.distrito,
        urbanizacion: proyecto.urbanizacion,
        zonaUTM: proyecto.zonaUTM ? Number(proyecto.zonaUTM) : undefined,
      }
    : undefined;

  const payload = {
    vertices: matriz.points,
    arcos: matriz.arcos,
    dimensiones,
    lote: {
      codigo: matriz.codigo,
      nombre: matriz.nombre,
      manzana: '',
      etapa: '',
      numeroLote: '',
      estado: 'libre' as const,
      ubicacion,
    },
    colindancias: colindancias.map((c) => ({
      lado: c.lado,
      tipo: c.tipo,
      nombre: c.nombre,
      longitud: c.longitud,
      radio: c.radio,
      longitudArco: c.longitudArco,
      sentido: c.sentido,
    })),
    contexto: (elementosContexto.length > 0 || elementosUrbanosContexto.length > 0)
      ? { elementos: [...elementosContexto, ...elementosUrbanosContexto] }
      : undefined,
  };

  return { ok: true, payload };
}
