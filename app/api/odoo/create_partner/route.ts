import { NextResponse } from 'next/server';
import { fetchOdoo, inferIdentificationTypeId } from '@/app/services/odooService';
import { requireStaffSession } from '@/app/lib/staffAuth';

export async function POST(request: Request) {
    const auth = await requireStaffSession(request);
    if (auth.response) return auth.response;

    try {
        const body = await request.json();
        const { name, email, phone, vat, address } = body;

        if (!name) {
            return NextResponse.json(
                { success: false, error: 'El nombre es obligatorio' },
                { status: 400 }
            );
        }

        const partnerData: Record<string, unknown> = {
            name,
            email: email || false,
            phone: phone || false,
            mobile: phone || false, // Use phone for mobile too by default
            vat: vat || false,
            street: address || false,
            company_type: 'person', // Default to individual
            customer_rank: 1 // Important for Sales filters
        };
        // Sin esto, un DNI de 8 dígitos queda con el tipo de identificación
        // en blanco y Odoo lo rechaza más tarde exigiendo formato de RUC.
        if (vat) {
            const idType = inferIdentificationTypeId(vat);
            if (idType) partnerData.l10n_latam_identification_type_id = idType;
        }

        const newPartnerId = await fetchOdoo(
            'res.partner',
            'create',
            [partnerData]
        );

        return NextResponse.json({ success: true, id: newPartnerId, name });

    } catch (error: unknown) {
        console.error("Create Partner API Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Error creando cliente' },
            { status: 500 }
        );
    }
}
