class GameMap {
    constructor(cols, rows, tileSize) {
        this.cols = cols;
        this.rows = rows;
        this.tileSize = tileSize;
        this.grid = [];
        this.autoTileMasks = this.createEmptyAutoTileMasks(cols, rows);
        this.initGrid();
    }

    // Terrain types enum
    static TERRAIN = {
        PLAINS: 0,
        FOREST: 1,
        MOUNTAIN: 2,
        WATER: 3,
        SHALLOW_WATER: 15,
        ROAD: 4,
        CITY_NEUTRAL: 5,
        CITY_P1: 6,
        CITY_P2: 7,
        HQ_P1: 23,
        HQ_P2: 24,
        FACTORY_NEUTRAL: 8,
        FACTORY_P1: 9,
        FACTORY_P2: 10,
        PORT_NEUTRAL: 11,
        PORT_P1: 12,
        PORT_P2: 13,
        BRIDGE_H: 16,
        BRIDGE_V: 17,
        AIRPORT_NEUTRAL: 18,
        AIRPORT_P1: 19,
        AIRPORT_P2: 20,
        RIVER_H: 21,
        RIVER_V: 22
    };

    // Movement costs for terrain by move type (Infinity means impassable)
    static MOVEMENT_COSTS = {
        [GameMap.TERRAIN.PLAINS]: { 'FOOT': 1, 'TREAD': 1, 'TIRE': 1, 'AIR': 1, 'SEA': Infinity, 'HOVER': 3 },
        [GameMap.TERRAIN.FOREST]: { 'FOOT': 1, 'TREAD': 2, 'TIRE': 3, 'AIR': 1, 'SEA': Infinity, 'HOVER': 3 },
        [GameMap.TERRAIN.MOUNTAIN]: { 'FOOT': 2, 'TREAD': Infinity, 'TIRE': Infinity, 'AIR': 1, 'SEA': Infinity, 'HOVER': 3 },
        [GameMap.TERRAIN.WATER]: { 'FOOT': Infinity, 'TREAD': Infinity, 'TIRE': Infinity, 'AIR': 1, 'SEA': 1, 'HOVER': 1 },
        [GameMap.TERRAIN.SHALLOW_WATER]: { 'FOOT': 0, 'TREAD': 0, 'TIRE': 0, 'AIR': 1, 'SEA': Infinity, 'HOVER': 1 },
        [GameMap.TERRAIN.ROAD]: { 'FOOT': 1, 'TREAD': 1, 'TIRE': 1, 'AIR': 1, 'SEA': Infinity, 'HOVER': 3 },
        [GameMap.TERRAIN.CITY_NEUTRAL]: { 'FOOT': 1, 'TREAD': 1, 'TIRE': 1, 'AIR': 1, 'SEA': Infinity, 'HOVER': 3 },
        [GameMap.TERRAIN.CITY_P1]: { 'FOOT': 1, 'TREAD': 1, 'TIRE': 1, 'AIR': 1, 'SEA': Infinity, 'HOVER': 3 },
        [GameMap.TERRAIN.CITY_P2]: { 'FOOT': 1, 'TREAD': 1, 'TIRE': 1, 'AIR': 1, 'SEA': Infinity, 'HOVER': 3 },
        [GameMap.TERRAIN.HQ_P1]: { 'FOOT': 1, 'TREAD': 1, 'TIRE': 1, 'AIR': 1, 'SEA': Infinity, 'HOVER': 3 },
        [GameMap.TERRAIN.HQ_P2]: { 'FOOT': 1, 'TREAD': 1, 'TIRE': 1, 'AIR': 1, 'SEA': Infinity, 'HOVER': 3 },
        [GameMap.TERRAIN.FACTORY_NEUTRAL]: { 'FOOT': 1, 'TREAD': 1, 'TIRE': 1, 'AIR': 1, 'SEA': Infinity, 'HOVER': 3 },
        [GameMap.TERRAIN.FACTORY_P1]: { 'FOOT': 1, 'TREAD': 1, 'TIRE': 1, 'AIR': 1, 'SEA': Infinity, 'HOVER': 3 },
        [GameMap.TERRAIN.FACTORY_P2]: { 'FOOT': 1, 'TREAD': 1, 'TIRE': 1, 'AIR': 1, 'SEA': Infinity, 'HOVER': 3 },
        [GameMap.TERRAIN.BRIDGE_H]: { 'FOOT': 1, 'TREAD': 1, 'TIRE': 1, 'AIR': 1, 'SEA': Infinity, 'HOVER': 3 },
        [GameMap.TERRAIN.BRIDGE_V]: { 'FOOT': 1, 'TREAD': 1, 'TIRE': 1, 'AIR': 1, 'SEA': Infinity, 'HOVER': 3 },
        [GameMap.TERRAIN.PORT_NEUTRAL]: { 'FOOT': 1, 'TREAD': 1, 'TIRE': 1, 'AIR': 1, 'SEA': 1, 'HOVER': 3 },
        [GameMap.TERRAIN.PORT_P1]: { 'FOOT': 1, 'TREAD': 1, 'TIRE': 1, 'AIR': 1, 'SEA': 1, 'HOVER': 3 },
        [GameMap.TERRAIN.PORT_P2]: { 'FOOT': 1, 'TREAD': 1, 'TIRE': 1, 'AIR': 1, 'SEA': 1, 'HOVER': 3 },
        [GameMap.TERRAIN.AIRPORT_NEUTRAL]: { 'FOOT': 1, 'TREAD': 1, 'TIRE': 1, 'AIR': 1, 'SEA': Infinity, 'HOVER': 3 },
        [GameMap.TERRAIN.AIRPORT_P1]: { 'FOOT': 1, 'TREAD': 1, 'TIRE': 1, 'AIR': 1, 'SEA': Infinity, 'HOVER': 3 },
        [GameMap.TERRAIN.AIRPORT_P2]: { 'FOOT': 1, 'TREAD': 1, 'TIRE': 1, 'AIR': 1, 'SEA': Infinity, 'HOVER': 3 },
        [GameMap.TERRAIN.RIVER_H]: { 'FOOT': 2, 'TREAD': Infinity, 'TIRE': Infinity, 'AIR': 1, 'SEA': Infinity, 'HOVER': 1 },
        [GameMap.TERRAIN.RIVER_V]: { 'FOOT': 2, 'TREAD': Infinity, 'TIRE': Infinity, 'AIR': 1, 'SEA': Infinity, 'HOVER': 1 },
    };

    // Defense bonuses for terrain
    static DEFENSE_BONUS = {
        [GameMap.TERRAIN.PLAINS]: 0,
        [GameMap.TERRAIN.FOREST]: 1,
        [GameMap.TERRAIN.MOUNTAIN]: 2,
        [GameMap.TERRAIN.WATER]: 0,
        [GameMap.TERRAIN.ROAD]: 0,
        [GameMap.TERRAIN.CITY_NEUTRAL]: 2,
        [GameMap.TERRAIN.CITY_P1]: 2,
        [GameMap.TERRAIN.CITY_P2]: 2,
        [GameMap.TERRAIN.FACTORY_NEUTRAL]: 2,
        [GameMap.TERRAIN.FACTORY_P1]: 2,
        [GameMap.TERRAIN.FACTORY_P2]: 2,
        [GameMap.TERRAIN.HQ_P1]: 2,
        [GameMap.TERRAIN.HQ_P2]: 2,
        [GameMap.TERRAIN.PORT_NEUTRAL]: 2,
        [GameMap.TERRAIN.PORT_P1]: 2,
        [GameMap.TERRAIN.PORT_P2]: 2,
        [GameMap.TERRAIN.BRIDGE_H]: 2,
        [GameMap.TERRAIN.BRIDGE_V]: 2,
        [GameMap.TERRAIN.AIRPORT_NEUTRAL]: 2,
        [GameMap.TERRAIN.AIRPORT_P1]: 2,
        [GameMap.TERRAIN.AIRPORT_P2]: 2,
        [GameMap.TERRAIN.RIVER_H]: 2,
        [GameMap.TERRAIN.RIVER_V]: 2
    };

    initGrid() {
        // Simple map generation for now
        for (let y = 0; y < this.rows; y++) {
            let row = [];
            for (let x = 0; x < this.cols; x++) {
                // Default to plains
                let terrainType = GameMap.TERRAIN.PLAINS;

                // Add some basic terrain features randomly for prototype
                if (Math.random() < 0.1) terrainType = GameMap.TERRAIN.FOREST;
                else if (Math.random() < 0.05) terrainType = GameMap.TERRAIN.MOUNTAIN;
                else if (Math.random() < 0.07) terrainType = GameMap.TERRAIN.WATER; // Add water tiles
                else if (x === 5 || y === 5) terrainType = GameMap.TERRAIN.ROAD; // Cross road at center

                row.push(terrainType);
            }
            this.grid.push(row);
        }

        // Add random bridges over water tiles
        this.placeBridges();
        this.grid[1][1] = GameMap.TERRAIN.HQ_P1;
        this.grid[2][2] = GameMap.TERRAIN.FACTORY_P1;

        this.grid[this.rows - 2][this.cols - 2] = GameMap.TERRAIN.HQ_P2;
        this.grid[this.rows - 3][this.cols - 3] = GameMap.TERRAIN.FACTORY_P2;

        this.grid[4][4] = GameMap.TERRAIN.CITY_NEUTRAL;
        this.grid[10][15] = GameMap.TERRAIN.CITY_NEUTRAL;
        
        this.grid[7][8] = GameMap.TERRAIN.FACTORY_NEUTRAL;
        this.grid[7][11] = GameMap.TERRAIN.FACTORY_NEUTRAL;

        this.grid[3][3] = GameMap.TERRAIN.AIRPORT_P1;
        this.grid[this.rows - 4][this.cols - 4] = GameMap.TERRAIN.AIRPORT_P2;
        this.grid[5][10] = GameMap.TERRAIN.AIRPORT_NEUTRAL;
    }

    getTerrainAt(x, y) {
        if (this.isValidTile(x, y)) {
            return this.grid[y][x];
        }
        return null;
    }

    isValidTile(x, y) {
        return x >= 0 && x < this.cols && y >= 0 && y < this.rows;
    }

    getMovementCost(terrainType, moveType) {
        if (moveType === 'AIR' && terrainType !== null) {
            return 1;
        }
        const costs = GameMap.MOVEMENT_COSTS[terrainType];
        if (costs) {
            return costs[moveType] ?? Infinity;
        }
        return Infinity;
    }

    static isHQ(terrainType) {
        return terrainType === GameMap.TERRAIN.HQ_P1 || terrainType === GameMap.TERRAIN.HQ_P2;
    }

    static getCapturePointsRequired(terrainType) {
        return GameMap.isHQ(terrainType) ? 40 : 20;
    }

    isRiver(terrainType) {
        return terrainType === GameMap.TERRAIN.RIVER_H || terrainType === GameMap.TERRAIN.RIVER_V;
    }

    createEmptyMaskGrid(cols = this.cols, rows = this.rows) {
        return Array.from({ length: rows }, () => new Array(cols).fill(null));
    }

    createEmptyAutoTileMasks(cols = this.cols, rows = this.rows) {
        return {
            road: this.createEmptyMaskGrid(cols, rows),
            river: this.createEmptyMaskGrid(cols, rows),
            water: this.createEmptyMaskGrid(cols, rows)
        };
    }

    setAutoTileMasks(autoTileMasks) {
        this.autoTileMasks = this.createEmptyAutoTileMasks();
        if (!autoTileMasks) return;

        ['road', 'river', 'water'].forEach(kind => {
            if (!Array.isArray(autoTileMasks[kind])) return;
            for (let y = 0; y < this.rows; y++) {
                for (let x = 0; x < this.cols; x++) {
                    const mask = autoTileMasks[kind][y]?.[x];
                    this.autoTileMasks[kind][y][x] = Number.isInteger(mask) ? mask : null;
                }
            }
        });
    }

    bakeAutoTileMasks() {
        this.setAutoTileMasks(this.autoTileMasks);
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const terrain = this.grid[y][x];
                if (terrain === GameMap.TERRAIN.ROAD && this.autoTileMasks.road[y][x] === null) {
                    this.autoTileMasks.road[y][x] = this.getRoadBitmask(x, y);
                } else if (this.isRiver(terrain) && this.autoTileMasks.river[y][x] === null) {
                    this.autoTileMasks.river[y][x] = this.getRiverBitmask(x, y);
                } else if (terrain === GameMap.TERRAIN.WATER && this.autoTileMasks.water[y][x] === null) {
                    this.autoTileMasks.water[y][x] = this.getWaterBitmask(x, y);
                }
            }
        }
    }

    setAutoTileMask(kind, x, y, bitmask) {
        if (!this.isValidTile(x, y) || !this.autoTileMasks?.[kind]) return;
        this.autoTileMasks[kind][y][x] = bitmask;
    }

    clearAutoTileMasksAt(x, y) {
        if (!this.isValidTile(x, y) || !this.autoTileMasks) return;
        if (this.autoTileMasks.road) this.autoTileMasks.road[y][x] = null;
        if (this.autoTileMasks.river) this.autoTileMasks.river[y][x] = null;
        if (this.autoTileMasks.water) this.autoTileMasks.water[y][x] = null;
    }

    getDefenseBonus(terrainType) {
        return GameMap.DEFENSE_BONUS[terrainType] || 0;
    }

    getRoadBitmask(x, y) {
        let bitmask = 0;
        // North = 1, East = 2, South = 4, West = 8
        if (this.isValidTile(x, y - 1) && this.grid[y - 1][x] === GameMap.TERRAIN.ROAD) bitmask |= 1;
        if (this.isValidTile(x + 1, y) && this.grid[y][x + 1] === GameMap.TERRAIN.ROAD) bitmask |= 2;
        if (this.isValidTile(x, y + 1) && this.grid[y + 1][x] === GameMap.TERRAIN.ROAD) bitmask |= 4;
        if (this.isValidTile(x - 1, y) && this.grid[y][x - 1] === GameMap.TERRAIN.ROAD) bitmask |= 8;
        return bitmask;
    }

    getRoadRenderMask(x, y) {
        const mask = this.autoTileMasks?.road?.[y]?.[x];
        return Number.isInteger(mask) ? mask : this.getRoadBitmask(x, y);
    }

    isWater(terrainType) {
        return terrainType === GameMap.TERRAIN.WATER;
    }

    isLandForWaterAutotile(terrainType) {
        return terrainType !== null && terrainType !== GameMap.TERRAIN.WATER;
    }

    getWaterBitmask(x, y) {
        let bitmask = 0;
        // North = 1, East = 2, South = 4, West = 8
        if (this.isValidTile(x, y - 1) && this.isLandForWaterAutotile(this.grid[y - 1][x])) bitmask |= 1;
        if (this.isValidTile(x + 1, y) && this.isLandForWaterAutotile(this.grid[y][x + 1])) bitmask |= 2;
        if (this.isValidTile(x, y + 1) && this.isLandForWaterAutotile(this.grid[y + 1][x])) bitmask |= 4;
        if (this.isValidTile(x - 1, y) && this.isLandForWaterAutotile(this.grid[y][x - 1])) bitmask |= 8;
        return bitmask;
    }

    getWaterRenderMask(x, y) {
        const mask = this.autoTileMasks?.water?.[y]?.[x];
        return Number.isInteger(mask) ? mask : this.getWaterBitmask(x, y);
    }


    getRiverBitmask(x, y) {
        let bitmask = 0;
        // North = 1, East = 2, South = 4, West = 8
        if (this.isValidTile(x, y - 1) && this.isRiver(this.grid[y - 1][x])) bitmask |= 1;
        if (this.isValidTile(x + 1, y) && this.isRiver(this.grid[y][x + 1])) bitmask |= 2;
        if (this.isValidTile(x, y + 1) && this.isRiver(this.grid[y + 1][x])) bitmask |= 4;
        if (this.isValidTile(x - 1, y) && this.isRiver(this.grid[y][x - 1])) bitmask |= 8;
        return bitmask;
    }

    getRiverRenderMask(x, y) {
        const mask = this.autoTileMasks?.river?.[y]?.[x];
        return Number.isInteger(mask) ? mask : this.getRiverBitmask(x, y);
    }

    // Alias for backward compatibility with editor code
    getRoadMask(x, y) {
        return this.getRoadRenderMask(x, y);
    }

    getRiverMask(x, y) {
        return this.getRiverRenderMask(x, y);
    }

    // Return all bridge tile coordinates
    getAllBridgeTiles() {
        const bridges = [];
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const t = this.grid[y][x];
                if (t === GameMap.TERRAIN.BRIDGE_H || t === GameMap.TERRAIN.BRIDGE_V) {
                    bridges.push({ x, y });
                }
            }
        }
        return bridges;
    }

    // removed stray coastline code block
    // Ensure bridges are placed on water tiles that are adjacent to land so they are reachable.
    placeBridges() {
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                if (this.grid[y][x] !== GameMap.TERRAIN.WATER) continue;
                // Check orthogonal neighbors for land (non‑water)
                const neighbors = [
                    this.isValidTile(x, y - 1) ? this.grid[y - 1][x] : null,
                    this.isValidTile(x + 1, y) ? this.grid[y][x + 1] : null,
                    this.isValidTile(x, y + 1) ? this.grid[y + 1][x] : null,
                    this.isValidTile(x - 1, y) ? this.grid[y][x - 1] : null
                ];
                const hasLand = neighbors.some(t => t !== null && t !== GameMap.TERRAIN.WATER);
                if (!hasLand) continue; // skip isolated water
                if (Math.random() < 0.3) {
                    // Randomly choose horizontal or vertical bridge
                    this.grid[y][x] = Math.random() < 0.5 ? GameMap.TERRAIN.BRIDGE_H : GameMap.TERRAIN.BRIDGE_V;
                }
            }
        }
    }
}
// Export GameMap to global scope for other scripts
if (typeof window !== 'undefined') {
    window.GameMap = GameMap;
}
