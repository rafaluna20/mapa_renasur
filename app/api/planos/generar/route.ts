import { NextRequest, NextResponse } from 'next/server';
import { fetchOdoo, OdooProduct } from '@/app/services/odooService';
import { lotsData, Lot } from '@/app/data/lotsData';
import { mergeLotsData, normalizeCode } from '@/app/utils/dataMerger';
import { derivarColindanciasYDimensiones } from '@/app/utils/colindanciasUtils';
import { calculateCentroid, calculateDistance } from '@/app/utils/geometryUtils';
import geometriesEnrichedRaw from '@/app/data/geometries-enriched.json';

const RADIO_CONTEXTO_METROS = 200;

const geometriesJson = geometriesEnrichedRaw as unknown as Record<string, {
  coordinates: [number, number][];
  measurements: { sides: number[]; area: number; perimeter: number; centroid: [number, number] };
}>;

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
        fields: ['id', 'name', 'default_code', 'list_price', 'qty_available', 'x_statu', 'x_area', 'x_mz', 'x_etapa', 'x_lote', 'x_cliente', 'x_geometry_utm'],
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
