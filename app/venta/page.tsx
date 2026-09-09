import { Metadata } from 'next';
import { getPublicLots, getPublicProyectos, getPublicElementosUrbanos } from '@/app/services/odooPublicService';
import { OdooProduct, Proyecto } from '@/app/services/odooService';
import { ElementoUrbano } from '@/app/data/elementosUrbanos';
import VentaClient from '@/app/venta/VentaClient';

// Página pública (sin login) de anuncios pagados: landing + mapa de lotes de
// solo lectura + formulario que manda un lead al CRM. NO usa la credencial
// admin de odooService.ts — todo el fetch de datos pasa por
// odooPublicService.ts, con su propia cuenta mínima de Odoo. Ver el plan en
// C:\Users\henry\.claude\plans\wondrous-dancing-wave.md para el contexto
// completo de por qué existe esta página y qué se descartó antes de llegar
// a este diseño.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Terra Lima — Lotes en venta en Pucusana',
    description: 'Lotes disponibles en Terra Lima, Panamericana Sur Km 55, Pucusana. Financiamiento directo, sin bancos.',
};

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
    searchParams: Promise<{ utm_source?: string; utm_medium?: string; utm_campaign?: string }>;
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

    return (
        <VentaClient
            odooProducts={lots}
            proyectos={proyectos}
            elementosUrbanos={elementosUrbanos}
            hasConnectionError={hasConnectionError}
            utmSource={resolvedParams?.utm_source}
            utmMedium={resolvedParams?.utm_medium}
            utmCampaign={resolvedParams?.utm_campaign}
        />
    );
}
