export interface Lot {
    id: string; // using name as id for now
    name: string;
    status: 'available' | 'reserved' | 'sold';
    price: number;
    area: number;
    points: number[][]; // [[x, y], [x, y]]
    image?: string;
    description?: string;
}

export const lotsData: Lot[] = [
    {
        id: "poly-01",
        name: "Polígono 01",
        status: "available",
        price: 120000,
        area: 5000,
        points: [
            [308758.5435, 8623079.82], [308763.5952, 8623080.0217], [308775.4647, 8623081.8499],
            [309039.5162, 8623154.452], [309075.2187, 8623027.7484], [309136.3503, 8622811.2917],
            [308871.432, 8622738.7153], [308850.0381, 8622819.799], [308822.3445, 8622929.7864]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        description: 'Terreno amplio con excelente ubicación.'
    },
    {
        id: "poly-02",
        name: "Polígono 02",
        status: "reserved",
        price: 95000,
        area: 4200,
        points: [
            [308291.4827, 8623340.869], [308750.1099, 8623077.248], [308640.4756, 8623051.1366],
            [308735.7424, 8622776.1674], [308752.6381, 8622703.634], [308660.749, 8622678.4603],
            [308648.4495, 8622753.4586], [308355.4442, 8622689.0557], [308308.517, 8622753.8469],
            [308477.6171, 8622887.5031], [308471.4927, 8622971.2857], [308271.0707, 8622921.1211],
            [308251.4539, 8622988.398], [308150.0365, 8623042.7388], [308198.1441, 8623150.4862],
            [308333.7336, 8623076.5369], [308397.7777, 8623106.2979], [308328.1165, 8623178.0433],
            [308331.8287, 8623284.9785]
        ],
        image: 'https://images.unsplash.com/photo-1516156008625-3a9d60da923c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        description: 'Lote ideal para desarrollo residencial.'
    },
    {
        id: "poly-03",
        name: "Polígono 03",
        status: "sold",
        price: 45000,
        area: 1200,
        points: [
            [308147.3936, 8623045.3306], [308248.8111, 8622990.9898], [308268.4278, 8622923.7129],
            [308468.8498, 8622973.8775], [308474.9742, 8622890.0949], [308305.8741, 8622756.4382]
        ],
        image: 'https://images.unsplash.com/photo-1626245084927-46e33621a24d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        description: 'Oportunidad de inversión.'
    },
    {
        id: "poly-04",
        name: "Polígono 04",
        status: "available",
        price: 60000,
        area: 2500,
        points: [
            [308198.1585, 8623150.4783], [308017.3558, 8623248.9168], [307990.8568, 8623285.3908],
            [307991.3548, 8623377.0198], [308019.022, 8623384.37], [308076.5927, 8623445.2029],
            [308076.5769, 8623466.2157], [308178.828, 8623409.9244], [308291.4827, 8623340.869],
            [308331.8287, 8623284.9785], [308328.1165, 8623178.0433], [308397.7777, 8623106.2979],
            [308333.7336, 8623076.5369]
        ],
        image: 'https://images.unsplash.com/photo-1524813686514-a57563d77965?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        description: 'Terreno con gran potencial.'
    },
    {
        id: "poly-05",
        name: "Polígono 05",
        status: "sold",
        price: 55000,
        area: 1200,
        points: [
            [308019.022, 8623384.37],
            [308076.5769, 8623466.2157], [308178.828, 8623409.9244]
        ],
        image: 'https://images.unsplash.com/photo-1502005229766-939760a7cb0d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        description: 'Lote vendido recientemente.'
    },
    {
        id: "poly-11",
        name: "Lote 11",
        status: "available",
        price: 40000,
        area: 160,
        points: [
            [308794.9341, 8622921.2613], [308790.6257, 8622935.0486], [308786.7906, 8622937.3021],
            [308780.9770, 8622936.2645], [308783.8152, 8622919.0540]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
    },
    {
        id: "poly-12",
        name: "Lote 12",
        status: "available",
        price: 40000,
        area: 160,
        points: [
            [308780.9770, 8622936.2645], [308773.8477, 8622935.3172], [308775.8936, 8622917.9372],
            [308783.8152, 8622919.0540]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
    },
    {
        id: "poly-13",
        name: "Lote 13",
        status: "available",
        price: 40000,
        area: 160,
        points: [
            [308773.8477, 8622935.3172], [308766.6888, 8622934.6439], [308767.9287, 8622917.1879],
            [308775.8936, 8622917.9372]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
    },
    {
        id: "poly-14",
        name: "Lote 14",
        status: "available",
        price: 40000,
        area: 160,
        points: [
            [308766.6888, 8622934.6439], [308759.5065, 8622934.3025], [308759.9378, 8622916.8078],
            [308767.9287, 8622917.1879]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
    },
    {
        id: "poly-15",
        name: "Lote 15",
        status: "available",
        price: 40000,
        area: 160,
        points: [
            [308759.5065, 8622934.3025], [308752.3160, 8622934.2935], [308751.9378, 8622916.7976],
            [308759.9378, 8622916.8078]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
    },
    {
        id: "poly-16",
        name: "Lote 16",
        status: "available",
        price: 40000,
        area: 160,
        points: [
            [308752.3160, 8622934.2935], [308745.1329, 8622934.6172], [308743.9459, 8622917.1575],
            [308751.9378, 8622916.7976]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
    },
    {
        id: "poly-17",
        name: "Lote 17",
        status: "available",
        price: 40000,
        area: 160,
        points: [
            [308745.1329, 8622934.6172], [308737.9724, 8622935.2726], [308735.9792, 8622917.8865],
            [308743.9459, 8622917.1575]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
    },
    {
        id: "poly-18",
        name: "Lote 18",
        status: "available",
        price: 40000,
        area: 160,
        points: [
            [308737.9724, 8622935.2726], [308730.8498, 8622936.2586], [308728.0547, 8622918.9832],
            [308735.9792, 8622917.8865]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
    },
    {
        id: "poly-19",
        name: "Lote 19",
        status: "available",
        price: 40000,
        area: 160,
        points: [
            [308730.8498, 8622936.2586], [308723.7805, 8622937.5729], [308720.1894, 8622920.4453],
            [308728.0547, 8622918.9832]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
    },
    {
        id: "poly-20",
        name: "Lote 20",
        status: "available",
        price: 40000,
        area: 160,
        points: [
            [308723.7805, 8622937.5729], [308716.7795, 8622939.2127], [308712.4002, 8622922.2695],
            [308720.1894, 8622920.4453]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
    },
    {
        id: "poly-21",
        name: "Lote 21",
        status: "available",
        price: 40000,
        area: 160,
        points: [
            [308716.7795, 8622939.2127], [308709.8619, 8622941.1745], [308704.7036, 8622924.4520],
            [308712.4002, 8622922.2695]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
    },
    {
        id: "poly-22",
        name: "Lote 22",
        status: "available",
        price: 40000,
        area: 160,
        points: [
            [308709.8619, 8622941.1745], [308703.0424, 8622943.4542], [308697.1163, 8622926.9881],
            [308704.7036, 8622924.4520]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
    },
    {
        id: "poly-23",
        name: "Lote 23",
        status: "available",
        price: 40000,
        area: 160,
        points: [
            [308703.0424, 8622943.4542], [308696.3356, 8622946.0468], [308689.6543, 8622929.8724],
            [308697.1163, 8622926.9881]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
    },
    {
        id: "poly-24",
        name: "Lote 24",
        status: "available",
        price: 40000,
        area: 160,
        points: [
            [308696.3356, 8622946.0468], [308689.7559, 8622948.9468], [308682.3337, 8622933.0987],
            [308689.6543, 8622929.8724]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
    },
    {
        id: "poly-25",
        name: "Lote 25",
        status: "available",
        price: 40000,
        area: 160,
        points: [
            [308689.7559, 8622948.9468], [308687.8629, 8622949.8496], [308677.4574, 8622946.6782],
            [308672.4689, 8622938.1126], [308682.3337, 8622933.0987]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
    },
    {
        id: "poly-26",
        name: "Lote 26",
        status: "available",
        price: 40000,
        area: 160,
        points: [
            [308682.3337, 8622933.0987], [308672.4689, 8622938.1126], [308667.8710, 8622930.2175],
            [308671.2225, 8622919.0279], [308674.9116, 8622917.2506]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
    },
    {
        id: "poly-27",
        name: "Lote 27",
        status: "available",
        price: 40000,
        area: 160,
        points: [
            [308689.6543, 8622929.8724], [308682.3337, 8622933.0987], [308674.9116, 8622917.2506],
            [308682.9731, 8622913.6980]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
    },
    {
        id: "poly-28",
        name: "Lote 28",
        status: "available",
        price: 40000,
        area: 160,
        points: [
            [308697.1163, 8622926.9881], [308689.6543, 8622929.8724], [308682.9731, 8622913.6980],
            [308691.1902, 8622910.5220]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
    },
    {
        id: "poly-29",
        name: "Lote 29",
        status: "available",
        price: 40000,
        area: 160,
        points: [
            [308704.7036, 8622924.4520], [308697.1163, 8622926.9881], [308691.1902, 8622910.5220],
            [308699.5454, 8622907.7295]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
    },
    {
        id: "poly-30",
        name: "Lote 30",
        status: "available",
        price: 40000,
        area: 160,
        points: [
            [308712.4002, 8622922.2695], [308704.7036, 8622924.4520], [308699.5454, 8622907.7295],
            [308708.0208, 8622905.3263]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
    },
    {
        id: "poly-31",
        name: "Lote 31",
        status: "available",
        price: 40000,
        area: 160,
        points: [
            [308720.1894, 8622920.4453], [308712.4002, 8622922.2695], [308708.0208, 8622905.3263],
            [308716.5983, 8622903.3177]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
    },
    {
        id: "poly-32",
        name: "Lote 32",
        status: "available",
        price: 40000,
        area: 160,
        points: [
            [308728.0547, 8622918.9832], [308720.1894, 8622920.4453], [308716.5983, 8622903.3177],
            [308725.2596, 8622901.7079]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
    },
    {
        id: "poly-33",
        name: "Lote 33",
        status: "available",
        price: 40000,
        area: 160,
        points: [
            [308735.9792, 8622917.8865], [308728.0547, 8622918.9832], [308725.2596, 8622901.7079],
            [308733.9860, 8622900.5004]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
    },
    {
        id: "poly-34",
        name: "Lote 34",
        status: "available",
        price: 40000,
        area: 160,
        points: [
            [308743.9459, 8622917.1575], [308735.9792, 8622917.8865], [308733.9860, 8622900.5004],
            [308742.7589, 8622899.6978]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
    },
    {
        id: "poly-35",
        name: "Lote 35",
        status: "available",
        price: 40000,
        area: 160,
        points: [
            [308751.9378, 8622916.7976], [308743.9459, 8622917.1575], [308742.7589, 8622899.6978],
            [308751.5595, 8622899.3017]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
    },
    {
        id: "poly-36",
        name: "Lote 36",
        status: "available",
        price: 40000,
        area: 160,
        points: [
            [308759.9378, 8622916.8078], [308751.9378, 8622916.7976], [308751.5595, 8622899.3017],
            [308760.3690, 8622899.3131]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
    },
    {
        id: "poly-37",
        name: "Lote 37",
        status: "available",
        price: 40000,
        area: 160,
        points: [
            [308767.9287, 8622917.1879], [308759.9378, 8622916.8078], [308760.3690, 8622899.3131],
            [308769.1686, 8622899.7319]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
    },
    {
        id: "poly-38",
        name: "Lote 38",
        status: "available",
        price: 40000,
        area: 160,
        points: [
            [308775.8936, 8622917.9372], [308767.9287, 8622917.1879], [308769.1686, 8622899.7319],
            [308777.9394, 8622900.5572]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
    },
    {
        id: "poly-39",
        name: "Lote 39",
        status: "available",
        price: 40000,
        area: 160,
        points: [
            [308783.8152, 8622919.0540], [308775.8936, 8622917.9372], [308777.9394, 8622900.5572],
            [308786.6627, 8622901.7872]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
    },
    {
        id: "poly-40",
        name: "Lote 40",
        status: "available",
        price: 40000,
        area: 160,
        points: [
            [308794.7454, 8622903.2982], [308786.6627, 8622901.7872], [308783.8152, 8622919.0540],
            [308794.9341, 8622921.2613], [308798.7520, 8622909.0449]
        ],
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'
    }
];
