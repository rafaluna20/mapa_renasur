import { NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, email, phone, vat, address } = body;

        if (!name) {
            return NextResponse.json(
                { success: false, error: 'El nombre es obligatorio' },
                { status: 400 }
            );
        }

        const partnerData = {
            name,
            email: email || false,
            phone: phone || false,
            mobile: phone || false, // Use phone for mobile too by default
            vat: vat || false,
            street: address || false,
            company_type: 'person', // Default to individual
            customer_rank: 1 // Important for Sales filters
        };

        const newPartnerId = await fetchOdoo(
            'res.partner',
            'create',
            [partnerData]
        );

        return NextResponse.json({ success: true, id: newPartnerId, name });

    } catch (error: any) {
        console.error("Create Partner API Error:", error);
        return NextResponse.json(
            { success: false, error: error.message || 'Error creando cliente' },
            { status: 500 }
        );
    }
}
