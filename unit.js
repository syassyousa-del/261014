class Unit {
    constructor(type, owner, x, y) {
        this.type = type;
        this.owner = owner; // 1 for Player 1, 2 for Player 2
        this.x = x;
        this.y = y;
        
        const stats = Unit.BASE_STATS[type] || {
            health: 10,
            moveRange: 3,
            moveType: Unit.MOVE_TYPES.FOOT,
            fuel: 99,
            ammo: null
        };
        this.maxHealth = stats.health;
        this.health = this.maxHealth;
        this.moveRange = stats.moveRange || 3;
        this.attackPower = stats.attackPower || 5;
        this.attackRange = stats.attackRange ?? (Number.isFinite(stats.ammo) ? { min: 1, max: 1 } : undefined);
        this.moveType = stats.moveType || Unit.MOVE_TYPES.FOOT;
        this.maxFuel = stats.fuel || Unit.getDefaultFuel(type);
        this.fuel = this.maxFuel;
        this.maxAmmo = Number.isFinite(stats.ammo) ? stats.ammo : null;
        this.ammo = this.maxAmmo;
        this.maxSupplyAmmo = Number.isFinite(stats.supplyAmmo) ? stats.supplyAmmo : 0;
        this.supplyAmmo = this.maxSupplyAmmo;
        // Transport capacity (number of infantry units it can carry)
        this.capacity = stats.capacity || 0;
        this.loadedTurn = null; // Turn when unit was loaded onto a transport
        
        this.hasMoved = false;
        this.carriedUnits = []; // Initialize cargo array
        this.hasAttacked = false;
        this.autoMoveEnabled = false;
        this.autoMoveDestination = null;
    }

    static TYPES = {
        INFANTRY: 'INFANTRY',
        TRANSPORT: 'TRANSPORT',
        TANK: 'TANK',
        MD_TANK: 'MD_TANK',
        HV_TANK: 'HV_TANK',
        ARTILLERY: 'ARTILLERY',
        ROCKET: 'ROCKET',
        HELI_TRANSPORT: 'HELI_TRANSPORT',
        FIGHTER: 'FIGHTER',
        BOMBER: 'BOMBER',
        AA_TANK: 'AA_TANK',
        AA_MISSILE: 'AA_MISSILE',
        BATTLESHIP: 'BATTLESHIP',
        DESTROYER: 'DESTROYER',
        SUBMARINE: 'SUBMARINE',
        HOVERCRAFT: 'HOVERCRAFT'
    };

    static MOVE_TYPES = {
        FOOT: 'FOOT',
        TREAD: 'TREAD',
        TIRE: 'TIRE',
        AIR: 'AIR',
        SEA: 'SEA',
        HOVER: 'HOVER'
    };

    static BASE_STATS = {
        [Unit.TYPES.INFANTRY]: { health: 10, moveRange: 3, moveType: Unit.MOVE_TYPES.FOOT, fuel: 99, ammo: 10 },
        [Unit.TYPES.TRANSPORT]: { health: 10, moveRange: 6, moveType: Unit.MOVE_TYPES.TIRE, capacity: 2, fuel: 99, ammo: 6, supplyAmmo: 100 },
        [Unit.TYPES.TANK]: { health: 10, moveRange: 6, moveType: Unit.MOVE_TYPES.TREAD, fuel: 60, ammo: 10 },
        [Unit.TYPES.MD_TANK]: { health: 10, moveRange: 5, moveType: Unit.MOVE_TYPES.TREAD, fuel: 60, ammo: 8 },
        [Unit.TYPES.HV_TANK]: { health: 10, moveRange: 3, moveType: Unit.MOVE_TYPES.TREAD, fuel: 60, ammo: 6 },
        [Unit.TYPES.ARTILLERY]: { health: 10, moveRange: 4, attackRange: {min: 2, max: 3}, moveType: Unit.MOVE_TYPES.TREAD, fuel: 60, ammo: 6 },
        [Unit.TYPES.ROCKET]: { health: 10, moveRange: 3, attackRange: {min: 2, max: 5}, moveType: Unit.MOVE_TYPES.TIRE, fuel: 60, ammo: 4 },
        [Unit.TYPES.HELI_TRANSPORT]: { health: 10, moveRange: 6, moveType: Unit.MOVE_TYPES.AIR, capacity: 2, fuel: 100, ammo: 6, attackRange: { min: 1, max: 1 } },
        [Unit.TYPES.FIGHTER]: { health: 10, moveRange: 9, moveType: Unit.MOVE_TYPES.AIR, fuel: 100, ammo: 4 },
        [Unit.TYPES.BOMBER]: { health: 10, moveRange: 7, moveType: Unit.MOVE_TYPES.AIR, fuel: 100, ammo: 4 },
        [Unit.TYPES.AA_TANK]: { health: 10, moveRange: 6, moveType: Unit.MOVE_TYPES.TREAD, fuel: 60, ammo: 6, attackRange: { min: 1, max: 1 } },
        [Unit.TYPES.AA_MISSILE]: { health: 10, moveRange: 5, attackRange: {min: 3, max: 5}, moveType: Unit.MOVE_TYPES.TIRE, fuel: 60, ammo: 4 },
        [Unit.TYPES.BATTLESHIP]: { health: 10, moveRange: 5, attackRange: {min: 2, max: 6}, moveType: Unit.MOVE_TYPES.SEA, fuel: 99, ammo: 6 },
        [Unit.TYPES.DESTROYER]: { health: 10, moveRange: 6, moveType: Unit.MOVE_TYPES.SEA, fuel: 99, ammo: 8, attackRange: { min: 1, max: 3 } },
        [Unit.TYPES.SUBMARINE]: { health: 10, moveRange: 4, moveType: Unit.MOVE_TYPES.SEA, fuel: 99, ammo: 6 },
        [Unit.TYPES.HOVERCRAFT]: { health: 10, moveRange: 5, moveType: Unit.MOVE_TYPES.HOVER, capacity: 2, fuel: 99 }
    };

    static getDefaultFuel(type) {
        const stats = Unit.BASE_STATS[type];
        if (stats?.moveType === Unit.MOVE_TYPES.AIR) return 100;
        if (type === Unit.TYPES.INFANTRY || type === Unit.TYPES.TRANSPORT) return 99;
        if (stats?.moveType === Unit.MOVE_TYPES.SEA || stats?.moveType === Unit.MOVE_TYPES.HOVER) return 99;
        return 60;
    }

    static COSTS = {
        [Unit.TYPES.INFANTRY]: 1000,
        [Unit.TYPES.TRANSPORT]: 2000,
        [Unit.TYPES.TANK]: 4000,
        [Unit.TYPES.MD_TANK]: 12000,
        [Unit.TYPES.HV_TANK]: 16000,
        [Unit.TYPES.ARTILLERY]: 7000,
        [Unit.TYPES.ROCKET]: 15000,
        [Unit.TYPES.HELI_TRANSPORT]: 5000,
        [Unit.TYPES.FIGHTER]: 20000,
        [Unit.TYPES.BOMBER]: 22000,
        [Unit.TYPES.AA_TANK]: 8000,
        [Unit.TYPES.AA_MISSILE]: 12000,
        [Unit.TYPES.BATTLESHIP]: 35000,
        [Unit.TYPES.DESTROYER]: 22000,
        [Unit.TYPES.SUBMARINE]: 24000,
        [Unit.TYPES.HOVERCRAFT]: 16500
    };

    static MATCHUPS = {
        [Unit.TYPES.INFANTRY]: {
            [Unit.TYPES.INFANTRY]: 2.5, [Unit.TYPES.TRANSPORT]: 1, [Unit.TYPES.TANK]: 0.5, [Unit.TYPES.MD_TANK]: 0.25, [Unit.TYPES.HV_TANK]: 0.05, [Unit.TYPES.ARTILLERY]: 1, [Unit.TYPES.ROCKET]: 1,
            [Unit.TYPES.HELI_TRANSPORT]: 0.5, [Unit.TYPES.FIGHTER]: 0, [Unit.TYPES.BOMBER]: 0, [Unit.TYPES.AA_TANK]: 0.25, [Unit.TYPES.AA_MISSILE]: 1,
            [Unit.TYPES.BATTLESHIP]: 0, [Unit.TYPES.DESTROYER]: 0, [Unit.TYPES.SUBMARINE]: 0, [Unit.TYPES.HOVERCRAFT]: 1
        },
        [Unit.TYPES.TRANSPORT]: {
            [Unit.TYPES.INFANTRY]: 5, [Unit.TYPES.TRANSPORT]: 3, [Unit.TYPES.TANK]: 1.5, [Unit.TYPES.MD_TANK]: 1, [Unit.TYPES.HV_TANK]: 0, [Unit.TYPES.ARTILLERY]: 2, [Unit.TYPES.ROCKET]: 2,
            [Unit.TYPES.HELI_TRANSPORT]: 0.5, [Unit.TYPES.FIGHTER]: 0, [Unit.TYPES.BOMBER]: 0, [Unit.TYPES.AA_TANK]: 1, [Unit.TYPES.AA_MISSILE]: 2,
            [Unit.TYPES.BATTLESHIP]: 0, [Unit.TYPES.DESTROYER]: 0, [Unit.TYPES.SUBMARINE]: 0, [Unit.TYPES.HOVERCRAFT]: 3
        },
        [Unit.TYPES.TANK]: {
            [Unit.TYPES.INFANTRY]: 7, [Unit.TYPES.TRANSPORT]: 3.5, [Unit.TYPES.TANK]: 2.5, [Unit.TYPES.MD_TANK]: 1.5, [Unit.TYPES.HV_TANK]: 0.75, [Unit.TYPES.ARTILLERY]: 3.5, [Unit.TYPES.ROCKET]: 3.5,
            [Unit.TYPES.HELI_TRANSPORT]: 0.5, [Unit.TYPES.FIGHTER]: 0, [Unit.TYPES.BOMBER]: 0, [Unit.TYPES.AA_TANK]: 3, [Unit.TYPES.AA_MISSILE]: 3.75,
            [Unit.TYPES.BATTLESHIP]: 0.5, [Unit.TYPES.DESTROYER]: 0.5, [Unit.TYPES.SUBMARINE]: 0, [Unit.TYPES.HOVERCRAFT]: 2.5
        },
        [Unit.TYPES.MD_TANK]: {
            [Unit.TYPES.INFANTRY]: 9, [Unit.TYPES.TRANSPORT]: 9, [Unit.TYPES.TANK]: 8, [Unit.TYPES.MD_TANK]: 5, [Unit.TYPES.HV_TANK]: 3, [Unit.TYPES.ARTILLERY]: 9, [Unit.TYPES.ROCKET]: 9,
            [Unit.TYPES.HELI_TRANSPORT]: 2, [Unit.TYPES.FIGHTER]: 0, [Unit.TYPES.BOMBER]: 0, [Unit.TYPES.AA_TANK]: 8, [Unit.TYPES.AA_MISSILE]: 9,
            [Unit.TYPES.BATTLESHIP]: 1, [Unit.TYPES.DESTROYER]: 1, [Unit.TYPES.SUBMARINE]: 0, [Unit.TYPES.HOVERCRAFT]: 5
        },
        [Unit.TYPES.HV_TANK]: {
            [Unit.TYPES.INFANTRY]: 10, [Unit.TYPES.TRANSPORT]: 10, [Unit.TYPES.TANK]: 10, [Unit.TYPES.MD_TANK]: 8, [Unit.TYPES.HV_TANK]: 5, [Unit.TYPES.ARTILLERY]: 10, [Unit.TYPES.ROCKET]: 10,
            [Unit.TYPES.HELI_TRANSPORT]: 3, [Unit.TYPES.FIGHTER]: 0, [Unit.TYPES.BOMBER]: 0, [Unit.TYPES.AA_TANK]: 10, [Unit.TYPES.AA_MISSILE]: 9,
            [Unit.TYPES.BATTLESHIP]: 1.5, [Unit.TYPES.DESTROYER]: 1.5, [Unit.TYPES.SUBMARINE]: 0, [Unit.TYPES.HOVERCRAFT]: 6
        },
        [Unit.TYPES.ARTILLERY]: {
            [Unit.TYPES.INFANTRY]: 8, [Unit.TYPES.TRANSPORT]: 8, [Unit.TYPES.TANK]: 7, [Unit.TYPES.MD_TANK]: 5, [Unit.TYPES.HV_TANK]: 3, [Unit.TYPES.ARTILLERY]: 7, [Unit.TYPES.ROCKET]: 7,
            [Unit.TYPES.HELI_TRANSPORT]: 0, [Unit.TYPES.FIGHTER]: 0, [Unit.TYPES.BOMBER]: 0, [Unit.TYPES.AA_TANK]: 6, [Unit.TYPES.AA_MISSILE]: 7.5,
            [Unit.TYPES.BATTLESHIP]: 4, [Unit.TYPES.DESTROYER]: 4.5, [Unit.TYPES.SUBMARINE]: 0, [Unit.TYPES.HOVERCRAFT]: 7
        },
        [Unit.TYPES.ROCKET]: {
            [Unit.TYPES.INFANTRY]: 10, [Unit.TYPES.TRANSPORT]: 10, [Unit.TYPES.TANK]: 9, [Unit.TYPES.MD_TANK]: 7, [Unit.TYPES.HV_TANK]: 5, [Unit.TYPES.ARTILLERY]: 9, [Unit.TYPES.ROCKET]: 9,
            [Unit.TYPES.HELI_TRANSPORT]: 0, [Unit.TYPES.FIGHTER]: 0, [Unit.TYPES.BOMBER]: 0, [Unit.TYPES.AA_TANK]: 8, [Unit.TYPES.AA_MISSILE]: 9,
            [Unit.TYPES.BATTLESHIP]: 5.5, [Unit.TYPES.DESTROYER]: 6, [Unit.TYPES.SUBMARINE]: 0, [Unit.TYPES.HOVERCRAFT]: 9
        },
        [Unit.TYPES.HELI_TRANSPORT]: {
            [Unit.TYPES.INFANTRY]: 2.5, [Unit.TYPES.TRANSPORT]: 1.5, [Unit.TYPES.TANK]: 0.5, [Unit.TYPES.MD_TANK]: 0.25, [Unit.TYPES.HV_TANK]: 0, [Unit.TYPES.ARTILLERY]: 1, [Unit.TYPES.ROCKET]: 1,
            [Unit.TYPES.HELI_TRANSPORT]: 0, [Unit.TYPES.FIGHTER]: 0, [Unit.TYPES.BOMBER]: 0, [Unit.TYPES.AA_TANK]: 0.25, [Unit.TYPES.AA_MISSILE]: 1,
            [Unit.TYPES.BATTLESHIP]: 0, [Unit.TYPES.DESTROYER]: 0, [Unit.TYPES.SUBMARINE]: 0, [Unit.TYPES.HOVERCRAFT]: 0.5
        },
        [Unit.TYPES.FIGHTER]: {
            [Unit.TYPES.INFANTRY]: 0, [Unit.TYPES.TRANSPORT]: 0, [Unit.TYPES.TANK]: 0, [Unit.TYPES.MD_TANK]: 0, [Unit.TYPES.HV_TANK]: 0, [Unit.TYPES.ARTILLERY]: 0, [Unit.TYPES.ROCKET]: 0,
            [Unit.TYPES.HELI_TRANSPORT]: 10, [Unit.TYPES.FIGHTER]: 5, [Unit.TYPES.BOMBER]: 10, [Unit.TYPES.AA_TANK]: 0, [Unit.TYPES.AA_MISSILE]: 0,
            [Unit.TYPES.BATTLESHIP]: 0, [Unit.TYPES.DESTROYER]: 0, [Unit.TYPES.SUBMARINE]: 0, [Unit.TYPES.HOVERCRAFT]: 0
        },
        [Unit.TYPES.BOMBER]: {
            [Unit.TYPES.INFANTRY]: 10, [Unit.TYPES.TRANSPORT]: 10, [Unit.TYPES.TANK]: 10, [Unit.TYPES.MD_TANK]: 9, [Unit.TYPES.HV_TANK]: 7, [Unit.TYPES.ARTILLERY]: 10, [Unit.TYPES.ROCKET]: 10,
            [Unit.TYPES.HELI_TRANSPORT]: 0, [Unit.TYPES.FIGHTER]: 0, [Unit.TYPES.BOMBER]: 0, [Unit.TYPES.AA_TANK]: 8, [Unit.TYPES.AA_MISSILE]: 9,
            [Unit.TYPES.BATTLESHIP]: 7.5, [Unit.TYPES.DESTROYER]: 7.5, [Unit.TYPES.SUBMARINE]: 8.5, [Unit.TYPES.HOVERCRAFT]: 9
        },
        [Unit.TYPES.AA_TANK]: {
            [Unit.TYPES.INFANTRY]: 10, [Unit.TYPES.TRANSPORT]: 9, [Unit.TYPES.TANK]: 4, [Unit.TYPES.MD_TANK]: 1, [Unit.TYPES.HV_TANK]: 0, [Unit.TYPES.ARTILLERY]: 4, [Unit.TYPES.ROCKET]: 4,
            [Unit.TYPES.HELI_TRANSPORT]: 6.5, [Unit.TYPES.FIGHTER]: 6, [Unit.TYPES.BOMBER]: 7, [Unit.TYPES.AA_TANK]: 4, [Unit.TYPES.AA_MISSILE]: 6,
            [Unit.TYPES.BATTLESHIP]: 0.5, [Unit.TYPES.DESTROYER]: 0.5, [Unit.TYPES.SUBMARINE]: 0, [Unit.TYPES.HOVERCRAFT]: 4
        },
        [Unit.TYPES.AA_MISSILE]: {
            [Unit.TYPES.INFANTRY]: 0, [Unit.TYPES.TRANSPORT]: 0, [Unit.TYPES.TANK]: 0, [Unit.TYPES.MD_TANK]: 0, [Unit.TYPES.HV_TANK]: 0, [Unit.TYPES.ARTILLERY]: 0, [Unit.TYPES.ROCKET]: 0,
            [Unit.TYPES.HELI_TRANSPORT]: 10, [Unit.TYPES.FIGHTER]: 9, [Unit.TYPES.BOMBER]: 10, [Unit.TYPES.AA_TANK]: 0, [Unit.TYPES.AA_MISSILE]: 0,
            [Unit.TYPES.BATTLESHIP]: 0, [Unit.TYPES.DESTROYER]: 0, [Unit.TYPES.SUBMARINE]: 0, [Unit.TYPES.HOVERCRAFT]: 0
        },
        [Unit.TYPES.BATTLESHIP]: {
            [Unit.TYPES.INFANTRY]: 9, [Unit.TYPES.TRANSPORT]: 9.5, [Unit.TYPES.TANK]: 8, [Unit.TYPES.MD_TANK]: 6.5, [Unit.TYPES.HV_TANK]: 5, [Unit.TYPES.ARTILLERY]: 8.5, [Unit.TYPES.ROCKET]: 8.5,
            [Unit.TYPES.HELI_TRANSPORT]: 0, [Unit.TYPES.FIGHTER]: 0, [Unit.TYPES.BOMBER]: 0, [Unit.TYPES.AA_TANK]: 8, [Unit.TYPES.AA_MISSILE]: 8,
            [Unit.TYPES.BATTLESHIP]: 5, [Unit.TYPES.DESTROYER]: 6, [Unit.TYPES.SUBMARINE]: 0.5, [Unit.TYPES.HOVERCRAFT]: 8.5
        },
        [Unit.TYPES.DESTROYER]: {
            [Unit.TYPES.INFANTRY]: 0, [Unit.TYPES.TRANSPORT]: 2, [Unit.TYPES.TANK]: 1.5, [Unit.TYPES.MD_TANK]: 1, [Unit.TYPES.HV_TANK]: 0.5, [Unit.TYPES.ARTILLERY]: 2, [Unit.TYPES.ROCKET]: 2,
            [Unit.TYPES.HELI_TRANSPORT]: 8.5, [Unit.TYPES.FIGHTER]: 3, [Unit.TYPES.BOMBER]: 5, [Unit.TYPES.AA_TANK]: 2, [Unit.TYPES.AA_MISSILE]: 2,
            [Unit.TYPES.BATTLESHIP]: 2, [Unit.TYPES.DESTROYER]: 4, [Unit.TYPES.SUBMARINE]: 8, [Unit.TYPES.HOVERCRAFT]: 5
        },
        [Unit.TYPES.SUBMARINE]: {
            [Unit.TYPES.INFANTRY]: 0, [Unit.TYPES.TRANSPORT]: 0, [Unit.TYPES.TANK]: 0, [Unit.TYPES.MD_TANK]: 0, [Unit.TYPES.HV_TANK]: 0, [Unit.TYPES.ARTILLERY]: 0, [Unit.TYPES.ROCKET]: 0,
            [Unit.TYPES.HELI_TRANSPORT]: 0, [Unit.TYPES.FIGHTER]: 0, [Unit.TYPES.BOMBER]: 0, [Unit.TYPES.AA_TANK]: 0, [Unit.TYPES.AA_MISSILE]: 0,
            [Unit.TYPES.BATTLESHIP]: 7, [Unit.TYPES.DESTROYER]: 5, [Unit.TYPES.SUBMARINE]: 5, [Unit.TYPES.HOVERCRAFT]: 8
        },
        [Unit.TYPES.HOVERCRAFT]: {
            [Unit.TYPES.INFANTRY]: 0, [Unit.TYPES.TRANSPORT]: 0, [Unit.TYPES.TANK]: 0, [Unit.TYPES.MD_TANK]: 0, [Unit.TYPES.HV_TANK]: 0, [Unit.TYPES.ARTILLERY]: 0, [Unit.TYPES.ROCKET]: 0,
            [Unit.TYPES.HELI_TRANSPORT]: 0, [Unit.TYPES.FIGHTER]: 0, [Unit.TYPES.BOMBER]: 0, [Unit.TYPES.AA_TANK]: 0, [Unit.TYPES.AA_MISSILE]: 0,
            [Unit.TYPES.BATTLESHIP]: 0, [Unit.TYPES.DESTROYER]: 0, [Unit.TYPES.SUBMARINE]: 0, [Unit.TYPES.HOVERCRAFT]: 0
        }
    };

    resetTurn() {
        this.hasMoved = false;
        this.hasAttacked = false;
    }

    isDone() {
        return this.hasMoved && this.hasAttacked; // Simplification: assume attacking ends turn
    }

    takeDamage(amount) {
        if (typeof amount !== 'number' || isNaN(amount)) return false;
        
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            // Destroy carried units if this is a transport
            this.carriedUnits.forEach(u => u.takeDamage(9999));
            return true; // Return true if destroyed
        }
        return false;
    }
}
