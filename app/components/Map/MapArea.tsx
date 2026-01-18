import { Map as MapIcon, Layers, Square, Navigation, Ruler } from 'lucide-react';
import MapContainerWrapper from './MapContainer';
import LotDetailModal from '../UI/LotDetailModal';
import { Lot } from '@/app/data/lotsData';

interface MapAreaProps {
    lots: Lot[];
    selectedLotId: string | null;
    onLotSelect: (lot: Lot) => void;
    onCloseModal: () => void;
    mapType: 'street' | 'satellite' | 'blank';
    onMapTypeChange: (type: 'street' | 'satellite' | 'blank') => void;
    userLocation: [number, number] | null;
    onUserLocationChange: (loc: [number, number]) => void;
    selectedLot: Lot | null;
    onUpdateStatus: (id: string, status: string) => void;
    preferCanvas?: boolean;
    showMeasurements: boolean;
    onToggleMeasurements: () => void;
}

export default function MapArea({
    lots, selectedLotId, onLotSelect, onCloseModal,
    mapType, onMapTypeChange,
    userLocation, onUserLocationChange,
    selectedLot, onUpdateStatus,
    preferCanvas,
    showMeasurements, onToggleMeasurements
}: MapAreaProps) {
    return (
        <div id="map-export-area" className="flex-1 bg-slate-200 relative overflow-hidden flex flex-col">
            {/* Map Controls (Floating) */}
            <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2">
                <div className="bg-white rounded-lg shadow-md p-1 border border-slate-200 flex flex-col gap-1">
                    <button
                        onClick={() => onMapTypeChange('street')}
                        className={`p-2 rounded hover:bg-slate-100 transition-colors ${mapType === 'street' ? 'bg-blue-50 text-blue-600' : 'text-slate-600'}`}
                        title="Mapa Calles"
                    >
                        <MapIcon size={20} />
                    </button>
                    <button
                        onClick={() => onMapTypeChange('satellite')}
                        className={`p-2 rounded hover:bg-slate-100 transition-colors ${mapType === 'satellite' ? 'bg-blue-50 text-blue-600' : 'text-slate-600'}`}
                        title="Mapa Satélite"
                    >
                        <Layers size={20} />
                    </button>
                    <button
                        onClick={() => onMapTypeChange('blank')}
                        className={`p-2 rounded hover:bg-slate-100 transition-colors ${mapType === 'blank' ? 'bg-blue-50 text-blue-600' : 'text-slate-600'}`}
                        title="Fondo Blanco"
                    >
                        <Square size={20} />
                    </button>
                    <div className="h-[1px] bg-slate-100 mx-1"></div>
                    <button
                        onClick={onToggleMeasurements}
                        className={`p-2 rounded hover:bg-slate-100 transition-colors ${showMeasurements ? 'bg-emerald-50 text-emerald-600' : 'text-slate-400'}`}
                        title={showMeasurements ? "Ocultar Medidas" : "Mostrar Medidas"}
                    >
                        <Ruler size={20} />
                    </button>
                </div>
                <button
                    className="bg-white text-slate-700 p-2 rounded-lg shadow-md border border-slate-200 hover:bg-slate-50"
                    title="Mi Ubicación"
                    onClick={() => {
                        if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(
                                (position) => {
                                    const { latitude, longitude } = position.coords;
                                    onUserLocationChange([latitude, longitude]);
                                    // Let parent handle side-effects if needed, or dispatch event here
                                    window.dispatchEvent(new CustomEvent('centerMap', {
                                        detail: { lat: latitude, lng: longitude, zoom: 18 }
                                    }));
                                },
                                (error) => {
                                    alert('No se pudo obtener tu ubicación: ' + error.message);
                                }
                            );
                        } else {
                            alert('Tu navegador no soporta geolocalización');
                        }
                    }}
                >
                    <Navigation size={20} />
                </button>
            </div>

            {/* Legend Overlay */}
            <div className="absolute bottom-6 right-4 z-[400] bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-lg border border-slate-200 pointer-events-none">
                <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Leyenda</h4>
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-3 rounded-sm bg-emerald-500"></div>
                        <span className="text-slate-700">Disponible</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-3 rounded-sm bg-amber-500"></div>
                        <span className="text-slate-700">Reservado</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-3 rounded-sm bg-red-500"></div>
                        <span className="text-slate-700">Vendido</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 z-0 relative h-full">
                <MapContainerWrapper
                    lots={lots}
                    selectedLotId={selectedLotId}
                    onLotSelect={onLotSelect}
                    mapType={mapType}
                    userLocation={userLocation}
                    preferCanvas={preferCanvas}
                    showMeasurements={showMeasurements}
                />
            </div>

            {/* Detail Modal Overlay (Floating) */}
            <LotDetailModal
                lot={selectedLot}
                onClose={onCloseModal}
                onUpdateStatus={onUpdateStatus}
            />
        </div>
    );
}
