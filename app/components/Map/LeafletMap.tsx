'use client';

import { MapContainer, TileLayer, Polygon, Popup, useMap, Tooltip, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';
import proj4 from 'proj4';
import { Lot } from '@/app/data/lotsData';
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

const ZOOM_THRESHOLD_LABELS = 14;

// Define UTM zone 18L projection (WGS84)
proj4.defs("EPSG:32718", "+proj=utm +zone=18 +south +datum=WGS84 +units=m +no_defs");

interface LeafletMapProps {
    lots: Lot[];
    selectedLotId: string | null;
    onLotSelect: (lot: Lot) => void;
    mapType: 'street' | 'satellite' | 'blank';
}

function MapController({ lots, selectedLotId, onZoomChange }: { lots: Lot[], selectedLotId: string | null, onZoomChange: (z: number) => void }) {
    const map = useMap();
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Report initial zoom
        onZoomChange(map.getZoom());

        const handleZoom = () => {
            onZoomChange(map.getZoom());
        };

        map.on('zoomend', handleZoom);
        return () => {
            map.off('zoomend', handleZoom);
        };
    }, [map, onZoomChange]);

    useEffect(() => {
        // If selected lot, fly to it
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
                        // Calculate the target zoom to fit the bounds with padding
                        const targetZoom = map.getBoundsZoom(bounds, false, [50, 50] as any);
                        const finalZoom = Math.min(targetZoom, 21); // Ensure we don't exceed maxZoom

                        // Use flyTo for a smoother "flight" animation
                        map.flyTo(bounds.getCenter(), finalZoom, {
                            duration: 2, // Slower duration for "gradual" effect
                            easeLinearity: 0.25
                        });
                    }
                } catch (e) {
                    console.error("Zoom to lot error", e);
                }
            }
        }
        // Initial bounds fitting if no selection
        else if (lots.length > 0) {
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

    return null;
}

export default function LeafletMap({ lots, selectedLotId, onLotSelect, mapType }: LeafletMapProps) {
    const center: [number, number] = [-12.0464, -77.0428];
    const [zoom, setZoom] = useState(16);

    const getColor = (status: string) => {
        switch (status) {
            case 'available': return '#10B981'; // emerald-500
            case 'reserved': return '#F59E0B'; // amber-500
            case 'sold': return '#EF4444'; // red-500
            default: return '#3b82f6';
        }
    };

    const getMinZoomForLabel = (area: number) => {
        if (area < 200) return 21; // Small lots (e.g. 160m2) needs high zoom
        if (area < 1200) return 19; // Medium lots
        return 19; // Large lots
    };

    return (
        <MapContainer
            center={center}
            zoom={16}
            maxZoom={22}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%', background: mapType === 'blank' ? '#ffffff' : '#ddd' }}
            className="z-0"
        >
            {mapType === 'street' && (
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
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

            {lots.map((lot) => {
                const positions: [number, number][] = lot.points.map(p => {
                    try {
                        const [lon, lat] = proj4("EPSG:32718", "EPSG:4326", [p[0], p[1]]);
                        return [lat, lon];
                    } catch (e) {
                        return [0, 0];
                    }
                });

                if (positions.length === 0) return null;
                const isSelected = selectedLotId === lot.id;
                const isPermanent = zoom >= getMinZoomForLabel(lot.area);

                return (
                    <Polygon
                        key={lot.id}
                        positions={positions}
                        pathOptions={{
                            color: isSelected ? '#2563EB' : (mapType === 'satellite' ? 'white' : '#64748b'),
                            fillColor: getColor(lot.status),
                            fillOpacity: 0.6,
                            weight: isSelected ? 3 : 1
                        }}
                        eventHandlers={{
                            click: () => onLotSelect(lot),
                        }}
                    >
                        <Tooltip
                            key={`tooltip-${lot.id}-${isPermanent}`}
                            permanent={isPermanent}
                            direction="center"
                            className="!bg-transparent !border-0 !shadow-none p-0"
                            opacity={1}
                        >
                            <div className="flex flex-col items-center justify-center bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-white/50 p-2.5 min-w-[90px] transform transition-all cursor-pointer">
                                <span className="text-slate-800 font-bold text-xs tracking-tight">{lot.name}</span>
                                <div className="h-px w-full bg-slate-100 my-1.5"></div>
                                <span className="text-blue-600 text-[10px] font-bold bg-blue-50 px-2 py-0.5 rounded-full tracking-wide shadow-sm">
                                    {lot.area} m²
                                </span>
                            </div>
                        </Tooltip>
                    </Polygon>
                );
            })}

            <MapController lots={lots} selectedLotId={selectedLotId} onZoomChange={setZoom} />
        </MapContainer>
    );
}
