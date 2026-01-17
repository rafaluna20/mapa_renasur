import { NextRequest, NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ success: false, error: "Missing userId parameter" }, { status: 400 });
        }

        const uid = parseInt(userId);
        if (isNaN(uid)) {
            return NextResponse.json({ success: false, error: "Invalid userId parameter" }, { status: 400 });
        }

        console.log(`[API Stats] Fetching stats for user ${uid}`);

        // 1. Sold Count
        const soldCount = await fetchOdoo(
            "sale.order",
            "search_count",
            [[
                ["user_id", "=", uid],
                ["state", "in", ["sale", "done"]]
            ]]
        );

        // 2. Reserved Count (TODO: Add filter logic when requested)
        const reservedCount = 0; // Placeholder as per user request (implement next time)

        // 3. Total Sales Amount
        // read_group(domain, fields, groupby)
        const totalSalesData = await fetchOdoo(
            "sale.order",
            "read_group",
            [
                [
                    ["user_id", "=", uid],
                    ["state", "in", ["sale", "done"]]
                ]
            ],
            {
                fields: ["amount_total"],
                groupby: ["user_id"]
            }
        );

        let totalValue = 0;
        if (totalSalesData && totalSalesData.length > 0) {
            totalValue = totalSalesData[0].amount_total || 0;
        }

        return NextResponse.json({
            success: true,
            stats: {
                sold: soldCount,
                reserved: reservedCount,
                totalValue: totalValue
            }
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
        console.error("API Stats Error:", error);
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
}
