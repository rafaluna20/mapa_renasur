/**
 * Web Worker para cálculos geométricos pesados
 * Realiza transformaciones de coordenadas en un hilo separado
 * para no bloquear el UI principal
 */

import proj4 from 'proj4';

// Definir proyección UTM Zone 18S
proj4.defs("EPSG:32718", "+proj=utm +zone=18 +south +datum=WGS84 +units=m +no_defs");

interface TransformMessage {
  type: 'TRANSFORM_COORDINATES';
  data: {
    lots: Array<{
      id: string;
      default_code: string;
      points: [number, number][];
    }>;
  };
}

interface TransformResponse {
  type: 'TRANSFORM_COMPLETE';
  data: Array<[string, [number, number][]]>;
}

// Escuchar mensajes del hilo principal
self.addEventListener('message', (e: MessageEvent<TransformMessage>) => {
  const { type, data } = e.data;
  
  if (type === 'TRANSFORM_COORDINATES') {
    const startTime = performance.now();
    const { lots } = data;
    const positionsMap: Array<[string, [number, number][]]> = [];
    
    try {
      lots.forEach((lot) => {
        const positions: [number, number][] = lot.points.map((p) => {
          try {
            const [lon, lat] = proj4("EPSG:32718", "EPSG:4326", [p[0], p[1]]);
            return [lat, lon] as [number, number];
          } catch (error) {
            console.error(`Error transforming point for lot ${lot.id}:`, error);
            return [0, 0] as [number, number];
          }
        });
        
        positionsMap.push([`${lot.id}-${lot.default_code}`, positions]);
      });
      
      const endTime = performance.now();
      console.log(`[Worker] Transformed ${lots.length} lots in ${(endTime - startTime).toFixed(2)}ms`);
      
      // Enviar resultado de vuelta al hilo principal
      const response: TransformResponse = {
        type: 'TRANSFORM_COMPLETE',
        data: positionsMap
      };
      
      self.postMessage(response);
      
    } catch (error) {
      console.error('[Worker] Fatal error during transformation:', error);
      self.postMessage({
        type: 'TRANSFORM_ERROR',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// Mensaje de inicialización
console.log('[Worker] Geometry Worker initialized and ready');

export {};
