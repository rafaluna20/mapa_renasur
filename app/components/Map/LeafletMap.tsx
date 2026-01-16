'use client';

import { MapContainer, TileLayer, Polygon, useMap, Tooltip, Circle, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';
import proj4 from 'proj4';
import { Lot } from '@/app/data/lotsData';
import { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';

const ZOOM_THRESHOLD_LABELS = 14;

// Define UTM zone 18L projection (WGS84)
proj4.defs("EPSG:32718", "+proj=utm +zone=18 +south +datum=WGS84 +units=m +no_defs");

interface LeafletMapProps {
    lots: Lot[];
    selectedLotId: string | null;
    onLotSelect: (lot: Lot) => void;
    mapType: 'street' | 'satellite' | 'blank';
    userLocation?: [number, number] | null;
    preferCanvas?: boolean;
}

function MapController({ lots, selectedLotId, onZoomChange }: { lots: Lot[], selectedLotId: string | null, onZoomChange: (z: number) => void }) {
    const map = useMap();

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
                        const targetZoom = map.getBoundsZoom(bounds, false, [50, 50] as any);
                        const finalZoom = Math.min(targetZoom, 21);
                        map.flyTo(bounds.getCenter(), finalZoom, {
                            duration: 2,
                            easeLinearity: 0.25
                        });
                    }
                } catch (e) {
                    console.error("Zoom to lot error", e);
                }
            }
        } else if (lots.length > 0) {
            try {
                const bounds = L.latLngBounds([]);
                lots.forEach(lot => {
                    lot.points.forEach(p => {
                        const [lon, lat] = proj4("EPSG:32718", "EPSG:4326", [p[0], p[1]]);
                        bounds.extend([lat, lon]);
                    });
                });

                if (bounds.isValid()) {
                    map.fitBounds(bounds, { padding: [20, 20], maxZoom: 22 });
                }
            } catch (e) {
                console.error("FitBounds error", e);
            }
        }
    }, [selectedLotId, map, lots]);

    useEffect(() => {
        const handleCenterMap = (event: any) => {
            const { lat, lng, zoom } = event.detail;
            map.flyTo([lat, lng], zoom, { animate: true, duration: 2 });
        };
        window.addEventListener('centerMap', handleCenterMap);
        return () => window.removeEventListener('centerMap', handleCenterMap);
    }, [map]);

    return null;
}

export default function LeafletMap({ lots, selectedLotId, onLotSelect, mapType, userLocation, preferCanvas = true }: LeafletMapProps) {
    const center: [number, number] = [-12.0464, -77.0428];
    const [zoom, setZoom] = useState(16);

    // OPTIMIZACIÓN CRÍTICA: Memoizar todas las posiciones Lat/Lng
    const memoizedPositionsMap = useMemo(() => {
        const map = new Map<string, [number, number][]>();
        lots.forEach(lot => {
            const positions: [number, number][] = lot.points.map(p => {
                try {
                    const [lon, lat] = proj4("EPSG:32718", "EPSG:4326", [p[0], p[1]]);
                    return [lat, lon] as [number, number];
                } catch (e) {
                    return [0, 0] as [number, number];
                }
            });
            map.set(lot.id, positions);
        });
        return map;
    }, [lots]);

    const getColor = (status: string) => {
        switch (status) {
            case 'libre': return '#10B981';
            case 'separado': return '#F59E0B';
            case 'vendido': return '#EF4444';
            default: return '#3b82f6';
        }
    };

    const getMinZoomForLabel = (area: number) => {
        if (area < 200) return 21;
        if (area < 1200) return 19;
        return 19;
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
                />
            )}
            {mapType === 'satellite' && (
                <TileLayer
                    attribution='Tiles &copy; Esri'
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    maxNativeZoom={19}
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

            {lots.map((lot) => {
                const positions = memoizedPositionsMap.get(lot.id);
                if (!positions || positions.length === 0) return null;

                const isSelected = selectedLotId === lot.id;
                const isPermanent = zoom >= getMinZoomForLabel(lot.x_area);

                return (
                    <Polygon
                        key={lot.id}
                        positions={positions}
                        pathOptions={{
                            color: isSelected ? '#2563EB' : (mapType === 'satellite' ? 'white' : '#64748b'),
                            fillColor: getColor(lot.x_statu),
                            fillOpacity: 0.6,
                            weight: isSelected ? 3 : 1
                        }}
                        eventHandlers={{
                            click: () => onLotSelect(lot),
                        }}
                    >
                        {zoom > 16 && (
                            <Tooltip
                                key={`tooltip-${lot.id}-${isPermanent}`}
                                permanent={isPermanent}
                                direction="center"
                                className="!bg-transparent !border-0 !shadow-none p-0"
                                opacity={1}
                            >
                                <div className="flex flex-col items-center justify-center bg-white/95 backdrop-blur-md rounded-md shadow-md border border-white/50 p-1 min-w-[52px] transform transition-all cursor-pointer">
                                    <div className="flex flex-col items-center leading-[1.1]">
                                        {lot.name.toLowerCase().split(' mz ').map((part, i) => (
                                            <span key={i} className="text-slate-800 font-bold text-[7px] tracking-tight capitalize text-center">
                                                {i === 1 ? `Mz ${part}` : part}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="h-[0.5px] w-full bg-slate-100 my-0.5"></div>
                                    <span className="text-blue-600 text-[6px] font-bold bg-blue-50 px-1 py-0.5 rounded-full tracking-wide shadow-sm">
                                        {lot.x_area} m²
                                    </span>
                                </div>
                            </Tooltip>
                        )}
                    </Polygon>
                );
            })}

            <MapController lots={lots} selectedLotId={selectedLotId} onZoomChange={setZoom} />
        </MapContainer>
    );
}
