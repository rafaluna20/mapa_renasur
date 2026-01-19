// --- Type Definitions ---
export interface OdooUser {
    uid: number;
    name: string;
    username: string;
    session_id: string;
    partner_id: number;
    company_id: number;
    is_system: boolean;
}

export interface OdooProduct {
    id: number;
    name: string;
    default_code: string | false;
    list_price: number;
    qty_available: number;
    x_statu?: string;
    x_area?: number;
    x_mz?: string;
    x_etapa?: string;
    x_lote?: string;
    x_cliente?: string | false;
}

// --- Server-Side Fetch Utility ---
// NOTA: Esta función DEBE usarse solo en Server Components o API Routes.
// No la uses directamente en Client Components porque process.env no estará disponible.
export async function fetchOdoo(
    model: string,
    method: string,
    args: unknown[],
    kwargs: Record<string, unknown> = {}
) {
    const url = process.env.ODOO_URL;
    if (!url) {
        // Fallback for debugging if run on client by mistake, though it will fail cors likely
        console.error("Missing ODOO_URL. Ensure this is called server-side.");
    }

    const payload = {
        jsonrpc: "2.0",
        method: "call",
        params: {
            service: "object",
            method: "execute_kw",
            args: [
                process.env.ODOO_DB,
                parseInt(process.env.ODOO_USER_ID || "0"),
                process.env.ODOO_PASSWORD,
                model,
                method,
                args,
                kwargs
            ]
        },
        id: 2
    };

    try {
        const res = await fetch(url!, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            cache: "no-store",
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Odoo HTTP Error ${res.status}: ${text}`);
        }

        const data = await res.json();

        if (data.error) {
            console.error("Odoo JSON-RPC Error:", JSON.stringify(data.error, null, 2));
            throw new Error(`Odoo Error: ${data.error.message} - ${data.error.data?.message || ''}`);
        }





        return data.result;
    } catch (error) {
        console.error("Fetch Odoo Error:", error);
        throw error;
    }
}

// --- Client-Side Auth Service ---
export const odooService = {
    async login(login: string, pass: string): Promise<OdooUser> {
        // We will hit our own API route which will handle the proxying
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, password: pass }),
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Authentication Failed');
        }

        // Return the user data structure
        return result.user;
    },

    async getSalesCount(_partnerId: number): Promise<number> {
        // Placeholder for future implementation
        return 0;
    },

    async getSalesStats(userId: number): Promise<{ sold: number, reserved: number, totalValue: number }> {
        const response = await fetch(`/api/odoo/stats?userId=${userId}`);
        const result = await response.json();

        if (!result.success) {
            console.error("Failed to fetch stats:", result.error);
            return { sold: 0, reserved: 0, totalValue: 0 };
        }

        return result.stats;
    },

    async updateLotStatus(productId: string | number, status: string): Promise<boolean> {
        try {
            const response = await fetch('/api/odoo/update_status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId, newStatus: status }),
            });
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || "Error desconocido en API");
            }
            return true;
        } catch (error) {
            console.error("Error updating status:", error);
            throw error;
        }
    },

    async getDetailedSalesStats(userId: number) {
        // MOCK DATA for Dashboard Prototype
        // In the future, this will fetch real data from Odoo
        return {
            salesTrend: [
                { name: 'Ene', ventas: 4000 },
                { name: 'Feb', ventas: 3000 },
                { name: 'Mar', ventas: 2000 },
                { name: 'Abr', ventas: 2780 },
                { name: 'May', ventas: 1890 },
                { name: 'Jun', ventas: 2390 },
                { name: 'Jul', ventas: 3490 },
            ],
            kpis: {
                totalSales: 154000,
                monthlyGoal: 200000,
                commission: 4620,
                pendingLeads: 12
            },
            recentActivity: [
                { id: 1, action: "Reserva", lot: "Mz C Lote 12", date: "Hace 2 horas" },
                { id: 2, action: "Venta", lot: "Mz A Lote 04", date: "Ayer" },
                { id: 3, action: "Cotización", lot: "Mz D Lote 08", date: "Hace 2 días" }
            ]
        };
    },

    // --- Advanced Features (Mocked for Implementation) ---

    async reserveLotWithEvidence(productId: string | number, userId: number, file: File, notes: string): Promise<boolean> {
        console.log("Reserving Lot:", productId, "User:", userId, "File:", file.name, "Notes:", notes);

        // Simulating API call to lock status
        // In real implementation: Upload file -> Get URL -> Call Odoo execute_kw to write status and link attachment

        return this.updateLotStatus(productId, 'separado');
    },

    // Check if a lot is currently being acted upon by another user
    // This would use a realtime DB or Redis in production
    async checkLotLock(productId: string) {
        // MOCK: Randomly return true for locking demo purpose if needed
        // For now, always return false (unlocked) unless strictly demo-ing concurrency
        return { isLocked: false, lockedBy: null };
    }
};
