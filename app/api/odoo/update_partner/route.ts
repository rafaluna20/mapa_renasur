import { NextResponse } from 'next/server';
import { fetchOdoo, inferIdentificationTypeId } from '@/app/services/odooService';
import { requireStaffSession } from '@/app/lib/staffAuth';

/**
 * Actualiza los datos de contacto de un cliente ya existente (res.partner) —
 * antes de esto, la única forma de arreglar un DNI/teléfono/correo mal
 * cargado en Odoo era hacerlo directo en el CRM: en la cotización solo se
 * podía buscar+seleccionar un cliente (de solo lectura) o crear uno nuevo,
 * sin ningún camino para corregir uno existente. Mismo patrón que
 * create_partner/route.ts, pero con 'write' en vez de 'create'.
 */
export async function POST(request: Request) {
    const auth = await requireStaffSession(request);
    if (auth.response) return auth.response;

    try {
        const body = await request.json();
        const { id, name, email, phone, vat, address } = body;

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'Falta el id del cliente a actualizar' },
                { status: 400 }
            );
        }
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
            mobile: phone || false, // Mismo criterio que create_partner: un solo campo de teléfono en la UI
            vat: vat || false,
            street: address || false,
        };
        // Mismo fix que create_partner: sin esto, contactos creados antes de
        // ese fix (o con el tipo en blanco) siguen fallando al validar un
        // DNI de 8 dígitos contra el formato de RUC.
        if (vat) {
            const idType = inferIdentificationTypeId(vat);
            if (idType) partnerData.l10n_latam_identification_type_id = idType;
        }

        await fetchOdoo('res.partner', 'write', [[id], partnerData]);

        return NextResponse.json({ success: true, id, name });

    } catch (error: unknown) {
        console.error("Update Partner API Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Error actualizando cliente' },
            { status: 500 }
        );
    }
}
