const fs = require('fs');
const path = require('path');

// --- 1. Load Environment Variables from .env.local (Simple Parser) ---
function loadEnv() {
    try {
        const envPath = path.resolve(__dirname, '../.env.local');
        if (!fs.existsSync(envPath)) {
            console.error("❌ Error: .env.local not found in project root.");
            process.exit(1);
        }
        const content = fs.readFileSync(envPath, 'utf-8');
        const env = {};
        content.split('\n').forEach(line => {
            line = line.trim();
            if (line && !line.startsWith('#')) {
                const parts = line.split('=');
                if (parts.length >= 2) {
                    const key = parts[0].trim();
                    // Join back the rest in case values have '='
                    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
                    env[key] = val;
                }
            }
        });
        return env;
    } catch (err) {
        console.error("Error loading .env.local", err);
        return {};
    }
}

const env = loadEnv();

// --- 2. Odoo Fetch Function ---
async function fetchOdooProducts() {
    const url = env.ODOO_URL;
    const db = env.ODOO_DB;
    const uid = env.ODOO_USER_ID;
    const pass = env.ODOO_PASSWORD;

    if (!url || !db || !uid || !pass) {
        console.error("❌ Missing Odoo credentials in .env.local", { url, db, uid });
        process.exit(1);
    }

    console.log("🔄 Fetching products from Odoo...");

    const payload = {
        jsonrpc: "2.0",
        method: "call",
        params: {
            service: "object",
            method: "execute_kw",
            args: [
                db,
                parseInt(uid),
                pass,
                "product.template",
                "search_read",
                [[["active", "=", true]]], // Search domain
                { fields: ["default_code", "name", "x_area", "x_mz", "x_etapa", "x_lote"] } // Fields
            ]
        },
        id: 1
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
        const data = await response.json();

        if (data.error) {
            console.error("❌ Odoo RPC Error:", data.error);
            process.exit(1);
        }
        return data.result;
    } catch (error) {
        console.error("❌ Network fail:", error);
        process.exit(1);
    }
}

// --- 3. Update File Logic ---
function updateFile(odooProducts) {
    const filePath = path.resolve(__dirname, '../app/data/lotsData.ts');
    let content = fs.readFileSync(filePath, 'utf-8');

    // Index Odoo products by default_code
    const odooMap = new Map();
    odooProducts.forEach(p => {
        if (p.default_code) {
            odooMap.set(p.default_code.trim().toUpperCase(), p);
        }
    });

    console.log(`✅ Loaded ${odooMap.size} products from Odoo.`);
    console.log('[DEBUG] Sample Odoo Keys:', Array.from(odooMap.keys()).slice(0, 5));

    // --- Helper to Generate Code locally to match lots ---
    // Copied logic from lotsData.ts to ensure we find the right match
    function generateDefaultCode(name, etapa, manzana) {
        const loteMatch = name.match(/(\d+)/);
        if (!loteMatch) return '';
        const loteNum = loteMatch[1].padStart(3, '0');
        const etapaNum = etapa.padStart(2, '0');
        return `E${etapaNum}MZ${manzana}${loteNum}`;
    }

    // --- Parsing and Replacement Strategy ---
    // We iterate over the file content looking for object blocks: { ... }
    // This is a naive regex approach but works for structured files like the one provided.

    let updatedCount = 0;

    // Pattern to find block properties for: name, etapa, manzana
    // We capture the whole block to infer the ID/Name first


    // We will read line by line. 
    // We need to track:
    // 1. Where a lot object starts (line index)
    // 2. The properties of that lot (name, etapa, manzana)
    // 3. Where the lot object ends

    const lines = content.split(/\r?\n/);
    const newLines = [...lines];

    let parsingActive = false; // Only parse inside the lotsDataRaw array

    // State machine
    let insideObject = false;
    let currentLot = {};
    let currentStartIndex = -1;
    let braceDepth = 0; // To handle nested arrays (points)

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed.includes('const lotsDataRaw')) {
            parsingActive = true;
            console.log("[DEBUG] Found lotsDataRaw array start.");
        }
        if (parsingActive && trimmed.endsWith('];')) {
            parsingActive = false;
        }

        if (!parsingActive) continue;

        // Detect start of object
        // Assuming objects are in the array: [ { ... }, { ... } ]
        // A line ending with '{' or just '{' usually starts it.
        if (trimmed.endsWith('{') || trimmed === '{') {
            if (braceDepth === 0) {
                insideObject = true;
                currentLot = {};
                currentStartIndex = i;
            }
            braceDepth++;
        }

        if (insideObject) {
            // Extract props...
            if (trimmed.includes('name:')) {
                const nameMatch = trimmed.match(/name:\s*['"]([^'"]+)['"]/);
                if (nameMatch) {
                    currentLot.name = nameMatch[1];
                } else {
                    console.log(`[DEBUG] Found 'name:' but regex failed: ${trimmed}`);
                }
            }

            if (trimmed.includes('etapa:')) {
                const etapaMatch = trimmed.match(/etapa:\s*['"]([^'"]+)['"]/);
                if (etapaMatch) currentLot.etapa = etapaMatch[1];
            }

            if (trimmed.includes('manzana:')) {
                const manzanaMatch = trimmed.match(/manzana:\s*['"]([^'"]+)['"]/);
                if (manzanaMatch) currentLot.manzana = manzanaMatch[1];
            }
        }

        // Detect end of object
        // '},' or '}'
        if (trimmed.includes('}')) {
            braceDepth--;

            // If checking depth 0, we finished the top-level lot object
            if (braceDepth === 0 && insideObject) {
                console.log(`[DEBUG] Closing object. Captured:`, currentLot); // DEBUG

                // Determine Code
                if (currentLot.name && currentLot.etapa && currentLot.manzana) {
                    const code = generateDefaultCode(currentLot.name, currentLot.etapa, currentLot.manzana);
                    // console.log(`[PARSED] Found Lot: ${currentLot.name} | Code: ${code}`); // DEBUG
                    const odooData = odooMap.get(code.toUpperCase());

                    if (odooData) {
                        // console.log(`   ✅ Match found for ${code}`);
                        // Scan lines...
                        for (let j = currentStartIndex; j <= i; j++) {
                            const row = lines[j];

                            // Update Area
                            if (odooData.x_area && row.trim().startsWith('area:')) {
                                const newLine = row.replace(/area:\s*\d+(\.\d+)?/, `area: ${odooData.x_area}`);
                                if (row !== newLine) {
                                    newLines[j] = newLine;
                                    console.log(`   ✏️ Updated Area for ${code}: ${odooData.x_area}`);
                                }
                            }

                            // Update Manzana (if changed)
                            if (odooData.x_mz && row.trim().startsWith('manzana:')) {
                                const oldMz = row.match(/manzana:\s*['"]([^'"]+)['"]/)?.[1];
                                if (oldMz && oldMz !== odooData.x_mz) {
                                    const newLine = row.replace(/manzana:\s*['"][^'"]+['"]/, `manzana: '${odooData.x_mz}'`);
                                    newLines[j] = newLine;
                                    console.log(`   ✏️ Updated Manzana for ${code}: ${odooData.x_mz}`);
                                }
                            }

                            // Update Etapa (if changed)
                            if (odooData.x_etapa && row.trim().startsWith('etapa:')) {
                                const oldEtapa = row.match(/etapa:\s*['"]([^'"]+)['"]/)?.[1];
                                if (oldEtapa && oldEtapa !== odooData.x_etapa) {
                                    const newLine = row.replace(/etapa:\s*['"][^'"]+['"]/, `etapa: '${odooData.x_etapa}'`);
                                    newLines[j] = newLine;
                                    console.log(`   ✏️ Updated Etapa for ${code}: ${odooData.x_etapa}`);
                                }
                            }
                        }
                        updatedCount++;
                    }
                }
                insideObject = false;
            }
        }
    }

    // Write back
    fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');
    console.log(`\n✨ Sync Complete. Scanned and verified ${updatedCount} lots.`);
}

// --- Main Execution ---
(async () => {
    try {
        const products = await fetchOdooProducts();
        updateFile(products);
    } catch (e) {
        console.error("Fatal Error:", e);
    }
})();
