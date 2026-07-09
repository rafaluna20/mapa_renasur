import { fetchOdoo, fetchElementosUrbanos, OdooProduct } from '@/app/services/odooService';
import { mergeElementosUrbanos } from '@/app/data/elementosUrbanos';
import HomeClient from '@/app/components/HomeClient';

// Force dynamic rendering because Odoo data changes regularly
export const dynamic = 'force-dynamic';

// Estructura de caché en memoria del servidor para navegación ultra veloz
interface CacheContainer {
  data: OdooProduct[];
  timestamp: number;
}

let serverSideLotsCache: CacheContainer | null = null;
const CACHE_TTL = 30000; // 30 segundos de caché de alto rendimiento en memoria del servidor

export default async function Home({ searchParams }: { searchParams: Promise<{ refresh?: string }> }) {
  const resolvedParams = await searchParams;
  const forceRefresh = resolvedParams?.refresh === 'true';

  let products: OdooProduct[] = [];
  let hasConnectionError = false;
  const now = Date.now();

  // Si existe cache, no ha expirado y no se solicita refresco manual forzado
  if (serverSideLotsCache && (now - serverSideLotsCache.timestamp < CACHE_TTL) && !forceRefresh) {
    console.log(`[⚡ LIGHTNING CACHE HIT] Sirviendo ${serverSideLotsCache.data.length} lotes al instante desde memoria del servidor.`);
    products = serverSideLotsCache.data;
  } else {
    try {
      console.log(forceRefresh 
        ? `[🌀 FORCE REFRESH BYPASS] Saltando caché por solicitud de sincronización manual. Consultando Odoo...`
        : `[🌀 CACHE MISS / EXPIRED] Consultando inventario actualizado a Odoo...`
      );
      
      products = await fetchOdoo(
        "product.template",
        "search_read",
        [[["active", "=", true]]],
        {
          fields: ["id", "name", "default_code", "list_price", "qty_available", "x_statu", "x_area", "x_mz", "x_etapa", "x_lote", "x_cliente", "x_geometry_utm"],
          limit: 1000,
          context: { lang: "es_PE" }
        }
      );
      
      console.log(`Successfully fetched ${products.length} products from Odoo.`);

      // Guardar en la caché en memoria del servidor
      serverSideLotsCache = {
        data: products,
        timestamp: now
      };
    } catch (error) {
      console.error("Failed to fetch initial Odoo data:", error);
      
      // Resiliencia empresarial: si Odoo falla, servimos la caché existente aunque esté expirada
      if (serverSideLotsCache) {
        console.warn("Sirviendo caché existente debido a problemas de comunicación con Odoo.");
        products = serverSideLotsCache.data;
      } else {
        hasConnectionError = true;
      }
    }
  }

  // Elementos urbanos (calles/áreas verdes): modelo Odoo separado, nunca
  // pasa por la caché/fusión de lotes de arriba. Si falla, no debe tumbar
  // la carga del mapa — fetchElementosUrbanos ya devuelve [] en ese caso.
  const elementosUrbanosOdoo = await fetchElementosUrbanos();
  const elementosUrbanos = mergeElementosUrbanos(elementosUrbanosOdoo);

  return (
    <main>
      <HomeClient
        odooProducts={products}
        hasConnectionError={hasConnectionError}
        elementosUrbanos={elementosUrbanos}
      />
    </main>
  );
}
