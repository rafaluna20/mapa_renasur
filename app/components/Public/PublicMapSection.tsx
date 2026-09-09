'use client';

import { useEffect, useRef, useState } from 'react';
import { Lot } from '@/app/data/lotsData';
import { Proyecto } from '@/app/services/odooService';
import { ElementoUrbano } from '@/app/data/elementosUrbanos';
import MapContainerWrapper from '@/app/components/Map/MapContainer';
import LotPointerHint from '@/app/components/Public/LotPointerHint';

// Envoltorio de solo lectura sobre el mismo MapContainer/LeafletMap que ya
// usa el mapa de staff — a propósito NO se pasan onPhotoPointClick ni
// onMatrizClick (extras de staff), y no hay ningún botón de reservar/pagar/
// crear contrato acá: eso se queda 100% en la herramienta interna.
//
// elementosUrbanos (calles/áreas verdes/etc.) se pasa tal cual — el mismo
// interruptor mostrarEnMapa/mostrarEtiqueta que ya usa staff en Odoo decide
// qué se dibuja también acá, no hay una lista de exclusiones aparte para
// la vista pública.
//
// El marco .venta-map-frame (borde sutil + sombra) es puro empaque visual —
// el mapa que exhibe adentro sigue siendo el real, con sus propios colores
// de estado (STATUS_LEGEND abajo), nunca recoloreados para calzar con la
// paleta de turno.
interface PublicMapSectionProps {
    lots: Lot[];
    proyectos: Proyecto[];
    elementosUrbanos: ElementoUrbano[];
    selectedLotId: string | null;
    onLotSelect: (lot: Lot) => void;
    soloDisponibles: boolean;
    onToggleSoloDisponibles: () => void;
}

const STATUS_LEGEND: { label: string; color: string }[] = [
    { label: 'Disponible', color: '#34D399' },
    { label: 'En cotización', color: '#FDE047' },
    { label: 'Reservado', color: '#C084FC' },
    { label: 'Vendido', color: '#F87171' },
];

function esDisponible(lot: Lot): boolean {
    const estado = lot.x_statu?.toLowerCase();
    return estado === 'libre' || estado === 'disponible';
}

export default function PublicMapSection({
    lots,
    proyectos,
    elementosUrbanos,
    selectedLotId,
    onLotSelect,
    soloDisponibles,
    onToggleSoloDisponibles,
}: PublicMapSectionProps) {
    // El nudge apunta siempre a un lote realmente comprable, sin importar
    // si el toggle "solo disponibles" está apagado (con el toggle apagado
    // `lots` incluye vendidos/reservados, y sugerir esos sería engañoso).
    const lotesDisponibles = lots.filter(esDisponible);

    // Si el lote seleccionado (clic directo en el mapa, no en el pin) NO es
    // disponible, el hint se sigue ocultando en vez de "congelarse" ahí —
    // sería inconsistente con la regla de arriba.
    const loteSeleccionado = lots.find((lot) => lot.id === selectedLotId) ?? null;
    const loteSeleccionadoParaHint = loteSeleccionado && esDisponible(loteSeleccionado) ? loteSeleccionado : null;

    // El pin "congelado" apunta al centro del canvas porque ahí quedó el
    // lote justo al seleccionarlo (flyTo de centrado, ver LeafletMap.tsx) —
    // pero deja de ser cierto en cuanto el usuario arrastra el mapa (reporte
    // real del cliente: quedaba apuntando a un punto vacío). `seMovioElMapa`
    // se resetea a `false` cada vez que cambia la selección con el patrón
    // oficial de React para "ajustar estado cuando cambia un prop" (se
    // ejecuta durante el render, no en un efecto — evita el problema de
    // sincronizar estado con un prop vía useEffect) y se pone en `true`
    // desde el callback de un evento real de Leaflet (onViewChange más
    // abajo), nunca desde el render.
    const [prevSelectedLotId, setPrevSelectedLotId] = useState(selectedLotId);
    const [seMovioElMapa, setSeMovioElMapa] = useState(false);
    if (selectedLotId !== prevSelectedLotId) {
        setPrevSelectedLotId(selectedLotId);
        setSeMovioElMapa(false);
    }
    const loteParaElPin = seMovioElMapa ? null : loteSeleccionadoParaHint;

    // Reporte real (captura de celular): al seleccionar un lote, Leaflet
    // centra el LOTE dentro del mapa, pero la página en sí no se mueve —
    // si el visitante ya estaba desplazado hacia abajo, el panel (fijo al
    // fondo de la pantalla) termina tapando parte del mapa igual, aunque el
    // lote esté perfectamente centrado adentro. Se hace scroll de la
    // PÁGINA para llevar el marco del mapa arriba del todo, recuperando el
    // espacio que ocupaban el título/subtítulo/toggle — solo en móvil
    // (640px, mismo corte que el resto de los ajustes de esta sección): en
    // desktop el panel es una tarjeta flotante en la esquina, no tapa nada.
    const mapFrameRef = useRef<HTMLDivElement>(null);
    // El mapa es la ÚLTIMA sección de la página (no hay nada después) — sin
    // este colchón, el navegador NUNCA puede llevar el marco hasta arriba
    // del todo, no por un bug de animación sino por física simple: no hay
    // suficiente contenido debajo para "absorber" ese scroll (verificado en
    // vivo: scrollTo se clampeaba solo al máximo real de la página,
    // dejando ~250px del marco tapados por el panel sin importar el método
    // de scroll usado). El colchón crece exactamente lo que falta y se
    // vuelve a cero en cuanto se cierra el panel, así que no deja un hueco
    // en blanco al navegar normalmente.
    const scrollSpacerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const spacer = scrollSpacerRef.current;
        if (!selectedLotId) {
            if (spacer) spacer.style.height = '0px';
            return;
        }
        if (typeof window === 'undefined' || window.innerWidth >= 640) return;
        const el = mapFrameRef.current;
        if (!el || !spacer) return;
        // Coordenada calculada a mano, no scrollIntoView(): la posición
        // actual del marco (getBoundingClientRect().top) es relativa al
        // viewport, así que sumada al scroll actual da la coordenada
        // absoluta de la página donde debe terminar el scroll.
        const targetY = window.scrollY + el.getBoundingClientRect().top;
        const maxScrollY = document.documentElement.scrollHeight - window.innerHeight;
        const deficit = targetY - maxScrollY;
        spacer.style.height = deficit > 0 ? `${deficit}px` : '0px';
        window.scrollTo(0, targetY);
    }, [selectedLotId]);

    return (
        <>
        <section id="mapa-lotes" className="venta-lots">
            <h2>
                Elige tu lote en el <span className="accent">mapa</span>
            </h2>
            <p className="venta-sub2">Mapa real del proyecto — no una foto. Toca un lote disponible para separar el tuyo.</p>

            <div className="venta-map-frame" ref={mapFrameRef}>
                <span className="ribbon">
                    <span className="venta-dot" />
                    Mapa interactivo en tiempo real
                </span>
                {/* Flotante en la esquina opuesta al ribbon, dentro del
                    mismo marco — pedido del cliente de moverlo de una fila
                    normal arriba del mapa a un overlay superior-derecho. */}
                <div className="venta-map-toggle-row">
                    <label className="venta-toggle-label">
                        <span>Ver solo disponibles</span>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={soloDisponibles}
                            onClick={onToggleSoloDisponibles}
                            className={`venta-switch ${soloDisponibles ? 'is-on' : ''}`}
                        >
                            <span className="venta-switch-thumb" />
                        </button>
                    </label>
                </div>
                <div className="venta-map-canvas">
                    <MapContainerWrapper
                        lots={lots}
                        proyectos={proyectos}
                        elementosUrbanos={elementosUrbanos}
                        proyectoSeleccionadoId={null}
                        selectedLotId={selectedLotId}
                        onLotSelect={onLotSelect}
                        mapType="street"
                        preferCanvas
                        showMeasurements={false}
                        initialZoomOverride={16.8}
                        onViewChange={() => setSeMovioElMapa(true)}
                    />
                    <LotPointerHint
                        lots={lotesDisponibles}
                        active={!selectedLotId}
                        selectedLot={loteParaElPin}
                        onPick={onLotSelect}
                    />
                </div>
                <div className="venta-map-caption">
                    {STATUS_LEGEND.map((item) => (
                        <span key={item.label}>
                            <i style={{ backgroundColor: item.color }} />
                            {item.label}
                        </span>
                    ))}
                </div>
            </div>
        </section>
        {/* Colchón de scroll (ver comentario junto al efecto de arriba) —
            0px en reposo, invisible. Fuera de .venta-lots a propósito: debe
            quedar al final absoluto de la página, no importa el layout
            interno de la sección. */}
        <div ref={scrollSpacerRef} aria-hidden="true" style={{ height: 0 }} />
        </>
    );
}
