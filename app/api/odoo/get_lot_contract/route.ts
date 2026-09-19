import { NextResponse } from 'next/server';
import { requireStaffSession } from '@/app/lib/staffAuth';
import { fetchLotContractInfo } from '@/app/lib/lotContract';

/**
 * POST /api/odoo/get_lot_contract  { productCode }
 * Moneda y precio final del contrato vigente del lote (o null si no tiene contrato).
 * Lo usa la ficha del lote para mostrar Valor total / Saldo en la moneda del contrato.
 */
export async function POST(request: Request) {
    const auth = await requireStaffSession(request);
    if (auth.response) return auth.response;

    try {
        const { productCode } = await request.json();
        if (!productCode || typeof productCode !== 'string') {
            return NextResponse.json({ success: false, error: 'Missing productCode' }, { status: 400 });
        }
        const contracts = await fetchLotContractInfo([productCode]);
        return NextResponse.json({ success: true, contract: contracts.get(productCode) ?? null });
    } catch (error: unknown) {
        console.error('❌ Get Lot Contract Error:', error);
        // 200 con contract:null: la ficha cae al catálogo en soles en vez de mostrar un error.
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal Server Error',
            contract: null,
        });
    }
}
