'use client';

import { useState } from 'react';
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

    return (
        <section id="mapa-lotes" className="venta-lots">
            <h2>
                Elige tu lote en el <span className="accent">mapa</span>
            </h2>
            <p className="venta-sub2">Mapa real del proyecto — no una foto. Toca un lote disponible para separar el tuyo.</p>

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

            <div className="venta-map-frame">
                <span className="ribbon">
                    <span className="venta-dot" />
                    Mapa interactivo en tiempo real
                </span>
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
    );
}
