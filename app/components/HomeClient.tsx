'use client';

// ----------------------------------------------------------------------
// Importaciones
// ----------------------------------------------------------------------
import { useState, useMemo, useEffect } from 'react';
import proj4 from 'proj4';
import { OdooProduct, Proyecto } from '@/app/services/odooService';
import Header from '@/app/components/UI/Header';
import LotCard from '@/app/components/UI/LotCard';
import { lotsData, Lot } from '@/app/data/lotsData';
import geometriesEnrichedRaw from '@/app/data/geometries-enriched.json';
import { ElementoUrbano } from '@/app/data/elementosUrbanos';
import { useSmartSearch } from '@/app/hooks/useSmartSearch';
import { mergeLotsData } from '@/app/utils/dataMerger';

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
import { Menu, Filter, Loader2, WifiOff } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { useTheme } from '@/app/context/ThemeContext';
import { useRouter } from 'next/navigation';

// Componentes Refactorizados (Modularizados)
import FilterBar from './Dashboard/FilterBar';       // Barra de filtros lateral
import ProductDashboard from './Dashboard/ProductDashboard'; // Resumen de estadisticas (footer sidebar)
import FloatingControls from './UI/FloatingControls'; // Menú flotante para móviles
import MapArea from './Map/MapArea';                 // Área del mapa y sus controles
import ChatWidget from './Chat/ChatWidget';           // Asistente conversacional de búsqueda de lotes
import { exportToSvg } from '@/app/utils/svgExporter'; // Utilidad para exportar SVG
import { exportToPdf } from '@/app/utils/pdfExporter'; // Utilidad para exportar PDF

// ----------------------------------------------------------------------
// Tipos y Interfaces
// ----------------------------------------------------------------------

// Props que recibe este componente desde el Servidor (page.tsx)
interface HomeClientProps {
    odooProducts: OdooProduct[]; // Array de productos obtenidos de Odoo
    hasConnectionError?: boolean; // Flag if Odoo fetch failed
    elementosUrbanos?: ElementoUrbano[]; // Calles/áreas verdes (modelo Odoo separado, ver page.tsx)
    proyectos?: Proyecto[]; // Proyectos inmobiliarios (ubicación + zona UTM), ver page.tsx
}

// ----------------------------------------------------------------------
// Componente Principal: HomeClient
// ----------------------------------------------------------------------
/**
 * Componente "Orquestador" que maneja el estado global de la vista principal.
 * Recibe datos de Odoo, los fusiona con geometría local, y coordina
 * la comunicación entre el Mapa, la Barra Lateral y los Filtros.
 */
export default function HomeClient({ odooProducts, hasConnectionError = false, elementosUrbanos = [], proyectos = [] }: HomeClientProps) {

    // Hooks de Contexto y Enrutamiento
    const { user, loading } = useAuth(); // Obtiene el usuario autenticado
    const { theme } = useTheme();
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

    // ------------------------------------------------------------------
    // Persistencia y carga de filtros desde localStorage
    // ------------------------------------------------------------------
    const loadFilters = () => {
        if (typeof window === 'undefined') return null;
        try {
            const saved = localStorage.getItem('lotFilters');
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    };

    const savedFilters = loadFilters();

    // Filtros activos con persistencia
    const [statusFilter, setStatusFilter] = useState<string>(savedFilters?.statusFilter || 'all');
    const [searchQuery, setSearchQuery] = useState<string>(savedFilters?.searchQuery || '');
    const [manzanaFilter, setManzanaFilter] = useState<string>(savedFilters?.manzanaFilter || 'all');
    const [etapaFilter, setEtapaFilter] = useState<string>(savedFilters?.etapaFilter || 'all');
    // Código de proyecto.inmobiliario ('all' = todos los proyectos juntos,
    // el comportamiento histórico de antes de que existiera este campo).
    const [proyectoFilter, setProyectoFilter] = useState<string>(savedFilters?.proyectoFilter || 'all');
    
    // Nuevos filtros de rango
    const [priceMin, setPriceMin] = useState<number | null>(savedFilters?.priceMin || null);
    const [priceMax, setPriceMax] = useState<number | null>(savedFilters?.priceMax || null);
    const [areaMin, setAreaMin] = useState<number | null>(savedFilters?.areaMin || null);
    const [areaMax, setAreaMax] = useState<number | null>(savedFilters?.areaMax || null);

    // Estado de UI
    const [isSidebarOpen, setSidebarOpen] = useState(false); // Controla si la barra lateral está visible (oculto por defecto para móvil)
    const [mapType, setMapType] = useState<'street' | 'satellite' | 'blank' | 'dark'>('street'); // Tipo de mapa base

    // Inicialización del sidebar según el dispositivo
    useEffect(() => {
        if (typeof window !== 'undefined' && window.innerWidth >= 768) {
            setSidebarOpen(true); // Abierto por defecto solo en escritorio
        }
    }, []);

    // Enlazar el tipo de mapa con el tema claro/oscuro: el toggle principal
    // del header debe cambiar TODA la pantalla, no solo el sidebar/chrome —
    // si no, el mapa (la parte más grande de la pantalla) sigue brillante
    // en modo oscuro, que era justo el problema que se quería resolver.
    // Solo actúa sobre los valores por defecto (street/dark) para no pisar
    // una elección manual de satélite o fondo blanco.
    useEffect(() => {
        setMapType((prev) => {
            if (theme === 'dark' && prev === 'street') return 'dark';
            if (theme === 'light' && prev === 'dark') return 'street';
            return prev;
        });
    }, [theme]);

    // Ubicación del usuario (Geolocalización)
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

    // Visibilidad de medidas en el mapa
    const [showMeasurements, setShowMeasurements] = useState(true);

    // ------------------------------------------------------------------
    // Lógica de Fusión de Datos (Backend + Local)
    // ------------------------------------------------------------------

    /**
     * useMemo: Estrategia de Fusión MEJORADA
     * Extraída a la utilidad dataMerger para evitar bloqueos del main thread y mejorar la mantenibilidad.
     */
    const mergedLots = useMemo(() => {
        return mergeLotsData(odooProducts, lotsData, geometriesJson);
    }, [odooProducts]);

    // id de proyecto.inmobiliario seleccionado (resuelto desde el código del
    // filtro) — null cuando el filtro es 'all', o cuando el código elegido
    // no matchea ningún proyecto real (no debería pasar, pero por las dudas
    // no oculta todo silenciosamente).
    const proyectoSeleccionadoId = useMemo(() => {
        if (proyectoFilter === 'all') return null;
        return proyectos.find((p) => p.codigo === proyectoFilter)?.id ?? null;
    }, [proyectoFilter, proyectos]);

    // Lotes del proyecto elegido — se aplica ANTES de la búsqueda/filtros de
    // manzana-etapa-estado, así que todo lo demás (stats, dashboard, mapa,
    // lista) automáticamente respeta el proyecto seleccionado sin tener que
    // tocar esa lógica.
    const lotesDelProyecto = useMemo(() => {
        if (!proyectoSeleccionadoId) return mergedLots;
        return mergedLots.filter((l) => l.x_proyectoId === proyectoSeleccionadoId);
    }, [mergedLots, proyectoSeleccionadoId]);

    // Estado que almacena la lista final de lotes a mostrar
    const [lots, setLots] = useState<Lot[]>(lotesDelProyecto);

    // Efecto: Sincronizar estado cuando cambien los lotes fusionados o el proyecto elegido
    useEffect(() => {
        setLots(lotesDelProyecto);
    }, [lotesDelProyecto]);

    // Elementos urbanos del proyecto elegido, mismo criterio que los lotes —
    // sin esto, seleccionar un proyecto seguiría mostrando las calles/áreas
    // verdes de TODOS los proyectos mezcladas en el mapa.
    const elementosUrbanosDelProyecto = useMemo(() => {
        if (!proyectoSeleccionadoId) return elementosUrbanos;
        return elementosUrbanos.filter((e) => e.proyectoId === proyectoSeleccionadoId);
    }, [elementosUrbanos, proyectoSeleccionadoId]);

    // Al elegir un proyecto con centro UTM cargado (opcional en
    // proyecto.inmobiliario), centra el mapa ahí — mismo evento que ya usa
    // "Mi Ubicación" (ver MapArea.tsx). Con el filtro en "Todos los
    // proyectos" (proyectoSeleccionadoId null), centra en el proyecto de
    // menor 'orden' (campo Odoo 'secuencia') en vez de dejar el center
    // genérico de Lima hardcodeado en LeafletMap.tsx — ese fallback no
    // corresponde a ningún proyecto real y deja de tener sentido apenas
    // haya un segundo proyecto en otra ubicación. Sin centro UTM cargado
    // en ningún proyecto, no hace nada: el usuario sigue viendo lo que
    // ya tenía, solo se aplica el filtro.
    useEffect(() => {
        const proyecto = proyectoSeleccionadoId
            ? proyectos.find((p) => p.id === proyectoSeleccionadoId)
            : proyectos.reduce<Proyecto | null>(
                  (min, p) => (min === null || p.orden < min.orden ? p : min),
                  null
              );
        if (!proyecto?.centroEste || !proyecto?.centroNorte) return;
        try {
            const zona = Number(proyecto.zonaUTM) || 18;
            const [lng, lat] = proj4(`+proj=utm +zone=${zona} +south +datum=WGS84 +units=m +no_defs`, 'EPSG:4326', [proyecto.centroEste, proyecto.centroNorte]);
            window.dispatchEvent(new CustomEvent('centerMap', { detail: { lat, lng, zoom: 16 } }));
        } catch (error) {
            console.warn('No se pudo centrar el mapa en el proyecto seleccionado:', error);
        }
    }, [proyectoSeleccionadoId, proyectos]);

    // Efecto: Proteger ruta (Redirigir a login si no hay usuario)
    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    // Efecto: Limpiar parámetro de sincronización de la URL silenciosamente
    useEffect(() => {
        if (typeof window !== 'undefined' && window.location.search.includes('refresh=true')) {
            router.replace('/', { scroll: false });
        }
    }, [router]);

    // Efecto: Guardar filtros en localStorage cuando cambien
    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        const filters = {
            searchQuery,
            statusFilter,
            manzanaFilter,
            etapaFilter,
            proyectoFilter,
            priceMin,
            priceMax,
            areaMin,
            areaMax
        };

        try {
            localStorage.setItem('lotFilters', JSON.stringify(filters));
        } catch (error) {
            console.warn('No se pudo guardar filtros en localStorage:', error);
        }
    }, [searchQuery, statusFilter, manzanaFilter, etapaFilter, proyectoFilter, priceMin, priceMax, areaMin, areaMax]);

    // ------------------------------------------------------------------
    // Búsqueda Inteligente con Hook Personalizado
    // ------------------------------------------------------------------

    // Usar el hook de búsqueda inteligente
    const {
        results: filteredLots,
        count: filteredCount,
        hasActiveFilters,
        searchMatchCount
    } = useSmartSearch(
        lots,
        ['name', 'default_code', 'x_lote', 'x_mz', 'x_etapa', 'x_cliente'], // Campos buscables
        {
            query: searchQuery,
            priceRange: [priceMin, priceMax],
            areaRange: [areaMin, areaMax],
            statusFilter,
            manzanaFilter,
            etapaFilter,
            debounceMs: 300
        }
    );

    // ------------------------------------------------------------------
    // Estadísticas Derivadas
    // ------------------------------------------------------------------

    // Calcular contadores en tiempo real (para el dashboard)
    const stats = useMemo(() => {
        return {
            available: lots.filter(l => l.x_statu === 'libre').length,
            reserved: lots.filter(l => l.x_statu === 'separado').length,
            sold: lots.filter(l => l.x_statu === 'vendido').length,
        };
    }, [lots]);

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

        // 0. Capturar estado anterior para rollback
        const lotToUpdate = lots.find(l => l.id === id);
        const previousStatus = lotToUpdate ? lotToUpdate.x_statu : undefined;

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
        } catch (error: unknown) {
            console.error("Error al actualizar estado:", error);
            // Mostrar el mensaje de error real si viene de la API
            const msg = error instanceof Error ? error.message : "Error desconocido";
            alert(`Error al guardar cambios en Odoo: ${msg}\n\nSe revertirá el cambio localmente.`);

            // Revertir cambio en UI (Optimistic rollback real, sin recargar página)
            if (previousStatus) {
                setLots(prev => prev.map(lot =>
                    lot.id === id ? { ...lot, x_statu: previousStatus } : lot
                ));
            }
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
        alert("Sincronizando datos en tiempo real con Odoo...");
        router.push('/?refresh=true');
    };


    // Renderizado de carga si estamos verificando sesión
    if (loading || !user) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
                <Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={32} />
            </div>
        );
    }

    // Pantalla de bloqueo: Fallo de conexión con Odoo
    if (hasConnectionError) {
        return (
            <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900 font-sans">
                <Header onSync={handleSync} />
                <div className="flex-1 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 p-8 md:p-12 rounded-2xl shadow-xl max-w-lg w-full text-center border border-red-100 dark:border-red-900/50">
                        <div className="mx-auto w-20 h-20 bg-red-100 dark:bg-red-950/50 text-red-500 dark:text-red-400 rounded-full flex items-center justify-center mb-6">
                            <WifiOff size={40} />
                        </div>
                        <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-4">Error de Conexión</h2>
                        <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
                            No pudimos establecer comunicación con el servidor central de inventario (Odoo).
                            Por seguridad e integridad de los datos, el portal ha sido bloqueado temporalmente.
                        </p>
                        <button 
                            onClick={() => window.location.reload()} 
                            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-8 rounded-xl transition-colors shadow-md shadow-red-200"
                        >
                            Intentar Reconectar
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ------------------------------------------------------------------
    // Renderizado Principal (JSX)
    // ------------------------------------------------------------------
    return (
        <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden font-sans">

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
                  absolute inset-y-0 left-0 z-[500] w-80 max-w-[85vw] bg-white dark:bg-slate-900 shadow-2xl transform transition-transform duration-300 ease-in-out border-r border-slate-200 dark:border-slate-800 flex flex-col
                  ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} // Animación de entrada/salida
                  md:absolute md:z-[500] md:shadow-xl     // Ahora es colapsable también en desktop
                `}>

                    {/* Header del Sidebar con botón de cerrar */}
                    <div className="flex items-center justify-between p-3 border-b border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">Explorador</span>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            aria-label="Cerrar panel lateral"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Componente: Barra de Filtros con búsqueda mejorada */}
                    <FilterBar
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        statusFilter={statusFilter}
                        onStatusChange={setStatusFilter}
                        proyectos={proyectos}
                        proyectoFilter={proyectoFilter}
                        onProyectoChange={setProyectoFilter}
                        manzanaFilter={manzanaFilter}
                        onManzanaChange={setManzanaFilter}
                        etapaFilter={etapaFilter}
                        onEtapaChange={setEtapaFilter}
                        filteredCount={filteredCount}
                        searchMatchCount={searchMatchCount}
                        priceMin={priceMin}
                        priceMax={priceMax}
                        onPriceMinChange={setPriceMin}
                        onPriceMaxChange={setPriceMax}
                        areaMin={areaMin}
                        areaMax={areaMax}
                        onAreaMinChange={setAreaMin}
                        onAreaMaxChange={setAreaMax}
                        onClearFilters={() => {
                            setStatusFilter('all');
                            setManzanaFilter('all');
                            setEtapaFilter('all');
                            setSearchQuery('');
                            setPriceMin(null);
                            setPriceMax(null);
                            setAreaMin(null);
                            setAreaMax(null);
                        }}
                    />

                    {/* Feedback visual de búsqueda */}
                    {hasActiveFilters && (
                        <div className="px-3 py-2 bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-950/40 dark:to-violet-950/40 border-b border-blue-100 dark:border-blue-900/40 flex items-center justify-between text-xs">
                            <span className="text-blue-700 dark:text-blue-300 font-medium">
                                {searchQuery ? `🔍 "${searchQuery}"` : '🎯 Filtros activos'}
                            </span>
                            <span className="text-blue-600 dark:text-blue-400 font-bold">
                                {filteredCount} resultado{filteredCount !== 1 ? 's' : ''}
                            </span>
                        </div>
                    )}

                    {/* Lista Renderizada de Tarjetas de Lote */}
                    <div className="flex-1 overflow-y-auto">
                        {filteredLots.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 dark:text-slate-500">
                                <Filter size={32} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm font-medium">
                                    {hasActiveFilters ? 'No se encontraron lotes con estos criterios' : 'Cargando lotes...'}
                                </p>
                                {hasActiveFilters && (
                                    <button
                                        onClick={() => {
                                            setStatusFilter('all');
                                            setManzanaFilter('all');
                                            setEtapaFilter('all');
                                            setSearchQuery('');
                                            setPriceMin(null);
                                            setPriceMax(null);
                                            setAreaMin(null);
                                            setAreaMax(null);
                                        }}
                                        className="mt-3 px-4 py-2 bg-[#A145F5] text-white text-xs font-bold rounded-lg hover:bg-[#8c3ad4] transition-colors"
                                    >
                                        Limpiar filtros
                                    </button>
                                )}
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

                {/* Botón flotante para abrir menú (visible en móvil y escritorio cuando está cerrado) */}
                {!isSidebarOpen && (
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="absolute top-4 left-4 z-[400] bg-white dark:bg-slate-800 p-2.5 rounded-xl shadow-lg text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors border border-slate-200 dark:border-slate-700"
                        title="Abrir filtros"
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
                    elementosUrbanos={elementosUrbanosDelProyecto}
                    proyectos={proyectos}
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
                    currentUser={user}
                    onExport={() => exportToSvg(filteredLots)}
                    onExportPdf={() => exportToPdf('map-export-area', 'Mapa-Renasur.pdf')}
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

                {/*
                  ASISTENTE DE CHAT (IA)
                  Búsqueda conversacional de lotes — al elegir un resultado,
                  reutiliza la búsqueda/sidebar existente en vez de duplicar
                  la lógica de selección de lote.
                */}
                <ChatWidget
                    onSelectLot={(codigo) => {
                        setSearchQuery(codigo);
                        setSidebarOpen(true);
                    }}
                />

            </div>
        </div>
    );
}


