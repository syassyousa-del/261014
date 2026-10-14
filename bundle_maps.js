const fs = require('fs');
const path = require('path');

const mapsDir = path.join(__dirname, 'maps');
const outputFile = path.join(__dirname, 'bundled_maps.js');

const bundledMaps = {};
const files = fs.readdirSync(mapsDir);

files.forEach(file => {
    if (file.endsWith('.json')) {
        const content = fs.readFileSync(path.join(mapsDir, file), 'utf8');
        try {
            bundledMaps[file] = JSON.parse(content);
        } catch (e) {
            console.error(`Error parsing ${file}: ${e}`);
        }
    }
});

const outputContent = `window.BUNDLED_MAPS = ${JSON.stringify(bundledMaps, null, 2)};\n`;
fs.writeFileSync(outputFile, outputContent, 'utf8');
console.log(`Bundled ${Object.keys(bundledMaps).length} maps into ${outputFile}`);
