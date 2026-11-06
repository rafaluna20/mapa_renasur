import { NextResponse } from 'next/server';
import { fetchOdoo, fetchElementosUrbanos, fetchProyectos, OdooProduct } from '@/app/services/odooService';
import { lotsData, Lot } from '@/app/data/lotsData';
import { mergeLotsData, normalizeCode } from '@/app/utils/dataMerger';
import { derivarColindanciasYDimensiones, type AdvertenciaColindancia } from '@/app/utils/colindanciasUtils';
import { calculateCentroid, calculateDistance, calculateLotMeasurements } from '@/app/utils/geometryUtils';
import geometriesEnrichedRaw from '@/app/data/geometries-enriched.json';
import { mergeElementosUrbanos } from '@/app/data/elementosUrbanos';
import { resolverProyecto } from '@/app/lib/ubicacionProyecto';
import { leerLotesPaginados } from '@/app/lib/lotesPaginados';

// Extraído de app/api/planos/generar/route.ts para que
// app/api/planos/generar-resumen/route.ts pueda armar exactamente el mismo
// payload (geometría, colindancias, contexto urbano) sin duplicar esta
// lógica — ambas rutas solo difieren en el `config` que le mandan a
// plan_pro y en el gate de sesión (admin vs. cualquier staff).

const RADIO_CONTEXTO_METROS = 250;

const CAMPOS_LOTE_PLANO = ['id', 'name', 'default_code', 'list_price', 'qty_available', 'x_statu', 'x_area', 'x_mz', 'x_etapa', 'x_lote', 'x_cliente', 'x_geometry_utm', 'x_proyecto', 'x_proyecto_id', 'x_ubicacion', 'x_geometry_arcos'];

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

/** 422: no se genera un plano con la dirección o la zona UTM de otro proyecto (ni sin ellas). */
function respuestaProyectoNoResuelto(que: string, detalle: string): { ok: false; response: NextResponse } {
  return {
    ok: false,
    response: NextResponse.json(
      {
        success: false,
        error: {
          code: 'PROYECTO_NO_RESUELTO',
          message: `${que} ${detalle}. Asígnale un proyecto activo en Odoo antes de generar el plano.`,
        },
      },
      { status: 422 }
    ),
  };
}

export type PlanoPayloadResult =
  // `advertencias`: cosas que el staff debe revisar antes de entregar el
  // documento (lados sin clasificar, inconsistencias del motor de
  // colindancias). No viajan a plan_pro ni bloquean nada.
  | { ok: true; payload: Record<string, unknown>; advertencias: AdvertenciaColindancia[] }
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
  const { registros: odooProducts } = await leerLotesPaginados<OdooProduct>(
    fetchOdoo,
    [['active', '=', true]],
    CAMPOS_LOTE_PLANO,
    { context: { lang: 'es_PE' } },
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
  const { colindancias, dimensiones, advertencias } = derivarColindanciasYDimensiones(lote, allLots, elementosUrbanos);

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
  const resolucion = resolverProyecto(lote, proyectos);
  if (!resolucion.ok) return respuestaProyectoNoResuelto(`El lote ${lote.default_code}`, resolucion.detalle);
  const ubicacionProyecto = resolucion.ubicacion;
  const direccion = construirDireccion(lote);
  // Ubicación administrativa del proyecto + dirección real del lote (x_ubicacion), si existe.
  const ubicacion = { ...ubicacionProyecto, ...(direccion ? { direccion } : {}) };

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

  return { ok: true, payload, advertencias };
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
    leerLotesPaginados<OdooProduct>(
      fetchOdoo,
      [['active', '=', true]],
      CAMPOS_LOTE_PLANO,
      { context: { lang: 'es_PE' } },
    ).then((r) => r.registros),
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
  //
  // measurements SÍ hay que calcularlo acá: derivarColindanciasYDimensiones
  // lee `lote.measurements?.area ?? lote.x_area` para el área del plano, y
  // como una matriz no tiene un x_area real de Odoo (no es un product.
  // template), dejar measurements sin definir hacía caer siempre al
  // x_area=0 de abajo — plan_pro rechazaba el payload por "área debe ser
  // mayor a 0" (VALIDATION_ERROR), sin mensaje claro en el modal.
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
    measurements: calculateLotMeasurements(matriz.points, matriz.arcos),
  };

  // La matriz misma no debe aparecer como "vecina de sí misma" en la
  // búsqueda de colindancias por coincidencia de arista.
  const elementosUrbanosSinMatriz = elementosUrbanos.filter((e) => e.codigo !== matriz.codigo);

  const { colindancias, dimensiones, advertencias } = derivarColindanciasYDimensiones(loteFalso, allLots, elementosUrbanosSinMatriz);

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

  const resolucionMatriz = resolverProyecto(matriz, proyectos);
  if (!resolucionMatriz.ok) return respuestaProyectoNoResuelto(`La matriz ${matriz.codigo}`, resolucionMatriz.detalle);
  const ubicacion = resolucionMatriz.ubicacion;

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

  return { ok: true, payload, advertencias };
}
