'use client';

// ----------------------------------------------------------------------
// Importaciones
// ----------------------------------------------------------------------
import { useState, useMemo, useEffect } from 'react';
import { OdooProduct } from '@/app/services/odooService';
import Header from '@/app/components/UI/Header';
import LotCard from '@/app/components/UI/LotCard';
import { lotsData, Lot } from '@/app/data/lotsData';
import geometriesEnrichedRaw from '@/app/data/geometries-enriched.json';

// Type for enriched geometries with measurements
interface EnrichedGeometry {
    coordinates: [number, number][];
    measurements: {
        sides: number[];
        area: number;
        perimeter: number;
        centroid: [number, number];
    };
}

const geometriesJson = geometriesEnrichedRaw as unknown as Record<string, EnrichedGeometry>;
import { Menu, Filter, Loader2 } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { useRouter } from 'next/navigation';

// Componentes Refactorizados (Modularizados)
import FilterBar from './Dashboard/FilterBar';       // Barra de filtros lateral
import ProductDashboard from './Dashboard/ProductDashboard'; // Resumen de estadisticas (footer sidebar)
import FloatingControls from './UI/FloatingControls'; // Menú flotante para móviles
import MapArea from './Map/MapArea';                 // Área del mapa y sus controles
import { exportToSvg } from '@/app/utils/svgExporter'; // Utilidad para exportar SVG
import { exportToPdf } from '@/app/utils/pdfExporter'; // Utilidad para exportar PDF

// ----------------------------------------------------------------------
// Tipos y Interfaces
// ----------------------------------------------------------------------

// Props que recibe este componente desde el Servidor (page.tsx)
interface HomeClientProps {
    odooProducts: OdooProduct[]; // Array de productos obtenidos de Odoo
}

// ----------------------------------------------------------------------
// Componente Principal: HomeClient
// ----------------------------------------------------------------------
/**
 * Componente "Orquestador" que maneja el estado global de la vista principal.
 * Recibe datos de Odoo, los fusiona con geometría local, y coordina
 * la comunicación entre el Mapa, la Barra Lateral y los Filtros.
 */
export default function HomeClient({ odooProducts }: HomeClientProps) {

    // Hooks de Contexto y Enrutamiento
    const { user, loading } = useAuth(); // Obtiene el usuario autenticado
    const router = useRouter();          // Para redirecciones

    // DEBUG: Ver que llega desde el servidor
    useEffect(() => {
        console.log("HomeClient MOUNTED. Recibidos Odoo Products:", odooProducts.length);
    }, [odooProducts]);

    // ------------------------------------------------------------------
    // Estado Local (Variables que controlan la UI)
    // ------------------------------------------------------------------

    // ID del lote seleccionado actualmente (null si ninguno)
    const [selectedLotId, setSelectedLotId] = useState<string | null>(null);

    // Filtros activos
    const [statusFilter, setStatusFilter] = useState<string>('all'); // Estado: todos, disponible, reservado, vendido
    const [searchQuery, setSearchQuery] = useState('');              // Texto del buscador
    const [manzanaFilter, setManzanaFilter] = useState<string>('all'); // Filtro por Manzana (Q, R, S...)
    const [etapaFilter, setEtapaFilter] = useState<string>('all');     // Filtro por Etapa (1, 2, 3...)

    // Estado de UI
    const [isSidebarOpen, setSidebarOpen] = useState(true); // Controla si la barra lateral está visible
    const [mapType, setMapType] = useState<'street' | 'satellite' | 'blank'>('street'); // Tipo de mapa base

    // Ubicación del usuario (Geolocalización)
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

    // Visibilidad de medidas en el mapa
    const [showMeasurements, setShowMeasurements] = useState(true);

    // ------------------------------------------------------------------
    // Lógica de Fusión de Datos (Backend + Local)
    // ------------------------------------------------------------------

    /**
     * Helper paramanejar valores de Odoo que pueden venir como 'false' cuando están vacíos.
     */
    function getOdooVal<T>(val: T | false | undefined | null, fallback: T): T {
        if (val === false || val === undefined || val === null) return fallback;
        if (typeof val === 'string' && val.trim() === '') return fallback;
        return val;
    }

    /**
     * useMemo: Estrategia de Fusión MEJORADA
     * Combina la data geométrica estática (lotsData.ts) con la data dinámica de precios/estado (Odoo).
     * AHORA usa 'default_code' para la coincidencia (más preciso que el nombre).
     * IMPORTANTE: Solo muestra lotes que coinciden con Odoo. Los que NO coinciden se eliminan.
     * Se recalcula solo cuando 'odooProducts' cambia.
     */
    const mergedLots = useMemo(() => {
        // Helpers de procesamiento -----------------------------------------------
        const normalizeCode = (c: string) => (c || '').toString().replace(/\s+/g, '').toUpperCase().trim();

        const getOdooVal = (v: any, fallback: string): string => {
            if (v === undefined || v === null || v === false) return fallback;
            return v.toString();
        };

        const parseVal = (v: any, fallback: number, isArea: boolean = false): number => {
            if (v === undefined || v === null || v === false) return fallback;
            let s = v.toString().trim().replace(/\./g, '').replace(',', '.');
            let n = parseFloat(s);
            if (isNaN(n)) return fallback;
            if (isArea && n >= 1000) n = n / 100;
            return n;
        };

        const mapOdooStatus = (s: string | undefined): string | null => {
            if (!s) return null;
            const status = s.toLowerCase();
            if (status.includes('disponible')) return 'libre';
            if (status.includes('reservado')) return 'separado';
            if (status.includes('vendido')) return 'vendido';
            return status;
        };

        // 1. Mapa de productos Odoo
        const odooMap = new Map<string, OdooProduct>();
        odooProducts.forEach(p => {
            if (p.default_code) {
                const code = normalizeCode(p.default_code);
                odooMap.set(code, p);
            }
        });

        console.log("[SYNC_DEBUG] Odoo Map entries:", odooMap.size);
        const integratedCodes = new Set<string>();
        const integratedIds = new Set<string>();

        // 2. Procesar lotes locales (Base fija lotsData.ts)
        const matched = lotsData.map(lot => {
            const rawCode = lot.default_code;
            const normCode = normalizeCode(rawCode);
            integratedCodes.add(normCode);

            // Intentar match con y sin sufijo 'P'
            let odooMatch = odooMap.get(normCode);
            if (!odooMatch) {
                odooMatch = normCode.endsWith('P') ? odooMap.get(normCode.slice(0, -1)) : odooMap.get(normCode + 'P');
            }

            const registryGeometry = geometriesJson[normCode] || geometriesJson[rawCode];

            if (odooMatch) {
                // Registrar tanto el código buscado como el código real de Odoo e ID para evitar duplicados
                if (odooMatch.default_code) integratedCodes.add(normalizeCode(odooMatch.default_code));
                integratedIds.add(odooMatch.id.toString());

                const mappedStatus = mapOdooStatus(odooMatch.x_statu);
                return {
                    ...lot,
                    id: odooMatch.id.toString(),
                    x_statu: mappedStatus || lot.x_statu,
                    list_price: parseVal(odooMatch.list_price, lot.list_price),
                    x_area: parseVal(odooMatch.x_area, lot.x_area, true),
                    x_mz: getOdooVal(odooMatch.x_mz, lot.x_mz),
                    x_etapa: getOdooVal(odooMatch.x_etapa, lot.x_etapa),
                    points: registryGeometry?.coordinates || lot.points,
                    measurements: registryGeometry?.measurements
                };
            }

            return {
                ...lot,
                id: `local-${lot.id}`,
                points: registryGeometry?.coordinates || lot.points,
                measurements: registryGeometry?.measurements
            };
        });

        // 3. INTEGRACIÓN DINÁMICA: Productos Odoo no incluidos en lotsData
        const dynamicLots: Lot[] = [];
        odooProducts.forEach(odooMatch => {
            const code = normalizeCode(odooMatch.default_code || '');
            const odooId = odooMatch.id.toString();

            if (code && !integratedCodes.has(code) && !integratedIds.has(odooId)) {
                const registryGeometry = geometriesJson[code];
                if (registryGeometry?.coordinates && registryGeometry.coordinates.length > 0) {
                    integratedCodes.add(code);
                    integratedIds.add(odooId);
                    dynamicLots.push({
                        id: odooMatch.id.toString(),
                        name: odooMatch.name || `Lote ${code}`,
                        x_statu: mapOdooStatus(odooMatch.x_statu) || 'libre',
                        list_price: parseVal(odooMatch.list_price, 0),
                        x_area: parseVal(odooMatch.x_area, 0, true),
                        x_mz: getOdooVal(odooMatch.x_mz, ''),
                        x_etapa: getOdooVal(odooMatch.x_etapa, ''),
                        x_lote: getOdooVal(odooMatch.x_lote, ''),
                        default_code: code,
                        points: registryGeometry.coordinates,
                        measurements: registryGeometry.measurements,
                        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
                        description: 'Lote detectado dinámicamente desde Odoo.'
                    });
                }
            }
        });

        // 4. FALLBACK: Geometrías en JSON no cubiertas
        const fallbackLots: Lot[] = [];
        Object.keys(geometriesJson).forEach(code => {
            const normCode = normalizeCode(code);
            if (!integratedCodes.has(normCode)) {
                const metadataMatch = normCode.match(/E(\d+)MZ([A-Z]+)(\w+)/);
                const geometry = geometriesJson[code];
                fallbackLots.push({
                    id: `fb-${normCode}`,
                    name: `Lote ${normCode} (Geometría)`,
                    x_statu: 'libre',
                    list_price: 0,
                    x_area: geometry.measurements?.area || 0,
                    x_mz: metadataMatch ? metadataMatch[2] : '',
                    x_etapa: metadataMatch ? metadataMatch[1] : '',
                    x_lote: metadataMatch ? metadataMatch[3] : '',
                    default_code: normCode,
                    points: geometry.coordinates,
                    measurements: geometry.measurements,
                    image: '',
                    description: 'Lote detectado únicamente por geometría.'
                });
            }
        });

        const finalResult = [...matched, ...dynamicLots, ...fallbackLots];
        console.log(`[MAP_SYNC] Local: ${matched.length}, Odoo: ${dynamicLots.length}, Fallback: ${fallbackLots.length}`);
        return finalResult;
    }, [odooProducts]);

    // Estado que almacena la lista final de lotes a mostrar
    const [lots, setLots] = useState<Lot[]>(mergedLots);

    // Efecto: Sincronizar estado cuando mergedLots cambie (ej. al cargar)
    useEffect(() => {
        setLots(mergedLots);
    }, [mergedLots]);

    // Efecto: Proteger ruta (Redirigir a login si no hay usuario)
    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);


    // ------------------------------------------------------------------
    // Filtros y Estadísticas Derivadas
    // ------------------------------------------------------------------

    // Calcular contadores en tiempo real (para el dashboard)
    const stats = useMemo(() => {
        return {
            available: lots.filter(l => l.x_statu === 'libre').length,
            reserved: lots.filter(l => l.x_statu === 'separado').length,
            sold: lots.filter(l => l.x_statu === 'vendido').length,
        };
    }, [lots]);

    // Calcular la lista filtrada según los criterios seleccionados
    const filteredLots = useMemo(() => {
        return lots.filter(lot => {
            const matchesStatus = statusFilter === 'all' || lot.x_statu === statusFilter;
            const matchesSearch = lot.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesManzana = manzanaFilter === 'all' || lot.x_mz === manzanaFilter;
            const matchesEtapa = etapaFilter === 'all' || lot.x_etapa === etapaFilter;
            return matchesStatus && matchesSearch && matchesManzana && matchesEtapa;
        });
    }, [lots, statusFilter, searchQuery, manzanaFilter, etapaFilter]);

    // Lote seleccionado actualmente (objeto completo)
    const selectedLot = useMemo(() => lots.find(l => l.id === selectedLotId) || null, [lots, selectedLotId]);

    // Función para manejar cambio manual de estado (desde modal)
    const handleUpdateStatus = async (id: string, newStatus: string) => {
        // Validación: No intentar actualizar lotes que no existen en Odoo
        // 1. Fallback Lots (fb-...)
        // 2. Local Static Lots (IDs cortos '1', '2', '3') que no se han emparejado con Odoo (si se emparejan, usan el ID largo de Odoo)

        const isLocalId = id.startsWith('fb-') || id.startsWith('local-');

        if (isLocalId) {
            alert("⚠️ Este lote es LOCAL (no sincronizado con Odoo).\n\nEl estado se actualizará solo visualmente en este mapa, pero NO se guardará en la base de datos.");
            // Actualización solo local (visual)
            setLots(prev => prev.map(lot =>
                lot.id === id ? { ...lot, x_statu: newStatus } : lot
            ));
            return;
        }

        // 1. Optimistic Update (Actualizar UI inmediatamente)
        setLots(prev => prev.map(lot =>
            lot.id === id ? { ...lot, x_statu: newStatus } : lot
        ));

        // 2. Enviar cambio a Odoo
        try {
            const success = await import('@/app/services/odooService').then(m => m.odooService.updateLotStatus(id, newStatus));

            if (success) {
                // Opcional: Mostrar feedback sutil
                console.log("Estado actualizado en Odoo correctamente");
            } else {
                throw new Error("Falló la actualización en Odoo");
            }
        } catch (error: any) {
            console.error("Error al actualizar estado:", error);
            // Mostrar el mensaje de error real si viene de la API
            const msg = error.message || "Error desconocido";
            alert(`Error al guardar cambios en Odoo: ${msg}\n\nPor favor revisa la consola para más detalles.`);

            // Revertir cambio en UI (Optimistic rollback)
            setLots(prev => prev.map(lot =>
                lot.id === id ? { ...lot, x_statu: lot.x_statu } : lot // Esto requeriría guardar el estado anterior, 
                // pero como simplificación forzamos un refresh si falla
            ));
            router.refresh();
        }
    };

    /**
     * Función para redirigir a la página de cotización avanzada.
     */
    const handleQuotation = (lot: Lot) => {
        console.log("Navegando a cotización para:", lot.name, lot.id);
        router.push(`/quote/${lot.id}`);
    };

    // Función para recargar la página y traer datos frescos del servidor
    const handleSync = () => {
        router.refresh();
        alert("Sincronizando datos con Odoo...");
    };


    // Renderizado de carga si estamos verificando sesión
    if (loading || !user) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
        );
    }

    // ------------------------------------------------------------------
    // Renderizado Principal (JSX)
    // ------------------------------------------------------------------
    return (
        <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans">

            {/* Cabecera Superior */}
            <Header onSync={handleSync} />

            <div className="flex flex-1 overflow-hidden relative">

                {/* Backdrop (Fondo oscuro) para móvil cuando se abre el sidebar */}
                {isSidebarOpen && (
                    <div
                        className="absolute inset-0 bg-black/30 z-[490] md:hidden backdrop-blur-[2px] animate-in fade-in"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* 
                  BARRA LATERAL (Sidebar)
                  Contiene: FilterBar, Lista de Lotes, y Dashboard
                */}
                <div className={`
                  absolute inset-y-0 left-0 z-[500] w-80 max-w-[85vw] bg-white shadow-2xl transform transition-transform duration-300 ease-in-out border-r border-slate-200 flex flex-col
                  ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} // Animación de entrada/salida
                  md:relative md:translate-x-0 md:z-10 md:shadow-xl     // Siempre visible en desktop
                `}>

                    {/* Componente: Barra de Filtros */}
                    <FilterBar
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        statusFilter={statusFilter}
                        onStatusChange={setStatusFilter}
                        manzanaFilter={manzanaFilter}
                        onManzanaChange={setManzanaFilter}
                        etapaFilter={etapaFilter}
                        onEtapaChange={setEtapaFilter}
                        filteredCount={filteredLots.length}
                        onClearFilters={() => {
                            setStatusFilter('all');
                            setManzanaFilter('all');
                            setEtapaFilter('all');
                            setSearchQuery('');
                        }}
                        onExport={() => exportToSvg(filteredLots)}
                        onExportPdf={() => exportToPdf('map-export-area', 'Mapa-Renasur.pdf')}
                    />

                    {/* Lista Renderizada de Tarjetas de Lote */}
                    <div className="flex-1 overflow-y-auto">
                        {filteredLots.length === 0 ? (
                            <div className="p-8 text-center text-slate-400">
                                <Filter size={32} className="mx-auto mb-2 opacity-50" />
                                <p>Cargando polígonos...</p>
                            </div>
                        ) : (
                            filteredLots.map(lot => (
                                <LotCard
                                    key={`${lot.id}-${lot.default_code}`}
                                    lot={lot}
                                    onClick={() => {
                                        setSelectedLotId(lot.id);
                                        // En móvil, cerrar sidebar al seleccionar
                                        if (window.innerWidth < 768) setSidebarOpen(false);
                                    }}
                                    isSelected={selectedLotId === lot.id}
                                />
                            ))
                        )}
                    </div>

                    {/* Componente: Dashboard (Estadísticas al pie) */}
                    <ProductDashboard stats={stats} />
                </div>

                {/* Botón flotante para abrir menú en móvil (solo visible cuando sidebar está cerrado) */}
                {!isSidebarOpen && (
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="absolute top-4 left-4 z-20 bg-white p-2 rounded-lg shadow-lg text-slate-600 md:hidden"
                    >
                        <Menu size={20} />
                    </button>
                )}

                {/* 
                  ÁREA DEL MAPA
                  Contiene: Mapa Leaflet, Controles flotantes, Leyenda, Modales
                */}
                <MapArea
                    lots={filteredLots}
                    selectedLotId={selectedLotId}
                    onLotSelect={(l) => setSelectedLotId(l.id)}
                    mapType={mapType}
                    onMapTypeChange={setMapType}
                    userLocation={userLocation}
                    onUserLocationChange={(loc) => { // Callback cuando el usuario pulsa "Mi Ubicación"
                        setUserLocation(loc);
                        setSelectedLotId(null);
                    }}
                    selectedLot={selectedLot}
                    onCloseModal={() => setSelectedLotId(null)}
                    onUpdateStatus={handleUpdateStatus}
                    onQuotation={handleQuotation}
                    preferCanvas={true} // IMPORTANTE: Renderizado optimizado
                    showMeasurements={showMeasurements}
                    onToggleMeasurements={() => setShowMeasurements(!showMeasurements)}
                />

                {/* 
                  CONTROLES FLOTANTES (Móvil)
                  Barra inferior para filtros rápidos en pantallas pequeñas
                */}
                <FloatingControls
                    etapaFilter={etapaFilter}
                    onEtapaChange={setEtapaFilter}
                    manzanaFilter={manzanaFilter}
                    onManzanaChange={setManzanaFilter}
                    statusFilter={statusFilter}
                    onStatusChange={setStatusFilter}
                    onOpenSidebar={() => setSidebarOpen(true)}
                />

            </div>
        </div>
    );
}

// ----------------------------------------------------------------------
// Funciones Auxiliares
// ----------------------------------------------------------------------

/**
 * Mapea los valores de texto crudos de Odoo a nuestro tipo interno 'status'.
 * Esto asegura que la UI entienda los estados 'disponible', 'reservado', 'vendido'
 * independientemente de leves variaciones en el texto de origen.
 */
function mapOdooStatus(odooStatus: string | undefined): 'libre' | 'separado' | 'vendido' | undefined {
    if (!odooStatus) return undefined;
    const s = odooStatus.toLowerCase();
    if (s.includes('disponible') || s === 'available' || s === 'libre') return 'libre';
    if (s.includes('reservado') || s === 'reserved' || s === 'separado') return 'separado';
    if (s.includes('vendido') || s === 'sold') return 'vendido';
    return undefined;
}
