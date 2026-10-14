// editor.js - Map editor implementation
// Supports terrain and unit placement via palette buttons.
// Canvas is interactive: clicking places selected brush, eraser clears.
// Renders the game map on the editor canvas. Initially fills the map with plain tiles.

window.addEventListener('load', async () => {
  const canvas = document.getElementById('editorCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const tileSize = 32; // base pixel size per tile
let scale = 1.0; // zoom factor
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.0;

  // Create map instance (e.g., 20x15 tiles)
  const cols = 20;
  const rows = 15;
  const gameMap = new GameMap(cols, rows, tileSize);

  // Initialize a separate unit grid (null means no unit)
  let unitGrid = [];
for (let y = 0; y < rows; y++) {
  unitGrid[y] = new Array(cols).fill(null);
}

  // Initialize a separate bridge grid (null means no bridge)
  let bridgeGrid = [];
  for (let y = 0; y < rows; y++) {
    bridgeGrid[y] = new Array(cols).fill(null);
  }

  // Override initGrid to generate only plains for editor preview
  gameMap.initGrid = function () {
    for (let y = 0; y < this.rows; y++) {
      const row = [];
      for (let x = 0; x < this.cols; x++) {
        row.push(GameMap.TERRAIN.PLAINS);
      }
      this.grid.push(row);
    }
  };
  // Regenerate grid with plain tiles only
  gameMap.grid = [];
  gameMap.initGrid();

  // Load assets (terrain images, roads, coastlines, units, etc.)
  const assets = new AssetManager();
  await assets.loadAll();

// -------------------------------------------------
// Define toolbar items (terrain, units, tools)
// -------------------------------------------------
const terrainItems = [
  { type: 'terrain', value: 'PLAINS' },
  { type: 'terrain', value: 'FOREST' },
  { type: 'terrain', value: 'MOUNTAIN' },
  { type: 'terrain', value: 'WATER' },
  { type: 'terrain', value: 'ROAD' },
  { type: 'terrain', value: 'BRIDGE_H' },
  { type: 'terrain', value: 'BRIDGE_V' },
  { type: 'terrain', value: 'RIVER_H' },
  { type: 'terrain', value: 'RIVER_V' },
  { type: 'terrain', value: 'CITY_NEUTRAL' },
  { type: 'terrain', value: 'CITY_P1' },
  { type: 'terrain', value: 'CITY_P2' },
  { type: 'terrain', value: 'HQ_P1' },
  { type: 'terrain', value: 'HQ_P2' },
  { type: 'terrain', value: 'FACTORY_NEUTRAL' },
  { type: 'terrain', value: 'FACTORY_P1' },
  { type: 'terrain', value: 'FACTORY_P2' },
  { type: 'terrain', value: 'AIRPORT_NEUTRAL' },
  { type: 'terrain', value: 'AIRPORT_P1' },
  { type: 'terrain', value: 'AIRPORT_P2' },
  { type: 'terrain', value: 'PORT_NEUTRAL' },
  { type: 'terrain', value: 'PORT_P1' },
  { type: 'terrain', value: 'PORT_P2' }
];

const unitP1Items = [
  { type: 'unit', value: 'INFANTRY', owner: 1 },
  { type: 'unit', value: 'TANK', owner: 1 },
  { type: 'unit', value: 'ARTILLERY', owner: 1 },
  { type: 'unit', value: 'TRANSPORT', owner: 1 },
  { type: 'unit', value: 'MD_TANK', owner: 1 },
  { type: 'unit', value: 'HV_TANK', owner: 1 },
  { type: 'unit', value: 'ROCKET', owner: 1 },
  { type: 'unit', value: 'FIGHTER', owner: 1 },
  { type: 'unit', value: 'BOMBER', owner: 1 },
  { type: 'unit', value: 'AA_TANK', owner: 1 },
  { type: 'unit', value: 'AA_MISSILE', owner: 1 },
  { type: 'unit', value: 'BATTLESHIP', owner: 1 },
  { type: 'unit', value: 'DESTROYER', owner: 1 },
  { type: 'unit', value: 'SUBMARINE', owner: 1 },
  { type: 'unit', value: 'HOVERCRAFT', owner: 1 }
];

const unitP2Items = [
  { type: 'unit', value: 'INFANTRY', owner: 2 },
  { type: 'unit', value: 'TANK', owner: 2 },
  { type: 'unit', value: 'ARTILLERY', owner: 2 },
  { type: 'unit', value: 'TRANSPORT', owner: 2 },
  { type: 'unit', value: 'MD_TANK', owner: 2 },
  { type: 'unit', value: 'HV_TANK', owner: 2 },
  { type: 'unit', value: 'ROCKET', owner: 2 },
  { type: 'unit', value: 'FIGHTER', owner: 2 },
  { type: 'unit', value: 'BOMBER', owner: 2 },
  { type: 'unit', value: 'AA_TANK', owner: 2 },
  { type: 'unit', value: 'AA_MISSILE', owner: 2 },
  { type: 'unit', value: 'BATTLESHIP', owner: 2 },
  { type: 'unit', value: 'DESTROYER', owner: 2 },
  { type: 'unit', value: 'SUBMARINE', owner: 2 },
  { type: 'unit', value: 'HOVERCRAFT', owner: 2 }
];

const toolItems = [
  { type: 'tool', value: 'ERASER' },
  { type: 'tool', value: 'PAN' }
];

/**
 * Populate a toolbar container with button elements based on provided items.
 * Each button receives appropriate data attributes and an icon image.
 */
function populateBrushGrid(toolbarId, items) {
  const container = document.getElementById(toolbarId);
  if (!container) return;
  container.innerHTML = '';
  items.forEach(item => {
    const btn = document.createElement('button');
    btn.className = item.type === 'unit' ? 'unit-btn brush-btn' : 'brush-btn';
    btn.dataset.type = item.type;
    btn.dataset.value = item.value;
    if (item.owner !== undefined) btn.dataset.owner = item.owner;
    const img = document.createElement('img');
    img.className = 'icon';
    // Determine image source based on type
    let imgObj = null;
    if (item.type === 'terrain') {
      if (item.value === 'ROAD') {
        // Use generic road image (mask 0) for palette display
        imgObj = assets.getRoadImage(0);
      } else {
        imgObj = assets.getImage(GameMap.TERRAIN[item.value]);
      }
    } else if (item.type === 'unit') {
      imgObj = assets.getUnitImage(item.value, item.owner);
    }
    if (imgObj && imgObj.src) {
      img.src = imgObj.src;
      btn.appendChild(img);
    } else if (item.type === 'tool') {
      btn.innerHTML = item.value === 'ERASER' ? '消去' : (item.value === 'PAN' ? '移動' : item.value);
    } else {
      btn.appendChild(img);
    }
    container.appendChild(btn);
  });
}

// Generate toolbars
populateBrushGrid('terrain-brushes-toolbar', terrainItems);
populateBrushGrid('unit-p1-toolbar', unitP1Items);
populateBrushGrid('unit-p2-toolbar', unitP2Items);
populateBrushGrid('tools-toolbar', toolItems);


  // Current brush state (default to plains terrain)
  let currentBrush = { type: 'terrain', value: 'PLAINS', owner: null };

  // Palette button handling
  document.querySelectorAll('.brush-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    // Remove active class from all, add to clicked
    document.querySelectorAll('.brush-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const brushType = btn.dataset.type;
    const brushValue = btn.dataset.value;
    const brushOwner = btn.dataset.owner ? Number(btn.dataset.owner) : null;
    currentBrush = { type: brushType, value: brushValue, owner: brushOwner };
  });
});

// ------- Resize button handling -------
const resizeBtn = document.getElementById('resize-btn');
if (resizeBtn) {
  resizeBtn.addEventListener('click', () => {
    const newCols = parseInt(document.getElementById('map-width-input').value, 10);
    const newRows = parseInt(document.getElementById('map-height-input').value, 10);
    
    if (isNaN(newCols) || isNaN(newRows) || newCols < 1 || newRows < 1) return;

    // Create new grids
    const newGrid = [];
    const newUnitGrid = [];
    const newBridgeGrid = [];
    const newAutoTileMasks = gameMap.createEmptyAutoTileMasks(newCols, newRows);
    
    for (let y = 0; y < newRows; y++) {
      const row = [];
      const unitRow = [];
      const bridgeRow = [];
      for (let x = 0; x < newCols; x++) {
        // Copy existing tile if within bounds, otherwise default to PLAINS/null
        if (y < gameMap.rows && x < gameMap.cols) {
          row.push(gameMap.grid[y][x]);
          unitRow.push(unitGrid[y][x]);
          bridgeRow.push(bridgeGrid[y][x]);
          newAutoTileMasks.road[y][x] = gameMap.autoTileMasks?.road?.[y]?.[x] ?? null;
          newAutoTileMasks.river[y][x] = gameMap.autoTileMasks?.river?.[y]?.[x] ?? null;
          newAutoTileMasks.water[y][x] = gameMap.autoTileMasks?.water?.[y]?.[x] ?? null;
        } else {
          row.push(GameMap.TERRAIN.PLAINS);
          unitRow.push(null);
          bridgeRow.push(null);
        }
      }
      newGrid.push(row);
      newUnitGrid.push(unitRow);
      newBridgeGrid.push(bridgeRow);
    }
    
    // Update state
    gameMap.cols = newCols;
    gameMap.rows = newRows;
    gameMap.grid = newGrid;
    gameMap.setAutoTileMasks(newAutoTileMasks);
    unitGrid = newUnitGrid;
    bridgeGrid = newBridgeGrid;

    // Adjust canvas size to fit new map dimensions
    canvas.width = gameMap.cols * tileSize * scale;
    canvas.height = gameMap.rows * tileSize * scale;
    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;
    // Center scroll after resize (so map can be panned fully)
    if (canvasWrapper) {
      canvasWrapper.scrollLeft = 400 + (canvas.width - canvasWrapper.clientWidth) / 2;
      canvasWrapper.scrollTop = 400 + (canvas.height - canvasWrapper.clientHeight) / 2;
    }
    console.log('Map resized to', newCols, 'x', newRows);
    drawMap();
  });
}

// ------- Load button handling (改良版) -------
const loadBtn = document.getElementById('load-file-btn');
const loadInput = document.getElementById('load-file-input');
const saveBtn = document.getElementById('save-btn');
if (saveBtn) {
  saveBtn.addEventListener('click', () => {
    // Gather current map state
      const mapData = {
        cols: gameMap.cols,
        rows: gameMap.rows,
        grid: gameMap.grid,
        autoTileMasks: gameMap.autoTileMasks,
        unitGrid: unitGrid,
        // Legacy fields for compatibility with the game loader
        mapGrid: gameMap.grid,
        // Convert unitGrid (2D) to flat unit list for legacy format
        units: (function() {
          const list = [];
          for (let y = 0; y < unitGrid.length; y++) {
            for (let x = 0; x < unitGrid[y].length; x++) {
              const u = unitGrid[y][x];
              if (u) {
                list.push({ x, y, type: u.type, owner: u.owner });
              }
            }
          }
          return list;
        })()
      };
    const json = JSON.stringify(mapData, null, 2);
    // Create a Blob and trigger download
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const mapName = document.getElementById('map-name-input').value.trim() || 'map';
    a.href = url;
    a.download = `${mapName}.json`;
    a.click();
    // Cleanup
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

if (loadBtn && loadInput) {
  loadBtn.addEventListener('click', () => loadInput.click());

  loadInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        // Parse map file (supports new and legacy formats)
        const data = JSON.parse(ev.target.result);
        console.log('Loaded map data:', data);

        // Try new format first (cols, rows, grid)
        let colsVal = data.cols;
        let rowsVal = data.rows;
        let gridVal = data.grid;
        let autoTileMasksVal = data.autoTileMasks;
        let unitGridVal = data.unitGrid;

        // If new keys missing, fall back to legacy keys (mapGrid, units)
        if (typeof colsVal === 'undefined' && Array.isArray(data.mapGrid)) {
          // Infer dimensions from mapGrid array
          gridVal = data.mapGrid;
          autoTileMasksVal = data.autoTileMasks;
          rowsVal = gridVal.length;
          colsVal = rowsVal > 0 ? gridVal[0].length : 0;
          unitGridVal = data.units || [];
        }

        // Coerce possible string numbers
        if (typeof colsVal === 'string') colsVal = parseInt(colsVal, 10);
        if (typeof rowsVal === 'string') rowsVal = parseInt(rowsVal, 10);



        // Ensure unitGrid shape matches map dimensions
        if (!Array.isArray(unitGridVal) || unitGridVal.length !== rowsVal) {
          console.info('unitGrid not found or mismatched – initializing empty unit grid');
          unitGridVal = Array.from({ length: rowsVal }, () => new Array(colsVal).fill(null));
        }

        // Adjust canvas size to match new map dimensions (intrinsic size only)
        canvas.width = colsVal * tileSize * scale;
        canvas.height = rowsVal * tileSize * scale;
        canvas.style.width = `${canvas.width}px`;
        canvas.style.height = `${canvas.height}px`; // Ensure CSS matches intrinsic size

        // Apply data to game state
        gameMap.cols = colsVal;
        gameMap.rows = rowsVal;
        gameMap.grid = gridVal;
        gameMap.setAutoTileMasks(autoTileMasksVal);
        gameMap.bakeAutoTileMasks();
        unitGrid = unitGridVal;
        drawMap();
      } catch (err) {
        console.error('Failed to load map file', err);
      }
    };
    reader.readAsText(file);
  });
}

// -------------------------------------------------------------------
// Auto-generate button
// -------------------------------------------------------------------
const generateMapBtn = document.getElementById('generate-map-btn');
const mapSeedInput = document.getElementById('map-seed-input');
const mapComplexitySelect = document.getElementById('map-complexity-select');

function createEmptyUnitGrid(colsVal, rowsVal) {
  return Array.from({ length: rowsVal }, () => new Array(colsVal).fill(null));
}

function refreshAutoTileMasks() {
  gameMap.setAutoTileMasks(gameMap.createEmptyAutoTileMasks(gameMap.cols, gameMap.rows));
  gameMap.bakeAutoTileMasks();
}

function setTerrainIfValid(grid, x, y, terrain) {
  if (x < 0 || y < 0 || y >= grid.length || x >= grid[y].length) return;
  grid[y][x] = terrain;
}

function hashSeed(seedText) {
  let hash = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    hash ^= seedText.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seedText) {
  let state = hashSeed(seedText) || 0x9e3779b9;
  return function random() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(random, min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function makeGeneratedSeed() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let seed = '';
  for (let i = 0; i < 8; i++) {
    seed += chars[Math.floor(Math.random() * chars.length)];
  }
  return seed;
}

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}

function createValueNoise(random, colsVal, rowsVal, cellSize) {
  const gridCols = Math.ceil(colsVal / cellSize) + 3;
  const gridRows = Math.ceil(rowsVal / cellSize) + 3;
  const values = Array.from({ length: gridRows }, () => (
    Array.from({ length: gridCols }, () => random())
  ));

  return function noise(x, y) {
    const gx = x / cellSize;
    const gy = y / cellSize;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const tx = smoothstep(gx - x0);
    const ty = smoothstep(gy - y0);
    const a = values[y0]?.[x0] ?? 0;
    const b = values[y0]?.[x0 + 1] ?? a;
    const c = values[y0 + 1]?.[x0] ?? a;
    const d = values[y0 + 1]?.[x0 + 1] ?? c;
    const top = a + (b - a) * tx;
    const bottom = c + (d - c) * tx;
    return top + (bottom - top) * ty;
  };
}

function createFractalNoise(random, colsVal, rowsVal) {
  const large = createValueNoise(random, colsVal, rowsVal, Math.max(5, Math.floor(Math.min(colsVal, rowsVal) / 3)));
  const medium = createValueNoise(random, colsVal, rowsVal, Math.max(3, Math.floor(Math.min(colsVal, rowsVal) / 5)));
  const small = createValueNoise(random, colsVal, rowsVal, 3);
  return (x, y) => large(x, y) * 0.55 + medium(x, y) * 0.3 + small(x, y) * 0.15;
}

function getGenerationProfile(kind) {
  const profiles = {
    balanced: { water: 0.28, mountain: 0.78, forest: 0.54, cityScale: 62, roadWiggle: 0.45 },
    wild: { water: 0.34, mountain: 0.70, forest: 0.48, cityScale: 54, roadWiggle: 0.72 },
    islands: { water: 0.42, mountain: 0.82, forest: 0.5, cityScale: 66, roadWiggle: 0.58 },
    highlands: { water: 0.23, mountain: 0.64, forest: 0.5, cityScale: 58, roadWiggle: 0.55 }
  };
  return profiles[kind] || profiles.balanced;
}

function isProtectedTerrain(terrain) {
  return terrain === GameMap.TERRAIN.HQ_P1 ||
    terrain === GameMap.TERRAIN.HQ_P2 ||
    terrain === GameMap.TERRAIN.FACTORY_P1 ||
    terrain === GameMap.TERRAIN.FACTORY_P2 ||
    terrain === GameMap.TERRAIN.AIRPORT_P1 ||
    terrain === GameMap.TERRAIN.AIRPORT_P2;
}

function getWalkableTerrain(grid, x, y) {
  const terrain = grid[y]?.[x];
  return terrain !== undefined &&
    terrain !== GameMap.TERRAIN.WATER &&
    terrain !== GameMap.TERRAIN.MOUNTAIN;
}

function carveRoad(grid, fromX, fromY, toX, toY, random, wiggle = 0.35) {
  let x = fromX;
  let y = fromY;
  let guard = grid.length * grid[0].length * 2;
  while ((x !== toX || y !== toY) && guard > 0) {
    guard--;
    if (!isProtectedTerrain(grid[y]?.[x])) {
      setTerrainIfValid(grid, x, y, GameMap.TERRAIN.ROAD);
    }
    const moveHorizontal = x !== toX && (y === toY || random() > 0.5 - wiggle * 0.25);
    if (moveHorizontal) {
      x += x < toX ? 1 : -1;
    } else if (y !== toY) {
      y += y < toY ? 1 : -1;
    }
    if (random() < wiggle && x > 1 && y > 1 && x < grid[0].length - 2 && y < grid.length - 2) {
      if (random() < 0.5) x += random() < 0.5 ? -1 : 1;
      else y += random() < 0.5 ? -1 : 1;
    }
  }
  if (!isProtectedTerrain(grid[y]?.[x])) {
    setTerrainIfValid(grid, x, y, GameMap.TERRAIN.ROAD);
  }
}

function sprinkleTerrain(grid, terrain, chance, random, passes = 1) {
  const rowsVal = grid.length;
  const colsVal = rowsVal > 0 ? grid[0].length : 0;
  for (let pass = 0; pass < passes; pass++) {
    for (let y = 1; y < rowsVal - 1; y++) {
      for (let x = 1; x < colsVal - 1; x++) {
        if (grid[y][x] === GameMap.TERRAIN.PLAINS && random() < chance) {
          grid[y][x] = terrain;
        }
      }
    }
  }
}

function addLake(grid, centerX, centerY, radiusX, radiusY, random) {
  for (let y = centerY - radiusY; y <= centerY + radiusY; y++) {
    for (let x = centerX - radiusX; x <= centerX + radiusX; x++) {
      const dx = (x - centerX) / Math.max(1, radiusX);
      const dy = (y - centerY) / Math.max(1, radiusY);
      if (dx * dx + dy * dy <= 1 + random() * 0.35) {
        setTerrainIfValid(grid, x, y, GameMap.TERRAIN.WATER);
      }
    }
  }
}

function addRiver(grid, startX, startY, endX, endY, random) {
  let x = startX;
  let y = startY;
  let guard = grid.length * grid[0].length;
  while ((x !== endX || y !== endY) && guard > 0) {
    guard--;
    if (!isProtectedTerrain(grid[y]?.[x])) {
      setTerrainIfValid(grid, x, y, GameMap.TERRAIN.RIVER_H);
    }
    if (random() < 0.42) {
      x += x < endX ? 1 : x > endX ? -1 : 0;
    } else {
      y += y < endY ? 1 : y > endY ? -1 : 0;
    }
    if (random() < 0.22 && x > 1 && y > 1 && x < grid[0].length - 2 && y < grid.length - 2) {
      if (random() < 0.5) x += random() < 0.5 ? -1 : 1;
      else y += random() < 0.5 ? -1 : 1;
    }
  }
}

function addMirroredTerrain(grid, x, y, terrain) {
  const colsVal = grid[0].length;
  setTerrainIfValid(grid, x, y, terrain);
  setTerrainIfValid(grid, colsVal - 1 - x, y, terrain);
}

function canPlaceNeutralPair(grid, x, y) {
  const mirrorX = grid[0].length - 1 - x;
  return (
    grid[y]?.[x] === GameMap.TERRAIN.PLAINS &&
    grid[y]?.[mirrorX] === GameMap.TERRAIN.PLAINS
  );
}

function clearArea(grid, centerX, centerY, radius = 1) {
  for (let y = centerY - radius; y <= centerY + radius; y++) {
    for (let x = centerX - radius; x <= centerX + radius; x++) {
      setTerrainIfValid(grid, x, y, GameMap.TERRAIN.PLAINS);
    }
  }
}

function chooseBasePosition(colsVal, rowsVal, random) {
  return {
    x: Math.max(2, Math.floor(colsVal * (0.14 + random() * 0.08))),
    y: Math.max(2, Math.min(rowsVal - 3, Math.floor(rowsVal * (0.35 + random() * 0.3))))
  };
}

function generateRandomMap() {
  const colsVal = gameMap.cols;
  const rowsVal = gameMap.rows;
  const seed = (mapSeedInput?.value || '').trim() || makeGeneratedSeed();
  if (mapSeedInput) mapSeedInput.value = seed;
  const random = createSeededRandom(`${seed}:${colsVal}x${rowsVal}`);
  const complexityKind = mapComplexitySelect?.value || 'balanced';
  const profile = getGenerationProfile(complexityKind);
  const grid = Array.from({ length: rowsVal }, () => new Array(colsVal).fill(GameMap.TERRAIN.PLAINS));
  const centerX = Math.floor(colsVal / 2);
  const centerY = Math.floor(rowsVal / 2);
  const heightNoise = createFractalNoise(random, colsVal, rowsVal);
  const moistureNoise = createFractalNoise(random, colsVal, rowsVal);
  const featureNoise = createFractalNoise(random, colsVal, rowsVal);
  const p1Base = chooseBasePosition(colsVal, rowsVal, random);
  const p2Base = { x: colsVal - 1 - p1Base.x, y: p1Base.y };

  for (let y = 0; y < rowsVal; y++) {
    for (let x = 0; x < colsVal; x++) {
      const edgeDistance = Math.min(x, y, colsVal - 1 - x, rowsVal - 1 - y);
      const edgeWaterBias = edgeDistance < 2 ? 0.12 : 0;
      const mirroredX = x < centerX ? x : colsVal - 1 - x;
      const height = heightNoise(mirroredX, y);
      const moisture = moistureNoise(mirroredX, y);
      const feature = featureNoise(mirroredX, y);
      if (height < profile.water + edgeWaterBias || (complexityKind === 'islands' && edgeDistance < 3 && moisture < 0.55)) {
        grid[y][x] = GameMap.TERRAIN.WATER;
      } else if (height > profile.mountain || feature > 0.84) {
        grid[y][x] = GameMap.TERRAIN.MOUNTAIN;
      } else if (moisture > profile.forest || feature > 0.68) {
        grid[y][x] = GameMap.TERRAIN.FOREST;
      }
    }
  }

  clearArea(grid, p1Base.x, p1Base.y, 2);
  clearArea(grid, p2Base.x, p2Base.y, 2);
  clearArea(grid, centerX, centerY, 1);

  const lakeCount = Math.max(1, Math.floor((colsVal * rowsVal) / (profile.water > 0.35 ? 150 : 220)));
  for (let i = 0; i < lakeCount; i++) {
    const lakeX = randomInt(random, Math.max(2, Math.floor(colsVal * 0.18)), Math.max(2, Math.floor(colsVal * 0.82)));
    const lakeY = randomInt(random, 2, Math.max(2, rowsVal - 3));
    addLake(grid, lakeX, lakeY, randomInt(random, 1, 4), randomInt(random, 1, 3), random);
  }

  const riverCount = rowsVal > 12 && colsVal > 14 ? randomInt(random, 1, profile.water > 0.35 ? 3 : 2) : 0;
  for (let i = 0; i < riverCount; i++) {
    addRiver(
      grid,
      randomInt(random, 2, colsVal - 3),
      1,
      randomInt(random, 2, colsVal - 3),
      rowsVal - 2,
      random
    );
  }

  sprinkleTerrain(grid, GameMap.TERRAIN.FOREST, 0.035, random, 1);
  if (complexityKind === 'highlands') {
    sprinkleTerrain(grid, GameMap.TERRAIN.MOUNTAIN, 0.025, random, 1);
  }

  carveRoad(grid, p1Base.x, p1Base.y, centerX, centerY, random, profile.roadWiggle);
  carveRoad(grid, centerX, centerY, p2Base.x, p2Base.y, random, profile.roadWiggle);
  const branchCount = randomInt(random, 2, Math.max(2, Math.floor(colsVal / 8)));
  for (let i = 0; i < branchCount; i++) {
    const branchY = randomInt(random, 2, rowsVal - 3);
    carveRoad(grid, centerX, centerY, randomInt(random, 2, colsVal - 3), branchY, random, profile.roadWiggle * 0.75);
  }

  setTerrainIfValid(grid, p1Base.x, p1Base.y, GameMap.TERRAIN.HQ_P1);
  setTerrainIfValid(grid, p2Base.x, p2Base.y, GameMap.TERRAIN.HQ_P2);
  setTerrainIfValid(grid, p1Base.x + 1, p1Base.y, GameMap.TERRAIN.FACTORY_P1);
  setTerrainIfValid(grid, p2Base.x - 1, p2Base.y, GameMap.TERRAIN.FACTORY_P2);
  setTerrainIfValid(grid, p1Base.x, p1Base.y - 1, GameMap.TERRAIN.CITY_P1);
  setTerrainIfValid(grid, p2Base.x, p2Base.y - 1, GameMap.TERRAIN.CITY_P2);
  setTerrainIfValid(grid, p1Base.x, p1Base.y + 1, GameMap.TERRAIN.AIRPORT_P1);
  setTerrainIfValid(grid, p2Base.x, p2Base.y + 1, GameMap.TERRAIN.AIRPORT_P2);

  const neutralCount = Math.max(4, Math.floor((colsVal * rowsVal) / profile.cityScale));
  let placedNeutral = 0;
  let attempts = 0;
  while (placedNeutral < neutralCount && attempts < neutralCount * 12) {
    attempts++;
    const x = randomInt(random, 1, Math.max(1, Math.floor(colsVal / 2) - 2));
    const y = randomInt(random, 1, rowsVal - 2);
    if (!canPlaceNeutralPair(grid, x, y)) continue;
    const nearRoad = [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => grid[y + dy]?.[x + dx] === GameMap.TERRAIN.ROAD);
    if (!nearRoad && random() < 0.55) continue;
    const roll = random();
    const terrain = roll < 0.65 ? GameMap.TERRAIN.CITY_NEUTRAL : roll < 0.9 ? GameMap.TERRAIN.FACTORY_NEUTRAL : GameMap.TERRAIN.AIRPORT_NEUTRAL;
    addMirroredTerrain(grid, x, y, terrain);
    placedNeutral++;
  }

  if (rowsVal > 10 && colsVal > 14 && random() < 0.6) {
    const portY = randomInt(random, 2, rowsVal - 3);
    const p1PortX = Math.max(1, p1Base.x - 2);
    const p2PortX = colsVal - 1 - p1PortX;
    setTerrainIfValid(grid, p1PortX, portY, GameMap.TERRAIN.PORT_P1);
    setTerrainIfValid(grid, p2PortX, portY, GameMap.TERRAIN.PORT_P2);
    setTerrainIfValid(grid, p1PortX - 1, portY, GameMap.TERRAIN.WATER);
    setTerrainIfValid(grid, p2PortX + 1, portY, GameMap.TERRAIN.WATER);
  }

  gameMap.grid = grid;
  unitGrid = createEmptyUnitGrid(colsVal, rowsVal);
  bridgeGrid = createEmptyUnitGrid(colsVal, rowsVal);
  refreshAutoTileMasks();
  drawMap();
}

if (generateMapBtn) {
  generateMapBtn.addEventListener('click', () => {
    if (!confirm('現在のマップを上書きして自動生成しますか？')) return;
    generateRandomMap();
  });
}
// -------------------------------------------------------------------
// Play button – start the game with the current map
// -------------------------------------------------------------------
const playBtn = document.getElementById('play-btn');
if (playBtn) {
  playBtn.addEventListener('click', () => {
    const mapData = {
      cols: gameMap.cols,
      rows: gameMap.rows,
      grid: gameMap.grid,
      autoTileMasks: gameMap.autoTileMasks,
      unitGrid: unitGrid
    };
    try {
      localStorage.setItem('custom_scenario', JSON.stringify(mapData));
      localStorage.setItem('famicomMap', JSON.stringify(mapData));
    } catch (e) {
      console.warn('Failed to store map in localStorage', e);
    }
    window.location.href = 'index.html';
  });
}
// -------------------------------------------------------------------
// Clear button
// -------------------------------------------------------------------
const clearBtn = document.getElementById('clear-btn');
if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    if (confirm('マップを全消去しますか？')) {
      for (let y = 0; y < gameMap.rows; y++) {
        for (let x = 0; x < gameMap.cols; x++) {
          gameMap.grid[y][x] = GameMap.TERRAIN.PLAINS;
          gameMap.clearAutoTileMasksAt(x, y);
          unitGrid[y][x] = null;
          bridgeGrid[y][x] = null;
        }
      }
      drawMap();
    }
  });
}

// -------------------------------------------------------------------
// Bundle maps button – re-generate bundled_maps.js from maps/ folder
// -------------------------------------------------------------------
const bundleMapsBtn = document.getElementById('bundle-maps-btn');
if (bundleMapsBtn) {
  bundleMapsBtn.addEventListener('click', async () => {
    const originalText = bundleMapsBtn.textContent;
    bundleMapsBtn.textContent = '更新中…';
    bundleMapsBtn.disabled = true;
    try {
      const res = await fetch('/api/bundle-maps', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        bundleMapsBtn.textContent = `✔ ${data.count}件 更新完了`;
        if (data.errors && data.errors.length > 0) {
          console.warn('Bundle map errors:', data.errors);
        }
      } else {
        bundleMapsBtn.textContent = '✖ 更新失敗';
        console.error('Bundle failed:', data.error);
      }
    } catch (err) {
      bundleMapsBtn.textContent = '✖ 通信エラー';
      console.error('Bundle request failed:', err);
    }
    setTimeout(() => {
      bundleMapsBtn.textContent = originalText;
      bundleMapsBtn.disabled = false;
    }, 2000);
  });
}

  // Canvas click handling for placing tiles/units with drag support
let isDrawing = false;
let lastPaintedTile = { x: null, y: null };

function placeTile(e) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / (tileSize * scale));
  const y = Math.floor((e.clientY - rect.top) / (tileSize * scale));
  if (x < 0 || x >= gameMap.cols || y < 0 || y >= gameMap.rows) return;
  
  if (lastPaintedTile.x === x && lastPaintedTile.y === y) return; // Prevent rapid toggling on the same tile during drag
  lastPaintedTile = { x, y };

  if (currentBrush.type === 'terrain') {
        const terrainConst = GameMap.TERRAIN[currentBrush.value];
        // Bridge toggle handling
        if (currentBrush.value === 'BRIDGE_H') {
            bridgeGrid[y][x] = null;
            if (gameMap.grid[y][x] === GameMap.TERRAIN.BRIDGE_H) {
                gameMap.grid[y][x] = GameMap.TERRAIN.BRIDGE_V;
            } else if (gameMap.grid[y][x] === GameMap.TERRAIN.BRIDGE_V) {
                gameMap.grid[y][x] = GameMap.TERRAIN.BRIDGE_H;
            } else {
                gameMap.grid[y][x] = GameMap.TERRAIN.BRIDGE_H;
            }
            gameMap.clearAutoTileMasksAt(x, y);
        // River handling: both river brushes place an auto-tiling river tile.
        } else if (currentBrush.value === 'RIVER_H' || currentBrush.value === 'RIVER_V') {
            bridgeGrid[y][x] = null;
            gameMap.grid[y][x] = GameMap.TERRAIN.RIVER_H;
            gameMap.setAutoTileMask('river', x, y, gameMap.getRiverBitmask(x, y));
        } else if (currentBrush.value === 'ROAD') {
            bridgeGrid[y][x] = null;
            gameMap.grid[y][x] = GameMap.TERRAIN.ROAD;
            gameMap.setAutoTileMask('road', x, y, gameMap.getRoadBitmask(x, y));
        } else if (currentBrush.value === 'WATER') {
            bridgeGrid[y][x] = null;
            gameMap.grid[y][x] = GameMap.TERRAIN.WATER;
            gameMap.setAutoTileMask('water', x, y, gameMap.getWaterBitmask(x, y));
        } else {
            if (terrainConst !== undefined) {
                gameMap.grid[y][x] = terrainConst;
                gameMap.clearAutoTileMasksAt(x, y);
                bridgeGrid[y][x] = null; // Clear bridge when placing other terrain
            }
        }
    } else if (currentBrush.type === 'unit') {
        unitGrid[y][x] = { type: currentBrush.value, owner: currentBrush.owner };
    } else if (currentBrush.type === 'tool' && currentBrush.value === 'ERASER') {
        gameMap.grid[y][x] = GameMap.TERRAIN.PLAINS;
        gameMap.clearAutoTileMasksAt(x, y);
        unitGrid[y][x] = null;
        bridgeGrid[y][x] = null;
    }
  drawMap();
}

// Drag scrolling (right‑click) and WASD navigation
let isDraggingMap = false;
let startDragX = 0;
let startDragY = 0;
let startScrollLeft = 0;
let startScrollTop = 0;
const canvasWrapper = document.getElementById('canvas-wrapper'); // global reference
if (canvasWrapper) {
  // Make wrapper focusable for keyboard events
  canvasWrapper.tabIndex = -1;
  canvasWrapper.focus();
}

canvas.addEventListener('contextmenu', e => e.preventDefault()); // suppress context menu

// Canvas drag handling (right‑click OR left-click with PAN tool)
canvas.addEventListener('mousedown', e => {
  if (e.button === 2 || (e.button === 0 && currentBrush.type === 'tool' && currentBrush.value === 'PAN')) {
      e.preventDefault();
      isDraggingMap = true;
      startDragX = e.clientX;
      startDragY = e.clientY;
      startScrollLeft = canvasWrapper.scrollLeft;
      startScrollTop = canvasWrapper.scrollTop;
      canvas.style.cursor = 'grabbing';
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
  }
});

function handleDragMove(e) {
  if (!isDraggingMap) return;
  const dx = e.clientX - startDragX;
  const dy = e.clientY - startDragY;
  const factor = scale; // movement proportional to zoom
  const targetX = startScrollLeft - dx * factor;
  const targetY = startScrollTop - dy * factor;
  const maxX = canvasWrapper.scrollWidth - canvasWrapper.clientWidth;
  const maxY = canvasWrapper.scrollHeight - canvasWrapper.clientHeight;
  canvasWrapper.scrollLeft = Math.max(0, Math.min(maxX, Math.round(targetX)));
  canvasWrapper.scrollTop = Math.max(0, Math.min(maxY, Math.round(targetY)));
}

function handleDragEnd(e) {
  isDraggingMap = false;
  canvas.style.cursor = 'crosshair';
  window.removeEventListener('mousemove', handleDragMove);
  window.removeEventListener('mouseup', handleDragEnd);
}

// Left‑button painting
canvas.addEventListener('mousedown', e => {
  if (e.button !== 0) return; // left button → painting
  if (currentBrush.type === 'tool' && currentBrush.value === 'PAN') return; // Handled by drag logic
  isDrawing = true;
  lastPaintedTile = { x: null, y: null };
  placeTile(e);
});

canvas.addEventListener('mousemove', e => {
  if (isDrawing) placeTile(e);
});

canvas.addEventListener('mouseup', e => {
  if (e.button === 0) isDrawing = false;
});

canvas.addEventListener('mouseleave', () => {
  isDrawing = false;
});

function touchToMouseEvent(touch) {
  return {
    button: 0,
    clientX: touch.clientX,
    clientY: touch.clientY,
    preventDefault() {}
  };
}

let activeTouchId = null;
let touchesMap = new Map();
let initialPinchDistance = null;
let initialPinchScale = null;

function getActiveTouch(touches) {
  for (const touch of touches) {
    if (touch.identifier === activeTouchId) return touch;
  }
  return null;
}

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  for (let i = 0; i < e.changedTouches.length; i++) {
    touchesMap.set(e.changedTouches[i].identifier, e.changedTouches[i]);
  }

  if (touchesMap.size === 2) {
    if (activeTouchId !== null) {
      isDrawing = false;
      isDraggingMap = false;
      canvas.style.cursor = 'crosshair';
      activeTouchId = null;
    }
    let tArray = Array.from(touchesMap.values());
    initialPinchDistance = Math.hypot(tArray[0].clientX - tArray[1].clientX, tArray[0].clientY - tArray[1].clientY);
    initialPinchScale = scale;
  } else if (touchesMap.size === 1) {
    const touch = e.changedTouches[0];
    activeTouchId = touch.identifier;

    if (currentBrush.type === 'tool' && currentBrush.value === 'PAN') {
        isDraggingMap = true;
        startDragX = touch.clientX;
        startDragY = touch.clientY;
        startScrollLeft = canvasWrapper.scrollLeft;
        startScrollTop = canvasWrapper.scrollTop;
        canvas.style.cursor = 'grabbing';
        return;
    }

    isDrawing = true;
    lastPaintedTile = { x: null, y: null };
    placeTile(touchToMouseEvent(touch));
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  for (let i = 0; i < e.changedTouches.length; i++) {
    if (touchesMap.has(e.changedTouches[i].identifier)) {
      touchesMap.set(e.changedTouches[i].identifier, e.changedTouches[i]);
    }
  }

  if (touchesMap.size === 2 && initialPinchDistance) {
    let tArray = Array.from(touchesMap.values());
    let currentDistance = Math.hypot(tArray[0].clientX - tArray[1].clientX, tArray[0].clientY - tArray[1].clientY);
    let zoomDelta = currentDistance / initialPinchDistance;
    let newScale = initialPinchScale * zoomDelta;
    updateZoom(newScale);
    return;
  }

  if (activeTouchId !== null) {
    const touch = getActiveTouch(e.changedTouches);
    if (!touch) return;

    if (isDraggingMap) {
        const dx = touch.clientX - startDragX;
        const dy = touch.clientY - startDragY;
        const factor = scale;
        const targetX = startScrollLeft - dx * factor;
        const targetY = startScrollTop - dy * factor;
        const maxX = canvasWrapper.scrollWidth - canvasWrapper.clientWidth;
        const maxY = canvasWrapper.scrollHeight - canvasWrapper.clientHeight;
        canvasWrapper.scrollLeft = Math.max(0, Math.min(maxX, Math.round(targetX)));
        canvasWrapper.scrollTop = Math.max(0, Math.min(maxY, Math.round(targetY)));
        return;
    }

    if (isDrawing) {
        placeTile(touchToMouseEvent(touch));
    }
  }
}, { passive: false });

const handleTouchEnd = e => {
  e.preventDefault();
  let activeTouchEnded = false;
  for (let i = 0; i < e.changedTouches.length; i++) {
    if (e.changedTouches[i].identifier === activeTouchId) {
      activeTouchEnded = true;
    }
    touchesMap.delete(e.changedTouches[i].identifier);
  }

  if (touchesMap.size < 2) {
    initialPinchDistance = null;
  }

  if (activeTouchEnded) {
    isDrawing = false;
    isDraggingMap = false;
    canvas.style.cursor = 'crosshair';
    activeTouchId = null;
  }
};
canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

window.addEventListener('keydown', e => {
  const scrollSpeed = 20;
  switch (e.key.toLowerCase()) {
    case 'w': canvasWrapper.scrollTop -= scrollSpeed; break;
    case 'a': canvasWrapper.scrollLeft -= scrollSpeed; break;
    case 's': canvasWrapper.scrollTop += scrollSpeed; break;
    case 'd': canvasWrapper.scrollLeft += scrollSpeed; break;
  }
});

  const zoomInBtn = document.getElementById('zoom-in-btn');
  const zoomOutBtn = document.getElementById('zoom-out-btn');
  const updateZoom = (newScale) => {
    if (canvasWrapper) {
      const margin = 400;
      const centerX = canvasWrapper.scrollLeft + canvasWrapper.clientWidth / 2 - margin;
      const centerY = canvasWrapper.scrollTop + canvasWrapper.clientHeight / 2 - margin;
      const oldScale = scale;
      scale = Math.max(MIN_SCALE, Math.min(newScale, MAX_SCALE));
      const scaleRatio = scale / oldScale;
      
      canvas.width = gameMap.cols * tileSize * scale;
      canvas.height = gameMap.rows * tileSize * scale;
      canvas.style.width = `${canvas.width}px`;
      canvas.style.height = `${canvas.height}px`;
      drawMap();
      
      canvasWrapper.scrollLeft = margin + centerX * scaleRatio - canvasWrapper.clientWidth / 2;
      canvasWrapper.scrollTop = margin + centerY * scaleRatio - canvasWrapper.clientHeight / 2;
    } else {
      scale = Math.max(MIN_SCALE, Math.min(newScale, MAX_SCALE));
      canvas.width = gameMap.cols * tileSize * scale;
      canvas.height = gameMap.rows * tileSize * scale;
      canvas.style.width = `${canvas.width}px`;
      canvas.style.height = `${canvas.height}px`;
      drawMap();
    }
  };
  
  if (zoomInBtn) zoomInBtn.addEventListener('click', () => updateZoom(scale + 0.2));
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => updateZoom(scale - 0.2));

  canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const delta = e.deltaY;
  const step = 0.1;
  updateZoom(delta < 0 ? scale + step : scale - step);
});
  function drawMap() {
  const drawTileSize = tileSize * scale;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < gameMap.rows; y++) {
    for (let x = 0; x < gameMap.cols; x++) {
      const terrain = gameMap.grid[y][x];
      const px = x * drawTileSize;
      const py = y * drawTileSize;
      // DEBUG: draw road_h.png at (0,0) to verify asset loading
      if (x === 0 && y === 0) {
        const testImg = assets.getRoadImage(0);
        if (testImg) {
          ctx.drawImage(testImg, px, py, drawTileSize, drawTileSize);
        }
      }

      if (terrain === GameMap.TERRAIN.ROAD) {
        const mask = gameMap.getRoadRenderMask(x, y);
        const roadImg = assets.getRoadImage(mask);
        console.debug(`Drawing road at (${x},${y}) mask=${mask}`);
        ctx.fillStyle = 'rgba(255,0,0,0.3)';
        ctx.fillRect(px, py, drawTileSize, drawTileSize);
        if (roadImg) {
          ctx.drawImage(roadImg, px, py, drawTileSize, drawTileSize);
        } else {
          ctx.fillStyle = '#888';
          ctx.fillRect(px, py, drawTileSize, drawTileSize);
        }
      } else if (terrain === GameMap.TERRAIN.WATER) {
        const mask = gameMap.getWaterRenderMask(x, y);
        const waterImg = assets.getWaterImage(mask);
        if (waterImg) {
            ctx.drawImage(waterImg, px, py, drawTileSize, drawTileSize);
        } else {
            ctx.fillStyle = '#1e90ff';
            ctx.fillRect(px, py, drawTileSize, drawTileSize);
        }
      } else if (gameMap.isRiver(terrain)) {
        const mask = gameMap.getRiverRenderMask(x, y);
        const riverImg = assets.getRiverImage(mask);
        if (riverImg) {
            ctx.drawImage(riverImg, px, py, drawTileSize, drawTileSize);
        } else {
            ctx.fillStyle = '#0044ff';
            ctx.fillRect(px, py, drawTileSize, drawTileSize);
        }
      } else {
        const img = assets.getImage(terrain);
        if (img) {
            ctx.drawImage(img, px, py, drawTileSize, drawTileSize);
        } else {
            ctx.fillStyle = '#7cfc00';
            ctx.fillRect(px, py, drawTileSize, drawTileSize);
        }
      }
      
      // Bridge rendering (no auto-tiling, uses bridgeGrid)
      if (bridgeGrid[y][x]) {
          const bridgeImg = assets.getImage(bridgeGrid[y][x]);
          if (bridgeImg) {
              ctx.drawImage(bridgeImg, px, py, drawTileSize, drawTileSize);
          } else {
              ctx.fillStyle = '#5555ff';
              ctx.fillRect(px, py, drawTileSize, drawTileSize);
          }
      } else if (terrain === GameMap.TERRAIN.BRIDGE_H || terrain === GameMap.TERRAIN.BRIDGE_V) {
          const bridgeImg = assets.getImage(terrain);
          if (bridgeImg) {
              ctx.drawImage(bridgeImg, px, py, drawTileSize, drawTileSize);
          } else {
              ctx.fillStyle = '#5555ff';
              ctx.fillRect(px, py, drawTileSize, drawTileSize);
          }
      }
      const unit = unitGrid[y][x];
      if (unit) {
        const unitImg = assets.getUnitImage(unit.type, unit.owner);
        if (unitImg) {
          ctx.drawImage(unitImg, px, py, drawTileSize, drawTileSize);
        }
      }
    }
  }
}

  // Initial render
  drawMap();
  // Center the view on the map after initial load
  if (canvasWrapper) {
    canvasWrapper.scrollLeft = 400 + (canvas.width - canvasWrapper.clientWidth) / 2;
    canvasWrapper.scrollTop = 400 + (canvas.height - canvasWrapper.clientHeight) / 2;
  }
  // Ensure CSS matches intrinsic canvas size for scrolling
  canvas.style.width = `${canvas.width}px`;
  canvas.style.height = `${canvas.height}px`;

});
