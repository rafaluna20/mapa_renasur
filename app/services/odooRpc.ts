// --- Transporte JSON-RPC de bajo nivel hacia Odoo ---
// Extraído de odooService.ts para poder llamarlo con credenciales distintas
// (ver odooPublicService.ts): la cuenta admin de siempre (ODOO_USER_ID/
// ODOO_PASSWORD) sigue usándose vía fetchOdoo() sin ningún cambio de
// comportamiento; la cuenta pública mínima usa este mismo transporte con
// sus propias credenciales, nunca con las de admin.
//
// NOTA: como fetchOdoo(), esto DEBE usarse solo en Server Components o API
// Routes — nunca en Client Components (las credenciales viven en env vars
// del servidor).
export interface OdooRpcCredentials {
    url: string;
    db: string;
    uid: number;
    password: string;
}

export async function callOdooJsonRpc(
    creds: OdooRpcCredentials,
    model: string,
    method: string,
    args: unknown[],
    kwargs: Record<string, unknown> = {}
) {
    const payload = {
        jsonrpc: "2.0",
        method: "call",
        params: {
            service: "object",
            method: "execute_kw",
            args: [
                creds.db,
                creds.uid,
                creds.password,
                model,
                method,
                args,
                kwargs
            ]
        },
        id: 2
    };

    try {
        const res = await fetch(creds.url, {
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
