/**
 * Script para convertir el logo de TERRA LIMA a base64
 * Ejecutar con: node scripts/convertLogoToBase64.js
 */

const fs = require('fs');
const path = require('path');

// Ruta al logo
const logoPath = path.join(__dirname, '..', 'public', 'terra-lima-logo.png');

// Leer la imagen
try {
    const imageBuffer = fs.readFileSync(logoPath);
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64Image}`;
    
    console.log('='.repeat(80));
    console.log('LOGO TERRA LIMA CONVERTIDO A BASE64');
    console.log('='.repeat(80));
    console.log('\nCopia el siguiente código y reemplázalo en app/utils/imageHelper.ts:\n');
    console.log(`export const TERRA_LIMA_LOGO_BASE64 = '${dataUrl}';`);
    console.log('\n' + '='.repeat(80));
    
    // También guardar en un archivo temporal
    const outputPath = path.join(__dirname, 'logo-base64.txt');
    fs.writeFileSync(outputPath, dataUrl);
    console.log(`\n✅ También guardado en: ${outputPath}\n`);
    
} catch (error) {
    console.error('❌ Error al convertir la imagen:', error.message);
    console.log('\n📝 INSTRUCCIONES ALTERNATIVAS:');
    console.log('1. Guarda el logo como: public/terra-lima-logo.png');
    console.log('2. Usa una herramienta online: https://base64.guru/converter/encode/image');
    console.log('3. Pega el resultado en app/utils/imageHelper.ts\n');
}
