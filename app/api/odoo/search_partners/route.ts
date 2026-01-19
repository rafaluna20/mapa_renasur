import { NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';

export async function POST(request: Request) {
    try {
        const { query } = await request.json();

        if (!query || query.length < 1) {
            return NextResponse.json({ success: true, results: [] });
        }

        // Domain: Search by Name OR Email OR VAT (DNI/RUC)
        const domain = [
            '|', '|',
            ['name', 'ilike', query],
            ['email', 'ilike', query],
            ['vat', 'ilike', query]
        ];

        // Ensure we only get active records
        const finalDomain = [['active', '=', true], ...domain];

        const results = await fetchOdoo(
            'res.partner',
            'search_read',
            [finalDomain],
            {
                fields: ['id', 'name', 'email', 'phone', 'mobile', 'vat', 'street'],
                limit: 10
            }
        );

        return NextResponse.json({ success: true, results });

    } catch (error: any) {
        console.error("Partner Search API Error:", error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
