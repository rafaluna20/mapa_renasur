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
}




// Array RAW de lotes (sin defaultCode)
const lotsDataRaw: Lot[] = [
    {
        id: '1',
        name: 'etapa 01 mz T lote 01',
        x_statu: 'separado',
        default_code: 'E01MZT001',
        list_price: 10000,
        x_lote: '01',
        x_mz: 'T',
        x_etapa: '01',
        x_area: 450,
        points: [
            [308291.4827, 8623340.869], [308750.1099, 8623077.248], [308640.4756, 8623051.1366]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        description: 'Amplio lote con vista panorámica.'
    },
    {
        id: '2',
        name: 'etapa 01 mz T lote 02',
        x_statu: 'separado',
        default_code: 'E01MZT002',
        list_price: 20000,
        x_lote: '02',
        x_mz: 'T',
        x_etapa: '01',
        x_area: 380,
        salespersonId: 2,
        points: [
            [308333.7336, 8623076.5369], [308397.7777, 8623106.2979], [308328.1165, 8623178.0433],
            [308331.8287, 8623284.9785]
        ],
        image: 'https://images.unsplash.com/photo-1516156008625-3a9d60da923c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        description: 'Lote ideal para desarrollo residencial.'
    },
    {
        id: '3',
        name: 'etapa 01 mz T lote 03',
        x_statu: 'vendido',
        default_code: 'E01MZT003',
        list_price: 30000,
        x_lote: '03',
        x_mz: 'T',
        x_etapa: '01',
        x_area: 2500,
        salespersonId: 3,
        points: [
            [308198.1585, 8623150.4783], [308017.3558, 8623248.9168], [307990.8568, 8623285.3908]
        ],
        image: 'https://images.unsplash.com/photo-1524813686514-a57563d77965?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        description: 'Terreno con gran potencial.'
    },
    {
        id: '4',
        name: 'etapa 04 mz X lote 04',
        x_statu: 'libre',
        default_code: 'E04MZX004',
        list_price: 40000,
        x_lote: '04',
        x_mz: 'X',
        x_etapa: '04',
        x_area: 2500,
        points: [
            [308198.1585, 8623150.4783], [308017.3558, 8623248.9168], [307990.8568, 8623285.3908]
        ],
        image: 'https://images.unsplash.com/photo-1524813686514-a57563d77965?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        description: 'Terreno con gran potencial.'
    },
    {
        id: '5',
        name: 'etapa 04 mz X lote 05',
        x_statu: 'vendido',
        default_code: 'E04MZX005',
        list_price: 50000,
        x_lote: '05',
        x_mz: 'X',
        x_etapa: '04',
        x_area: 1200,
        points: [
            [308019.022, 8623384.37],
            [308076.5769, 8623466.2157], [308178.828, 8623409.9244]
        ],
        image: 'https://images.unsplash.com/photo-1502005229766-939760a7cb0d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        description: 'Lote vendido recientemente.'
    },
    {
        id: '11',
        name: 'etapa 02 mz T lote 11',
        x_statu: 'vendido',
        default_code: 'E02MZT011',
        list_price: 11000,
        x_lote: '11',
        x_mz: 'T',
        x_etapa: '02',
        x_area: 160,
        salespersonId: 3,
        points: [
            [308794.9341, 8622921.2613], [308790.6257, 8622935.0486], [308786.7906, 8622937.3021],
            [308780.9770, 8622936.2645], [308783.8152, 8622919.0540]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    },
    {
        id: '12',
        name: 'etapa 02 mz T lote 12',
        x_statu: 'vendido',
        default_code: 'E02MZT012',
        list_price: 12000,
        x_lote: '12',
        x_mz: 'T',
        x_etapa: '02',
        x_area: 160,
        salespersonId: 3,
        points: [
            [308780.9770, 8622936.2645], [308773.8477, 8622935.3172], [308775.8936, 8622917.9372],
            [308783.8152, 8622919.0540]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    },
    {
        id: '13',
        name: 'etapa 02 mz T lote 13',
        x_statu: 'vendido',
        default_code: 'E02MZT013',
        list_price: 13000,
        x_lote: '13',
        x_mz: 'T',
        x_etapa: '02',
        x_area: 160,
        salespersonId: 3,
        points: [
            [308773.8477, 8622935.3172], [308766.6888, 8622934.6439], [308767.9287, 8622917.1879],
            [308775.8936, 8622917.9372]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    },
    {
        id: '14',
        name: 'etapa 02 mz T lote 14',
        x_statu: 'vendido',
        default_code: 'E02MZT014',
        list_price: 14000,
        x_lote: '14',
        x_mz: 'T',
        x_etapa: '02',
        x_area: 160,
        salespersonId: 3,
        points: [
            [308766.6888, 8622934.6439], [308759.5065, 8622934.3025], [308759.9378, 8622916.8078],
            [308767.9287, 8622917.1879]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    },
    {
        id: '15',
        name: 'etapa 02 mz T lote 15',
        x_statu: 'separado',
        default_code: 'E02MZT015',
        list_price: 15000,
        x_lote: '15',
        x_mz: 'T',
        x_etapa: '02',
        x_area: 160,
        salespersonId: 3,
        points: [
            [308759.5065, 8622934.3025], [308752.3160, 8622934.2935], [308751.9378, 8622916.7976],
            [308759.9378, 8622916.8078]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    },
    {
        id: '16',
        name: 'etapa 02 mz T lote 16',
        x_statu: 'separado',
        default_code: 'E02MZT016',
        list_price: 16000,
        x_lote: '16',
        x_mz: 'T',
        x_etapa: '02',
        x_area: 160,
        salespersonId: 3,
        points: [
            [308752.3160, 8622934.2935], [308745.1329, 8622934.6172], [308743.9459, 8622917.1575],
            [308751.9378, 8622916.7976]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    },
    {
        id: '17',
        name: 'etapa 02 mz T lote 17',
        x_statu: 'separado',
        default_code: 'E02MZT017',
        list_price: 17000,
        x_lote: '17',
        x_mz: 'T',
        x_etapa: '02',
        x_area: 160,
        salespersonId: 3,
        points: [
            [308745.1329, 8622934.6172], [308737.9724, 8622935.2726], [308735.9792, 8622917.8865],
            [308743.9459, 8622917.1575]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    },
    {
        id: '18',
        name: 'etapa 02 mz T lote 18',
        x_statu: 'vendido',
        default_code: 'E02MZT018',
        list_price: 18000,
        x_lote: '18',
        x_mz: 'T',
        x_etapa: '02',
        x_area: 160,
        salespersonId: 3,
        points: [
            [308737.9724, 8622935.2726], [308730.8498, 8622936.2586], [308728.0547, 8622918.9832],
            [308735.9792, 8622917.8865]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    },
    {
        id: '19',
        name: 'etapa 02 mz T lote 19',
        x_statu: 'vendido',
        default_code: 'E02MZT019',
        list_price: 19000,
        x_lote: '19',
        x_mz: 'T',
        x_etapa: '02',
        x_area: 160,
        salespersonId: 3,
        points: [
            [308730.8498, 8622936.2586], [308723.7805, 8622937.5729], [308720.1894, 8622920.4453],
            [308728.0547, 8622918.9832]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    },
    {
        id: '20',
        name: 'etapa 02 mz T lote 20',
        x_statu: 'vendido',
        default_code: 'E02MZT020',
        list_price: 20000,
        x_lote: '20',
        x_mz: 'T',
        x_etapa: '02',
        x_area: 160,
        salespersonId: 3,
        points: [
            [308723.7805, 8622937.5729], [308716.7795, 8622939.2127], [308712.4002, 8622922.2695],
            [308720.1894, 8622920.4453]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    },
    {
        id: '21',
        name: 'etapa 03 mz W lote 21',
        x_statu: 'libre',
        default_code: 'E03MZW021',
        list_price: 21000,
        x_lote: '21',
        x_mz: 'W',
        x_etapa: '03',
        x_area: 160,
        points: [
            [308716.7795, 8622939.2127], [308709.8619, 8622941.1745], [308704.7036, 8622924.4520],
            [308712.4002, 8622922.2695]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    },
    {
        id: '22',
        name: 'etapa 03 mz W lote 22',
        x_statu: 'libre',
        default_code: 'E03MZW022',
        list_price: 22000,
        x_lote: '22',
        x_mz: 'W',
        x_etapa: '03',
        x_area: 160,
        points: [
            [308709.8619, 8622941.1745], [308703.0424, 8622943.4542], [308697.1163, 8622926.9881],
            [308704.7036, 8622924.4520]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    },
    {
        id: '23',
        name: 'etapa 03 mz W lote 23',
        x_statu: 'libre',
        default_code: 'E03MZW023',
        list_price: 23000,
        x_lote: '23',
        x_mz: 'W',
        x_etapa: '03',
        x_area: 160,
        points: [
            [308703.0424, 8622943.4542], [308696.3356, 8622946.0468], [308689.6543, 8622929.8724],
            [308697.1163, 8622926.9881]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    },
    {
        id: '24',
        name: 'etapa 03 mz W lote 24',
        x_statu: 'libre',
        default_code: 'E03MZW024',
        list_price: 24000,
        x_lote: '24',
        x_mz: 'W',
        x_etapa: '03',
        x_area: 160,
        points: [
            [308696.3356, 8622946.0468], [308689.7559, 8622948.9468], [308682.3337, 8622933.0987],
            [308689.6543, 8622929.8724]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    },
    {
        id: '25',
        name: 'etapa 03 mz W lote 25',
        x_statu: 'libre',
        default_code: 'E03MZW025',
        list_price: 25000,
        x_lote: '25',
        x_mz: 'W',
        x_etapa: '03',
        x_area: 160,
        points: [
            [308689.7559, 8622948.9468], [308687.8629, 8622949.8496], [308677.4574, 8622946.6782],
            [308672.4689, 8622938.1126], [308682.3337, 8622933.0987]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    },
    {
        id: '26',
        name: 'etapa 02 mz S lote 26',
        x_statu: 'libre',
        default_code: 'E02MZS026',
        list_price: 26000,
        x_lote: '26',
        x_mz: 'S',
        x_etapa: '02',
        x_area: 160,
        points: [
            [308682.3337, 8622933.0987], [308672.4689, 8622938.1126], [308667.8710, 8622930.2175],
            [308671.2225, 8622919.0279], [308674.9116, 8622917.2506]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    },
    {
        id: '27',
        name: 'etapa 02 mz S lote 27',
        x_statu: 'libre',
        default_code: 'E02MZS027',
        list_price: 27000,
        x_lote: '27',
        x_mz: 'S',
        x_etapa: '02',
        x_area: 160,
        points: [
            [308689.6543, 8622929.8724], [308682.3337, 8622933.0987], [308674.9116, 8622917.2506],
            [308682.9731, 8622913.6980]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    },
    {
        id: '28',
        name: 'etapa 02 mz S lote 28',
        x_statu: 'libre',
        default_code: 'E02MZS028',
        list_price: 28000,
        x_lote: '28',
        x_mz: 'S',
        x_etapa: '02',
        x_area: 160,
        points: [
            [308697.1163, 8622926.9881], [308689.6543, 8622929.8724], [308682.9731, 8622913.6980],
            [308691.1902, 8622910.5220]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    },
    {
        id: '29',
        name: 'etapa 02 mz S lote 29',
        x_statu: 'libre',
        default_code: 'E02MZS029',
        list_price: 29000,
        x_lote: '29',
        x_mz: 'S',
        x_etapa: '02',
        x_area: 160,
        points: [
            [308704.7036, 8622924.4520], [308697.1163, 8622926.9881], [308691.1902, 8622910.5220],
            [308699.5454, 8622907.7295]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    },
    {
        id: '30',
        name: 'etapa 01 mz R lote 30',
        x_statu: 'libre',
        default_code: 'E01MZR030',
        list_price: 30000,
        x_lote: '30',
        x_mz: 'R',
        x_etapa: '01',
        x_area: 160,
        points: [
            [308712.4002, 8622922.2695], [308704.7036, 8622924.4520], [308699.5454, 8622907.7295],
            [308708.0208, 8622905.3263]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    },
    {
        id: '31',
        name: 'etapa 01 mz R lote 31',
        x_statu: 'libre',
        default_code: 'E01MZR031',
        list_price: 31000,
        x_lote: '31',
        x_mz: 'R',
        x_etapa: '01',
        x_area: 160,
        points: [
            [308720.1894, 8622920.4453], [308712.4002, 8622922.2695], [308708.0208, 8622905.3263],
            [308716.5983, 8622903.3177]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    },
    {
        id: '32',
        name: 'etapa 01 mz R lote 32',
        x_statu: 'libre',
        default_code: 'E01MZR032',
        list_price: 32000,
        x_lote: '32',
        x_mz: 'R',
        x_etapa: '01',
        x_area: 160,
        points: [
            [308728.0547, 8622918.9832], [308720.1894, 8622920.4453], [308716.5983, 8622903.3177],
            [308725.2596, 8622901.7079]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    },
    {
        id: '33',
        name: 'etapa 01 mz R lote 33',
        x_statu: 'libre',
        default_code: 'E01MZR033',
        list_price: 33000,
        x_lote: '33',
        x_mz: 'R',
        x_etapa: '01',
        x_area: 160,
        points: [
            [308735.9792, 8622917.8865], [308728.0547, 8622918.9832], [308725.2596, 8622901.7079],
            [308733.9860, 8622900.5004]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    },
    {
        id: '34',
        name: 'etapa 01 mz R lote 34',
        x_statu: 'libre',
        default_code: 'E01MZR034',
        list_price: 34000,
        x_lote: '34',
        x_mz: 'R',
        x_etapa: '01',
        x_area: 160,
        points: [
            [308743.9459, 8622917.1575], [308735.9792, 8622917.8865], [308733.9860, 8622900.5004],
            [308742.7589, 8622899.6978]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    },
    {
        id: '35',
        name: 'etapa 01 mz Q lote 35',
        x_statu: 'libre',
        default_code: 'E01MZQ035',
        list_price: 35000,
        x_lote: '35',
        x_mz: 'Q',
        x_etapa: '01',
        x_area: 160,
        points: [
            [308751.9378, 8622916.7976], [308743.9459, 8622917.1575], [308742.7589, 8622899.6978],
            [308751.5595, 8622899.3017]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    },
    {
        id: '36',
        name: 'etapa 01 mz Q lote 36',
        x_statu: 'libre',
        default_code: 'E01MZQ036',
        list_price: 36000,
        x_lote: '36',
        x_mz: 'Q',
        x_etapa: '01',
        x_area: 160,
        points: [
            [308759.9378, 8622916.8078], [308751.9378, 8622916.7976], [308751.5595, 8622899.3017],
            [308760.3690, 8622899.3131]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    },
    {
        id: '37',
        name: 'etapa 01 mz Q lote 37',
        x_statu: 'libre',
        default_code: 'E01MZQ037',
        list_price: 37000,
        x_lote: '37',
        x_mz: 'Q',
        x_etapa: '01',
        x_area: 160,
        points: [
            [308767.9287, 8622917.1879], [308759.9378, 8622916.8078], [308760.3690, 8622899.3131],
            [308769.1686, 8622899.7319]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    },
    {
        id: '38',
        name: 'etapa 01 mz Q lote 38',
        x_statu: 'libre',
        default_code: 'E01MZQ038',
        list_price: 38000,
        x_lote: '38',
        x_mz: 'Q',
        x_etapa: '01',
        x_area: 160,
        points: [
            [308775.8936, 8622917.9372], [308767.9287, 8622917.1879], [308769.1686, 8622899.7319],
            [308777.9394, 8622900.5572]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    },
    {
        id: '39',
        name: 'etapa 01 mz Q lote 39',
        x_statu: 'libre',
        default_code: 'E01MZQ039',
        list_price: 39000,
        x_lote: '39',
        x_mz: 'Q',
        x_etapa: '01',
        x_area: 160,
        points: [
            [308783.8152, 8622919.0540], [308775.8936, 8622917.9372], [308777.9394, 8622900.5572],
            [308786.6627, 8622901.7872]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    },
    {
        id: '40',
        name: 'etapa 01 mz Q lote 40',
        x_statu: 'libre',
        default_code: 'E01MZQ040',
        list_price: 40000,
        x_lote: '40',
        x_mz: 'Q',
        x_etapa: '01',
        x_area: 160,
        points: [
            [308794.7454, 8622903.2982], [308786.6627, 8622901.7872], [308783.8152, 8622919.0540],
            [308794.9341, 8622921.2613], [308798.7520, 8622909.0449]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    },
];

/**
 * EXPORTACIÓN: Los lotes ya incluyen x_statu, list_price, x_mz, x_etapa, x_lote y default_code.
 */
export const lotsData: Lot[] = lotsDataRaw;
