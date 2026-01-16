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
    }
};
