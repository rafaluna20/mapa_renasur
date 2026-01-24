import { useState, useEffect } from 'react';
import L from 'leaflet';
import proj4 from 'proj4';
import { Lot } from '@/app/data/lotsData';

proj4.defs("EPSG:32718", "+proj=utm +zone=18 +south +datum=WGS84 +units=m +no_defs");

export const useMapBounds = (map: L.Map | null) => {
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);

  useEffect(() => {
    if (!map) return;

    const updateBounds = () => {
      const newBounds = map.getBounds();
      setBounds(newBounds);
    };

    // Actualizar inmediatamente
    updateBounds();

    // Escuchar eventos del mapa
    map.on('moveend', updateBounds);
    map.on('zoomend', updateBounds);

    return () => {
      map.off('moveend', updateBounds);
      map.off('zoomend', updateBounds);
    };
  }, [map]);

  return bounds;
};

/**
 * Verifica si un lote está dentro de los bounds del mapa
 */
export const isLotInBounds = (lot: Lot, bounds: L.LatLngBounds | null): boolean => {
  if (!bounds || !lot.points || lot.points.length === 0) {
    return true; // Si no hay bounds o puntos, considerar como visible
  }

  try {
    // Verificar si al menos un punto del lote está dentro de los bounds
    return lot.points.some(point => {
      const [lon, lat] = proj4("EPSG:32718", "EPSG:4326", [point[0], point[1]]);
      return bounds.contains([lat, lon]);
    });
  } catch (error) {
    console.error('Error checking lot bounds:', error);
    return true; // En caso de error, mostrar el lote
  }
};

/**
 * Filtra lotes que están dentro de los bounds del mapa
 */
export const filterLotsByBounds = (lots: Lot[], bounds: L.LatLngBounds | null): Lot[] => {
  if (!bounds) return lots;
  
  return lots.filter(lot => isLotInBounds(lot, bounds));
};

/**
 * Hook combinado para filtrado geoespacial
 */
export const useGeospatialFilter = (
  map: L.Map | null,
  lots: Lot[],
  enabled: boolean
) => {
  const bounds = useMapBounds(map);
  
  if (!enabled || !bounds) {
    return lots;
  }
  
  return filterLotsByBounds(lots, bounds);
};
