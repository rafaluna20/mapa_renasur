import { NextRequest, NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';
import { requireStaffSession } from '@/app/lib/staffAuth';
import { guardiaLote } from '@/app/lib/accesoProyectos';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // P3: antes esta ruta no pedía sesión y devolvía precio y estado de cualquier lote. La usa la pantalla de cotización
    // (personal interno), así que exige sesión de staff y que el lote sea de un proyecto al que tiene acceso.
    const auth = await requireStaffSession(request);
    if (auth.response) return auth.response;

    const { id } = await params;

    // Si el ID es local (formato local-XXXX), intentamos buscar por el ID numérico
    // Si es fallback (fb-XXXX), intentamos buscar por el default_code
    let filter: unknown[] = [];
    const idStr = id.replace('local-', '');

    if (id.startsWith('fb-')) {
        const code = id.replace('fb-', '');
        filter = [["default_code", "=", code]];
    } else {
        const numId = parseInt(idStr);
        if (!isNaN(numId)) {
            filter = [["id", "=", numId]];
        } else {
            return NextResponse.json({ success: false, error: "ID inválido" }, { status: 400 });
        }
    }

    try {
        const guardia = await guardiaLote(
            auth.session,
            id.startsWith('fb-') ? { codigo: id.replace('fb-', '') } : { templateId: parseInt(idStr) },
            '/api/odoo/product/[id]',
        );
        if (!guardia.ok) return guardia.response;

        const products = await fetchOdoo(
            "product.template",
            "search_read",
            [filter],
            {
                fields: ["id", "name", "default_code", "list_price", "qty_available", "x_statu", "x_area", "x_mz", "x_etapa", "x_lote"],
                limit: 1
            }
        );

        if (!products || products.length === 0) {
            return NextResponse.json({ success: false, error: "Lote no encontrado en Odoo" }, { status: 404 });
        }

        return NextResponse.json({ success: true, product: products[0] });
    } catch (error: unknown) {
        console.error("API Get Product Error:", error);
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
    }
}
