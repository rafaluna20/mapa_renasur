import { NextResponse } from 'next/server';
import { fetchOdoo, inferIdentificationTypeId } from '@/app/services/odooService';
import { requireStaffSession } from '@/app/lib/staffAuth';
import { esDocumentoValido, soloDigitos } from '@/app/lib/documentoCliente';
import {
    buscarClientesPorDocumento,
    enSerieParaDocumento,
    MENSAJE_ODOO_DOCUMENTO_REPETIDO,
} from '@/app/lib/clienteExistente';

/**
 * Crea un cliente (res.partner) SOLO si ese documento aún no está registrado.
 *
 * - Mismo DNI/RUC ya registrado → no se crea: se devuelve la ficha existente (`existed: true`) y el cotizador la
 *   selecciona. Así un doble clic, un reintento o dos vendedores a la vez no generan duplicados.
 * - Otra ficha de la misma persona con el otro documento (DNI ↔ RUC 10) → se avisa (`code: 'documento_equivalente'`)
 *   y solo se crea si el vendedor lo confirma (`confirmarEquivalente: true`): puede ser legítimo (p. ej. factura con RUC).
 */
export async function POST(request: Request) {
    const auth = await requireStaffSession(request);
    if (auth.response) return auth.response;

    try {
        const body = await request.json();
        const { name, email, phone, vat, address, confirmarEquivalente } = body;

        if (!name) {
            return NextResponse.json(
                { success: false, error: 'El nombre es obligatorio' },
                { status: 400 }
            );
        }

        const documento = soloDigitos(vat);
        if (!esDocumentoValido(documento)) {
            return NextResponse.json(
                { success: false, error: 'El DNI debe tener 8 dígitos o el RUC 11 dígitos numéricos.' },
                { status: 400 }
            );
        }

        const resultado = await enSerieParaDocumento(documento, async () => {
            const coincidencias = await buscarClientesPorDocumento(documento);

            if (coincidencias.exactos.length > 0) {
                const existente = coincidencias.exactos[0];
                return { tipo: 'existente' as const, existente };
            }
            if (coincidencias.equivalentes.length > 0 && !confirmarEquivalente) {
                return { tipo: 'equivalente' as const, existente: coincidencias.equivalentes[0] };
            }

            const partnerData: Record<string, unknown> = {
                name,
                email: email || false,
                phone: phone || false,
                mobile: phone || false, // Use phone for mobile too by default
                vat: documento,
                street: address || false,
                company_type: 'person', // Default to individual
                customer_rank: 1 // Important for Sales filters
            };
            // Sin esto, un DNI de 8 dígitos queda con el tipo de identificación
            // en blanco y Odoo lo rechaza más tarde exigiendo formato de RUC.
            const idType = inferIdentificationTypeId(documento);
            if (idType) partnerData.l10n_latam_identification_type_id = idType;

            try {
                const newPartnerId = await fetchOdoo('res.partner', 'create', [partnerData]);
                return { tipo: 'creado' as const, id: newPartnerId as number };
            } catch (error) {
                // Otra petición (u otro proceso) lo creó entre la búsqueda y el alta: Odoo lo rechaza por repetido.
                // No es un error para el vendedor: se usa la ficha que ya quedó registrada.
                const mensaje = error instanceof Error ? error.message : '';
                if (mensaje.includes(MENSAJE_ODOO_DOCUMENTO_REPETIDO)) {
                    const otra = await buscarClientesPorDocumento(documento);
                    if (otra.exactos.length > 0) return { tipo: 'existente' as const, existente: otra.exactos[0] };
                }
                throw error;
            }
        });

        if (resultado.tipo === 'existente') {
            return NextResponse.json({
                success: true,
                id: resultado.existente.id,
                name: resultado.existente.name,
                existed: true,
                partner: resultado.existente,
            });
        }
        if (resultado.tipo === 'equivalente') {
            return NextResponse.json({
                success: false,
                code: 'documento_equivalente',
                error: `Esta persona ya tiene otra ficha con su ${documento.length === 8 ? 'RUC' : 'DNI'}: ${resultado.existente.name}.`,
                existing: resultado.existente,
            });
        }

        return NextResponse.json({ success: true, id: resultado.id, name, existed: false });

    } catch (error: unknown) {
        console.error("Create Partner API Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Error creando cliente' },
            { status: 500 }
        );
    }
}
