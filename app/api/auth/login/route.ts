import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const { login, password } = await request.json();

        if (!login || !password) {
            return NextResponse.json({ success: false, error: "Missing credentials" }, { status: 400 });
        }

        const odooUrl = process.env.ODOO_URL;
        const odooDb = process.env.ODOO_DB;

        if (!odooUrl || !odooDb) {
            return NextResponse.json({ success: false, error: "Server misconfiguration (Missing Odoo Env)" }, { status: 500 });
        }

        // Construct the JSON-RPC payload for authentication
        const payload = {
            jsonrpc: "2.0",
            method: "call",
            params: {
                db: odooDb,
                login: login,
                password: password,
            },
            id: Math.floor(Math.random() * 1000000)
        };

        // We target the standard Odoo auth endpoint
        // Note: typically main Odoo URL + /web/session/authenticate
        // We need to parse ODOO_URL to strip 'jsonrpc' if it's there, or just assume the base domain.
        // Let's assume ODOO_URL in env is something like "https://my-odoo.com/jsonrpc".
        // We need the base URL. Safest is to try to construct it.

        let authUrl = odooUrl;
        if (authUrl.endsWith('/jsonrpc')) {
            authUrl = authUrl.replace('/jsonrpc', '/web/session/authenticate');
        } else {
            // If the user just put the base URL, append path
            // Remove trailing slash if exists
            authUrl = authUrl.replace(/\/$/, "") + '/web/session/authenticate';
        }

        console.log("Attempting Odoo Auth at:", authUrl);

        const response = await fetch(authUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            return NextResponse.json({ success: false, error: `Odoo HTTP Error: ${response.status}` }, { status: 502 });
        }

        const data = await response.json();

        if (data.error) {
            return NextResponse.json({ success: false, error: data.error.data?.message || data.error.message }, { status: 401 });
        }

        const result = data.result;

        // Normalize the user object
        const user = {
            uid: result.uid,
            name: result.name,
            username: result.username,
            session_id: result.session_id,
            partner_id: result.partner_id,
            company_id: result.company_id,
            is_system: result.is_system
        };

        return NextResponse.json({ success: true, user });

    } catch (error: any) {
        console.error("Auth Route Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
