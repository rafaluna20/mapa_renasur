import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { fetchOdoo, fetchElementosUrbanos, fetchProyectos, OdooProduct } from '@/app/services/odooService';
import { leerLotesPaginados } from '@/app/lib/lotesPaginados';
import { aplicarAcceso, idProyecto, obtenerAcceso } from '@/app/lib/accesoProyectos';
import { mergeElementosUrbanos } from '@/app/data/elementosUrbanos';
import { STAFF_COOKIE_NAME, verifyStaffSessionToken } from '@/app/lib/staffAuth';
import HomeClient from '@/app/components/HomeClient';
import { obtenerSeparaciones } from '@/app/lib/separaciones';

// Force dynamic rendering because Odoo data changes regularly
export const dynamic = 'force-dynamic';

// Estructura de caché en memoria del servidor para navegación ultra veloz
interface CacheContainer {
  data: OdooProduct[];
  truncado: boolean;
  timestamp: number;
}

let serverSideLotsCache: CacheContainer | null = null;
const CACHE_TTL = 30000; // 30 segundos de caché de alto rendimiento en memoria del servidor

export default async function Home({ searchParams }: { searchParams: Promise<{ refresh?: string }> }) {
  // Guard de sesión del lado del servidor: antes de esto, esta página fetcheaba
  // el inventario completo (incluido x_cliente, nombre real de compradores) y
  // lo pasaba como props a HomeClient sin ninguna verificación en el servidor
  // — el único control era un useEffect client-side en HomeClient, que ya
  // llega tarde: Next.js serializa los props en el payload RSC antes de que
  // ese redirect se ejecute. Ver app/lib/staffAuth.ts para el mecanismo.
  const cookieStore = await cookies();
  const session = await verifyStaffSessionToken(cookieStore.get(STAFF_COOKIE_NAME)?.value);
  if (!session) redirect('/login');

  const resolvedParams = await searchParams;
  const forceRefresh = resolvedParams?.refresh === 'true';

  let products: OdooProduct[] = [];
  let hasConnectionError = false;
  let lotesTruncados = false;
  const now = Date.now();

  // Si existe cache, no ha expirado y no se solicita refresco manual forzado
  if (serverSideLotsCache && (now - serverSideLotsCache.timestamp < CACHE_TTL) && !forceRefresh) {
    console.log(`[⚡ LIGHTNING CACHE HIT] Sirviendo ${serverSideLotsCache.data.length} lotes al instante desde memoria del servidor.`);
    products = serverSideLotsCache.data;
    lotesTruncados = serverSideLotsCache.truncado;
  } else {
    try {
      console.log(forceRefresh 
        ? `[🌀 FORCE REFRESH BYPASS] Saltando caché por solicitud de sincronización manual. Consultando Odoo...`
        : `[🌀 CACHE MISS / EXPIRED] Consultando inventario actualizado a Odoo...`
      );
      
      // Paginado (sin el tope fijo de 1000) y sin los lotes de proyectos DESACTIVADOS.
      const leidos = await leerLotesPaginados<OdooProduct>(
        fetchOdoo,
        [["active", "=", true]],
        ["id", "name", "default_code", "list_price", "qty_available", "x_statu", "x_area", "x_mz", "x_etapa", "x_lote", "x_cliente", "x_geometry_utm", "x_geometry_arcos", "x_proyecto_id"],
        { context: { lang: "es_PE" }, camposOpcionales: ["x_frente", "x_potencia_kw"] },
      );
      products = leidos.registros;
      lotesTruncados = leidos.truncado;
      
      console.log(`Successfully fetched ${products.length} products from Odoo.`);

      // Guardar en la caché en memoria del servidor
      serverSideLotsCache = {
        data: products,
        truncado: lotesTruncados,
        timestamp: now
      };
    } catch (error) {
      console.error("Failed to fetch initial Odoo data:", error);
      
      // Resiliencia empresarial: si Odoo falla, servimos la caché existente aunque esté expirada
      if (serverSideLotsCache) {
        console.warn("Sirviendo caché existente debido a problemas de comunicación con Odoo.");
        products = serverSideLotsCache.data;
        lotesTruncados = serverSideLotsCache.truncado;
      } else {
        hasConnectionError = true;
      }
    }
  }

  // Elementos urbanos (calles/áreas verdes): modelo Odoo separado, nunca
  // pasa por la caché/fusión de lotes de arriba. Si falla, no debe tumbar
  // la carga del mapa — fetchElementosUrbanos ya devuelve [] en ese caso.
  const elementosUrbanosOdoo = await fetchElementosUrbanos();
  const elementosUrbanosTodos = mergeElementosUrbanos(elementosUrbanosOdoo);

  // Proyectos (ubicación + zona UTM real por proyecto): mapa_renasur ya no
  // asume que todo cae en zona 18S — ver LeafletMap.tsx. Si el módulo
  // proyecto_inmobiliario todavía no está desplegado, fetchProyectos
  // devuelve [] y LeafletMap usa 18S por defecto (mismo comportamiento de
  // antes de este cambio).
  const proyectosTodos = await fetchProyectos();

  // Plazo de las separaciones (módulo Odoo v3.20+). Consulta aislada: si el
  // módulo aún no está desplegado devuelve vacío y el mapa queda como antes.
  const separacionesTodas = await obtenerSeparaciones(forceRefresh);

  // P3: filtro por proyecto EN EL SERVIDOR, antes de enviar nada al navegador. Antes, cualquier vendedor recibía todos
  // los proyectos (con precios y nombres de compradores) y el selector de proyecto solo ocultaba cosas en pantalla.
  // Según ACCESO_PROYECTOS_MODO: «observar» (por defecto) deja pasar todo y registra lo que habría ocultado;
  // «bloquear» aplica el filtro. Ver app/lib/accesoProyectos.ts.
  const acceso = await obtenerAcceso(session);
  const contexto = { uid: session.odooUid };
  const productsVisibles = aplicarAcceso(products, acceso, (p) => idProyecto(p.x_proyecto_id), { ...contexto, recurso: 'lotes' });
  const elementosUrbanos = aplicarAcceso(elementosUrbanosTodos, acceso, (e) => e.proyectoId, { ...contexto, recurso: 'elementos' });
  const proyectos = aplicarAcceso(proyectosTodos, acceso, (p) => p.id, { ...contexto, recurso: 'proyectos' });
  const idsVisibles = new Set(productsVisibles.map((p) => String(p.id)));
  const separaciones = productsVisibles.length === products.length
    ? separacionesTodas
    : {
        ...separacionesTodas,
        porLote: Object.fromEntries(Object.entries(separacionesTodas.porLote).filter(([id]) => idsVisibles.has(id))),
        reservasAdmin: separacionesTodas.reservasAdmin.filter((id) => idsVisibles.has(String(id))),
      };

  return (
    <main>
      <HomeClient
        odooProducts={productsVisibles}
        hasConnectionError={hasConnectionError}
        lotesTruncados={lotesTruncados}
        esAdmin={session.isSystem === true}
        elementosUrbanos={elementosUrbanos}
        proyectos={proyectos}
        separaciones={separaciones}
      />
    </main>
  );
}
