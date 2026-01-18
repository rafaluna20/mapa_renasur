const fetch = require('node-fetch');
const dotenv = require('dotenv');
const fs = require('fs');

if (fs.existsSync('.env.local')) {
    const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

async function testOdoo() {
    const url = process.env.ODOO_URL;
    const db = process.env.ODOO_DB;
    const uid = parseInt(process.env.ODOO_USER_ID);
    const password = process.env.ODOO_PASSWORD;

    console.log(`Connecting to: ${url}`);
    console.log(`DB: ${db}, UID: ${uid}`);

    const payload = {
        jsonrpc: "2.0",
        method: "call",
        params: {
            service: "object",
            method: "execute_kw",
            args: [
                db, uid, password,
                "product.template",
                "search_read",
                [[["active", "=", true]]],
                { fields: ["id", "name", "default_code"], limit: 5 }
            ]
        },
        id: Date.now()
    };

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.error) {
            console.error("Odoo Error:", data.error);
        } else {
            console.log("Success! Found " + data.result.length + " products.");
            console.log("Samples:", JSON.stringify(data.result, null, 2));
        }
    } catch (e) {
        console.error("Fetch Error:", e.message);
    }
}

testOdoo();
