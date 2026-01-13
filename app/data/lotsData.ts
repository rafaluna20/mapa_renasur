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
    }
];
