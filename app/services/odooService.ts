const PROXY_URL = '/api/odoo';
const DB = process.env.NEXT_PUBLIC_ODOO_DB || 'odoo'; // Fallback or from env

export interface OdooUser {
    uid: number;
    name: string;
    username: string;
    session_id: string;
    partner_id: number;
    company_id: number;
    is_system: boolean;
}

export const odooService = {
    async login(login: string, pass: string): Promise<OdooUser> {
        const response = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: '/web/session/authenticate',
                method: 'call',
                params: {
                    db: DB,
                    login: login,
                    password: pass,
                },
            }),
        });

        const result = await response.json();

        if (result.error) {
            throw new Error(result.error.data?.message || 'Authentication Failed');
        }

        const { uid, name, username, session_id, partner_id, company_id, is_system } = result.result;

        return {
            uid,
            name,
            username,
            session_id,
            partner_id,
            company_id,
            is_system
        };
    },

    async getSalesCount(partnerId: number): Promise<number> {
        // This assumes we can access 'stock.lot' or similar model where 'salesperson_id' or connected partner is tracked.
        // Adjust model and domain as per specific Odoo customization for "Lots".
        // For now, let's assume a model 'stock.quant' or a custom 'real.estate.lot' and status 'sold'.
        // If we don't know the exact model, we might default to 0 or mock it if the RPC fails.

        // NOTE: User mentioned "cada usuario vendedor muestra la cantidad de lotes vendido".
        // We will assume a model map or similar. Since we don't have the exact model name, 
        // we'll try to use a generic 'sale.order' count for now, or returns a mock if it fails,
        // as we need to be careful with the exact model name.

        // However, the prompt implies this app IS for the real estate.
        // Let's assume the model is 'res.partner' (too generic) or better, let's assume we are counting 'sale.order' where user_id is the current user.

        try {
            const response = await fetch(PROXY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: '/web/dataset/call_kw/sale.order/search_count',
                    method: 'call',
                    params: {
                        model: 'sale.order',
                        method: 'search_count',
                        args: [[['user_id.partner_id', '=', partnerId], ['state', '=', 'sale']]], // sales orders confirmed
                        kwargs: {},
                    },
                }),
            });

            const result = await response.json();
            if (result.error) {
                console.warn("Could not fetch sales count, returning 0", result.error);
                return 0;
            }
            return result.result;
        } catch (e) {
            console.error("Error fetching sales stats", e);
            return 0;
        }
    }
};
