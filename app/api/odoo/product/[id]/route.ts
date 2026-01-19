import { NextRequest, NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    // Si el ID es local (formato local-XXXX), intentamos buscar por el ID numérico
    // Si es fallback (fb-XXXX), intentamos buscar por el default_code
    let filter: any[] = [];
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
    } catch (error: any) {
        console.error("API Get Product Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
