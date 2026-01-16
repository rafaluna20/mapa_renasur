import { NextRequest, NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';


export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search');
        const etapa = searchParams.get('etapa');
        const manzana = searchParams.get('manzana');
        const estado = searchParams.get('estado');

        // Base domain: Only active products
        const domain: any[] = [["active", "=", true]];

        // Add filters if they exist
        if (search) {
            domain.push("|", ["name", "ilike", search], ["default_code", "ilike", search]);
        }
        if (etapa) {
            domain.push(["x_etapa", "=", etapa]);
        }
        if (manzana) {
            domain.push(["x_mz", "=", manzana]);
        }
        if (estado) {
            domain.push(["x_statu", "=", estado]);
        }

        const fields = [
            "id", "name", "default_code", "list_price",
            "qty_available", "x_statu", "x_area",
            "x_mz", "x_etapa", "x_lote"
        ];

        console.log("API Route: Fetching Odoo with domain:", JSON.stringify(domain));

        const result = await fetchOdoo(
            "product.template",
            "search_read",
            [domain], // Domain (Args)
            { fields: fields, limit: 100 } // Kwargs
        );

        return NextResponse.json({ success: true, count: result.length, data: result });


    } catch (error: any) {
        console.error("API Route Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
