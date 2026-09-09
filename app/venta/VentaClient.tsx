'use client';

import { useMemo, useState } from 'react';
import { OdooProduct, Proyecto } from '@/app/services/odooService';
import { ElementoUrbano } from '@/app/data/elementosUrbanos';
import { lotsData } from '@/app/data/lotsData';
import geometriesEnrichedRaw from '@/app/data/geometries-enriched.json';
import { mergeLotsData, EnrichedGeometry } from '@/app/utils/dataMerger';
import HeroSection from '@/app/components/Public/HeroSection';
import PublicMapSection from '@/app/components/Public/PublicMapSection';
import PublicLotPanel from '@/app/components/Public/PublicLotPanel';
import FloatingWhatsApp from '@/app/components/Public/FloatingWhatsApp';

const geometriesJson = geometriesEnrichedRaw as unknown as Record<string, EnrichedGeometry>;

// Solo se publican lotes con id numérico real de Odoo. mergeLotsData
// (app/utils/dataMerger.ts) también devuelve entradas sintéticas para lo que
// NO tiene match real en Odoo: `local-*` (fila estática de lotsData.ts nunca
// confirmada contra Odoo, con precios de 2024) y `fb-*` (solo geometría, sin
// match — list_price siempre 0, estado siempre 'no vender'). Publicar esas
// en un anuncio pagado sería mostrar precios/disponibilidad que pueden estar
// mal — se descartan acá, no en el fetch (el fetch ya excluye lo que puede
// excluirse del lado de Odoo; esto filtra lo que solo existe del lado local).
const ID_ODOO_REAL = /^\d+$/;

interface VentaClientProps {
    odooProducts: OdooProduct[];
    proyectos: Proyecto[];
    elementosUrbanos: ElementoUrbano[];
    hasConnectionError: boolean;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
}

export default function VentaClient({
    odooProducts,
    proyectos,
    elementosUrbanos,
    hasConnectionError,
    utmSource,
    utmMedium,
    utmCampaign,
}: VentaClientProps) {
    const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
    // Desactivado por defecto a pedido explícito del cliente (2026-09-09):
    // el primer vistazo muestra TODO el proyecto (disponibles + vendidos +
    // reservados + cotización, más calles/áreas verdes) como prueba de
    // escala/avance real, en vez de arrancar filtrado a solo lo comprable.
    // Trade-off avisado y aceptado: el mapa inicial es más denso; sigue
    // siendo un solo control, no 3 botones de igual peso.
    const [soloDisponibles, setSoloDisponibles] = useState(false);

    const lots = useMemo(() => {
        const merged = mergeLotsData(odooProducts, lotsData, geometriesJson);
        return merged.filter((lot) => ID_ODOO_REAL.test(lot.id));
    }, [odooProducts]);

    // Bug real encontrado en revisión (2026-09-09): si el visitante abre el
    // panel de un lote vendido/reservado/en cotización y DESPUÉS activa
    // "solo disponibles", ese lote se filtraba de `lotsVisibles` y su
    // polígono desaparecía del mapa por completo — el panel seguía abierto
    // mostrando ese lote como si nada, pero en el mapa había un hueco donde
    // debería estar. Se mantiene visible el que tiene el panel abierto sin
    // importar el estado del toggle, exactamente igual a como ya se
    // comporta el panel mismo (comentario de abajo).
    const lotsVisibles = useMemo(() => {
        if (!soloDisponibles) return lots;
        return lots.filter((lot) => {
            if (lot.id === selectedLotId) return true;
            const estado = lot.x_statu?.toLowerCase();
            return estado === 'libre' || estado === 'disponible';
        });
    }, [lots, soloDisponibles, selectedLotId]);

    // Se busca en `lots` (sin filtrar), no en `lotsVisibles`: si el visitante
    // seleccionó un lote y luego prende el toggle, el panel no debe
    // desaparecer de golpe.
    const selectedLot = useMemo(
        () => lots.find((lot) => lot.id === selectedLotId) || null,
        [lots, selectedLotId]
    );

    // Datos reales para el hero/strip del afiche "Mercado" — nunca un
    // número inventado: "202 lotes" (dato del boceto aprobado) se
    // reemplaza acá por el conteo real de lots ya traídos de Odoo, y el
    // precio "desde" es el mínimo real entre lotes efectivamente comprables.
    const precioDesde = useMemo(() => {
        const precios = lots
            .filter((lot) => {
                const estado = lot.x_statu?.toLowerCase();
                return (estado === 'libre' || estado === 'disponible') && lot.list_price > 0;
            })
            .map((lot) => lot.list_price);
        return precios.length ? Math.min(...precios) : null;
    }, [lots]);

    // "Lotes vendidos" para el hero: se cuenta sobre `odooProducts` (los
    // registros crudos de Odoo, ANTES del merge con geometría), no sobre
    // `lots` — `lots` descarta los que no calzaron con una geometría local
    // (ver mergeLotsData), y eso subcontaría ventas reales que sí existen
    // en Odoo. Verificado en vivo contra Odoo (2026-09-09): el número que
    // dio el cliente ("202") no coincidía con la base real (254 vendidos) —
    // se usa el dato real, que además se mantiene correcto solo sin
    // necesidad de venir a actualizar este número a mano cada vez que se
    // vende un lote.
    //
    // `p.x_statu &&` (no `?.`) a propósito: Odoo devuelve `false` (no
    // undefined) cuando el campo está vacío — `false?.toLowerCase()` revienta
    // en runtime porque el optional chaining solo protege contra
    // null/undefined, no contra `false`. Bug real, encontrado al probar esto
    // en vivo, no una precaución teórica.
    const lotesVendidos = useMemo(
        () => odooProducts.filter((p) => p.x_statu && p.x_statu.toLowerCase() === 'vendido').length,
        [odooProducts]
    );

    if (hasConnectionError) {
        return (
            <div className="venta-error-screen">
                <div>
                    <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                        No pudimos cargar el mapa de lotes en este momento.
                    </p>
                    <p style={{ marginTop: '0.6rem', color: '#d9c9ec' }}>
                        Escríbenos por WhatsApp al <a href="tel:+51977684050">+51 977 684 050</a> y te
                        ayudamos directo.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <main className="venta-page">
            <HeroSection totalLotes={lots.length} lotesVendidos={lotesVendidos} precioDesde={precioDesde} />

            <PublicMapSection
                lots={lotsVisibles}
                proyectos={proyectos}
                elementosUrbanos={elementosUrbanos}
                selectedLotId={selectedLotId}
                onLotSelect={(lot) => setSelectedLotId(lot.id)}
                soloDisponibles={soloDisponibles}
                onToggleSoloDisponibles={() => setSoloDisponibles((v) => !v)}
            />

            {selectedLot && (
                <PublicLotPanel
                    lot={selectedLot}
                    onClose={() => setSelectedLotId(null)}
                    utmSource={utmSource}
                    utmMedium={utmMedium}
                    utmCampaign={utmCampaign}
                />
            )}

            <FloatingWhatsApp active={!selectedLot} />
        </main>
    );
}
