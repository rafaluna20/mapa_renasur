import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const body = await request.json();
    const { url, method, params } = body;

    if (!url || !method) {
        return NextResponse.json({ error: 'Missing url or method' }, { status: 400 });
    }

    const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL;

    if (!ODOO_URL) {
        return NextResponse.json({ error: 'Server configuration error: NEXT_PUBLIC_ODOO_URL not set' }, { status: 500 });
    }

    const targetUrl = `${ODOO_URL}${url}`;

    try {
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: method,
                params: params,
                id: Math.floor(Math.random() * 1000000000),
            }),
        });

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Odoo Proxy Error:', error);
        return NextResponse.json({ error: 'Failed to communicate with Odoo' }, { status: 500 });
    }
}
