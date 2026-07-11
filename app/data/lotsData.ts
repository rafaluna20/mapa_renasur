import { ArcoMetadata } from '@/app/utils/arcoUtils';

export interface LotMeasurements {
    sides: number[];              // Length of each side in meters
    area: number;                 // Area in square meters
    perimeter: number;            // Total perimeter in meters
    centroid: [number, number];   // Centroid coordinates [x, y]
}

export interface Lot {
    id: string; // using name as id for now
    name: string;
    x_statu: string;
    list_price: number;
    x_area: number; // m2
    points: [number, number][]; // UTM coordinates
    image?: string;
    description?: string;
    salespersonId?: number; // ID of the salesperson assigned to this lot
    x_mz: string; // Block identifier (Q, R, S, T, W, X)
    x_etapa: string; // Phase identifier (01, 02, 03, 04)
    x_lote: string; // Número de lote
    default_code: string; // Código de Odoo para matching (ej: E01MZX001)
    measurements?: LotMeasurements; // Pre-calculated geometry measurements
    x_cliente?: string; // Nombre del cliente asignado (Odoo x_cliente)
    x_proyecto?: string; // Proyecto/urbanización al que pertenece (Odoo x_proyecto) — ver UBICACION_POR_PROYECTO en app/api/planos/generar/route.ts
    x_ubicacion?: string; // Calle/referencia del frente del lote (Odoo x_ubicacion), ej. "CALLE 13"
    x_geometry_arcos?: ArcoMetadata[]; // Metadata de lados curvos (Odoo x_geometry_arcos), ver product_lot_geometry
}




// Array RAW de lotes (sin defaultCode)
const lotsDataRaw: Lot[] = [
    
    {
        id: '33',
        name: 'etapa 01 mz Z lote 33',
        x_statu: 'vendido',
        default_code: 'E01MZZ033',
        list_price: 33000,
        x_lote: '33',
        x_mz: 'Z',
        x_etapa: '01',
        x_area: 160,
        points: [
            [308735.9792, 8622917.8865], [308728.0547, 8622918.9832], 
            [308733.9860, 8622900.5004]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    },

  

    {
        id: '39',
        name: 'etapa 01 mz Z lote 39',
        x_statu: 'separado',
        default_code: 'E01MZZ039',
        list_price: 39000,
        x_lote: '39',
        x_mz: 'Z',
        x_etapa: '01',
        x_area: 152.25,
        points: [
            [308783.8152, 8622919.140], [308778.9394, 8622900.5572],
            [308786.6627, 8622901.50]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    }



];

/**
 * EXPORTACIÓN: Los lotes ya incluyen x_statu, list_price, x_mz, x_etapa, x_lote y default_code.
 */
export const lotsData: Lot[] = lotsDataRaw;
