// --- Server-Side only: llama a los endpoints propios del módulo Odoo ---
// (simple_recurring_contract: /api/contract/*, /api/simple_contract/*)
//
// A diferencia de fetchOdoo() (que usa execute_kw con la cuenta de servicio
// ODOO_USER_ID/ODOO_PASSWORD y por lo tanto tiene acceso amplio a cualquier
// modelo/método), estas rutas son controladores JSON-RPC propios del módulo
// que ya traen rate limiting, validación de input y permisos por grupo — y
// se autentican con una API key de simple.contract.api.key, no con la cuenta
// admin. Usar esto para las operaciones sensibles (crear contrato, pagar
// factura) en vez de fetchOdoo() evita reimplementar esas protecciones en
// Next.js y aprovecha las que ya existen en el módulo.
//
// Requiere en Odoo:
// 1. Crear una credencial en simple.contract.api.key (Ajustes > Técnico, o el
//    menú del módulo) asociada a un usuario técnico dedicado.
// 2. Ese usuario técnico debe pertenecer a los grupos que piden los
//    endpoints usados: sales_team.group_sale_salesman (create_contract) y
//    account.group_account_invoice (pay_invoice).
// 3. Guardar la key generada (se muestra una sola vez) en la variable de
//    entorno ODOO_CONTRACT_API_KEY.

interface OdooModuleErrorResponse {
    status: 'error';
    message: string;
    retry_after?: number;
}

function getModuleBaseUrl(): string {
    const odooUrl = process.env.ODOO_URL || '';
    // ODOO_URL normalmente apunta a la ruta usada por execute_kw (.../jsonrpc);
    // los endpoints del módulo cuelgan de la raíz del sitio Odoo, no de /jsonrpc.
    return odooUrl.replace(/\/jsonrpc\/?$/, '').replace(/\/$/, '');
}

export async function callContractApi<T = Record<string, unknown>>(
    path: string,
    params: Record<string, unknown>
): Promise<T> {
    const baseUrl = getModuleBaseUrl();
    const apiKey = process.env.ODOO_CONTRACT_API_KEY;

    if (!baseUrl) throw new Error('Missing ODOO_URL');
    if (!apiKey) throw new Error('Missing ODOO_CONTRACT_API_KEY');

    const res = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params,
            id: Math.floor(Math.random() * 1_000_000),
        }),
        cache: 'no-store',
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Odoo module API HTTP ${res.status}: ${text}`);
    }

    const data = await res.json();

    if (data.error) {
        throw new Error(`Odoo module API error: ${data.error.message} - ${data.error.data?.message || ''}`);
    }

    const result = data.result as (T & Partial<OdooModuleErrorResponse>) | OdooModuleErrorResponse;

    // El controlador siempre responde 200 y mete el error en el body
    // ({status: 'error', message}), en vez de usar códigos HTTP de error.
    if (result && (result as OdooModuleErrorResponse).status === 'error') {
        const err = result as OdooModuleErrorResponse;
        throw new Error(err.message || 'Odoo module API returned an error');
    }

    return result as T;
}
