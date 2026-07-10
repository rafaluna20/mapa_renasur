'use client';

import { MapContainer, TileLayer, Polygon, useMap, Tooltip, Circle, CircleMarker, ImageOverlay } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';
import proj4 from 'proj4';
import { Lot } from '@/app/data/lotsData';
import { ElementoUrbano } from '@/app/data/elementosUrbanos';
import { useEffect, useState, useMemo, useRef } from 'react';
import L from 'leaflet';
import { calculateMidpoint } from '@/app/utils/geometryUtils';

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
    mapType: 'street' | 'satellite' | 'blank';
    userLocation?: [number, number] | null;
    preferCanvas?: boolean;
    showMeasurements?: boolean;
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

        // Helper function to determine tooltip direction based on edge orientation
        const getTooltipDirection = (p1: [number, number], p2: [number, number]): 'top' | 'bottom' | 'left' | 'right' => {
            const dx = p2[0] - p1[0];
            const dy = p2[1] - p1[1];

            // Calculate angle in degrees (0-360)
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            const normalizedAngle = (angle + 360) % 360;

            // Determine direction based on angle
            // Top: 45-135 degrees (edge goes up-right to up-left)
            // Bottom: 225-315 degrees (edge goes down-left to down-right)
            // Right: 315-45 degrees (edge goes right)
            // Left: 135-225 degrees (edge goes left)

            if (normalizedAngle >= 45 && normalizedAngle < 135) {
                return 'top';
            } else if (normalizedAngle >= 135 && normalizedAngle < 225) {
                return 'left';
            } else if (normalizedAngle >= 225 && normalizedAngle < 315) {
                return 'bottom';
            } else {
                return 'right';
            }
        };

        // Create a tooltip for each side
        lot.points.forEach((point, index) => {
            const nextIndex = (index + 1) % lot.points.length;
            const nextPoint = lot.points[nextIndex];

            // Calculate midpoint in UTM
            const midpointUTM = calculateMidpoint(point, nextPoint);

            // Determine tooltip direction
            const direction = getTooltipDirection(point, nextPoint);

            // Convert to lat/lng for display
            try {
                const [lon, lat] = proj4("EPSG:32718", "EPSG:4326", [midpointUTM[0], midpointUTM[1]]);
                const sideLength = lot.measurements!.sides[index];

                const tooltip = L.tooltip({
                    permanent: true,
                    direction: direction,
                    className: 'side-measurement-tooltip',
                    opacity: 1,
                    offset: [0, 0] // No offset needed, let direction handle it
                })
                    .setLatLng([lat, lon])
                    .setContent(`${sideLength.toFixed(2)}m`)
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

export default function LeafletMap({ lots, elementosUrbanos = [], selectedLotId, onLotSelect, mapType, userLocation, preferCanvas = true, showMeasurements = true }: LeafletMapProps) {
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
            const positions: [number, number][] = lot.points.map(p => {
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

    // Posiciones Lat/Lng de calles/parques, memoizadas igual que los lotes.
    const elementosUrbanosPositions = useMemo(() => {
        return elementosUrbanos.map(elemento => ({
            elemento,
            positions: elemento.points.map(p => {
                try {
                    const [lon, lat] = proj4("EPSG:32718", "EPSG:4326", [p[0], p[1]]);
                    return [lat, lon] as [number, number];
                } catch {
                    return [0, 0] as [number, number];
                }
            }),
        }));
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
            style={{ height: '100%', width: '100%', background: mapType === 'blank' ? '#ffffff' : '#ddd' }}
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

            {/* Calles y parques (contexto visual, no vendibles): se dibujan
                debajo de los lotes, sin tooltip ni interacción de selección. */}
            {elementosUrbanosPositions.map(({ elemento, positions }) => {
                if (!positions || positions.length === 0) return null;
                return (
                    <Polygon
                        key={`urbano-${elemento.codigo}`}
                        positions={positions}
                        pathOptions={{
                            color: elemento.color || COLOR_ELEMENTO_URBANO_FALLBACK,
                            fillColor: elemento.color || COLOR_ELEMENTO_URBANO_FALLBACK,
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
                            color: isSelected ? '#2563EB' : (mapType === 'satellite' ? 'white' : '#64748b'),
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
                                    color: isSelected ? '#2563EB' : (mapType === 'satellite' ? 'white' : '#64748b')
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
                                <div className={`flex flex-col items-center justify-center bg-white rounded shadow-sm border border-slate-200 p-1 min-w-[40px] cursor-pointer lot-label-container ${areaClass} ${isSelected ? 'label-selected border-blue-500 shadow-blue-500/20' : ''}`}>
                                    <span className="text-slate-800 font-bold text-[9px] tracking-tight uppercase text-center leading-none">
                                        {lot.x_mz}{lot.x_lote}
                                    </span>
                                    <div className="h-[0.5px] w-full bg-slate-100 my-0.5"></div>
                                    <span className="text-blue-600 text-[8px] font-bold tracking-wide">
                                        {Number(lot.x_area).toFixed(1)} m²
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
