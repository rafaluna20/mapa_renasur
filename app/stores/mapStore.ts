import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface MapFilters {
  status: string;
  manzana: string;
  etapa: string;
  search: string;
  priceRange: [number | null, number | null];
  areaRange: [number | null, number | null];
}

interface MapState {
  // Selección
  selectedLotId: string | null;
  setSelectedLotId: (id: string | null) => void;
  
  // Filtros
  filters: MapFilters;
  setFilters: (filters: Partial<MapFilters>) => void;
  clearFilters: () => void;
  
  // Mapa
  mapType: 'street' | 'satellite' | 'blank';
  setMapType: (type: 'street' | 'satellite' | 'blank') => void;
  
  // UI
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  
  // Mediciones
  showMeasurements: boolean;
  toggleMeasurements: () => void;
  
  // Ubicación del usuario
  userLocation: [number, number] | null;
  setUserLocation: (location: [number, number] | null) => void;
  
  // Features avanzadas
  compareMode: boolean;
  toggleCompareMode: () => void;
  compareIds: string[];
  addToCompare: (id: string) => void;
  removeFromCompare: (id: string) => void;
  clearCompare: () => void;
  
  // Heatmap
  showHeatmap: boolean;
  toggleHeatmap: () => void;
  
  // Herramienta de medición
  measureMode: boolean;
  toggleMeasureMode: () => void;
  
  // Filtro por viewport
  filterByViewport: boolean;
  toggleFilterByViewport: () => void;
}

const defaultFilters: MapFilters = {
  status: 'all',
  manzana: 'all',
  etapa: 'all',
  search: '',
  priceRange: [null, null],
  areaRange: [null, null]
};

export const useMapStore = create<MapState>()(
  persist(
    (set) => ({
      // Estado de selección
      selectedLotId: null,
      setSelectedLotId: (id) => set({ selectedLotId: id }),
      
      // Filtros
      filters: defaultFilters,
      setFilters: (newFilters) => 
        set((state) => ({ 
          filters: { ...state.filters, ...newFilters } 
        })),
      clearFilters: () => 
        set({ filters: defaultFilters }),
      
      // Tipo de mapa
      mapType: 'street',
      setMapType: (type) => set({ mapType: type }),
      
      // Sidebar
      isSidebarOpen: true,
      toggleSidebar: () => set((state) => ({ 
        isSidebarOpen: !state.isSidebarOpen 
      })),
      setSidebarOpen: (open) => set({ isSidebarOpen: open }),
      
      // Mediciones
      showMeasurements: true,
      toggleMeasurements: () => set((state) => ({ 
        showMeasurements: !state.showMeasurements 
      })),
      
      // Ubicación
      userLocation: null,
      setUserLocation: (location) => set({ userLocation: location }),
      
      // Modo comparación
      compareMode: false,
      toggleCompareMode: () => set((state) => ({ 
        compareMode: !state.compareMode,
        compareIds: !state.compareMode ? [] : state.compareIds // Limpiar al salir
      })),
      compareIds: [],
      addToCompare: (id) => set((state) => ({
        compareIds: state.compareIds.includes(id) 
          ? state.compareIds 
          : [...state.compareIds, id].slice(-3) // Máximo 3
      })),
      removeFromCompare: (id) => set((state) => ({
        compareIds: state.compareIds.filter(cid => cid !== id)
      })),
      clearCompare: () => set({ compareIds: [] }),
      
      // Heatmap
      showHeatmap: false,
      toggleHeatmap: () => set((state) => ({ 
        showHeatmap: !state.showHeatmap 
      })),
      
      // Herramienta de medición
      measureMode: false,
      toggleMeasureMode: () => set((state) => ({ 
        measureMode: !state.measureMode 
      })),
      
      // Filtro viewport
      filterByViewport: false,
      toggleFilterByViewport: () => set((state) => ({ 
        filterByViewport: !state.filterByViewport 
      }))
    }),
    {
      name: 'map-store', // localStorage key
      partialize: (state) => ({ 
        filters: state.filters,
        mapType: state.mapType,
        showMeasurements: state.showMeasurements
      })
    }
  )
);

// Hooks personalizados para acceso específico
export const useMapFilters = () => {
  const filters = useMapStore((state) => state.filters);
  const setFilters = useMapStore((state) => state.setFilters);
  const clearFilters = useMapStore((state) => state.clearFilters);
  return { filters, setFilters, clearFilters };
};

export const useMapSelection = () => {
  const selectedLotId = useMapStore((state) => state.selectedLotId);
  const setSelectedLotId = useMapStore((state) => state.setSelectedLotId);
  return { selectedLotId, setSelectedLotId };
};

export const useMapUI = () => {
  const isSidebarOpen = useMapStore((state) => state.isSidebarOpen);
  const toggleSidebar = useMapStore((state) => state.toggleSidebar);
  const setSidebarOpen = useMapStore((state) => state.setSidebarOpen);
  return { isSidebarOpen, toggleSidebar, setSidebarOpen };
};

export const useCompareMode = () => {
  const compareMode = useMapStore((state) => state.compareMode);
  const toggleCompareMode = useMapStore((state) => state.toggleCompareMode);
  const compareIds = useMapStore((state) => state.compareIds);
  const addToCompare = useMapStore((state) => state.addToCompare);
  const removeFromCompare = useMapStore((state) => state.removeFromCompare);
  const clearCompare = useMapStore((state) => state.clearCompare);
  
  return { 
    compareMode, 
    toggleCompareMode, 
    compareIds, 
    addToCompare, 
    removeFromCompare,
    clearCompare 
  };
};
