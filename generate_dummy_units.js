const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, 'assets', 'images', 'units');
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

// 1x1 PNG base64 strings
const b64Red = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const b64Blue = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIB40U9hAAAAABJRU5ErkJggg==';

const units = [
    'infantry', 'transport', 'tank', 'md_tank', 'hv_tank', 'artillery', 'rocket',
    'aa_tank', 'aa_missile', 'heli_transport', 'fighter', 'bomber',
    'battleship', 'destroyer', 'submarine', 'hovercraft'
];

units.forEach(u => {
    const p1Path = path.join(outDir, `${u}_p1.png`);
    const p2Path = path.join(outDir, `${u}_p2.png`);
    if (!fs.existsSync(p1Path)) {
        fs.writeFileSync(p1Path, Buffer.from(b64Red, 'base64'));
    }
    if (!fs.existsSync(p2Path)) {
        fs.writeFileSync(p2Path, Buffer.from(b64Blue, 'base64'));
    }
    console.log(`Created dummy images for ${u}`);
});
