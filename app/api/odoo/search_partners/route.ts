import { NextResponse } from 'next/server';
import { fetchOdoo } from '@/app/services/odooService';
import { requireStaffSession } from '@/app/lib/staffAuth';
import { clasificarCoincidencia, dominioBusquedaClientes, soloDigitos } from '@/app/lib/documentoCliente';

export async function POST(request: Request) {
    const auth = await requireStaffSession(request);
    if (auth.response) return auth.response;

    try {
        const { query } = await request.json();

        if (!query || query.length < 1) {
            return NextResponse.json({ success: true, results: [] });
        }

        // Nombre (todas las palabras, en cualquier orden), correo o documento — solo registros activos.
        const finalDomain = dominioBusquedaClientes(String(query));

        const results = (await fetchOdoo(
            'res.partner',
            'search_read',
            [finalDomain],
            {
                fields: ['id', 'name', 'email', 'phone', 'mobile', 'vat', 'street'],
                limit: 10
            }
        )) as Record<string, unknown>[];

        // Si lo escrito es un documento, las coincidencias exactas van primero.
        const documento = soloDigitos(query);
        if (/^\d{8}$|^\d{11}$/.test(documento)) {
            const peso = (r: Record<string, unknown>) => (clasificarCoincidencia(r.vat, documento) === 'exacta' ? 0 : 1);
            results.sort((a, b) => peso(a) - peso(b));
        }

        // Marca los clientes que ya tienen un contrato: ayuda al vendedor a reconocer al titular correcto y no
        // abrir otra ficha. Es informativo; si falla, la búsqueda sigue funcionando sin la marca.
        try {
            const ids = results.map((r) => r.id);
            if (ids.length > 0) {
                const contratos = (await fetchOdoo(
                    'simple.contract',
                    'search_read',
                    [[['partner_id', 'in', ids], ['state', 'in', ['confirmed', 'closed']]]],
                    { fields: ['partner_id'], limit: 200 }
                )) as { partner_id: [number, string] | false }[];
                const conContrato = new Set(contratos.map((c) => (c.partner_id ? c.partner_id[0] : 0)));
                for (const r of results) r.tieneContrato = conContrato.has(Number(r.id));
            }
        } catch (error) {
            console.warn('Partner Search: no se pudo marcar clientes con contrato', error);
        }

        return NextResponse.json({ success: true, results });

    } catch (error: unknown) {
        console.error("Partner Search API Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Internal Server Error' },
            { status: 500 }
        );
    }
}
