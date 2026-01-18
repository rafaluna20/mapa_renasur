/**
 * Pre-processing script to enrich geometries.json with measurements
 * Run with: node scripts/processGeometries.js
 */

const fs = require('fs');
const path = require('path');

// Geometry calculation functions (duplicated for Node.js environment)

function calculateDistance(p1, p2) {
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    return Math.sqrt(dx * dx + dy * dy);
}

function calculateSideLengths(coordinates) {
    if (coordinates.length < 3) return [];

    const sides = [];
    const n = coordinates.length;

    for (let i = 0; i < n; i++) {
        const p1 = coordinates[i];
        const p2 = coordinates[(i + 1) % n];
        sides.push(calculateDistance(p1, p2));
    }

    return sides;
}

function calculateArea(coordinates) {
    if (coordinates.length < 3) return 0;

    let area = 0;
    const n = coordinates.length;

    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += coordinates[i][0] * coordinates[j][1];
        area -= coordinates[j][0] * coordinates[i][1];
    }

    return Math.abs(area / 2);
}

function calculatePerimeter(coordinates) {
    const sides = calculateSideLengths(coordinates);
    return sides.reduce((sum, side) => sum + side, 0);
}

function calculateCentroid(coordinates) {
    if (coordinates.length === 0) return [0, 0];

    let sumX = 0;
    let sumY = 0;

    for (const [x, y] of coordinates) {
        sumX += x;
        sumY += y;
    }

    return [sumX / coordinates.length, sumY / coordinates.length];
}

function calculateLotMeasurements(coordinates) {
    return {
        sides: calculateSideLengths(coordinates),
        area: calculateArea(coordinates),
        perimeter: calculatePerimeter(coordinates),
        centroid: calculateCentroid(coordinates)
    };
}

// Main processing function
function processGeometries() {
    console.log('🔧 Starting geometry pre-processing...\n');

    // Paths
    const inputPath = path.join(__dirname, '../app/data/geometries.json');
    const outputPath = path.join(__dirname, '../app/data/geometries-enriched.json');

    // Read input file
    console.log(`📖 Reading: ${inputPath}`);
    const rawData = fs.readFileSync(inputPath, 'utf8');
    const geometries = JSON.parse(rawData);

    // Process each lot
    const enrichedGeometries = {};
    let processedCount = 0;
    let errorCount = 0;

    console.log(`\n📊 Processing ${Object.keys(geometries).length} lots...\n`);

    for (const [lotId, coordinates] of Object.entries(geometries)) {
        try {
            // Handle both array and object formats
            const coords = Array.isArray(coordinates) ? coordinates : coordinates.coordinates;

            if (!coords || coords.length < 3) {
                console.warn(`⚠️  Skipping ${lotId}: insufficient coordinates`);
                errorCount++;
                continue;
            }

            const measurements = calculateLotMeasurements(coords);

            enrichedGeometries[lotId] = {
                coordinates: coords,
                measurements: {
                    sides: measurements.sides.map(s => parseFloat(s.toFixed(2))),
                    area: parseFloat(measurements.area.toFixed(2)),
                    perimeter: parseFloat(measurements.perimeter.toFixed(2)),
                    centroid: measurements.centroid.map(c => parseFloat(c.toFixed(2)))
                }
            };

            processedCount++;

            // Progress indicator
            if (processedCount % 50 === 0) {
                console.log(`  ✓ Processed ${processedCount} lots...`);
            }
        } catch (error) {
            console.error(`❌ Error processing ${lotId}:`, error.message);
            errorCount++;
        }
    }

    // Write output file
    console.log(`\n💾 Writing enriched data to: ${outputPath}`);
    fs.writeFileSync(
        outputPath,
        JSON.stringify(enrichedGeometries, null, 2),
        'utf8'
    );

    // Summary statistics
    console.log('\n' + '='.repeat(50));
    console.log('📈 PROCESSING SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Successfully processed: ${processedCount} lots`);
    console.log(`❌ Errors: ${errorCount} lots`);
    console.log(`📁 Output file: ${outputPath}`);

    // Sample data
    const sampleLot = Object.keys(enrichedGeometries)[0];
    console.log(`\n📋 Sample output (${sampleLot}):`);
    console.log(JSON.stringify(enrichedGeometries[sampleLot], null, 2));

    console.log('\n✨ Pre-processing complete!\n');
}

// Run the script
try {
    processGeometries();
} catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
}
