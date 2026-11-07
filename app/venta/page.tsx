import { Metadata } from 'next';
import { getPublicLots, getPublicProyectos, getPublicElementosUrbanos } from '@/app/services/odooPublicService';
import { OdooProduct, Proyecto } from '@/app/services/odooService';
import { ElementoUrbano } from '@/app/data/elementosUrbanos';
import VentaClient from '@/app/venta/VentaClient';
import { construirMetadataVenta } from '@/app/venta/metadataVenta';
import { elegirProyecto, filtrarPorProyecto } from '@/app/venta/proyectoPublico';
import { ofertaDeProyecto } from '@/app/venta/ofertaComercial';
import { idProyecto } from '@/app/lib/accesoProyectos';
import { codigoLegado } from '@/app/lib/codigoLote';
import { resolverCodigoViejoEnServidor } from '@/app/lib/aliasLotesServidor';

// Página pública (sin login) de anuncios pagados: landing + mapa de lotes de
// solo lectura + formulario que manda un lead al CRM. NO usa la credencial
// admin de odooService.ts — todo el fetch de datos pasa por
// odooPublicService.ts, con su propia cuenta mínima de Odoo. Ver el plan en
// C:\Users\henry\.claude\plans\wondrous-dancing-wave.md para el contexto
// completo de por qué existe esta página y qué se descartó antes de llegar
// a este diseño.
export const dynamic = 'force-dynamic';

// Proyectos para los metadatos del enlace (P5: título, descripción y nombre del sitio salen del proyecto). Caché propia y corta;
// si Odoo falla, los metadatos caen a los de siempre en vez de romper la página.
let proyectosMetaCache: { proyectos: Proyecto[]; timestamp: number } | null = null;

async function proyectosParaMetadata(): Promise<Proyecto[]> {
    const ahora = Date.now();
    if (proyectosMetaCache && ahora - proyectosMetaCache.timestamp < 5 * 60 * 1000) return proyectosMetaCache.proyectos;
    try {
        const proyectos = await getPublicProyectos();
        proyectosMetaCache = { proyectos, timestamp: ahora };
        return proyectos;
    } catch {
        return proyectosMetaCache?.proyectos ?? [];
    }
}

// P6: un enlace con el código VIEJO de un lote renombrado (o con el proyecto delante) sigue llevando a ese lote.
async function codigoVigente(lote?: string | null): Promise<string | undefined> {
    const vigente = await resolverCodigoViejoEnServidor(lote);
    return codigoLegado(vigente) ?? vigente;
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ lote?: string; utm_source?: string; proyecto?: string }> }): Promise<Metadata> {
    const { lote, utm_source, proyecto } = await searchParams;
    // El bot de ventas ya manda la imagen del lote como adjunto: su enlace no lleva imagen en la vista previa (se veía dos veces).
    const sinImagen = utm_source === 'asistente-virtual';
    const oferta = ofertaDeProyecto(elegirProyecto(await proyectosParaMetadata(), proyecto).proyecto);
    return construirMetadataVenta(await codigoVigente(lote), process.env.NEXT_PUBLIC_SITE_URL || undefined, { sinImagen }, oferta);
}

interface CacheContainer {
    lots: OdooProduct[];
    proyectos: Proyecto[];
    elementosUrbanos: ElementoUrbano[];
    timestamp: number;
}

let publicDataCache: CacheContainer | null = null;
// TTL más largo que el mapa de staff (30s): tráfico de anuncios no necesita
// la misma frescura al segundo, y así se evita golpear Odoo en cada visita.
const CACHE_TTL = 5 * 60 * 1000;

export default async function VentaPage({
    searchParams,
}: {
    searchParams: Promise<{ utm_source?: string; utm_medium?: string; utm_campaign?: string; lote?: string; proyecto?: string }>;
}) {
    const resolvedParams = await searchParams;

    let lots: OdooProduct[] = [];
    let proyectos: Proyecto[] = [];
    let elementosUrbanos: ElementoUrbano[] = [];
    let hasConnectionError = false;
    // Server Component: se ejecuta una vez por request en el servidor, no
    // se re-renderiza en el cliente. Mismo patrón exacto que el caché en
    // memoria ya existente en app/page.tsx (el mapa de staff) — la regla de
    // pureza de React apunta a Client Components, no al modelo de ejecución
    // de un RSC.
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();

    if (publicDataCache && now - publicDataCache.timestamp < CACHE_TTL) {
        lots = publicDataCache.lots;
        proyectos = publicDataCache.proyectos;
        elementosUrbanos = publicDataCache.elementosUrbanos;
    } else {
        try {
            [lots, proyectos, elementosUrbanos] = await Promise.all([
                getPublicLots(),
                getPublicProyectos(),
                getPublicElementosUrbanos(),
            ]);
            // eslint-disable-next-line react-hooks/globals -- ver comentario arriba.
            publicDataCache = { lots, proyectos, elementosUrbanos, timestamp: now };
        } catch (error) {
            console.error('[venta] Falló el fetch público de Odoo:', error);
            if (publicDataCache) {
                // Resiliencia: si Odoo falla mid-campaña, se sirve la
                // caché existente aunque esté vencida antes que mostrar
                // la página rota a tráfico pagado.
                lots = publicDataCache.lots;
                proyectos = publicDataCache.proyectos;
                elementosUrbanos = publicDataCache.elementosUrbanos;
            } else {
                hasConnectionError = true;
            }
        }
    }

    // P5: la landing muestra UN proyecto (?proyecto=<código>; por defecto el principal) con SU oferta comercial. Solo se
    // ofrecen proyectos publicables (activos, no «trabajo externo», con «Publicar en la web»). Ver app/venta/proyectoPublico.ts.
    const seleccion = elegirProyecto(proyectos, resolvedParams?.proyecto);
    const lotsDelProyecto = filtrarPorProyecto(lots, seleccion, (l) => idProyecto(l.x_proyecto_id), proyectos);
    const elementosDelProyecto = filtrarPorProyecto(elementosUrbanos, seleccion, (e) => e.proyectoId, proyectos);

    return (
        <VentaClient
            odooProducts={lotsDelProyecto}
            proyectos={proyectos}
            elementosUrbanos={elementosDelProyecto}
            oferta={ofertaDeProyecto(seleccion.proyecto)}
            hasConnectionError={hasConnectionError}
            utmSource={resolvedParams?.utm_source}
            utmMedium={resolvedParams?.utm_medium}
            utmCampaign={resolvedParams?.utm_campaign}
            loteInicial={await codigoVigente(resolvedParams?.lote)}
        />
    );
}
