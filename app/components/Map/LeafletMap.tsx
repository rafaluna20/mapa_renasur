'use client';

import { MapContainer, TileLayer, Polygon, Polyline, useMap, Tooltip, Circle, CircleMarker, ImageOverlay, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';
import proj4 from 'proj4';
import { Lot } from '@/app/data/lotsData';
import { ElementoUrbano } from '@/app/data/elementosUrbanos';
import { useEffect, useState, useMemo, useRef } from 'react';
import L from 'leaflet';
import { calculateMidpoint, calculateCentroid } from '@/app/utils/geometryUtils';
import { expandirVerticesConArcos } from '@/app/utils/arcoUtils';

// Define UTM zone 18L projection (WGS84)
proj4.defs("EPSG:32718", "+proj=utm +zone=18 +south +datum=WGS84 +units=m +no_defs");

// Color de respaldo si un elemento urbano llegara sin color (no debería
// pasar: capa_id es requerido en Odoo). El color real de cada elemento
// viene de su capa (elemento.urbano.capa en Odoo, estilo AutoCAD) — ya no
// es una tabla fija acá, así que un tipo/color nuevo no requiere deploy.
const COLOR_ELEMENTO_URBANO_FALLBACK = '#AAAAAA';

interface LeafletMapProps {
    lots: Lot[];
    elementosUrbanos?: ElementoUrbano[];
    selectedLotId: string | null;
    onLotSelect: (lot: Lot) => void;
    mapType: 'street' | 'satellite' | 'blank' | 'dark';
    userLocation?: [number, number] | null;
    preferCanvas?: boolean;
    showMeasurements?: boolean;
    onPhotoPointClick?: (elemento: ElementoUrbano) => void;
}

// Ícono de cámara para los puntos de interés fotográfico (capa "foto") —
// un div-icon en vez de imagen, para no depender de un asset extra y para
// poder tintarlo con el color de la capa (editable en Odoo).
function crearIconoFoto(color: string): L.DivIcon {
    return L.divIcon({
        className: '',
        html: `<div style="
            width: 30px; height: 30px; border-radius: 9999px;
            background: ${color}; border: 2px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
            display: flex; align-items: center; justify-content: center;
            cursor: pointer;
        ">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                <circle cx="12" cy="13" r="3"/>
            </svg>
        </div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
    });
}

function MapController({ lots, selectedLotId, onZoomChange }: { lots: Lot[], selectedLotId: string | null, onZoomChange: (z: number) => void }) {
    const map = useMap();
    const initialZoomDone = useRef(false);

    useEffect(() => {
        onZoomChange(map.getZoom());
        const handleZoom = () => onZoomChange(map.getZoom());
        map.on('zoomend', handleZoom);
        return () => {
            map.off('zoomend', handleZoom);
        };
    }, [map, onZoomChange]);

    useEffect(() => {
        if (selectedLotId) {
            const selectedLot = lots.find(l => l.id === selectedLotId);
            if (selectedLot && selectedLot.points && selectedLot.points.length > 0) {
                try {
                    const bounds = L.latLngBounds([]);
                    selectedLot.points.forEach(p => {
                        const [lon, lat] = proj4("EPSG:32718", "EPSG:4326", [p[0], p[1]]);
                        bounds.extend([lat, lon]);
                    });

                    if (bounds.isValid()) {
                        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

                        if (isMobile) {
                            // En móvil, usamos fitBounds con padding inferior para empujar el lote a la parte superior
                            map.fitBounds(bounds, {
                                paddingBottomRight: [0, 300], // 300px de padding inferior para dejar espacio al modal
                                animate: true,
                                duration: 1.5,  // Snappy, premium transition
                                maxZoom: 20
                            });
                        } else {
                            const targetZoom = map.getBoundsZoom(bounds, false, L.point(50, 50));
                            const finalZoom = Math.min(targetZoom, 21);
                            map.flyTo(bounds.getCenter(), finalZoom, {
                                duration: 1.5,  // Snappy, premium transition
                                animate: true
                            });
                        }
                    }
                } catch (e) {
                    console.error("Zoom to lot error", e);
                }
            }
        } else if (lots.length > 0 && !initialZoomDone.current) {
            try {
                const bounds = L.latLngBounds([]);
                lots.forEach(lot => {
                    lot.points.forEach(p => {
                        const [lon, lat] = proj4("EPSG:32718", "EPSG:4326", [p[0], p[1]]);
                        bounds.extend([lat, lon]);
                    });
                });

                if (bounds.isValid()) {
                    // Zoom inicial suave al cargar el mapa
                    map.flyTo(bounds.getCenter(), 17.5, {
                        animate: true,
                        duration: 1.2,
                        easeLinearity: 0.1
                    });
                    initialZoomDone.current = true;
                }
            } catch (e) {
                console.error("FitBounds error", e);
            }
        }
    }, [selectedLotId, map, lots]);

    useEffect(() => {
        const handleCenterMap = (event: Event) => {
            const customEvent = event as CustomEvent<{ lat: number, lng: number, zoom: number }>;
            const { lat, lng, zoom } = customEvent.detail;
            map.flyTo([lat, lng], zoom, {
                animate: true,
                duration: 1.5,
                easeLinearity: 0.1  // Animación suave y gradual
            });
        };
        window.addEventListener('centerMap', handleCenterMap);
        return () => window.removeEventListener('centerMap', handleCenterMap);
    }, [map]);

    return null;
}

// Controlador para monitorear el viewport y límites geográficos en tiempo real (Optimización Viewport Culling)
function MapBoundsController({ onBoundsChange }: { onBoundsChange: (bounds: L.LatLngBounds) => void }) {
    const map = useMap();

    useEffect(() => {
        // Enviar límites iniciales
        onBoundsChange(map.getBounds());

        const updateBounds = () => {
            onBoundsChange(map.getBounds());
        };

        map.on('moveend', updateBounds);
        map.on('zoomend', updateBounds);

        return () => {
            map.off('moveend', updateBounds);
            map.off('zoomend', updateBounds);
        };
    }, [map, onBoundsChange]);

    return null;
}

// Component to render side measurements for selected lot
function SideMeasurementTooltips({ lot, map }: { lot: Lot; map: L.Map }) {
    useEffect(() => {
        const newTooltips: L.Tooltip[] = [];

        // Only show if lot has measurements and points
        if (!lot.measurements?.sides || !lot.points || lot.points.length < 2) {
            return;
        }

        // Proyecta un punto UTM a píxeles de PANTALLA (no geo): la única
        // forma correcta de calcular un ángulo de rotación CSS que se vea
        // alineado al lado tal como se dibuja en el mapa. Se usa un zoom
        // fijo (el actual al momento de seleccionar el lote) solo como
        // referencia — el ÁNGULO entre 2 puntos cercanos es invariante al
        // zoom en Web Mercator (proyección conforme), así que no hace
        // falta recalcular en cada evento de zoom/pan.
        const zoomRef = map.getZoom();
        const utmToScreenPoint = (utmPoint: [number, number]): L.Point => {
            const [lon, lat] = proj4("EPSG:32718", "EPSG:4326", utmPoint);
            return map.project([lat, lon], zoomRef);
        };

        const centroidUtm = calculateCentroid(lot.points);
        const centroidPx = utmToScreenPoint(centroidUtm);

        // Desplazamiento fijo en PÍXELES (no metros): así la etiqueta se ve
        // igual de "adentro" del lote sin importar el nivel de zoom — un
        // desplazamiento en metros se vería enorme muy acercado o
        // invisible muy alejado.
        const OFFSET_PX = 13;

        // Create a tooltip for each side
        lot.points.forEach((point, index) => {
            const nextIndex = (index + 1) % lot.points.length;
            const nextPoint = lot.points[nextIndex];

            // Calculate midpoint in UTM
            const midpointUTM = calculateMidpoint(point, nextPoint);

            // Convert to lat/lng for display
            try {
                const [lon, lat] = proj4("EPSG:32718", "EPSG:4326", [midpointUTM[0], midpointUTM[1]]);
                const sideLength = lot.measurements!.sides[index];

                // Ángulo del lado en píxeles de pantalla, normalizado a
                // [-90°, 90°] para que el texto nunca quede al revés
                // (misma convención que las cotas del Plano Perimétrico).
                const p1px = utmToScreenPoint(point);
                const p2px = utmToScreenPoint(nextPoint);
                const dxPx = p2px.x - p1px.x;
                const dyPx = p2px.y - p1px.y;
                let angleDeg = Math.atan2(dyPx, dxPx) * (180 / Math.PI);
                if (angleDeg > 90) angleDeg -= 180;
                else if (angleDeg < -90) angleDeg += 180;

                // Perpendicular al lado, orientada hacia el CENTROIDE del
                // lote (adentro) — mismo criterio de "hacia qué lado
                // apunta" que ya usa plan_pro para sus cotas.
                const lenPx = Math.sqrt(dxPx * dxPx + dyPx * dyPx) || 1;
                let perpX = -dyPx / lenPx;
                let perpY = dxPx / lenPx;

                const midPx = utmToScreenPoint(midpointUTM);
                const toCentroidX = centroidPx.x - midPx.x;
                const toCentroidY = centroidPx.y - midPx.y;
                if (perpX * toCentroidX + perpY * toCentroidY < 0) {
                    perpX = -perpX;
                    perpY = -perpY;
                }

                const offsetX = perpX * OFFSET_PX;
                const offsetY = perpY * OFFSET_PX;

                const tooltip = L.tooltip({
                    permanent: true,
                    direction: 'center',
                    className: 'side-measurement-tooltip-anchor',
                    opacity: 1,
                    offset: [0, 0],
                    interactive: false,
                })
                    .setLatLng([lat, lon])
                    .setContent(
                        `<div class="side-measurement-tooltip" style="transform: translate(${offsetX.toFixed(1)}px, ${offsetY.toFixed(1)}px) rotate(${angleDeg.toFixed(1)}deg);">${sideLength.toFixed(2)}m</div>`
                    )
                    .addTo(map);

                newTooltips.push(tooltip);
            } catch (error) {
                console.error('Error creating measurement tooltip:', error);
            }
        });

        // Cleanup on unmount
        return () => {
            newTooltips.forEach(t => t.remove());
        };
    }, [map, lot]);

    return null;
}

function MeasurementController({ selectedLotId, lots }: { selectedLotId: string | null; lots: Lot[] }) {
    const map = useMap();
    const selectedLot = useMemo(() => lots.find(l => l.id === selectedLotId), [lots, selectedLotId]);

    if (!selectedLot) return null;

    return <SideMeasurementTooltips lot={selectedLot} map={map} />;
}

export default function LeafletMap({ lots, elementosUrbanos = [], selectedLotId, onLotSelect, mapType, userLocation, preferCanvas = true, showMeasurements = true, onPhotoPointClick }: LeafletMapProps) {
    const center: [number, number] = [-12.0464, -77.0428];
    const [zoom, setZoom] = useState(17.5);
    const [isMobile, setIsMobile] = useState(false);

    // Detección adaptativa de dispositivo móvil en cliente
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsMobile(window.innerWidth < 768);
            const handleResize = () => setIsMobile(window.innerWidth < 768);
            window.addEventListener('resize', handleResize);
            return () => window.removeEventListener('resize', handleResize);
        }
    }, []);

    const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);

    // Umbral alto para que las etiquetas solo aparezcan cuando el zoom esté bien cerca
    const labelZoomThreshold = 21;
    const showLabels = zoom >= labelZoomThreshold;

    // OPTIMIZACIÓN CRÍTICA: Memoizar todas las posiciones Lat/Lng
    const memoizedPositionsMap = useMemo(() => {
        const map = new Map<string, [number, number][]>();
        lots.forEach(lot => {
            // Lados curvos (x_geometry_arcos): se muestrea la curva real en
            // UTM ANTES de proyectar a lat/lng, así el mapa dibuja el arco
            // real en vez de la cuerda recta entre sus 2 extremos.
            const puntosUtm = expandirVerticesConArcos(lot.points, lot.x_geometry_arcos);
            const positions: [number, number][] = puntosUtm.map(p => {
                try {
                    const [lon, lat] = proj4("EPSG:32718", "EPSG:4326", [p[0], p[1]]);
                    return [lat, lon] as [number, number];
                } catch {
                    return [0, 0] as [number, number];
                }
            });
            map.set(`${lot.id}-${lot.default_code}`, positions);
        });
        return map;
    }, [lots]);

    // Posiciones Lat/Lng de calles/parques/etc, memoizadas igual que los
    // lotes. Un elemento puede ser: círculo completo (x_geometry_circulo,
    // centro+radio), o un polígono/línea (points, con lados curvos
    // expandidos vía expandirVerticesConArcos antes de proyectar).
    const elementosUrbanosPositions = useMemo(() => {
        const utmToLatLng = (p: [number, number]): [number, number] => {
            try {
                const [lon, lat] = proj4("EPSG:32718", "EPSG:4326", [p[0], p[1]]);
                return [lat, lon];
            } catch {
                return [0, 0];
            }
        };
        return elementosUrbanos.map(elemento => {
            if (elemento.circulo) {
                return {
                    elemento,
                    kind: 'circulo' as const,
                    center: utmToLatLng(elemento.circulo.centro),
                    radiusMeters: elemento.circulo.radio,
                };
            }
            const puntosUtm = expandirVerticesConArcos(elemento.points, elemento.arcos);
            const kind: 'area' | 'linea' = elemento.esArea ? 'area' : 'linea';
            return {
                elemento,
                kind,
                positions: puntosUtm.map(utmToLatLng),
            };
        });
    }, [elementosUrbanos]);

    // COORDENADAS DEL PLANO GENERAL (MASTERPLAN)
    // Proporcionadas por el usuario (Actualizadas):
    // Top-Left (NO): X=308132.686, Y=8623379.426
    // Bottom-Right (SE): X=309193.741, Y=8622631.289
    const imageBounds = useMemo(() => {
        try {
            const tl = proj4("EPSG:32718", "EPSG:4326", [309192.39, 8622652.56]); // -1m Sur
            const br = proj4("EPSG:32718", "EPSG:4326", [308126.61, 8623393.44]); // -1m Sur
            // Leaflet expects [lat, lng], so we swap [1] (lat) and [0] (lon)
            return [[tl[1], tl[0]], [br[1], br[0]]] as L.LatLngBoundsExpression;
        } catch (e) {
            console.error("Error calculating image bounds", e);
            return null;
        }
    }, []);

    // Expert Soft Palette + User Requests (Gray & Purple)
    const getColor = (status: string) => {
        const s = status?.toLowerCase().trim() || '';
        switch (s) {
            case 'libre':
            case 'disponible': return '#34D399'; // Emerald-400 (Soft Green)

            case 'cotizacion':
            case 'cotización': return '#FDE047'; // Yellow-300 (Soft Yellow)

            case 'no vender': return '#94A3B8'; // Slate-400 (Gray)

            case 'reservado':
            case 'separado': return '#C084FC'; // Purple-400 (Morado Suave)

            case 'vendido': return '#F87171'; // Red-400 (Soft Red)

            default: return '#94A3B8'; // Slate-400 (Neutral Grey)
        }
    };



    return (
        <MapContainer
            center={center}
            zoom={16}
            maxZoom={22}
            scrollWheelZoom={true}
            preferCanvas={preferCanvas}
            style={{ height: '100%', width: '100%', background: mapType === 'blank' ? '#ffffff' : mapType === 'dark' ? '#1e293b' : '#ddd' }}
            className="z-0"
        >
            {mapType === 'street' && (
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors'
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                    maxNativeZoom={19}
                    updateWhenZooming={false} // Evita recargar tiles durante la animación de zoom (ahorra CPU en móvil)
                    updateWhenIdle={true} // Solo carga tiles cuando el mapa está quieto
                />
            )}
            {mapType === 'satellite' && (
                <TileLayer
                    attribution='Tiles &copy; Esri'
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    maxNativeZoom={19}
                    updateWhenZooming={false}
                    updateWhenIdle={true}
                />
            )}
            {mapType === 'dark' && (
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    maxNativeZoom={19}
                    updateWhenZooming={false}
                    updateWhenIdle={true}
                />
            )}

            {/* SUPERPOSICIÓN DEL PLANO MASTER (RENDER) */}
            {imageBounds && (
                <ImageOverlay
                    url="/plano_general.webp"
                    bounds={imageBounds}
                    opacity={1}
                    zIndex={10}
                    interactive={false} // Desactiva la interactividad para evitar consumir eventos de toque en móviles
                />
            )}

            {userLocation && (
                <>
                    <CircleMarker
                        center={userLocation}
                        radius={8}
                        pathOptions={{ fillColor: '#3B82F6', fillOpacity: 1, color: '#FFFFFF', weight: 3 }}
                    />
                    <Circle
                        center={userLocation}
                        radius={20}
                        pathOptions={{ fillColor: '#3B82F6', fillOpacity: 0.1, color: '#3B82F6', weight: 1, opacity: 0.3 }}
                    />
                </>
            )}

            {/* Calles/parques/círculos/líneas (contexto visual, no vendibles):
                se dibujan debajo de los lotes, sin tooltip ni interacción. */}
            {elementosUrbanosPositions.map((item) => {
                const { elemento } = item;
                const color = elemento.color || COLOR_ELEMENTO_URBANO_FALLBACK;

                if (item.kind === 'circulo') {
                    // Punto de interés fotográfico: ícono de cámara clickeable
                    // en vez del círculo relleno genérico — no aplica el
                    // radio real (sería casi invisible al zoom normal, ya
                    // que estos puntos suelen tener radio ~1m solo para
                    // marcar la ubicación).
                    if (elemento.tipo === 'foto' && elemento.fotos && elemento.fotos.length > 0) {
                        return (
                            <Marker
                                key={`urbano-${elemento.codigo}`}
                                position={item.center}
                                icon={crearIconoFoto(color)}
                                eventHandlers={{
                                    click: () => onPhotoPointClick?.(elemento),
                                }}
                            />
                        );
                    }
                    return (
                        <Circle
                            key={`urbano-${elemento.codigo}`}
                            center={item.center}
                            radius={item.radiusMeters}
                            pathOptions={{ color, fillColor: color, fillOpacity: 0.5, weight: 1, interactive: false }}
                        />
                    );
                }

                if (!item.positions || item.positions.length === 0) return null;

                if (item.kind === 'linea') {
                    return (
                        <Polyline
                            key={`urbano-${elemento.codigo}`}
                            positions={item.positions}
                            pathOptions={{ color, weight: 2, interactive: false }}
                        />
                    );
                }

                return (
                    <Polygon
                        key={`urbano-${elemento.codigo}`}
                        positions={item.positions}
                        pathOptions={{
                            color,
                            fillColor: color,
                            fillOpacity: 0.5,
                            weight: 1,
                            interactive: false,
                        }}
                    />
                );
            })}

            {lots.map((lot) => {
                const positions = memoizedPositionsMap.get(`${lot.id}-${lot.default_code}`);
                if (!positions || positions.length === 0) return null;

                const isSelected = selectedLotId === lot.id;
                const areaClass = lot.x_area < 200 ? 'label-area-small' : (lot.x_area < 1200 ? 'label-area-medium' : 'label-area-large');

                // Viewport Culling: Solo renderizar etiquetas de lotes que están visibles en la pantalla actual
                const isInsideViewport = mapBounds
                    ? mapBounds.contains(positions[0] as [number, number])
                    : true;

                return (
                    <Polygon
                        key={`${lot.id}-${lot.default_code}`}
                        positions={positions}
                        smoothFactor={isMobile ? 1.5 : 1.0} // Simplificación de geometría adaptativa en móvil (Douglas-Peucker)
                        pathOptions={{
                            color: isSelected ? '#2563EB' : ((mapType === 'satellite' || mapType === 'dark') ? 'white' : '#64748b'),
                            fillColor: getColor(lot.x_statu),
                            fillOpacity: 0.6,
                            weight: isSelected ? 3 : 1,
                            className: isSelected ? 'lot-selected leaflet-interactive' : 'leaflet-interactive'
                        }}
                        // Optimización: en móvil desactivamos los listeners de hover completamente
                        eventHandlers={isMobile ? {
                            click: () => onLotSelect(lot)
                        } : {
                            click: () => onLotSelect(lot),
                            mouseover: (e) => {
                                if (isMobile) return; // Omitir cálculos de hover en móviles
                                const layer = e.target;
                                layer.setStyle({
                                    weight: 3,
                                    fillOpacity: 0.8,
                                    color: '#FFFFFF' // Borde blanco brillante al pasar el mouse
                                });
                                layer.bringToFront(); // Traer al frente
                            },
                            mouseout: (e) => {
                                if (isMobile) return; // Omitir en móviles
                                const layer = e.target;
                                // Resetear al estilo original
                                const isSelected = selectedLotId === lot.id;
                                layer.setStyle({
                                    weight: isSelected ? 3 : 1,
                                    fillOpacity: 0.6,
                                    color: isSelected ? '#2563EB' : ((mapType === 'satellite' || mapType === 'dark') ? 'white' : '#64748b')
                                });
                            }
                        }}
                    >
                        {showLabels && (isInsideViewport || isSelected) && (
                            <Tooltip
                                key={`tooltip-${lot.id}`}
                                permanent={true}
                                direction="center"
                                className="!bg-transparent !border-0 !shadow-none p-0 tooltip-opt"
                                opacity={1}
                            >
                                <div className={`flex flex-col items-center justify-center bg-white rounded border border-slate-200 p-1 min-w-[40px] cursor-pointer lot-label-container ${areaClass} ${isSelected ? 'label-selected border-blue-500' : ''}`}>
                                    <span className="text-slate-800 font-bold text-[9px] tracking-tight uppercase text-center leading-none">
                                        {lot.x_mz}{lot.x_lote}
                                    </span>
                                    <div className="h-[0.5px] w-full bg-slate-100 my-0.5"></div>
                                    <span className="text-blue-600 text-[8px] font-bold tracking-wide">
                                        {Number(lot.x_area).toFixed(2)} m²
                                    </span>
                                </div>
                            </Tooltip>
                        )}
                    </Polygon>
                );
            })}

            <MapController lots={lots} selectedLotId={selectedLotId} onZoomChange={setZoom} />
            <MapBoundsController onBoundsChange={setMapBounds} />
            {showMeasurements && <MeasurementController selectedLotId={selectedLotId} lots={lots} />}
        </MapContainer>
    );
}
