const https = require('https');

// HARDCODED CREDENTIALS FROM USER REPORT
const config = {
    url: 'https://bot-odoo.2fsywk.easypanel.host/jsonrpc',
    db: 'odoo_akallpav1',
    userId: 2,
    password: '842992cc1b6be60de147fab63e53c5aaa5bcf580'
};

const payload = {
    jsonrpc: "2.0",
    method: "call",
    params: {
        service: "object",
        method: "execute_kw",
        args: [
            config.db,
            config.userId,
            config.password,
            "product.template",
            "search_read",
            [[["active", "=", true]]], // Domain
            {
                fields: ["id", "name", "default_code", "x_statu", "list_price"],
                limit: 5 // Just get 5 to check
            }
        ]
    },
    id: 1
};

const req = https.request(config.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
}, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.error) {
                console.error("ODOO ERROR:", JSON.stringify(json.error, null, 2));
            } else {
                console.log("SUCCESS! Found products:", json.result.length);
                console.log("Sample Data:", JSON.stringify(json.result, null, 2));
            }
        } catch (e) {
            console.error("PARSE ERROR:", e.message);
            console.error("RAW RESPONSE:", data);
        }
    });
});

req.on('error', (e) => console.error("REQUEST ERROR:", e));
req.write(JSON.stringify(payload));
req.end();
