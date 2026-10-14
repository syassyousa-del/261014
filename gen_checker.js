const fs = require('fs');
const code = fs.readFileSync('unit.js', 'utf8');

// Quick and dirty manual check
const types = ['INFANTRY', 'TRANSPORT', 'TANK', 'MD_TANK', 'HV_TANK', 'ARTILLERY', 'ROCKET', 'HELI_TRANSPORT', 'FIGHTER', 'BOMBER', 'AA_TANK', 'AA_MISSILE', 'BATTLESHIP', 'DESTROYER', 'SUBMARINE', 'HOVERCRAFT'];

let missing = false;
types.forEach(attacker => {
    types.forEach(defender => {
        // Just regex search for the combination
        // Since we are checking if the matrix is complete, we'll just parse the object properly
    });
});

// Better way: write a small script that exports the MATCHUPS object and checks it.
// We can just construct a valid script and run it.
const scriptContent = `
const Unit = {
    TYPES: {
        INFANTRY: 'INFANTRY', TRANSPORT: 'TRANSPORT', TANK: 'TANK', MD_TANK: 'MD_TANK', HV_TANK: 'HV_TANK',
        ARTILLERY: 'ARTILLERY', ROCKET: 'ROCKET', HELI_TRANSPORT: 'HELI_TRANSPORT', FIGHTER: 'FIGHTER',
        BOMBER: 'BOMBER', AA_TANK: 'AA_TANK', AA_MISSILE: 'AA_MISSILE', BATTLESHIP: 'BATTLESHIP',
        DESTROYER: 'DESTROYER', SUBMARINE: 'SUBMARINE', HOVERCRAFT: 'HOVERCRAFT'
    }
};
` + code.match(/static MATCHUPS = (\{[\s\S]*?\});/)[0].replace('static MATCHUPS =', 'const MATCHUPS =') + `

const types = Object.values(Unit.TYPES);
let missing = [];
for (const t1 of types) {
  if (!MATCHUPS[t1]) {
    missing.push(t1 + ' missing as attacker');
    continue;
  }
  for (const t2 of types) {
    if (MATCHUPS[t1][t2] === undefined) {
      missing.push(t1 + ' -> ' + t2 + ' missing');
    }
  }
}
console.log('Missing pairs:', missing);
`;
fs.writeFileSync('check_matchups.js', scriptContent);
