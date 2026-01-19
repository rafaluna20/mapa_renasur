import { NextRequest, NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { productId, newStatus, clientName } = body;

        if (!productId || !newStatus) {
            return NextResponse.json({ success: false, error: "Missing productId or newStatus" }, { status: 400 });
        }

        const odooId = parseInt(productId);
        if (isNaN(odooId)) {
            return NextResponse.json({ success: false, error: "Invalid Product ID (Not synchronized with Odoo)" }, { status: 400 });
        }

        // Map local status to Odoo value
        let odooValue = '';
        switch (newStatus) {
            case 'libre':
                odooValue = 'disponible';
                break;
            case 'separado':
            case 'reservado': // Allow direct 'reservado' input
                odooValue = 'reservado';
                break;
            case 'vendido':
                odooValue = 'vendido';
                break;
            case 'cotizacion':
                odooValue = 'cotizacion';
                break;
            default:
                return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
        }

        // Prepare write values
        const vals: any = { "x_statu": odooValue };

        // If clientName is provided (e.g. for Quote Confirmation or Reservation), update x_cliente
        // We allow empty string to clear it if needed, or check undefined
        if (clientName !== undefined) {
            vals["x_cliente"] = clientName;
        }

        // Execute 'write' method on product.template
        // write(ids, values)
        // Execute 'write' method on product.template
        // write(ids, values)
        const result = await fetchOdoo(
            "product.template",
            "write",
            [[odooId], vals]
        );

        if (result) {
            return NextResponse.json({ success: true, message: "Status updated successfully" });
        } else {
            return NextResponse.json({ success: false, error: "Odoo write operation returned false" }, { status: 500 });
        }

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
        console.error("API Update Status Error:", error);
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
}
