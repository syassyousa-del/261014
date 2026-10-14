class AssetManager {
    constructor() {
        this.images = {};
        this.loaded = false;
        this.basePath = 'assets/images/terrain/';
        this.terrainFiles = {
            [GameMap.TERRAIN.PORT_NEUTRAL]: 'PORT_NEUTRAL.png',
            [GameMap.TERRAIN.PORT_P1]: 'PORT_P1.png',
            [GameMap.TERRAIN.PORT_P2]: 'PORT_P2.png',
            [GameMap.TERRAIN.ROAD]: 'road_cross.png',
            [GameMap.TERRAIN.PLAINS]: 'plains.png',
            [GameMap.TERRAIN.FOREST]: 'forest.png',
            [GameMap.TERRAIN.MOUNTAIN]: 'mountain.png',
            [GameMap.TERRAIN.WATER]: 'water.png',
            [GameMap.TERRAIN.CITY_NEUTRAL]: 'city_neutral.png',
            [GameMap.TERRAIN.CITY_P1]: 'city_p1.png',
            [GameMap.TERRAIN.CITY_P2]: 'city_p2.png',
            [GameMap.TERRAIN.HQ_P1]: 'HQ_P1.png',
            [GameMap.TERRAIN.HQ_P2]: 'HQ_P2.png',
            [GameMap.TERRAIN.FACTORY_NEUTRAL]: 'factory_neutral.png',
            [GameMap.TERRAIN.FACTORY_P1]: 'factory_p1.png',
            [GameMap.TERRAIN.FACTORY_P2]: 'factory_p2.png',
            [GameMap.TERRAIN.AIRPORT_NEUTRAL]: 'airport_neutral.png',
            [GameMap.TERRAIN.AIRPORT_P1]: 'airport_p1.png',
            [GameMap.TERRAIN.AIRPORT_P2]: 'airport_p2.png',
            [GameMap.TERRAIN.BRIDGE_H]: 'bridge_h.png',
            [GameMap.TERRAIN.BRIDGE_V]: 'bridge_v.png',
            [GameMap.TERRAIN.RIVER_H]: 'river_h.png',
            [GameMap.TERRAIN.RIVER_V]: 'river_v.png'
        };

        

        // Water edge bitmask maps (land contact: N=1, E=2, S=4, W=8)
        this.waterFiles = {
            0: 'water.png',
            1: 'water_n.png',
            2: 'water_e.png',
            3: 'water_ne.png',
            4: 'water_s.png',
            5: 'water_ns.png',
            6: 'water_es.png',
            7: 'water_nes.png',
            8: 'water_w.png',
            9: 'water_nw.png',
            10: 'water_ew.png',
            11: 'water_new.png',
            12: 'water_sw.png',
            13: 'water_nsw.png',
            14: 'water_esw.png',
            15: 'water_nesw.png'
        };

        // Road bitmask maps (N=1, E=2, S=4, W=8)
        this.roadFiles = {
            0: 'road_cross.png',    // No connections, default cross
            1: 'road_v.png',    // N
            2: 'road_h.png',    // E
            3: 'road_tr.png',   // N, E -> Corner Top-Right
            4: 'road_v.png',    // S
            5: 'road_v.png',    // N, S -> Vertical
            6: 'road_br.png',   // E, S -> Corner Bottom-Right
            7: 'road_t_right.png',// N, E, S -> T-Right
            8: 'road_h.png',    // W
            9: 'road_tl.png',   // N, W -> Corner Top-Left
            10: 'road_h.png',   // E, W -> Horizontal
            11: 'road_t_up.png', // N, E, W -> T-Up
            12: 'road_bl.png',  // S, W -> Corner Bottom-Left
            13: 'road_t_left.png',// N, S, W -> T-Left
            14: 'road_t_down.png',// E, S, W -> T-Down
            15: 'road_cross.png' // N, E, S, W -> Cross
        };

        // River bitmask maps (N=1, E=2, S=4, W=8)
        this.riverFiles = {
            0: 'river_h.png',     // No connections, default horizontal
            1: 'river_v.png',     // N
            2: 'river_h.png',     // E
            3: 'river_tr.png',    // N, E -> Corner Top-Right
            4: 'river_v.png',     // S
            5: 'river_v.png',     // N, S -> Vertical
            6: 'river_br.png',    // E, S -> Corner Bottom-Right
            7: 'river_t_rght.png',// N, E, S -> T-Right
            8: 'river_h.png',     // W
            9: 'river_tl.png',    // N, W -> Corner Top-Left
            10: 'river_h.png',    // E, W -> Horizontal
            11: 'river_t_up.png', // N, E, W -> T-Up
            12: 'river_bl.png',   // S, W -> Corner Bottom-Left
            13: 'river_t_left.png',// N, S, W -> T-Left
            14: 'river_t_down.png',// E, S, W -> T-Down
            15: 'river_cross.png' // N, E, S, W -> Cross
        };

        // Coastline files have been disabled. Fallback colors will be used instead.
        // this.coastFiles = {};
        // (original definitions removed)
        
        // Unit files
        this.unitBasePath = 'assets/images/units/';
        this.unitFiles = {
            'INFANTRY_P1': 'infantry_p1.png',
            'TRANSPORT_P1': 'transport_p1.png',
            'TANK_P1': 'tank_p1.png',
            'MD_TANK_P1': 'md_tank_p1.png',
            'HV_TANK_P1': 'hv_tank_p1.png',
            'ARTILLERY_P1': 'artillery_p1.png',
            'INFANTRY_P2': 'infantry_p2.png',
            'TRANSPORT_P2': 'transport_p2.png',
            'TANK_P2': 'tank_p2.png',
            'MD_TANK_P2': 'md_tank_p2.png',
            'HV_TANK_P2': 'hv_tank_p2.png',
            'ARTILLERY_P2': 'artillery_p2.png',
            'ROCKET_P1': 'rocket_p1.png',
            'ROCKET_P2': 'rocket_p2.png',
            'AA_TANK_P1': 'aa_tank_p1.png',
            'AA_TANK_P2': 'aa_tank_p2.png',
            'AA_MISSILE_P1': 'aa_missile_p1.png',
            'AA_MISSILE_P2': 'aa_missile_p2.png',
            'HELI_TRANSPORT_P1': 'heli_transport_p1.png',
            'HELI_TRANSPORT_P2': 'heli_transport_p2.png',
            'FIGHTER_P1': 'fighter_p1.png',
            'FIGHTER_P2': 'fighter_p2.png',
            'BOMBER_P1': 'bomber_p1.png',
            'BOMBER_P2': 'bomber_p2.png',
            'BATTLESHIP_P1': 'battleship_p1.png',
            'BATTLESHIP_P2': 'battleship_p2.png',
            'DESTROYER_P1': 'destroyer_p1.png',
            'DESTROYER_P2': 'destroyer_p2.png',
            'SUBMARINE_P1': 'submarine_p1.png',
            'SUBMARINE_P2': 'submarine_p2.png',
            'HOVERCRAFT_P1': 'hovercraft_p1.png',
            'HOVERCRAFT_P2': 'hovercraft_p2.png'
        };
    }

    async loadAll() {
        // Load standard terrain
        const terrainPromises = Object.entries(this.terrainFiles).map(([key, filename]) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    this.images[key] = img;
                    resolve();
                };
                img.onerror = () => {
                    console.log(`Fallback: Custom image ${filename} not found or failed to load.`);
                    resolve();
                };
                img.src = this.basePath + filename;
            });
        });

        // Load water edge variations
        const waterPromises = Object.entries(this.waterFiles).map(([bitmask, filename]) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    this.images[`WATER_${bitmask}`] = img;
                    resolve();
                };
                img.onerror = () => {
                    resolve();
                };
                img.src = this.basePath + filename;
            });
        });

        // Load road variations
        const roadPromises = Object.entries(this.roadFiles).map(([bitmask, filename]) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    this.images[`ROAD_${bitmask}`] = img;
                    resolve();
                };
                img.onerror = () => {
                    resolve();
                };
                img.src = this.basePath + filename;
            });
        });

        // Load river variations
        const riverPromises = Object.entries(this.riverFiles).map(([bitmask, filename]) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    this.images[`RIVER_${bitmask}`] = img;
                    resolve();
                };
                img.onerror = () => {
                    resolve();
                };
                img.src = this.basePath + filename;
            });
        });

        // Load units
        const unitPromises = Object.entries(this.unitFiles).map(([key, filename]) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    this.images[key] = img;
                    resolve();
                };
                img.onerror = () => {
                    resolve();
                };
                img.src = this.unitBasePath + filename;
            });
        });

        // Load coastlines only if definitions exist
        const coastPromises = (this.coastFiles && Object.keys(this.coastFiles).length > 0)
            ? Object.entries(this.coastFiles).map(([bitmask, filename]) => {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        this.images[`COAST_${bitmask}`] = img;
                        resolve();
                    };
                    img.onerror = () => {
                        resolve();
                    };
                    img.src = this.basePath + filename;
                });
            })
            : [];
        

        await Promise.all([...terrainPromises, ...waterPromises, ...roadPromises, ...riverPromises, ...unitPromises, ...coastPromises]);
        this.loaded = true;
    }

    getImage(terrainType) {
        return this.images[terrainType] || null;
    }
    
    getRoadImage(bitmask) {
        return this.images[`ROAD_${bitmask}`] || null;
    }

    getWaterImage(bitmask) {
        return this.images[`WATER_${bitmask}`] || this.images[GameMap.TERRAIN.WATER] || null;
    }

    getRiverImage(bitmask) {
        return this.images[`RIVER_${bitmask}`] || null;
    }

    getCoastlineImage(bitmask) {
        return this.images[`COAST_${bitmask}`] || null;
    }
    
    getUnitImage(type, owner) {
        const key = `${type}_P${owner}`;
        return this.images[key] || null;
    }
}
