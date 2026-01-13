'use client';

import { MapContainer, TileLayer, Polygon, Popup, useMap, Tooltip, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';
import proj4 from 'proj4';
import { Lot } from '@/app/data/lotsData';
import { useEffect, useRef } from 'react';
import L from 'leaflet';

// Define UTM zone 18L projection (WGS84)
proj4.defs("EPSG:32718", "+proj=utm +zone=18 +south +datum=WGS84 +units=m +no_defs");

interface LeafletMapProps {
    lots: Lot[];
    selectedLotId: string | null;
    onLotSelect: (lot: Lot) => void;
    mapType: 'street' | 'satellite' | 'blank';
}

function MapController({ lots, selectedLotId }: { lots: Lot[], selectedLotId: string | null }) {
    const map = useMap();
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // If selected lot, fly to it
        if (selectedLotId) {
            const selectedLot = lots.find(l => l.id === selectedLotId);
            if (selectedLot && selectedLot.points && selectedLot.points.length > 0) {
                try {
                    const p1 = selectedLot.points[0];
                    const [lon, lat] = proj4("EPSG:32718", "EPSG:4326", [p1[0], p1[1]]);
                    map.flyTo([lat, lon], 17, { animate: true, duration: 1 });
                } catch (e) {
                    console.error("FlyTo error", e);
                }
            }
        }
        // Initial bounds fitting if no selection AND we haven't done it recently to avoid jitter
        else if (lots.length > 0) {
            // Simple center logic for now, or could use fitBounds if we calculated bounds of all polygons
            // Let's stick to a known good center for the polygons provided
            // Center around the first lot
            try {
                const firstLot = lots[0];
                if (firstLot.points.length > 0) {
                    const p = firstLot.points[0];
                    const [lon, lat] = proj4("EPSG:32718", "EPSG:4326", [p[0], p[1]]);
                    // Only set view if far away? No, simple is better.
                    // map.setView([lat, lon], 15);
                }
            } catch (e) { }
        }
    }, [selectedLotId, map, lots]);

    return null;
}

export default function LeafletMap({ lots, selectedLotId, onLotSelect, mapType }: LeafletMapProps) {
    const center: [number, number] = [-12.0464, -77.0428];

    const getColor = (status: string) => {
        switch (status) {
            case 'available': return '#10B981'; // emerald-500
            case 'reserved': return '#F59E0B'; // amber-500
            case 'sold': return '#EF4444'; // red-500
            default: return '#3b82f6';
        }
    };

    return (
        <MapContainer
            center={center}
            zoom={14}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%', background: mapType === 'blank' ? '#ffffff' : '#ddd' }}
            className="z-0"
        >
            {mapType === 'street' && (
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                />
            )}
            {mapType === 'satellite' && (
                <TileLayer
                    attribution='Tiles &copy; Esri'
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
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
                            permanent
                            direction="center"
                            className="bg-transparent border-0 shadow-none font-bold text-xs"
                            opacity={1}
                        >
                            <span className="text-black drop-shadow-md bg-white/50 px-1 rounded backdrop-blur-[1px]">
                                {lot.name}
                            </span>
                        </Tooltip>
                    </Polygon>
                );
            })}

            <MapController lots={lots} selectedLotId={selectedLotId} />
        </MapContainer>
    );
}
