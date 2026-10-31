import { NextResponse } from 'next/server';
import { requireStaffSession } from '@/app/lib/staffAuth';
import { esDocumentoValido, soloDigitos } from '@/app/lib/documentoCliente';
import { buscarClientesPorDocumento } from '@/app/lib/clienteExistente';

/**
 * ¿Ya hay un cliente con este documento? Lo consulta el formulario de «Nuevo Cliente» mientras el vendedor escribe,
 * para mostrar «ya existe» antes de intentar guardar. Solo lectura.
 */
export async function POST(request: Request) {
    const auth = await requireStaffSession(request);
    if (auth.response) return auth.response;

    try {
        const { vat, excludeId } = await request.json();
        const documento = soloDigitos(vat);
        if (!esDocumentoValido(documento)) {
            return NextResponse.json({ success: true, exact: null, equivalent: null });
        }

        const { exactos, equivalentes } = await buscarClientesPorDocumento(documento, {
            excluirId: excludeId ? Number(excludeId) : undefined,
        });
        return NextResponse.json({ success: true, exact: exactos[0] ?? null, equivalent: equivalentes[0] ?? null });
    } catch (error: unknown) {
        console.error('Check Partner Document API Error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Error verificando el documento' },
            { status: 500 }
        );
    }
}
