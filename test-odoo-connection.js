const https = require('https');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envContent.split(/\r?\n/).forEach(line => { // Handle CRLF or LF
    if (!line || line.startsWith('#')) return; // Skip empty lines or comments
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        let key = match[1].trim();
        let value = match[2].trim();
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        envVars[key] = value;
    }
});

const ODOO_URL = envVars.ODOO_URL;
const ODOO_DB = envVars.ODOO_DB;
const ODOO_USER_ID = envVars.ODOO_USER_ID;
const ODOO_PASSWORD = envVars.ODOO_PASSWORD;

console.log('--- Odoo Connection Test ---');
console.log('URL:', ODOO_URL);
console.log('DB:', ODOO_DB);
console.log('User ID:', ODOO_USER_ID);

if (!ODOO_URL || !ODOO_DB || !ODOO_USER_ID || !ODOO_PASSWORD) {
    console.error('❌ Missing environment variables!');
    process.exit(1);
}

const payload = {
    jsonrpc: "2.0",
    method: "call",
    params: {
        service: "object",
        method: "execute_kw",
        args: [
            ODOO_DB,
            parseInt(ODOO_USER_ID),
            ODOO_PASSWORD,
            'res.partner',
            'search_read',
            [[['vat', '=', '87654321']]],
            { fields: ['id', 'name', 'phone', 'email'] }
        ]
    },
    id: 1
};

const options = {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    }
};

const req = https.request(ODOO_URL, options, (res) => {
    let data = '';

    console.log(`Status Code: ${res.statusCode}`);

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.error) {
                console.error('❌ Odoo Error:', JSON.stringify(json.error, null, 2));
            } else if (json.result) {
                console.log('✅ Success! Result:', JSON.stringify(json.result, null, 2));
                if (json.result.length === 0) {
                    console.log('⚠️ No partner found with DNI 87654321');
                } else {
                    console.log('✅ Partner found!');
                }
            } else {
                console.log('❓ Unexpected response:', data);
            }
        } catch (e) {
            console.error('❌ Failed to parse JSON:', e.message);
            console.log('Raw response:', data);
        }
    });
});

req.on('error', (e) => {
    console.error('❌ Request Error:', e.message);
});

req.write(JSON.stringify(payload));
req.end();
