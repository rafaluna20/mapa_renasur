'use client';

import { MapContainer, TileLayer, Polygon, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';
import proj4 from 'proj4';
import { Lot } from '@/app/data/lotsData';
import { useEffect, useMemo } from 'react';
import L from 'leaflet';

// Define UTM zone 18L projection (WGS84)
// EPSG:32718 is WGS 84 / UTM zone 18S.
proj4.defs("EPSG:32718", "+proj=utm +zone=18 +south +datum=WGS84 +units=m +no_defs");

interface LeafletMapProps {
    lots: Lot[];
    selectedLot: Lot | null;
    onLotSelect: (lot: Lot) => void;
}

function MapController({ lots, selectedLot }: { lots: Lot[], selectedLot: Lot | null }) {
    const map = useMap();

    useEffect(() => {
        // If selected lot, fly to it
        if (selectedLot && selectedLot.points && selectedLot.points.length > 0) {
            try {
                // Calculate centroid simply by averaging first point
                // Or just fly to the first point of the polygon
                const p1 = selectedLot.points[0];
                const [lon, lat] = proj4("EPSG:32718", "EPSG:4326", [p1[0], p1[1]]);
                map.flyTo([lat, lon], 16, { animate: true });
            } catch (e) {
                console.error("FlyTo error", e);
            }
        }
        // Initial bounds fitting if no selection
        else if (lots.length > 0) {
            try {
                // Find a valid point to center on
                const firstLot = lots[0];
                if (firstLot.points.length > 0) {
                    const p = firstLot.points[0];
                    const [lon, lat] = proj4("EPSG:32718", "EPSG:4326", [p[0], p[1]]);
                    map.setView([lat, lon], 14);
                }
            } catch (e) { }
        }
    }, [selectedLot, map, lots]);

    return null;
}

export default function LeafletMap({ lots, selectedLot, onLotSelect }: LeafletMapProps) {
    // Center of map - will be updated by controller
    const center: [number, number] = [-12.0464, -77.0428];

    const getColor = (status: string) => {
        switch (status) {
            case 'available': return '#22c55e'; // green-500
            case 'reserved': return '#eab308'; // yellow-500
            case 'sold': return '#ef4444'; // red-500
            default: return '#3b82f6';
        }
    };

    return (
        <MapContainer
            center={center}
            zoom={13}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
            className="z-0"
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {lots.map((lot) => {
                // Convert all UTM points to LatLngs
                const positions: [number, number][] = lot.points.map(p => {
                    try {
                        const [lon, lat] = proj4("EPSG:32718", "EPSG:4326", [p[0], p[1]]);
                        return [lat, lon];
                    } catch (e) {
                        console.error("Proj error", e);
                        return [0, 0];
                    }
                });

                if (positions.length === 0) return null;

                return (
                    <Polygon
                        key={lot.id}
                        positions={positions}
                        pathOptions={{
                            color: getColor(lot.status),
                            fillColor: getColor(lot.status),
                            fillOpacity: selectedLot?.id === lot.id ? 0.6 : 0.4,
                            weight: selectedLot?.id === lot.id ? 3 : 1
                        }}
                        eventHandlers={{
                            click: () => onLotSelect(lot),
                        }}
                    >
                        <Popup>
                            <div className="text-center font-sans">
                                <strong className="block text-lg mb-1">{lot.name}</strong>
                                <span className="text-sm text-gray-600">{lot.area} m²</span>
                                <br />
                                <span className="font-bold text-base">${lot.price.toLocaleString()}</span>
                                <br />
                                <span className={`
                    inline-block px-2 py-0.5 rounded text-xs text-white mt-1 capitalize
                    ${lot.status === 'available' ? 'bg-green-500' : lot.status === 'reserved' ? 'bg-yellow-500' : 'bg-red-500'}
                 `}>
                                    {lot.status}
                                </span>
                            </div>
                        </Popup>
                    </Polygon>
                );
            })}

            <MapController lots={lots} selectedLot={selectedLot} />
        </MapContainer>
    );
}
