const fs = require('fs');
const path = require('path');

const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.js'));
for (const file of files) {
    if (file === 'replace.js') continue;
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/\bMap\./g, 'GameMap.');
    content = content.replace(/\bclass Map\b/g, 'class GameMap');
    content = content.replace(/\bnew Map\(/g, 'new GameMap(');
    fs.writeFileSync(file, content);
}
console.log('Replaced Map with GameMap in ' + files.length + ' files.');
