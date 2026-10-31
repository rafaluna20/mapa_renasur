import { NextResponse } from 'next/server';
import { fetchOdoo, inferIdentificationTypeId } from '@/app/services/odooService';
import { requireStaffSession } from '@/app/lib/staffAuth';
import { esDocumentoValido, soloDigitos } from '@/app/lib/documentoCliente';
import { buscarClientesPorDocumento } from '@/app/lib/clienteExistente';

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

        // Corregir un documento no puede dejar a dos clientes con el mismo DNI/RUC.
        const documento = soloDigitos(vat);
        if (vat) {
            if (!esDocumentoValido(documento)) {
                return NextResponse.json(
                    { success: false, error: 'El DNI debe tener 8 dígitos o el RUC 11 dígitos numéricos.' },
                    { status: 400 }
                );
            }
            const { exactos } = await buscarClientesPorDocumento(documento, { excluirId: Number(id) });
            if (exactos.length > 0) {
                return NextResponse.json(
                    {
                        success: false,
                        code: 'documento_duplicado',
                        error: `Ya existe otro cliente con el documento ${documento}: ${exactos[0].name}. Selecciónalo en lugar de repetirlo.`,
                        existing: exactos[0],
                    },
                    { status: 409 }
                );
            }
        }

        const partnerData: Record<string, unknown> = {
            name,
            email: email || false,
            phone: phone || false,
            mobile: phone || false, // Mismo criterio que create_partner: un solo campo de teléfono en la UI
            vat: vat ? documento : false,
            street: address || false,
        };
        // Mismo fix que create_partner: sin esto, contactos creados antes de
        // ese fix (o con el tipo en blanco) siguen fallando al validar un
        // DNI de 8 dígitos contra el formato de RUC.
        if (vat) {
            const idType = inferIdentificationTypeId(documento);
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
