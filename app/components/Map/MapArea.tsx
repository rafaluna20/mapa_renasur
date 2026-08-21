import { Map as MapIcon, Layers, Square, Navigation, Ruler, FileDown, Building2, Moon } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import MapContainerWrapper from './MapContainer';
import LotDetailModal from '../UI/LotDetailModal';
import PhotoPointModal from './PhotoPointModal';
import { Lot } from '@/app/data/lotsData';
import { ElementoUrbano } from '@/app/data/elementosUrbanos';
import { odooService, OdooUser, Proyecto } from '@/app/services/odooService';
import { SHADOW_FLOATING } from '@/app/lib/designTokens';

interface MapAreaProps {
    lots: Lot[];
    elementosUrbanos?: ElementoUrbano[];
    proyectos?: Proyecto[];
    selectedLotId: string | null;
    onLotSelect: (lot: Lot) => void;
    onCloseModal: () => void;
    mapType: 'street' | 'satellite' | 'blank' | 'dark';
    onMapTypeChange: (type: 'street' | 'satellite' | 'blank' | 'dark') => void;
    userLocation: [number, number] | null;
    onUserLocationChange: (loc: [number, number]) => void;
    selectedLot: Lot | null;
    onUpdateStatus: (id: string, status: string) => void;
    onQuotation?: (lot: Lot) => void;
    preferCanvas?: boolean;
    showMeasurements: boolean;
    onToggleMeasurements: () => void;
    currentUser?: OdooUser | null;
    onExport: () => void;
    onExportPdf: () => void;
}

export default function MapArea({
    lots, elementosUrbanos = [], proyectos = [], selectedLotId, onLotSelect, onCloseModal,
    mapType, onMapTypeChange,
    userLocation, onUserLocationChange,
    selectedLot, onUpdateStatus,
    onQuotation,
    preferCanvas,
    showMeasurements, onToggleMeasurements,
    currentUser,
    onExport, onExportPdf
}: MapAreaProps) {
    const [activeQuotes, setActiveQuotes] = useState<{ count: number; quotes: { orderId: number; clientName: string; vendorName: string }[] } | null>(null);
    const [selectedPhotoPoint, setSelectedPhotoPoint] = useState<ElementoUrbano | null>(null);

    // Fetch active quotes when a lot is selected
    useEffect(() => {
        const fetchQuotes = async () => {
            if (selectedLot && selectedLot.default_code) {
                const data = await odooService.getActiveQuotesByLot(selectedLot.default_code);
                // Type assertion to resolve type incompatibility
                setActiveQuotes(data as any);
            } else {
                setActiveQuotes(null);
            }
        };
        fetchQuotes();
    }, [selectedLot]);

    return (
        <div id="map-export-area" className="flex-1 bg-slate-200 dark:bg-slate-800 relative overflow-hidden flex flex-col">

            {/* Floating Export Tools (Top Center) - Premium Pill Style */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] flex gap-2">
                <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-full shadow-lg border border-stone-200 dark:border-slate-700 p-1.5 flex gap-1">
                    <Link
                        href="/portal/login"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#A145F5] text-white hover:bg-[#8D32DF] shadow-sm hover:shadow-md transition-all text-xs font-bold"
                        title="Ir al Portal de Pagos"
                    >
                        <Building2 size={14} />
                        <span>Portal</span>
                    </Link>
                    <div className="w-px bg-stone-200 dark:bg-slate-700 my-1"></div>
                    <button
                        onClick={onExport}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-[#A145F5]/10 text-stone-600 dark:text-slate-300 hover:text-[#A145F5] transition-colors text-xs font-bold"
                        title="Exportar como Imagen SVG"
                    >
                        <MapIcon size={14} />
                        <span>SVG</span>
                    </button>
                    <div className="w-px bg-stone-200 dark:bg-slate-700 my-1"></div>
                    <button
                        onClick={onExportPdf}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#A145F5] text-white hover:bg-[#8D32DF] shadow-sm hover:shadow-md transition-all text-xs font-bold"
                        title="Descargar Reporte PDF"
                    >
                        <FileDown size={14} />
                        <span>PDF</span>
                    </button>
                </div>
            </div>

            {/* Map Controls (Floating) */}
            <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2">
                <div className={`bg-white dark:bg-slate-900 rounded-lg ${SHADOW_FLOATING} p-1 border border-slate-100 dark:border-slate-700 flex flex-col gap-1`}>
                    <button
                        onClick={() => onMapTypeChange('street')}
                        className={`p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${mapType === 'street' ? 'bg-[#A145F5]/10 text-[#A145F5]' : 'text-slate-600 dark:text-slate-300'}`}
                        title="Mapa Calles"
                    >
                        <MapIcon size={20} />
                    </button>
                    <button
                        onClick={() => onMapTypeChange('satellite')}
                        className={`p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${mapType === 'satellite' ? 'bg-[#A145F5]/10 text-[#A145F5]' : 'text-slate-600 dark:text-slate-300'}`}
                        title="Mapa Satélite"
                    >
                        <Layers size={20} />
                    </button>
                    <button
                        onClick={() => onMapTypeChange('blank')}
                        className={`p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${mapType === 'blank' ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300'}`}
                        title="Fondo Blanco"
                    >
                        <Square size={20} />
                    </button>
                    <button
                        onClick={() => onMapTypeChange('dark')}
                        className={`p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${mapType === 'dark' ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-300'}`}
                        title="Mapa Oscuro"
                    >
                        <Moon size={20} />
                    </button>
                    <div className="h-[1px] bg-slate-100 dark:bg-slate-700 mx-1"></div>
                    <button
                        onClick={onToggleMeasurements}
                        className={`p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${showMeasurements ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}
                        title={showMeasurements ? "Ocultar Medidas" : "Mostrar Medidas"}
                    >
                        <Ruler size={20} />
                    </button>
                </div>
                <button
                    className={`bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 p-2 rounded-lg ${SHADOW_FLOATING} border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800`}
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

            {/* Legend Overlay + cubo isométrico de marca (Terra Lima Lotes) */}
            <div className="absolute bottom-34 right-4 z-[400] flex flex-col items-end gap-[17px]">
                {/* Solo desktop: en móvil ese espacio es escaso y esto es
                    puramente decorativo, no aporta a la tarea del usuario.
                    self-center: centrado sobre el ancho de la leyenda, no
                    pegado al borde derecho como el resto de los elementos
                    de esta columna. */}
                <div className="hidden md:flex flex-col items-center gap-1 self-center pointer-events-none" aria-hidden="true">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Lotes</span>
                    <div className="terra-lima-cube-scene">
                        <div className="terra-lima-cube">
                            <div className="cube-face cube-face-front">TERRA LIMA</div>
                            <div className="cube-face cube-face-back">TERRA LIMA</div>
                            <div className="cube-face cube-face-right">VENTA</div>
                            <div className="cube-face cube-face-left">VENTA</div>
                            <div className="cube-face cube-face-top">TERRA LIMA</div>
                            <div className="cube-face cube-face-bottom">VENTA</div>
                        </div>
                    </div>
                </div>

                <div className={`bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm p-3 rounded-lg ${SHADOW_FLOATING} border border-slate-100 dark:border-slate-700 pointer-events-none`}>
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Leyenda</h4>
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                            <div className="w-3 h-3 rounded-sm bg-slate-400"></div>
                            <span className="text-slate-700 dark:text-slate-300">No Vender</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <div className="w-3 h-3 rounded-sm bg-emerald-400"></div>
                            <span className="text-slate-700 dark:text-slate-300">Disponible</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <div className="w-3 h-3 rounded-sm bg-yellow-300"></div>
                            <span className="text-slate-700 dark:text-slate-300">En Cotización</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <div className="w-3 h-3 rounded-sm bg-purple-400"></div>
                            <span className="text-slate-700 dark:text-slate-300">Reservado</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <div className="w-3 h-3 rounded-sm bg-red-400"></div>
                            <span className="text-slate-700 dark:text-slate-300">Vendido</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 z-0 relative h-full">
                <MapContainerWrapper
                    lots={lots}
                    elementosUrbanos={elementosUrbanos}
                    proyectos={proyectos}
                    selectedLotId={selectedLotId}
                    onLotSelect={onLotSelect}
                    mapType={mapType}
                    userLocation={userLocation}
                    preferCanvas={preferCanvas}
                    showMeasurements={showMeasurements}
                    onPhotoPointClick={setSelectedPhotoPoint}
                />
            </div>

            {/* Detail Modal Overlay (Floating) */}
            <LotDetailModal
                lot={selectedLot}
                onClose={onCloseModal}
                onUpdateStatus={onUpdateStatus}
                onQuotation={onQuotation}
                activeQuotes={activeQuotes || undefined}
                currentUser={currentUser}
            />

            {/* Galería de fotos de un punto de interés (capa "foto") */}
            {selectedPhotoPoint && (
                <PhotoPointModal
                    elemento={selectedPhotoPoint}
                    onClose={() => setSelectedPhotoPoint(null)}
                />
            )}

        </div>
    );
}
