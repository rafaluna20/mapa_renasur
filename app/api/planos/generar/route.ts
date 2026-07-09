import { NextRequest, NextResponse } from 'next/server';
import { fetchOdoo, OdooProduct } from '@/app/services/odooService';
import { lotsData, Lot } from '@/app/data/lotsData';
import { mergeLotsData, normalizeCode } from '@/app/utils/dataMerger';
import { derivarColindanciasYDimensiones } from '@/app/utils/colindanciasUtils';
import { calculateCentroid, calculateDistance } from '@/app/utils/geometryUtils';
import { requireStaffSession } from '@/app/lib/staffAuth';
import geometriesEnrichedRaw from '@/app/data/geometries-enriched.json';

const RADIO_CONTEXTO_METROS = 250;

interface UbicacionProyecto {
  departamento: string;
  provincia: string;
  distrito: string;
  urbanizacion: string;
  zonaUTM?: number; // Solo si el proyecto NO cae en zona 18S (default de plan_pro)
}

/**
 * Ubicación administrativa por proyecto. La clave debe coincidir EXACTO con
 * el valor del campo custom x_proyecto en Odoo (product.template) para cada
 * lote — ese campo hay que crearlo y poblarlo ahí, no es nativo de Odoo.
 *
 * Cuando arranque el proyecto nuevo: agrega su entrada acá con la clave que
 * uses en Odoo, y si NO cae en zona UTM 18S, especifica zonaUTM (17 o 19).
 */
const UBICACION_POR_PROYECTO: Record<string, UbicacionProyecto> = {
  'terra-lima': {
    departamento: 'Lima',
    provincia: 'Lima',
    distrito: 'Pucusana',
    urbanizacion: 'Terra Lima',
  },
  // 'proyecto-nuevo': { departamento: '...', provincia: '...', distrito: '...', urbanizacion: '...', zonaUTM: ... },
};

// Proyecto asumido para lotes sin x_proyecto poblado todavía en Odoo — hoy
// es el 100% de los lotes existentes, ya que este campo es nuevo.
const PROYECTO_DEFAULT = 'terra-lima';

/**
 * Resuelve la ubicación administrativa de un lote por su x_proyecto.
 * Si el proyecto no está en el mapa (ej. el proyecto nuevo ya tiene
 * x_proyecto poblado en Odoo pero todavía no le agregamos su entrada acá),
 * devuelve undefined en vez de adivinar — plan_pro marca el documento para
 * revisión manual cuando falta la ubicación, en vez de mostrar una ciudad
 * incorrecta.
 */
function resolverUbicacionProyecto(xProyecto: string | undefined): UbicacionProyecto | undefined {
  const key = xProyecto?.trim() || PROYECTO_DEFAULT;
  const ubicacion = UBICACION_POR_PROYECTO[key];
  if (!ubicacion) {
    console.warn(`[planos/generar] Proyecto "${key}" no está registrado en UBICACION_POR_PROYECTO — el plano se generará sin ubicación administrativa.`);
  }
  return ubicacion;
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

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaffSession(request);
    if (auth.response) return auth.response;

    // Temporal: mientras se termina de afinar el generador de planos, solo
    // administradores pueden dispararlo. Cuando esté listo, quitar este check.
    if (!auth.session.isSystem) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'La generación de planos está disponible solo para administradores por ahora.' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { defaultCode } = body as { defaultCode?: string };

    if (!defaultCode) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_CODE', message: 'Falta defaultCode del lote' } },
        { status: 400 }
      );
    }

    const PLANOS_API_URL = process.env.PLANOS_API_URL;
    const PLANOS_API_KEY = process.env.PLANOS_API_KEY;

    if (!PLANOS_API_URL || !PLANOS_API_KEY) {
      console.error('Faltan PLANOS_API_URL / PLANOS_API_KEY en el entorno del servidor');
      return NextResponse.json(
        { success: false, error: { code: 'CONFIG_ERROR', message: 'Integración de planos no configurada' } },
        { status: 500 }
      );
    }

    // 1. Traer todos los lotes (Odoo + JSON estático) para poder derivar
    //    colindancias — necesitamos la geometría de los vecinos, no solo la del lote objetivo.
    const odooProducts: OdooProduct[] = await fetchOdoo(
      'product.template',
      'search_read',
      [[['active', '=', true]]],
      {
        fields: ['id', 'name', 'default_code', 'list_price', 'qty_available', 'x_statu', 'x_area', 'x_mz', 'x_etapa', 'x_lote', 'x_cliente', 'x_geometry_utm', 'x_proyecto', 'x_ubicacion'],
        limit: 1000,
        context: { lang: 'es_PE' },
      }
    );

    const allLots: Lot[] = mergeLotsData(odooProducts, lotsData, geometriesJson);

    const normCode = normalizeCode(defaultCode);
    const lote = allLots.find((l) => normalizeCode(l.default_code) === normCode);

    if (!lote) {
      return NextResponse.json(
        { success: false, error: { code: 'LOT_NOT_FOUND', message: `Lote ${defaultCode} no encontrado` } },
        { status: 404 }
      );
    }

    if (!lote.points || lote.points.length < 3) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_GEOMETRY', message: `El lote ${defaultCode} no tiene geometría cargada` } },
        { status: 400 }
      );
    }

    // 2. Derivar colindancias y dimensiones por geometría (frente/fondo/derecha/izquierda)
    const { colindancias, dimensiones } = derivarColindanciasYDimensiones(lote, allLots);

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

    // 4. Armar el payload para plan_pro
    const ubicacionProyecto = resolverUbicacionProyecto(lote.x_proyecto);
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
      })),
      propietario: lote.x_cliente ? { nombre: lote.x_cliente } : undefined,
      contexto: elementosContexto.length > 0 ? { elementos: elementosContexto } : undefined,
    };

    // 5. Llamar a plan_pro
    const planosResponse = await fetch(`${PLANOS_API_URL}/api/v1/planos/generar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PLANOS_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const planosData = await planosResponse.json();

    if (!planosResponse.ok) {
      console.error('Error de plan_pro:', planosData);
      return NextResponse.json(
        { success: false, error: planosData.error || { code: 'PLANOS_API_ERROR', message: 'Error generando el plano' } },
        { status: planosResponse.status }
      );
    }

    return NextResponse.json({ success: true, data: planosData.data });
  } catch (error) {
    console.error('Error en /api/planos/generar:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Error desconocido' } },
      { status: 500 }
    );
  }
}
