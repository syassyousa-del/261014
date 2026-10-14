const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
class Game {
    constructor(map, units, audioManager) {
        this.map = map;
        this.units = units;
        this.audioManager = audioManager;
    this.turnCount = 0;
    this.currentPlayer = 1; // Player 1 starts
        this.selectedUnit = null;
        this.state = Game.STATES.IDLE;
        this.aiSpeedMultiplier = 1; // Default speed
        this.aiDifficulty = 'easy'; // Default difficulty
        
        // Economy system
        this.playerFunds = { 1: 0, 2: 0 };
        this.capturePoints = {}; // Track capture progress for buildings: { 'x,y': { owner: 1, points: 5 } }
        // Give starting income to Player 1 on game load
        this.giveTurnIncome(1);

        // For rendering highlights
        this.validMoveTiles = [];
        this.validAttackTiles = [];
        this.validUnloadTiles = [];
        this.previewAttackTiles = [];
        this.previewAttackUnit = null;
        this.explosions = [];
        
        // Camera for zooming and panning
        this.camera = { x: 0, y: 0, zoom: 1 };

        // Game starts at START_SCREEN to wait for user interaction (for audio)
        this.state = Game.STATES.START_SCREEN;
    }

    static STATES = {
        START_SCREEN: 'START_SCREEN',
        IDLE: 'IDLE',
        UNIT_SELECTED: 'UNIT_SELECTED',
        MOVING: 'MOVING',
        ATTACKING: 'ATTACKING',
        UNLOADING: 'UNLOADING',
        POST_MOVE_MENU: 'POST_MOVE_MENU',
        AUTO_DESTINATION: 'AUTO_DESTINATION',
        AUTO_MOVING: 'AUTO_MOVING',
        GAME_OVER: 'GAME_OVER',
        AI_ACTIVE: 'AI_ACTIVE',
        BATTLE_ANIMATION: 'BATTLE_ANIMATION'
    };

    sleep(ms) {
        const adjustedMs = Math.max(10, Math.floor(ms / this.aiSpeedMultiplier));
        return new Promise(resolve => setTimeout(resolve, adjustedMs));
    }

    setAISpeedMultiplier(multiplier) {
        this.aiSpeedMultiplier = Math.max(1, multiplier);
    }

    setAIDifficultyLevel(level) {
        switch (level) {
            case '楽勝':
                this.aiDifficulty = 'easy';
                break;
            case 'そこつよ':
                this.aiDifficulty = 'normal';
                break;
            case 'とてつよ':
                this.aiDifficulty = 'hard';
                break;
            default:
                this.aiDifficulty = 'easy';
        }
    }


    startGame() {
    if (this.state === Game.STATES.START_SCREEN) {
        this.state = Game.STATES.IDLE;   // 状態遷移
        this.audioManager.play('turn_p1'); // BGM 再生
    }
}

    getUnitAt(x, y) {
        return this.units.find(u => u.x === x && u.y === y && u.health > 0);
    }

    canLoadUnit(unit, transport) {
        if (!unit || !transport) return false;
        if (unit.owner !== transport.owner) return false;
        if ((transport.carriedUnits?.length ?? 0) >= (transport.capacity ?? 0)) return false;
        
        if (transport.type === Unit.TYPES.TRANSPORT || transport.type === Unit.TYPES.HELI_TRANSPORT) {
            return unit.type === Unit.TYPES.INFANTRY;
        }
        if (transport.type === Unit.TYPES.HOVERCRAFT) {
            return unit.moveType === Unit.MOVE_TYPES.FOOT || unit.moveType === Unit.MOVE_TYPES.TIRE || unit.moveType === Unit.MOVE_TYPES.TREAD;
        }
        return false;
    }

    addExplosion(x, y) {
        this.explosions.push({
            x,
            y,
            startTime: Date.now(),
            duration: 650
        });
    }

    endTurn() {
        // Reset units for current player
        this.units.filter(u => u.owner === this.currentPlayer).forEach(u => u.resetTurn());
        
        // Stop current BGM
        const currentTurnSound = this.currentPlayer === 1 ? 'turn_p1' : 'turn_p2';
        this.audioManager.stop(currentTurnSound);

        // Switch player
        this.currentPlayer = this.currentPlayer === 1 ? 2 : 1; this.turnCount++; // Increment turn count
        
        // Play turn sound
        const turnSound = this.currentPlayer === 1 ? 'turn_p1' : 'turn_p2';
        this.audioManager.play(turnSound);
        
        this.clearSelection();
        
        // Give income to new active player: +1000 G per owned structure
        this.giveTurnIncome(this.currentPlayer);

        // Heal units on owned structures by 20% (Healing is free!)
        this.units.filter(u => u.owner === this.currentPlayer && u.health > 0).forEach(u => {
            if (this.isOnOwnedSupplyProperty(u)) {
                if (u.health < u.maxHealth) {
                    const healAmount = u.maxHealth * 0.20;
                    u.health = Math.min(u.maxHealth, u.health + healAmount);
                }
            }

            this.resupplyUnitIfPossible(u);
        });

        this.removeCrashedAircraft();
        
        // Update UI again to reflect any supply costs
        this.updateFundsUI();

        // Update UI
        const turnIndicator = document.getElementById('turn-indicator');
        turnIndicator.textContent = this.currentPlayer === 1 ? 'RED軍' : 'BLUE軍';
        turnIndicator.style.color = this.currentPlayer === 1 ? '#ffaaaa' : '#aaaaff';

        if (this.currentPlayer === 1) {
            this.runPlayerAutoMoves();
        }

        // Trigger AI turn if current player is 2
        if (this.currentPlayer === 2) {
            this.runAITurn();
        }
    }

    selectUnit(unit) {
        if (unit.owner === this.currentPlayer && !unit.isDone()) {
            this.clearRangePreview();
            this.selectedUnit = unit;
            this.selectedUnitOriginalPos = { x: unit.x, y: unit.y };
            // Calculate move and attack ranges
            this.calculateMoveRange(unit);
            this.calculateAttackRange(unit);
            // Show command UI for attacks and ship auto-move controls.
            if ((this.validAttackTiles && this.validAttackTiles.length > 0) || this.isAutoMovableShip(unit)) {
                this.state = Game.STATES.POST_MOVE_MENU;
            } else {
                this.state = Game.STATES.UNIT_SELECTED;
            }
            // UI can still show attack button based on this.validAttackTiles
            this.audioManager.play('select');
            return true;
        }
        return false;
    }


    cancelAction() {
        if (!this.selectedUnit) {
            this.clearSelection();
            return;
        }

        this.audioManager.play('cancel');

        // Revert move if we are in a state where the unit has already moved but not committed
        if (!this.selectedUnit.hasAttacked && (this.state === Game.STATES.ATTACKING || this.state === Game.STATES.UNLOADING || this.state === Game.STATES.POST_MOVE_MENU)) {
            if (this.selectedUnitOriginalPos) {
                this.selectedUnit.x = this.selectedUnitOriginalPos.x;
                this.selectedUnit.y = this.selectedUnitOriginalPos.y;
            }
            this.selectedUnit.hasMoved = false;
        }

        this.clearSelection();
    }

    confirmWaitAction() {
        if (!this.selectedUnit) {
            this.clearSelection();
            return;
        }

        this.selectedUnit.hasMoved = true;
        this.selectedUnit.hasAttacked = true;
        this.checkCapture(this.selectedUnit);
        this.clearSelection();
    }

    isAutoMovableShip(unit) {
        return unit && (unit.moveType === Unit.MOVE_TYPES.SEA || unit.type === Unit.TYPES.HOVERCRAFT);
    }

    canSetAutoMoveDestination(unit, x, y) {
        if (!this.isAutoMovableShip(unit)) return false;
        if (!this.map.isValidTile(x, y)) return false;
        const terrain = this.map.getTerrainAt(x, y);
        if (this.map.getMovementCost(terrain, unit.moveType) === Infinity) return false;
        const occupant = this.getUnitAt(x, y);
        if (occupant && occupant !== unit) return false;
        return !!this.findAutoMovePath(unit, x, y);
    }

    setAutoMoveDestination(unit, x, y) {
        if (!this.canSetAutoMoveDestination(unit, x, y)) return false;
        unit.autoMoveEnabled = true;
        unit.autoMoveDestination = { x, y };
        this.clearSelection();
        return true;
    }

    clearAutoMove(unit) {
        if (!unit) return;
        unit.autoMoveEnabled = false;
        unit.autoMoveDestination = null;
        if (this.state === Game.STATES.AUTO_DESTINATION && this.selectedUnit === unit) {
            this.clearSelection();
        }
    }

    beginAutoDestinationSelection(unit) {
        if (!this.isAutoMovableShip(unit) || unit.owner !== this.currentPlayer) return false;
        this.clearRangePreview();
        this.selectedUnit = unit;
        this.selectedUnitOriginalPos = { x: unit.x, y: unit.y };
        this.validMoveTiles = [];
        this.validAttackTiles = [];
        this.validUnloadTiles = [];
        this.state = Game.STATES.AUTO_DESTINATION;
        return true;
    }

    clearSelection() {
    // Reset selection and UI state
    this.selectedUnit = null;
    this.selectedUnitOriginalPos = null;
    this.state = Game.STATES.IDLE;
    this.validMoveTiles = [];
    this.validAttackTiles = [];
    this.validUnloadTiles = [];
    this.clearRangePreview();
    // Hide unit info panel
    const unitInfo = document.getElementById('unit-info');
    if (unitInfo) unitInfo.style.display = 'none';
    // Hide unload button
    const unloadBtn = document.getElementById('unload-btn');
    if (unloadBtn) unloadBtn.style.display = 'none';
}

    getAutoMoveStepPath(unit) {
        if (!unit?.autoMoveEnabled || !unit.autoMoveDestination || unit.hasMoved || unit.health <= 0 || unit.x < 0) return [];
        const destination = unit.autoMoveDestination;
        if (unit.x === destination.x && unit.y === destination.y) {
            this.clearAutoMove(unit);
            return [];
        }

        const fullPath = this.findAutoMovePath(unit, destination.x, destination.y);
        if (!fullPath || fullPath.length === 0) {
            return [];
        }

        const fuelLimit = Math.max(0, unit.fuel ?? unit.maxFuel ?? Unit.getDefaultFuel(unit.type));
        const movementLimit = Math.min(unit.moveRange, fuelLimit);
        let spent = 0;
        const stepPath = [];

        for (const step of fullPath) {
            const terrain = this.map.getTerrainAt(step.x, step.y);
            const moveCost = this.map.getMovementCost(terrain, unit.moveType);
            if (moveCost === Infinity || spent + moveCost > movementLimit) break;
            const occupant = this.getUnitAt(step.x, step.y);
            if (occupant && occupant !== unit) break;
            spent += moveCost;
            stepPath.push(step);
        }

        return stepPath;
    }

    async runPlayerAutoMoves() {
        if (this.state === Game.STATES.GAME_OVER || this.currentPlayer !== 1) return;
        const autoUnits = this.units.filter(unit =>
            unit.owner === 1 &&
            this.isAutoMovableShip(unit) &&
            unit.autoMoveEnabled &&
            unit.autoMoveDestination &&
            !unit.hasMoved &&
            unit.health > 0 &&
            unit.x >= 0
        );
        if (autoUnits.length === 0) return;

        this.clearSelection();
        this.state = Game.STATES.AUTO_MOVING;

        for (const unit of autoUnits) {
            if (this.state === Game.STATES.GAME_OVER || this.currentPlayer !== 1) break;
            const path = this.getAutoMoveStepPath(unit);
            if (path.length === 0) continue;

            this.currentPath = path;
            this.isAnimating = true;
            for (const step of path) {
                unit.x = step.x;
                unit.y = step.y;
                await this.sleep(150);
            }
            this.consumeFuelForPath(unit, path);
            this.currentPath = [];
            this.isAnimating = false;

            unit.hasMoved = true;
            unit.hasAttacked = true;
            if (unit.autoMoveDestination && unit.x === unit.autoMoveDestination.x && unit.y === unit.autoMoveDestination.y) {
                this.clearAutoMove(unit);
            }
            await this.sleep(200);
        }

        this.isAnimating = false;
        this.currentPath = [];
        if (this.state !== Game.STATES.GAME_OVER && this.currentPlayer === 1) {
            this.state = Game.STATES.IDLE;
        }
    }
        


    // Very basic distance calculation (Manhattan distance)
    getDistance(x1, y1, x2, y2) {
        return Math.abs(x1 - x2) + Math.abs(y1 - y2);
    }

    clearRangePreview() {
        this.previewAttackTiles = [];
        this.previewAttackUnit = null;
    }

    // Modified calculateMoveRange to store parent map for path reconstruction
    calculateMoveRange(unit) {
        this.validMoveTiles = [];
        this.moveParents = {};
        const fuelLimit = Math.max(0, unit.fuel ?? unit.maxFuel ?? Unit.getDefaultFuel(unit.type));
        const movementLimit = Math.min(unit.moveRange, fuelLimit);
        if (movementLimit <= 0) {
            if (unit.moveType !== Unit.MOVE_TYPES.AIR) {
                this.validMoveTiles.push({ x: unit.x, y: unit.y });
            }
            return;
        }
        const openSet = [{ x: unit.x, y: unit.y, cost: 0 }];
        const gScore = {};
        const startKey = `${unit.x},${unit.y}`;
        gScore[startKey] = 0;
        const directions = [
            { x: 0, y: -1 }, // North
            { x: 1, y: 0 },  // East
            { x: 0, y: 1 },  // South
            { x: -1, y: 0 }  // West
        ];
        while (openSet.length > 0) {
            openSet.sort((a, b) => a.cost - b.cost);
            const current = openSet.shift();
            const currentKey = `${current.x},${current.y}`;
            if (current.cost > gScore[currentKey]) continue;
            if (current.cost <= movementLimit) {
                const occupant = this.getUnitAt(current.x, current.y);
                const canStop = !occupant || occupant === unit ||
                    this.canLoadUnit(unit, occupant) ||
                    (occupant.owner === unit.owner && occupant.type === unit.type && occupant.health < 10 && unit.health < 10);
                if (canStop) {
                    this.validMoveTiles.push({ x: current.x, y: current.y });
                }
            }
            for (const dir of directions) {
                const currentTerrain = this.map.getTerrainAt(current.x, current.y);
                if (currentKey !== startKey && this.map.isRiver(currentTerrain) && unit.moveType === Unit.MOVE_TYPES.FOOT) continue;

                const nx = current.x + dir.x;
                const ny = current.y + dir.y;
                if (!this.map.isValidTile(nx, ny)) continue;
                const terrain = this.map.getTerrainAt(nx, ny);
                const moveCost = this.map.getMovementCost(terrain, unit.moveType);
                if (moveCost === Infinity) continue;
                const occupant = this.getUnitAt(nx, ny);
                if (occupant && occupant !== unit && occupant.owner !== unit.owner) continue; // block enemy
                const totalCost = current.cost + moveCost;
                const neighborKey = `${nx},${ny}`;
                if (totalCost <= movementLimit && (gScore[neighborKey] === undefined || totalCost < gScore[neighborKey])) {
                    gScore[neighborKey] = totalCost;
                    this.moveParents[neighborKey] = currentKey; // store parent for path
                    openSet.push({ x: nx, y: ny, cost: totalCost });
                }
            }
        }
    }

    findPathAStar(unit, targetX, targetY) {
        const openSet = [{ x: unit.x, y: unit.y, g: 0, f: this.getDistance(unit.x, unit.y, targetX, targetY) }];
        const gScore = {};
        const startKey = `${unit.x},${unit.y}`;
        gScore[startKey] = 0;
        const cameFrom = {};

        const directions = [
            { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }
        ];

        let iterations = 0;

        while (openSet.length > 0 && iterations < 1000) {
            iterations++;
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();
            
            if (current.x === targetX && current.y === targetY) {
                const path = [];
                let currKey = `${current.x},${current.y}`;
                while (cameFrom[currKey]) {
                    const node = cameFrom[currKey];
                    path.unshift({x: node.x, y: node.y});
                    currKey = `${node.px},${node.py}`;
                }
                return path;
            }

            const currentKey = `${current.x},${current.y}`;

            for (const dir of directions) {
                const nx = current.x + dir.x;
                const ny = current.y + dir.y;
                if (!this.map.isValidTile(nx, ny)) continue;
                
                const currentTerrain = this.map.getTerrainAt(current.x, current.y);
                if (currentKey !== startKey && this.map.isRiver(currentTerrain) && unit.moveType === Unit.MOVE_TYPES.FOOT) continue;
                
                const terrain = this.map.getTerrainAt(nx, ny);
                let moveCost = this.map.getMovementCost(terrain, unit.moveType);
                if (moveCost === Infinity) continue;
                
                const occupant = this.getUnitAt(nx, ny);
                if (occupant && occupant !== unit && occupant.owner !== unit.owner) {
                    continue; // block enemy
                }
                
                const tentativeG = gScore[currentKey] + moveCost;
                const neighborKey = `${nx},${ny}`;
                
                if (gScore[neighborKey] === undefined || tentativeG < gScore[neighborKey]) {
                    cameFrom[neighborKey] = { px: current.x, py: current.y, x: nx, y: ny };
                    gScore[neighborKey] = tentativeG;
                    const h = this.getDistance(nx, ny, targetX, targetY);
                    openSet.push({ x: nx, y: ny, g: tentativeG, f: tentativeG + h });
                }
            }
        }
        return null;
    }

    findAutoMovePath(unit, targetX, targetY) {
        const targetOccupant = this.getUnitAt(targetX, targetY);
        if (targetOccupant && targetOccupant !== unit) return null;

        const openSet = [{ x: unit.x, y: unit.y, g: 0, f: this.getDistance(unit.x, unit.y, targetX, targetY) }];
        const gScore = {};
        const startKey = `${unit.x},${unit.y}`;
        gScore[startKey] = 0;
        const cameFrom = {};
        const directions = [
            { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }
        ];

        let iterations = 0;
        while (openSet.length > 0 && iterations < 2000) {
            iterations++;
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();

            if (current.x === targetX && current.y === targetY) {
                const path = [];
                let currKey = `${current.x},${current.y}`;
                while (cameFrom[currKey]) {
                    const node = cameFrom[currKey];
                    path.unshift({ x: node.x, y: node.y });
                    currKey = `${node.px},${node.py}`;
                }
                return path;
            }

            const currentKey = `${current.x},${current.y}`;
            if (current.g > gScore[currentKey]) continue;

            for (const dir of directions) {
                const nx = current.x + dir.x;
                const ny = current.y + dir.y;
                if (!this.map.isValidTile(nx, ny)) continue;

                const currentTerrain = this.map.getTerrainAt(current.x, current.y);
                if (currentKey !== startKey && this.map.isRiver(currentTerrain) && unit.moveType === Unit.MOVE_TYPES.FOOT) continue;

                const terrain = this.map.getTerrainAt(nx, ny);
                const moveCost = this.map.getMovementCost(terrain, unit.moveType);
                if (moveCost === Infinity) continue;

                const occupant = this.getUnitAt(nx, ny);
                if (occupant && occupant !== unit) continue;

                const tentativeG = gScore[currentKey] + moveCost;
                const neighborKey = `${nx},${ny}`;
                if (gScore[neighborKey] === undefined || tentativeG < gScore[neighborKey]) {
                    cameFrom[neighborKey] = { px: current.x, py: current.y, x: nx, y: ny };
                    gScore[neighborKey] = tentativeG;
                    const h = this.getDistance(nx, ny, targetX, targetY);
                    openSet.push({ x: nx, y: ny, g: tentativeG, f: tentativeG + h });
                }
            }
        }
        return null;
    }

    // Modified moveUnit to animate along the computed path and set animation flag
    moveUnit(targetX, targetY) {
        if (!this.selectedUnit) return false;
        if (![Game.STATES.UNIT_SELECTED, Game.STATES.POST_MOVE_MENU].includes(this.state)) return false;
        if (this.selectedUnit.hasMoved) return false;
        if (this.isAnimating) return false; // prevent new moves during animation
        const isValid = this.validMoveTiles.some(t => t.x === targetX && t.y === targetY);
        if (!isValid) return false;
        // Reconstruct path from selected unit to target using stored parents
        const path = this.reconstructMovePath(this.selectedUnit, targetX, targetY);
        // Store path for rendering arrows
        this.currentPath = path;
        // Animate movement
        this.isAnimating = true;
        const unit = this.selectedUnit;
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const animate = async () => {
            for (const step of path) {
                unit.x = step.x;
                unit.y = step.y;
                await sleep(150);
            }
            const didMove = path.length > 0;
            // Finalize move state
            unit.hasMoved = didMove;
            unit.hasAttacked = false;
            this.consumeFuelForPath(unit, path);
            this.isAnimating = false;
            this.currentPath = [];
            if (this.resolveFuelDepletion(unit)) {
                this.isAnimating = false;
                this.currentPath = [];
                this.clearSelection();
                this.checkWinCondition();
                return;
            }
            // Process special actions at destination
            // Find any unit other than the moving unit at the destination
            const finalOccupant = this.units.find(u => u !== unit && u.x === targetX && u.y === targetY);
            if (finalOccupant) {
                console.log('Attempting load: moving unit', unit.type, 'onto', finalOccupant.type);
                if (this.canLoadUnit(unit, finalOccupant)) {
                    // Load unit onto transport
                    finalOccupant.carriedUnits.push(unit);
                    // Remove unit from active unit list and map
                    this.units = this.units.filter(u => u !== unit);
                    unit.x = -1; unit.y = -1; // Off-map coordinates
                    unit.hasMoved = true; unit.hasAttacked = true; unit.loadedTurn = this.turnCount; // Track load turn
                    console.log('Loaded unit onto transport');
                this.clearSelection();
                    return;
                } else if (finalOccupant.owner === unit.owner && finalOccupant.type === unit.type && finalOccupant.health < 10 && unit.health < 10) {
                    // Join
                    const needed = 10 - finalOccupant.health;
                    const transferred = Math.min(unit.health, needed);
                    finalOccupant.health += transferred;
                    
                    if (finalOccupant.maxFuel !== Infinity) {
                        finalOccupant.fuel = Math.min(finalOccupant.maxFuel ?? Unit.getDefaultFuel(finalOccupant.type), finalOccupant.fuel + (unit.fuel ?? 0));
                    }
                    if (finalOccupant.maxAmmo !== undefined && finalOccupant.maxAmmo !== null) {
                        finalOccupant.ammo = Math.min(finalOccupant.maxAmmo, finalOccupant.ammo + (unit.ammo ?? 0));
                    }
                    if (finalOccupant.maxSupplyAmmo > 0) {
                        finalOccupant.supplyAmmo = Math.min(finalOccupant.maxSupplyAmmo, finalOccupant.supplyAmmo + (unit.supplyAmmo ?? 0));
                    }
                    this.units = this.units.filter(u => u !== unit);
                    finalOccupant.hasMoved = true;
                    finalOccupant.hasAttacked = true;
                    this.clearSelection();
                    return;
                }
            }
            // Normal move: calculate attack range
            this.calculateAttackRange(unit);
            if (this.validAttackTiles.length > 0) {
                this.state = Game.STATES.POST_MOVE_MENU;
            } else {
                unit.hasMoved = true;
                unit.hasAttacked = true;
                this.checkCapture(unit);
                // If the unit is a transport with loaded units, enter unloading mode automatically
                if ((unit.type === Unit.TYPES.TRANSPORT || unit.type === Unit.TYPES.HELI_TRANSPORT || unit.type === Unit.TYPES.HOVERCRAFT) && unit.carriedUnits && unit.carriedUnits.length > 0) {
                    this.state = Game.STATES.UNLOADING;
                    this.selectedUnit = unit;
                    this.calculateUnloadRange(unit);
                    // Update UI info panel
                    if (this.updateUnitInfo) this.updateUnitInfo(unit);
                } else {
                    this.clearSelection();
                }
            }
        };
        animate();
        return true;
    }

    calculateAttackRange(unit) {
        this.validAttackTiles = [];
        if (!this.hasAmmo(unit)) return;
        // Indirect units cannot attack after moving; they may only perform direct attacks (distance == 1).
        // Allow indirect units that have moved to bypass the attackRange guard.
        if (!unit.attackRange && !(this.isIndirectUnit(unit) && unit.hasMoved)) return;

        for (let y = 0; y < this.map.rows; y++) {
            for (let x = 0; x < this.map.cols; x++) {
                const dist = this.getDistance(unit.x, unit.y, x, y);
                if (this.canAttackUnitAtDistance(unit, this.getUnitAt(x, y), dist)) {
                    const occupant = this.getUnitAt(x, y);
                    if (occupant && occupant.owner !== unit.owner) {
                        const baseDamage = Unit.MATCHUPS[unit.type][occupant.type];
                        if (baseDamage > 0) {
                            this.validAttackTiles.push({x, y});
                        }
                    }
                }
            }
        }
    }

    reconstructMovePath(unit, targetX, targetY) {
        const path = [];
        let curKey = `${targetX},${targetY}`;
        const startKey = `${unit.x},${unit.y}`;
        while (curKey !== startKey) {
            const [cx, cy] = curKey.split(',').map(Number);
            path.unshift({ x: cx, y: cy });
            const parentKey = this.moveParents?.[curKey];
            if (!parentKey) break;
            curKey = parentKey;
        }
        return path;
    }

    getPathFuelCost(unit, path) {
        return path.reduce((sum, step) => {
            const terrain = this.map.getTerrainAt(step.x, step.y);
            const cost = this.map.getMovementCost(terrain, unit.moveType);
            return sum + (cost === Infinity ? 0 : cost);
        }, 0);
    }

    consumeFuelForPath(unit, path) {
        if (!unit || !Array.isArray(path) || path.length === 0) return 0;
        const cost = this.getPathFuelCost(unit, path);
        unit.fuel = Math.max(0, (unit.fuel ?? unit.maxFuel ?? Unit.getDefaultFuel(unit.type)) - cost);
        return cost;
    }

    hasAmmo(unit) {
        return !unit || unit.maxAmmo === null || unit.maxAmmo === undefined || unit.ammo > 0;
    }

    consumeAmmo(unit) {
        if (!unit || unit.maxAmmo === null || unit.maxAmmo === undefined) return;
        unit.ammo = Math.max(0, unit.ammo - 1);
    }

    resolveFuelDepletion(unit) {
        if (!unit || unit.health <= 0 || unit.fuel > 0) return false;
        if (unit.moveType !== Unit.MOVE_TYPES.AIR) return false;

        unit.takeDamage(9999);
        this.addExplosion(unit.x, unit.y);
        this.units = this.units.filter(u => u.health > 0);
        return true;
    }

    removeCrashedAircraft() {
        this.units.slice().forEach(unit => this.resolveFuelDepletion(unit));
    }

    resupplyUnitIfPossible(unit) {
        if (!unit || unit.health <= 0 || unit.x < 0) return false;
        let didResupply = false;

        if (this.canResupplyFuel(unit)) {
            unit.fuel = unit.maxFuel ?? Unit.getDefaultFuel(unit.type);
            didResupply = true;
        }

        didResupply = this.resupplyAmmoIfPossible(unit) || didResupply;

        if (unit.carriedUnits) {
            unit.carriedUnits.forEach(carried => {
                if (this.canResupplyFuel(unit) || (unit.type === Unit.TYPES.HOVERCRAFT && carried.moveType !== Unit.MOVE_TYPES.AIR)) {
                    carried.fuel = carried.maxFuel ?? Unit.getDefaultFuel(carried.type);
                    didResupply = true;
                }
                didResupply = this.resupplyAmmoIfPossible(carried, unit) || didResupply;
            });
        }
        return didResupply;
    }

    canResupplyFuel(unit) {
        if (unit.maxFuel === Infinity) return false;

        if (this.isOnOwnedSupplyProperty(unit)) return true;

        return this.units.some(other => {
            if (other === unit || other.owner !== unit.owner || other.health <= 0) return false;
            if (this.getDistance(unit.x, unit.y, other.x, other.y) > 1) return false;

            if (other.type === Unit.TYPES.HOVERCRAFT) {
                return unit.moveType !== Unit.MOVE_TYPES.AIR;
            }
            if (other.type === Unit.TYPES.TRANSPORT) {
                return !(unit.moveType === Unit.MOVE_TYPES.AIR && unit.type !== Unit.TYPES.HELI_TRANSPORT);
            }
            return false;
        });
    }

    resupplyAmmoIfPossible(unit, carrier = null) {
        if (!unit || unit.maxAmmo === null || unit.maxAmmo === undefined) return false;

        if (this.isOnOwnedSupplyProperty(unit, carrier)) {
            const beforeAmmo = unit.ammo;
            const beforeSupplyAmmo = unit.supplyAmmo;
            unit.ammo = unit.maxAmmo;
            if (unit.type === Unit.TYPES.TRANSPORT && unit.maxSupplyAmmo > 0) {
                unit.supplyAmmo = unit.maxSupplyAmmo;
            }
            return beforeAmmo !== unit.ammo || beforeSupplyAmmo !== unit.supplyAmmo;
        }

        if (carrier && carrier.type === Unit.TYPES.HOVERCRAFT && unit.moveType !== Unit.MOVE_TYPES.AIR) {
            const beforeAmmo = unit.ammo;
            unit.ammo = unit.maxAmmo;
            return beforeAmmo !== unit.ammo;
        }

        if (unit.ammo >= unit.maxAmmo) return false;

        // Hovercraft resupply (infinite ammo supply to adjacent non-air units)
        if (unit.moveType !== Unit.MOVE_TYPES.AIR) {
            const hasHoverSupply = this.units.some(other =>
                other !== unit &&
                other.owner === unit.owner &&
                other.type === Unit.TYPES.HOVERCRAFT &&
                other.health > 0 &&
                this.getDistance(unit.x, unit.y, other.x, other.y) <= 1
            );
            if (hasHoverSupply) {
                unit.ammo = unit.maxAmmo;
                return true;
            }
        }

        const transport = carrier && carrier.type === Unit.TYPES.TRANSPORT
            ? carrier
            : this.findAmmoTransportForUnit(unit);
        if (!transport || transport.supplyAmmo <= 0) return false;

        const needed = unit.maxAmmo - unit.ammo;
        const supplied = Math.min(needed, transport.supplyAmmo);
        unit.ammo += supplied;
        transport.supplyAmmo -= supplied;
        return supplied > 0;
    }

    findAmmoTransportForUnit(unit) {
        return this.units.find(other =>
            other !== unit &&
            other.owner === unit.owner &&
            other.type === Unit.TYPES.TRANSPORT &&
            other.health > 0 &&
            other.supplyAmmo > 0 &&
            this.getDistance(unit.x, unit.y, other.x, other.y) <= 1 &&
            !(unit.moveType === Unit.MOVE_TYPES.AIR && unit.type !== Unit.TYPES.HELI_TRANSPORT)
        );
    }

    isOnOwnedSupplyProperty(unit, carrier = null) {
        const x = carrier ? carrier.x : unit.x;
        const y = carrier ? carrier.y : unit.y;
        const terrain = this.map.getTerrainAt(x, y);
        const owner = unit.owner;
        const moveType = unit.moveType;
        if (moveType === Unit.MOVE_TYPES.AIR) {
            return (owner === 1 && terrain === GameMap.TERRAIN.AIRPORT_P1) || (owner === 2 && terrain === GameMap.TERRAIN.AIRPORT_P2);
        } else if (moveType === Unit.MOVE_TYPES.SEA || moveType === Unit.MOVE_TYPES.HOVER) {
            return (owner === 1 && terrain === GameMap.TERRAIN.PORT_P1) || (owner === 2 && terrain === GameMap.TERRAIN.PORT_P2);
        } else {
            return (owner === 1 && (terrain === GameMap.TERRAIN.CITY_P1 || terrain === GameMap.TERRAIN.FACTORY_P1 || terrain === GameMap.TERRAIN.PORT_P1 || terrain === GameMap.TERRAIN.HQ_P1)) ||
                   (owner === 2 && (terrain === GameMap.TERRAIN.CITY_P2 || terrain === GameMap.TERRAIN.FACTORY_P2 || terrain === GameMap.TERRAIN.PORT_P2 || terrain === GameMap.TERRAIN.HQ_P2));
        }
    }

    isOwnedSupplyPropertyForTile(unit, x, y) {
        const terrain = this.map.getTerrainAt(x, y);
        const owner = unit.owner;
        const moveType = unit.moveType;
        if (moveType === Unit.MOVE_TYPES.AIR) {
            return (owner === 1 && terrain === GameMap.TERRAIN.AIRPORT_P1) || (owner === 2 && terrain === GameMap.TERRAIN.AIRPORT_P2);
        } else if (moveType === Unit.MOVE_TYPES.SEA || moveType === Unit.MOVE_TYPES.HOVER) {
            return (owner === 1 && terrain === GameMap.TERRAIN.PORT_P1) || (owner === 2 && terrain === GameMap.TERRAIN.PORT_P2);
        } else {
            return (owner === 1 && (terrain === GameMap.TERRAIN.CITY_P1 || terrain === GameMap.TERRAIN.FACTORY_P1 || terrain === GameMap.TERRAIN.PORT_P1 || terrain === GameMap.TERRAIN.HQ_P1)) ||
                   (owner === 2 && (terrain === GameMap.TERRAIN.CITY_P2 || terrain === GameMap.TERRAIN.FACTORY_P2 || terrain === GameMap.TERRAIN.PORT_P2 || terrain === GameMap.TERRAIN.HQ_P2));
        }
    }

    findBestRetreatTile(unit, tiles) {
        if (!tiles || tiles.length === 0) return null;
        let bestTile = null;
        let bestScore = -Infinity;
        for (let tile of tiles) {
            let score = this.map.getDefenseBonus(this.map.getTerrainAt(tile.x, tile.y));
            if (this.isOwnedSupplyPropertyForTile(unit, tile.x, tile.y)) {
                score += 25;
            }
            if (tile.x === unit.x && tile.y === unit.y) {
                score += 10;
            }
            if (score > bestScore) {
                bestScore = score;
                bestTile = tile;
            }
        }
        return bestTile;
    }

    getAIDirectAttackMultiplier(attacker, dist) {
        return attacker?.owner === 2 && dist === 1 ? 1.1 : 1;
    }

    calculateCombatDamage(attacker, defender, terrainDef, dist) {
        const base = Unit.MATCHUPS[attacker?.type]?.[defender?.type] || 0;
        if (base <= 0) return 0;
        const multiplier = this.getAIDirectAttackMultiplier(attacker, dist);
        return Math.max(1, Math.floor(base * multiplier * (attacker.health / 10) * Math.max(0, 10 - terrainDef) / 10));
    }

    estimateCounterAttackDamage(attacker, defender, attackTile) {
        if (this.isIndirectUnit(attacker) || !this.hasAmmo(defender) || !defender.attackRange) return 0;
        const dist = this.getDistance(attackTile.x, attackTile.y, defender.x, defender.y);
        if (!this.canAttackUnitAtDistance(defender, attacker, dist)) return 0;
        const base = Unit.MATCHUPS[defender.type][attacker.type] || 0;
        if (base <= 0) return 0;
        const terrainDef = this.getUnitDefenseBonus(attacker, attackTile.x, attackTile.y);
        return this.calculateCombatDamage(defender, attacker, terrainDef, dist);
    }

    estimateAttackDamage(attacker, defender, attackX = null, attackY = null, attackerX = null, attackerY = null) {
        const terrainDef = defender.moveType === Unit.MOVE_TYPES.AIR ? 0 : this.getUnitDefenseBonus(defender, attackX, attackY);
        const dist = (attackerX !== null && attackerY !== null)
            ? this.getDistance(attackerX, attackerY, defender.x, defender.y)
            : this.getDistance(attacker.x, attacker.y, defender.x, defender.y);
        return this.calculateCombatDamage(attacker, defender, terrainDef, dist);
    }

    getEnemyThreatAtTile(unit, x, y, enemyOwner = null) {
        if (!unit) return { damage: 0, valueLoss: 0, attackers: 0 };
        const owner = enemyOwner ?? (unit.owner === 1 ? 2 : 1);
        let totalDamage = 0;
        let attackers = 0;

        for (const enemy of this.units) {
            if (enemy.owner !== owner || enemy.health <= 0 || enemy.x < 0 || !this.hasAmmo(enemy) || !enemy.attackRange) continue;
            const originTiles = this.getPotentialAttackOrigins(enemy);
            let bestDamage = 0;
            for (const origin of originTiles) {
                const dist = this.getDistance(origin.x, origin.y, x, y);
                if (!this.canThreatAttackUnitAtDistance(enemy, unit, dist)) continue;
                const damage = this.estimateAttackDamage(enemy, unit, x, y, origin.x, origin.y);
                if (damage > bestDamage) bestDamage = damage;
            }
            if (bestDamage > 0) {
                totalDamage += bestDamage;
                attackers++;
            }
        }

        const valueLoss = Math.min(unit.health, totalDamage) * this.getUnitBattleValue(unit) / 10;
        return { damage: totalDamage, valueLoss, attackers };
    }

    getPotentialAttackOrigins(unit) {
        if (!unit || unit.x < 0) return [];
        if (this.isIndirectUnit(unit)) return [{ x: unit.x, y: unit.y }];

        const savedMoveTiles = this.validMoveTiles;
        const savedMoveParents = this.moveParents;
        this.calculateMoveRange(unit);
        const origins = [...this.validMoveTiles, { x: unit.x, y: unit.y }]
            .filter((tile, index, arr) => arr.findIndex(t => t.x === tile.x && t.y === tile.y) === index)
            .filter(tile => {
                const occ = this.getUnitAt(tile.x, tile.y);
                return !occ || occ === unit;
            });
        this.validMoveTiles = savedMoveTiles;
        this.moveParents = savedMoveParents;
        return origins;
    }

    canThreatAttackUnitAtDistance(unit, target, dist) {
        if (!unit || !target || !unit.attackRange) return false;
        const isAirTarget = [Unit.TYPES.HELI_TRANSPORT, Unit.TYPES.FIGHTER, Unit.TYPES.BOMBER].includes(target.type);
        if (unit.type === Unit.TYPES.BATTLESHIP && isAirTarget) {
            return dist === 1;
        }
        return dist >= unit.attackRange.min && dist <= unit.attackRange.max;
    }

    getSupportScoreAtTile(unit, x, y) {
        let score = 0;
        for (const ally of this.units) {
            if (ally === unit || ally.owner !== unit.owner || ally.health <= 0 || ally.x < 0) continue;
            const d = this.getDistance(x, y, ally.x, ally.y);
            if (d <= 2) score += 8;
            else if (d <= 4) score += 3;
        }
        return Math.min(28, score);
    }

    getStrategicTileScore(unit, x, y, targetProperty = null) {
        let score = this.map.getDefenseBonus(this.map.getTerrainAt(x, y)) * 2;
        const terrain = this.map.getTerrainAt(x, y);

        if (this.isOwnedSupplyPropertyForTile(unit, x, y)) score += 12;
        if (this.isCapturablePropertyForPlayer(terrain, unit.owner)) {
            let captureBonus = this.getPropertyValue(terrain) * 15;
            
            // Tactical advantage: weapon manufacturing superiority
            if ([GameMap.TERRAIN.FACTORY_NEUTRAL, GameMap.TERRAIN.FACTORY_P1, GameMap.TERRAIN.FACTORY_P2, 
                 GameMap.TERRAIN.AIRPORT_NEUTRAL, GameMap.TERRAIN.AIRPORT_P1, GameMap.TERRAIN.AIRPORT_P2,
                 GameMap.TERRAIN.PORT_NEUTRAL, GameMap.TERRAIN.PORT_P1, GameMap.TERRAIN.PORT_P2].includes(terrain)) {
                captureBonus += 40;
            }
            
            // Tactical advantage: funds superiority
            captureBonus += 25;

            score += unit.type === Unit.TYPES.INFANTRY ? captureBonus : this.getPropertyValue(terrain) * 2;
        }
        if (targetProperty) {
            const before = this.getDistance(unit.x, unit.y, targetProperty.x, targetProperty.y);
            const after = this.getDistance(x, y, targetProperty.x, targetProperty.y);
            score += (before - after) * 5;
            if (x === targetProperty.x && y === targetProperty.y) score += 80 + this.getPropertyValue(targetProperty.terrain) * 10;
        }

        score += this.getSupportScoreAtTile(unit, x, y);
        const threat = this.getEnemyThreatAtTile(unit, x, y);
        const lossRatio = threat.valueLoss / Math.max(1000, this.getUnitBattleValue(unit));
        score -= lossRatio * (this.aiDifficulty === 'hard' ? 26 : 16);
        if (threat.damage >= unit.health) score -= this.aiDifficulty === 'hard' ? 70 : 40;
        return score;
    }

    getMonteCarloConfig() {
        if (this.aiDifficulty === 'hard') return { trials: 10, plies: 3, weight: 0.018 };
        if (this.aiDifficulty === 'normal') return { trials: 4, plies: 2, weight: 0.012 };
        return { trials: 0, plies: 0, weight: 0 };
    }

    cloneUnitsForSimulation() {
        return this.units
            .filter(u => u.health > 0 && u.x >= 0)
            .map(u => ({
                type: u.type,
                owner: u.owner,
                x: u.x,
                y: u.y,
                health: u.health,
                ammo: u.ammo,
                maxAmmo: u.maxAmmo,
                moveRange: u.moveRange,
                moveType: u.moveType,
                attackRange: u.attackRange ? { min: u.attackRange.min, max: u.attackRange.max } : null
            }));
    }

    evaluateAIMonteCarloAction(unit, action) {
        const config = this.getMonteCarloConfig();
        if (config.trials <= 0 || !unit || !action) return 0;

        let total = 0;
        for (let i = 0; i < config.trials; i++) {
            const simUnits = this.cloneUnitsForSimulation();
            const simUnit = simUnits.find(u => u.owner === unit.owner && u.type === unit.type && u.x === unit.x && u.y === unit.y && u.health === unit.health);
            if (!simUnit) continue;

            const baseline = this.evaluateSimulatedBoard(simUnits, unit.owner);
            this.applySimulatedAIAction(simUnits, simUnit, action);
            for (let ply = 0; ply < config.plies; ply++) {
                const player = ply % 2 === 0 ? 1 : 2;
                // MCTS-like rollout: Use heuristics instead of purely random
                this.runHeuristicSimulationPly(simUnits, player);
            }
            total += this.evaluateSimulatedBoard(simUnits, unit.owner) - baseline;
        }

        return (total / config.trials) * config.weight;
    }

    runHeuristicSimulationPly(simUnits, player) {
        // Find a random active unit for the player
        const activeUnits = simUnits.filter(u => u.owner === player && u.health > 0);
        if (activeUnits.length === 0) return;
        const u = activeUnits[Math.floor(Math.random() * activeUnits.length)];
        
        // Very basic heuristic: if there's an enemy nearby, attack it; otherwise move randomly
        const enemies = simUnits.filter(e => e.owner !== player && e.health > 0);
        let attacked = false;
        if (u.attackRange) {
            for (const enemy of enemies) {
                const d = Math.abs(u.x - enemy.x) + Math.abs(u.y - enemy.y);
                if (d >= u.attackRange.min && d <= u.attackRange.max) {
                    const dmg = Math.floor((Unit.MATCHUPS[u.type][enemy.type] || 0) * (u.health / 10));
                    enemy.health -= dmg;
                    attacked = true;
                    break;
                }
            }
        }
        if (!attacked) {
            const dir = [[0,1],[0,-1],[1,0],[-1,0]][Math.floor(Math.random()*4)];
            u.x += dir[0]; u.y += dir[1];
        }
    }

    applySimulatedAIAction(simUnits, simUnit, action) {
        simUnit.x = action.moveTile?.x ?? action.tile?.x ?? simUnit.x;
        simUnit.y = action.moveTile?.y ?? action.tile?.y ?? simUnit.y;

        if (action.enemy && this.simHasAmmo(simUnit)) {
            const target = simUnits.find(u =>
                u.owner !== simUnit.owner &&
                u.type === action.enemy.type &&
                u.x === action.enemy.x &&
                u.y === action.enemy.y &&
                u.health > 0
            );
            if (target) {
                this.applySimulatedAttack(simUnits, simUnit, target);
            }
        }

        this.removeDeadSimUnits(simUnits);
    }

    runRandomSimulationPly(simUnits, player) {
        const actors = simUnits
            .filter(u => u.owner === player && u.health > 0 && u.x >= 0)
            .sort(() => Math.random() - 0.5)
            .slice(0, 4);

        for (const actor of actors) {
            if (!this.simHasAmmo(actor) || !actor.attackRange) continue;
            const targets = simUnits.filter(target =>
                target.owner !== player &&
                target.health > 0 &&
                this.canSimulatedThreatAttack(actor, target)
            );
            if (targets.length === 0) continue;

            targets.sort((a, b) => {
                const aDamage = this.estimateSimulatedAttackDamage(actor, a);
                const bDamage = this.estimateSimulatedAttackDamage(actor, b);
                return (bDamage + this.getUnitBattleValue(b) / 5000) - (aDamage + this.getUnitBattleValue(a) / 5000);
            });
            const poolSize = Math.min(3, targets.length);
            const target = targets[Math.floor(Math.random() * poolSize)];
            this.applySimulatedAttack(simUnits, actor, target);
            this.removeDeadSimUnits(simUnits);
        }
    }

    canSimulatedThreatAttack(attacker, target) {
        const dist = this.getDistance(attacker.x, attacker.y, target.x, target.y);
        if (this.canThreatAttackUnitAtDistance(attacker, target, dist)) return true;
        if (this.isIndirectUnit(attacker)) return false;
        const reach = (attacker.moveRange || 0) + (attacker.attackRange?.max || 0);
        return dist <= reach && (Unit.MATCHUPS[attacker.type]?.[target.type] || 0) > 0;
    }

    applySimulatedAttack(simUnits, attacker, target) {
        const damage = this.estimateSimulatedAttackDamage(attacker, target);
        if (damage <= 0) return;
        target.health -= damage;
        if (this.simHasAmmo(attacker)) this.simConsumeAmmo(attacker);

        if (target.health > 0 && this.simHasAmmo(target)) {
            const dist = this.getDistance(attacker.x, attacker.y, target.x, target.y);
            if (this.canThreatAttackUnitAtDistance(target, attacker, dist)) {
                attacker.health -= this.estimateSimulatedAttackDamage(target, attacker);
                this.simConsumeAmmo(target);
            }
        }
        this.removeDeadSimUnits(simUnits);
    }

    estimateSimulatedAttackDamage(attacker, defender) {
        const base = Unit.MATCHUPS[attacker?.type]?.[defender?.type] || 0;
        if (base <= 0) return 0;
        const terrainDef = defender.moveType === Unit.MOVE_TYPES.AIR ? 0 : this.map.getDefenseBonus(this.map.getTerrainAt(defender.x, defender.y));
        const dist = this.getDistance(attacker.x, attacker.y, defender.x, defender.y);
        const multiplier = this.getAIDirectAttackMultiplier(attacker, dist);
        return Math.max(1, Math.floor(base * multiplier * (attacker.health / 10) * Math.max(0, 10 - terrainDef) / 10));
    }

    evaluateSimulatedBoard(simUnits, player) {
        const enemy = player === 1 ? 2 : 1;
        let score = 0;

        for (const unit of simUnits) {
            const value = (Unit.COSTS[unit.type] || 1000) * (unit.health / 10);
            score += unit.owner === player ? value : -value;

            const propertyBonus = this.getSimulatedPropertyPressure(unit, player, enemy);
            score += unit.owner === player ? propertyBonus : -propertyBonus;
        }

        return score;
    }

    getSimulatedPropertyPressure(unit, player, enemy) {
        let best = 0;
        for (let y = 0; y < this.map.rows; y++) {
            for (let x = 0; x < this.map.cols; x++) {
                const terrain = this.map.getTerrainAt(x, y);
                const owner = unit.owner;
                if (!this.isCapturablePropertyForPlayer(terrain, owner)) continue;
                const d = this.getDistance(unit.x, unit.y, x, y);
                if (d > 8) continue;
                let value = this.getPropertyValue(terrain) * 120 - d * 18;
                if (unit.type === Unit.TYPES.INFANTRY) value *= 1.7;
                if (owner === player && terrain === GameMap.TERRAIN.HQ_P1) value += enemy === 1 ? 0 : 900;
                if (owner === player && terrain === GameMap.TERRAIN.HQ_P2) value += enemy === 2 ? 0 : 900;
                if (value > best) best = value;
            }
        }
        return best;
    }

    simHasAmmo(unit) {
        return !unit || unit.maxAmmo === null || unit.maxAmmo === undefined || unit.ammo > 0;
    }

    simConsumeAmmo(unit) {
        if (!unit || unit.maxAmmo === null || unit.maxAmmo === undefined) return;
        unit.ammo = Math.max(0, unit.ammo - 1);
    }

    removeDeadSimUnits(simUnits) {
        for (let i = simUnits.length - 1; i >= 0; i--) {
            if (simUnits[i].health <= 0) simUnits.splice(i, 1);
        }
    }

    previewEnemyAttackRange(unit) {
        this.clearRangePreview();
        if (!unit || unit.owner === this.currentPlayer || unit.health <= 0) return false;
        if (!this.hasAmmo(unit)) return false;

        this.previewAttackUnit = unit;
        // Guard against units without attackRange
        if (!unit.attackRange) return false;
        const originTiles = this.isIndirectUnit(unit)
            ? [{ x: unit.x, y: unit.y }]
            : (() => {
                this.calculateMoveRange(unit);
                const tiles = [...this.validMoveTiles];
                this.validMoveTiles = [];
                this.moveParents = {};
                return tiles;
            })();
        const attackTileKeys = new Set();

        originTiles.forEach(origin => {
            for (let y = 0; y < this.map.rows; y++) {
                for (let x = 0; x < this.map.cols; x++) {
                    const dist = this.getDistance(origin.x, origin.y, x, y);
                    if (dist >= unit.attackRange.min && dist <= unit.attackRange.max) {
                        attackTileKeys.add(`${x},${y}`);
                    }
                }
            }
        });

        this.previewAttackTiles = [...attackTileKeys].map(key => {
            const [x, y] = key.split(',').map(Number);
            return { x, y };
        });
        return this.previewAttackTiles.length > 0;
    }

    canAttackUnitAtDistance(unit, target, dist) {
        if (!unit || !target || !unit.attackRange) return false;
        // Indirect units (e.g., battleship) can only perform direct attacks after they have moved.
        if (this.isIndirectUnit(unit) && unit.hasMoved) {
            return dist === 1;
        }
        const isAirTarget = [Unit.TYPES.HELI_TRANSPORT, Unit.TYPES.FIGHTER, Unit.TYPES.BOMBER].includes(target.type);
        if (unit.type === Unit.TYPES.BATTLESHIP && isAirTarget) {
            return dist === 1;
        }
        if (dist < unit.attackRange.min || dist > unit.attackRange.max) return false;
        return true;
    }

    calculateUnloadRange(unit) {
        this.validUnloadTiles = [];
        if (!unit.carriedUnits || unit.carriedUnits.length === 0) return;

        const unitToUnload = unit.carriedUnits[unit.carriedUnits.length - 1];
        const moveType = unitToUnload.moveType;

        const adj = [
            { x: unit.x, y: unit.y - 1 },
            { x: unit.x, y: unit.y + 1 },
            { x: unit.x - 1, y: unit.y },
            { x: unit.x + 1, y: unit.y }
        ];

        adj.forEach(t => {
            if (this.map.isValidTile(t.x, t.y)) {
                const occupant = this.getUnitAt(t.x, t.y);
                const terrain = this.map.getTerrainAt(t.x, t.y);
                const cost = this.map.getMovementCost(terrain, moveType);
                if (!occupant && cost !== Infinity) {
                    this.validUnloadTiles.push(t);
                }
            }
        });
    }

    unloadUnit(targetX, targetY) {
        if (this.state !== Game.STATES.UNLOADING || !this.selectedUnit) return false;
        
        const isValid = this.validUnloadTiles.some(t => t.x === targetX && t.y === targetY);
        if (isValid && this.selectedUnit.carriedUnits.length > 0) {
            const unitToUnload = this.selectedUnit.carriedUnits.pop();
            unitToUnload.x = targetX;
            unitToUnload.y = targetY;
                    unitToUnload.hasMoved = true;
                    unitToUnload.hasAttacked = true;
                    unitToUnload.loadedTurn = null; // Reset load turn after unload
            
            // Add the unloaded unit back to the active units list
            this.units.push(unitToUnload);
            
            this.audioManager.play('unload');
            
            this.calculateUnloadRange(this.selectedUnit);
            if (this.selectedUnit.carriedUnits.length === 0 || this.validUnloadTiles.length === 0) {
                this.selectedUnit.hasAttacked = true;
                this.checkCapture(this.selectedUnit);
                this.clearSelection();
            }
            return true;
        }
        return false;
    }

    async attackUnit(targetX, targetY) {
         if (!this.selectedUnit) return false;
         if (this.currentPlayer === 1 && this.state !== Game.STATES.ATTACKING) return false;
         if (this.selectedUnit.hasAttacked) return false;
         if (!this.hasAmmo(this.selectedUnit)) return false;
         // Allow indirect units to attack at distance 1 after moving; validation handled in canAttackUnitAtDistance.

         const targetUnit = this.getUnitAt(targetX, targetY);
         const isValidTarget = this.validAttackTiles.some(t => t.x === targetX && t.y === targetY);

         if (isValidTarget && targetUnit) {
             const terrainDef = (targetUnit.moveType === Unit.MOVE_TYPES.AIR) ? 0 : this.getUnitDefenseBonus(targetUnit);
             
             // Use matchup matrix
             const dist = this.getDistance(this.selectedUnit.x, this.selectedUnit.y, targetUnit.x, targetUnit.y);
             let damage = this.calculateCombatDamage(this.selectedUnit, targetUnit, terrainDef, dist);
             if (isNaN(damage) || damage < 1) damage = 1; // Ensure at least 1 damage, handle NaN

             let counterDamage = 0;
             const counterBaseDamage = Unit.MATCHUPS[targetUnit.type]?.[this.selectedUnit.type] || 0;
             if (this.hasAmmo(targetUnit) && (targetUnit.health - damage) > 0 && counterBaseDamage > 0) {
                 if (this.canAttackUnitAtDistance(targetUnit, this.selectedUnit, dist)) {
                     const attackerTerrainDef = (this.selectedUnit.moveType === Unit.MOVE_TYPES.AIR) ? 0 : this.getUnitDefenseBonus(this.selectedUnit);
                     
                     // Temporarily reduce target health to calculate correct counter damage based on surviving units
                     const originalHealth = targetUnit.health;
                     targetUnit.health -= damage;
                     counterDamage = this.calculateCombatDamage(targetUnit, this.selectedUnit, attackerTerrainDef, dist);
                     targetUnit.health = originalHealth;

                     if (isNaN(counterDamage) || counterDamage < 1) counterDamage = 1;
                 }
             }

             const previousState = this.state;
             this.state = Game.STATES.BATTLE_ANIMATION;
             
             this.battleAnimation = {
                 attacker: this.selectedUnit,
                 defender: targetUnit,
                 attackerInitialHealth: this.selectedUnit.health,
                 defenderInitialHealth: targetUnit.health,
                 damage: damage,
                 counterDamage: counterDamage,
                 startTime: Date.now(),
                 duration: 2500, // 2.5 seconds total animation
                 dist: dist,
                 previousState: previousState,
                 onComplete: null
             };

             // Return a promise that resolves when the animation finishes
             return new Promise(resolve => {
                 this.battleAnimation.onComplete = () => {
                     this.resolveBattleAnimation();
                     resolve(true);
                 };
             });
         }
          return false;
    }
    
    resolveBattleAnimation() {
        if (!this.battleAnimation) return;
        
        const { attacker, defender, damage, counterDamage, previousState } = this.battleAnimation;
        
        defender.takeDamage(damage);
        this.consumeAmmo(attacker);
        if (defender.health <= 0) {
            this.addExplosion(defender.x, defender.y);
        }
        
        attacker.hasMoved = true;
        attacker.hasAttacked = true;

        if (counterDamage > 0 && defender.health > 0) {
            attacker.takeDamage(counterDamage);
            this.consumeAmmo(defender);
            if (attacker.health <= 0) {
                this.addExplosion(attacker.x, attacker.y);
            }
        }

        // Remove dead units
        this.units = this.units.filter(u => u.health > 0);

        this.battleAnimation = null;
        this.state = previousState === Game.STATES.AI_ACTIVE ? Game.STATES.AI_ACTIVE : Game.STATES.IDLE;
        
        if (this.state === Game.STATES.IDLE) {
            this.clearSelection();
        }
        
        this.checkWinCondition();
    }

    hasHQForPlayer(player) {
        const targetTerrain = player === 1 ? GameMap.TERRAIN.HQ_P1 : GameMap.TERRAIN.HQ_P2;
        return this.map.grid.some(row => row.some(tile => tile === targetTerrain));
    }

    handleVictory(winner) {
        const loser = winner === 1 ? 2 : 1;
        alert(`プレイヤー${winner}の勝利！`);
        this.state = Game.STATES.GAME_OVER;
        this.audioManager.stop('turn_p1');
        this.audioManager.stop('turn_p2');
        return { winner, loser };
    }

    handleHQCaptured(owner) {
        this.handleVictory(owner);
    }

    getUnitDefenseBonus(unit, x = null, y = null) {
        if (!unit) return 0;
        const tx = x !== null ? x : unit.x;
        const ty = y !== null ? y : unit.y;
        const terrain = this.map.getTerrainAt(tx, ty);
        let terrainDef = this.map.getDefenseBonus(terrain);
        if ((unit.owner === 1 && terrain === GameMap.TERRAIN.HQ_P1) ||
            (unit.owner === 2 && terrain === GameMap.TERRAIN.HQ_P2)) {
            terrainDef += 50;
        }
        return terrainDef;
    }

    isIndirectUnit(unit) {
        return unit && (
            unit.type === Unit.TYPES.ARTILLERY ||
            unit.type === Unit.TYPES.ROCKET ||
            unit.type === Unit.TYPES.AA_MISSILE ||
            unit.type === Unit.TYPES.BATTLESHIP
        );
    }

    checkWinCondition() {
        if (!this.hasHQForPlayer(1)) {
            this.handleVictory(2);
            return;
        }
        if (!this.hasHQForPlayer(2)) {
            this.handleVictory(1);
            return;
        }

        const p1Units = this.units.some(u => u.owner === 1);
        const p2Units = this.units.some(u => u.owner === 2);

        if (!p1Units) {
            this.handleVictory(2);
        } else if (!p2Units) {
            this.handleVictory(1);
        }
    }

    async runAITurn() {
        if (this.state === Game.STATES.GAME_OVER) return;
        this.state = Game.STATES.AI_ACTIVE;
        this.clearSelection();

        // 0. Analyze Player 1's army to determine threats
        let tankThreat = 0;
        let airThreat = 0;
        let infThreat = 0;
        
        const p1Units = this.units.filter(u => u.owner === 1 && u.health > 0);
        p1Units.forEach(u => {
            if (u.type === Unit.TYPES.TANK || u.type === Unit.TYPES.MD_TANK || u.type === Unit.TYPES.HV_TANK) tankThreat++;
            else if (u.type === Unit.TYPES.FIGHTER || u.type === Unit.TYPES.BOMBER || u.type === Unit.TYPES.HELI_TRANSPORT) airThreat++;
            else if (u.type === Unit.TYPES.INFANTRY || u.type === Unit.TYPES.TRANSPORT) infThreat++;
        });

        // Determine primary threat
        let primaryThreat = 'NONE';
        if (tankThreat > airThreat && tankThreat > infThreat) primaryThreat = 'TANK';
        else if (airThreat > tankThreat && airThreat > infThreat) primaryThreat = 'AIR';
        else if (infThreat > tankThreat && infThreat > airThreat) primaryThreat = 'INFANTRY';
        else if (tankThreat > 0 || airThreat > 0 || infThreat > 0) primaryThreat = 'BALANCED';

        const threatMap = new Set();
        let hqThreatened = false;
        let aiHQPos = null;
        if (this.aiDifficulty === 'hard') {
            for (let y = 0; y < this.map.rows; y++) {
                for (let x = 0; x < this.map.cols; x++) {
                    if (this.map.getTerrainAt(x, y) === GameMap.TERRAIN.HQ_P2) aiHQPos = {x, y};
                }
            }
            const originalValidMoveTiles = this.validMoveTiles ? [...this.validMoveTiles] : [];
            const originalMoveParents = this.moveParents ? Object.assign({}, this.moveParents) : {};
            p1Units.forEach(enemy => {
                if (aiHQPos && enemy.x !== -1 && this.getDistance(enemy.x, enemy.y, aiHQPos.x, aiHQPos.y) <= 12) {
                    hqThreatened = true;
                }
                if (enemy.health > 0 && enemy.x !== -1 && enemy.attackRange.max > 0) {
                    this.calculateMoveRange(enemy);
                    const enemyMoveTiles = [...this.validMoveTiles, { x: enemy.x, y: enemy.y }];
                    enemyMoveTiles.forEach(mt => {
                        for (let dy = -enemy.attackRange.max; dy <= enemy.attackRange.max; dy++) {
                            for (let dx = -enemy.attackRange.max; dx <= enemy.attackRange.max; dx++) {
                                const dist = Math.abs(dx) + Math.abs(dy);
                                if (dist >= enemy.attackRange.min && dist <= enemy.attackRange.max) {
                                    const tx = mt.x + dx;
                                    const ty = mt.y + dy;
                                    if (this.map.isValidTile(tx, ty)) threatMap.add(`${tx},${ty}`);
                                }
                            }
                        }
                    });
                }
            });
            this.validMoveTiles = originalValidMoveTiles;
            this.moveParents = originalMoveParents;
        }

        const capturableTargets = this.getCapturablePropertiesForPlayer(2);
        const aiUnitsAlive = this.units.filter(u => u.owner === 2 && u.health > 0);
        const aiInfantryCount = aiUnitsAlive.filter(u => u.type === Unit.TYPES.INFANTRY).length;
        const aiTankCount = aiUnitsAlive.filter(u => u.type === Unit.TYPES.TANK || u.type === Unit.TYPES.MD_TANK || u.type === Unit.TYPES.HV_TANK).length;
        const aiIndirectCount = aiUnitsAlive.filter(u => u.type === Unit.TYPES.ARTILLERY || u.type === Unit.TYPES.ROCKET).length;
        const aiAntiAirCount = aiUnitsAlive.filter(u => u.type === Unit.TYPES.AA_TANK || u.type === Unit.TYPES.AA_MISSILE || u.type === Unit.TYPES.FIGHTER).length;
        const aiNavalCount = aiUnitsAlive.filter(u => this.isNavalUnitType(u.type)).length;
        const aiHovercraftCount = aiUnitsAlive.filter(u => u.type === Unit.TYPES.HOVERCRAFT).length;
        const aiTransportCount = aiUnitsAlive.filter(u =>
            u.type === Unit.TYPES.TRANSPORT ||
            u.type === Unit.TYPES.HELI_TRANSPORT ||
            u.type === Unit.TYPES.HOVERCRAFT
        ).length;
        const aiFactoryCount = this.countOwnedProductionTiles(2, GameMap.TERRAIN.FACTORY_P2);
        const economyPlan = this.getAIEconomyPlan(2, capturableTargets, aiUnitsAlive);
        const aiAntiArmorCount = aiUnitsAlive.filter(u =>
            u.type === Unit.TYPES.MD_TANK ||
            u.type === Unit.TYPES.HV_TANK ||
            u.type === Unit.TYPES.ARTILLERY ||
            u.type === Unit.TYPES.ROCKET ||
            u.type === Unit.TYPES.BOMBER
        ).length;
        const desiredInfantry = economyPlan.shouldExpand
            ? Math.min(7, Math.max(3, Math.ceil(capturableTargets.length / 2), aiFactoryCount + 1))
            : capturableTargets.length > 0
                ? Math.min(4, Math.max(2, Math.ceil(capturableTargets.length / 4), aiFactoryCount))
                : 1;
        let infantryDemand = Math.max(0, desiredInfantry - aiInfantryCount);
        const shouldBuildTransport = economyPlan.remoteCaptureTargets > 0 &&
            aiInfantryCount >= 2 &&
            aiTransportCount < Math.ceil(aiInfantryCount / 3) &&
            infantryDemand <= 2;
        const groundBuildCandidates = [
            Unit.TYPES.AA_TANK,
            Unit.TYPES.AA_MISSILE,
            Unit.TYPES.TANK,
            Unit.TYPES.MD_TANK,
            Unit.TYPES.HV_TANK,
            Unit.TYPES.ARTILLERY,
            Unit.TYPES.ROCKET
        ];
        const airBuildCandidates = [Unit.TYPES.FIGHTER, Unit.TYPES.BOMBER];
        let preferredGroundCounterBuild = this.chooseAICounterBuild(2, p1Units, this.playerFunds[2], groundBuildCandidates);
        let preferredAirCounterBuild = this.chooseAICounterBuild(2, p1Units, this.playerFunds[2], airBuildCandidates);
        let preferredCounterBuild = preferredGroundCounterBuild || preferredAirCounterBuild;
        let shouldSaveForCounter = preferredCounterBuild &&
            this.playerFunds[2] < Unit.COSTS[preferredCounterBuild] &&
            this.playerFunds[2] + economyPlan.aiIncome >= Unit.COSTS[preferredCounterBuild];
            
        if (this.aiDifficulty === 'hard') {
            if (this.playerFunds[2] > 18000 && !shouldSaveForCounter) {
                if (this.countOwnedProductionTiles(2, GameMap.TERRAIN.AIRPORT_P2) > 0 && this.playerFunds[2] < Unit.COSTS[Unit.TYPES.BOMBER]) {
                    shouldSaveForCounter = true;
                } else if (this.playerFunds[2] < Unit.COSTS[Unit.TYPES.MD_TANK]) {
                    shouldSaveForCounter = true;
                }
            } else if (aiInfantryCount >= 5 && aiTankCount >= 2 && !hqThreatened) {
                shouldSaveForCounter = true;
            }
        }

        let plannedAntiAirCount = aiAntiAirCount;
        let plannedAntiArmorCount = aiAntiArmorCount;
        let plannedArmorCount = aiTankCount;
        let plannedNavalCount = aiNavalCount;
        let plannedHovercraftCount = aiHovercraftCount;

        // 1. AI Production Spawning Phase
        for (let y = 0; y < this.map.rows; y++) {
            for (let x = 0; x < this.map.cols; x++) {
                const terrain = this.map.getTerrainAt(x, y);
                const occupant = this.getUnitAt(x, y);
                
                if (terrain === GameMap.TERRAIN.FACTORY_P2 && !occupant) {
                    let buildType = null;
                    const funds = this.playerFunds[2];
                    const localNeed = this.getLocalProductionNeed(2, x, y);
                    const needsAntiAir = airThreat > plannedAntiAirCount;
                    const needsAntiArmor = tankThreat > plannedAntiArmorCount;
                    const mustBuildInfantry = infantryDemand > 0 && aiInfantryCount === 0 && !needsAntiAir && !needsAntiArmor;
                    const canBuildPreferredCounter = preferredGroundCounterBuild && funds >= Unit.COSTS[preferredGroundCounterBuild];

                    if (shouldSaveForCounter && infantryDemand <= 0 && !canBuildPreferredCounter) {
                        buildType = null;
                    } else if (canBuildPreferredCounter && localNeed !== 'INFANTRY') {
                        buildType = preferredGroundCounterBuild;
                    } else if (localNeed === 'INFANTRY' && infantryDemand > 0 && funds >= Unit.COSTS[Unit.TYPES.INFANTRY]) {
                        buildType = Unit.TYPES.INFANTRY;
                    } else if (localNeed === 'ANTI_AIR' && funds >= Unit.COSTS[Unit.TYPES.AA_TANK]) {
                        buildType = funds >= Unit.COSTS[Unit.TYPES.AA_MISSILE] ? Unit.TYPES.AA_MISSILE : Unit.TYPES.AA_TANK;
                    } else if (localNeed === 'ANTI_ARMOR' && funds >= Unit.COSTS[Unit.TYPES.ARTILLERY]) {
                        buildType = funds >= Unit.COSTS[Unit.TYPES.MD_TANK] ? Unit.TYPES.MD_TANK : Unit.TYPES.ARTILLERY;
                    } else if (mustBuildInfantry && funds >= Unit.COSTS[Unit.TYPES.INFANTRY]) {
                        buildType = Unit.TYPES.INFANTRY;
                    } else if (needsAntiAir) {
                        if (funds >= Unit.COSTS[Unit.TYPES.AA_MISSILE] && plannedAntiAirCount < Math.ceil(airThreat / 2)) buildType = Unit.TYPES.AA_MISSILE;
                        else if (funds >= Unit.COSTS[Unit.TYPES.AA_TANK]) buildType = Unit.TYPES.AA_TANK;
                        else if (funds >= Unit.COSTS[Unit.TYPES.TANK]) buildType = Unit.TYPES.TANK;
                        else if (infantryDemand > 0 && funds >= Unit.COSTS[Unit.TYPES.INFANTRY]) buildType = Unit.TYPES.INFANTRY;
                    } else if (needsAntiArmor) {
                        if (funds >= Unit.COSTS[Unit.TYPES.ROCKET] && plannedAntiArmorCount < Math.ceil(tankThreat / 2)) buildType = Unit.TYPES.ROCKET;
                        else if (funds >= Unit.COSTS[Unit.TYPES.MD_TANK]) buildType = Unit.TYPES.MD_TANK;
                        else if (funds >= Unit.COSTS[Unit.TYPES.ARTILLERY]) buildType = Unit.TYPES.ARTILLERY;
                        else if (funds >= Unit.COSTS[Unit.TYPES.TANK]) buildType = Unit.TYPES.TANK;
                        else if (infantryDemand > 0 && funds >= Unit.COSTS[Unit.TYPES.INFANTRY]) buildType = Unit.TYPES.INFANTRY;
                    } else if (infantryDemand > 0 && plannedArmorCount + plannedAntiArmorCount >= Math.ceil(aiInfantryCount / 2) && funds >= Unit.COSTS[Unit.TYPES.INFANTRY]) {
                        buildType = Unit.TYPES.INFANTRY;
                    } else if (primaryThreat === 'AIR') {
                        // Prioritize Anti-Air
                        if (funds >= Unit.COSTS[Unit.TYPES.AA_MISSILE] && plannedAntiAirCount < Math.ceil(airThreat / 2)) buildType = Unit.TYPES.AA_MISSILE;
                        else if (funds >= Unit.COSTS[Unit.TYPES.AA_TANK]) buildType = Unit.TYPES.AA_TANK;
                        else if (funds >= Unit.COSTS[Unit.TYPES.TANK]) buildType = Unit.TYPES.TANK;
                        else if (funds >= Unit.COSTS[Unit.TYPES.INFANTRY]) buildType = Unit.TYPES.INFANTRY;
                    } else if (primaryThreat === 'TANK') {
                        // Prioritize heavy hitters
                        if (aiIndirectCount < 2 && funds >= Unit.COSTS[Unit.TYPES.ROCKET]) buildType = Unit.TYPES.ROCKET;
                        else if (funds >= Unit.COSTS[Unit.TYPES.MD_TANK]) buildType = Unit.TYPES.MD_TANK;
                        else if (funds >= Unit.COSTS[Unit.TYPES.ARTILLERY]) buildType = Unit.TYPES.ARTILLERY;
                        else if (funds >= Unit.COSTS[Unit.TYPES.TANK]) buildType = Unit.TYPES.TANK;
                        else if (funds >= Unit.COSTS[Unit.TYPES.INFANTRY]) buildType = Unit.TYPES.INFANTRY;
                    } else {
                        // Balanced: keep a capture core, then mix armor and support.
                        if (aiTankCount < aiInfantryCount && funds >= Unit.COSTS[Unit.TYPES.TANK]) buildType = Unit.TYPES.TANK;
                        else if (aiIndirectCount < 2 && funds >= Unit.COSTS[Unit.TYPES.ARTILLERY]) buildType = Unit.TYPES.ARTILLERY;
                        else if (funds >= Unit.COSTS[Unit.TYPES.MD_TANK]) buildType = Unit.TYPES.MD_TANK;
                        else if (funds >= Unit.COSTS[Unit.TYPES.TANK]) buildType = Unit.TYPES.TANK;
                        else if (funds >= Unit.COSTS[Unit.TYPES.INFANTRY]) buildType = Unit.TYPES.INFANTRY;
                    }

                    if (buildType && funds >= Unit.COSTS[buildType]) {
                        this.spawnUnit(buildType, 2, x, y);
                        if (buildType === Unit.TYPES.INFANTRY) infantryDemand--;
                        if (buildType === Unit.TYPES.AA_TANK || buildType === Unit.TYPES.AA_MISSILE) plannedAntiAirCount++;
                        if (buildType === Unit.TYPES.MD_TANK || buildType === Unit.TYPES.HV_TANK || buildType === Unit.TYPES.ARTILLERY || buildType === Unit.TYPES.ROCKET) plannedAntiArmorCount++;
                        if (buildType === Unit.TYPES.TANK || buildType === Unit.TYPES.MD_TANK || buildType === Unit.TYPES.HV_TANK) plannedArmorCount++;
                        preferredGroundCounterBuild = this.chooseAICounterBuild(2, p1Units, this.playerFunds[2], groundBuildCandidates);
                        preferredAirCounterBuild = this.chooseAICounterBuild(2, p1Units, this.playerFunds[2], airBuildCandidates);
                        preferredCounterBuild = preferredGroundCounterBuild || preferredAirCounterBuild;
                        shouldSaveForCounter = preferredCounterBuild &&
                            this.playerFunds[2] < Unit.COSTS[preferredCounterBuild] &&
                            this.playerFunds[2] + economyPlan.aiIncome >= Unit.COSTS[preferredCounterBuild];
                        await this.sleep(500); // Visual spawn pause
                    }
                } else if (terrain === GameMap.TERRAIN.AIRPORT_P2 && !occupant) {
                    let buildType = null;
                    const funds = this.playerFunds[2];
                    const localNeed = this.getLocalProductionNeed(2, x, y);
                    const canBuildPreferredAir = preferredAirCounterBuild && funds >= Unit.COSTS[preferredAirCounterBuild];

                    if (shouldSaveForCounter && infantryDemand <= 0 && funds < Unit.COSTS[Unit.TYPES.FIGHTER]) {
                        buildType = null;
                    } else if (canBuildPreferredAir) {
                        buildType = preferredAirCounterBuild;
                    } else if (localNeed === 'ANTI_AIR' && funds >= Unit.COSTS[Unit.TYPES.FIGHTER]) {
                        buildType = Unit.TYPES.FIGHTER;
                    } else if (localNeed === 'ANTI_ARMOR' && funds >= Unit.COSTS[Unit.TYPES.BOMBER]) {
                        buildType = Unit.TYPES.BOMBER;
                    } else if (shouldBuildTransport && funds >= Unit.COSTS[Unit.TYPES.HELI_TRANSPORT]) {
                        buildType = Unit.TYPES.HELI_TRANSPORT;
                    } else if (primaryThreat === 'AIR') {
                        if (funds >= Unit.COSTS[Unit.TYPES.FIGHTER]) buildType = Unit.TYPES.FIGHTER;
                    } else if (primaryThreat === 'TANK') {
                        if (funds >= Unit.COSTS[Unit.TYPES.BOMBER]) buildType = Unit.TYPES.BOMBER;
                    } else {
                        // Standard air build
                        if (funds >= Unit.COSTS[Unit.TYPES.BOMBER] && aiTankCount >= 2) buildType = Unit.TYPES.BOMBER;
                        else if (funds >= Unit.COSTS[Unit.TYPES.FIGHTER] && airThreat > 0) buildType = Unit.TYPES.FIGHTER;
                    }

                    if (buildType && funds >= Unit.COSTS[buildType]) {
                        this.spawnUnit(buildType, 2, x, y);
                        await this.sleep(500); // Visual spawn pause
                    }
                } else if (terrain === GameMap.TERRAIN.PORT_P2 && !occupant) {
                    const funds = this.playerFunds[2];
                    const buildType = this.chooseAINavalBuild(2, x, y, {
                        funds,
                        aiNavalCount: plannedNavalCount,
                        aiHovercraftCount: plannedHovercraftCount,
                        infantryDemand,
                        shouldBuildTransport,
                        primaryThreat
                    });

                    if (buildType && funds >= Unit.COSTS[buildType]) {
                        this.spawnUnit(buildType, 2, x, y);
                        if (this.isNavalUnitType(buildType)) plannedNavalCount++;
                        if (buildType === Unit.TYPES.HOVERCRAFT) plannedHovercraftCount++;
                        await this.sleep(500); // Visual spawn pause
                    }
                }
            }
        }
        
        // 2. AI Movement Phase
        // Find P2 active units on map that haven't acted yet (excludes newly spawned ones)
        const reservedPropertyTargets = new Set();
        const aiUnits = this.units
            .filter(u => u.owner === 2 && u.health > 0 && u.x !== -1 && !u.isDone())
            .sort((a, b) => {
                const aInf = a.type === Unit.TYPES.INFANTRY ? 1 : 0;
                const bInf = b.type === Unit.TYPES.INFANTRY ? 1 : 0;
                return bInf - aInf;
            });

        for (let unit of aiUnits) {
            if (this.state === Game.STATES.GAME_OVER) return;

            // 1. Select Unit
            this.selectedUnit = unit;
                // Attempt to load unit onto adjacent transport/hovercraft if possible
                const nearbyTransport = this.units.find(u =>
                    this.getDistance(unit.x, unit.y, u.x, u.y) === 1 &&
                    this.canLoadUnit(unit, u)
                );
                if (nearbyTransport) {
                    nearbyTransport.carriedUnits.push(unit);
                    this.units = this.units.filter(u => u !== unit);
                    unit.x = -1;
                    unit.y = -1;
                    unit.hasMoved = true;
                    unit.hasAttacked = true;
                    unit.loadedTurn = this.turnCount;
                    console.log('AI loaded infantry onto transport at', nearbyTransport.x, nearbyTransport.y);
                    continue;
                }
                this.calculateMoveRange(unit);
                await this.sleep(600);

            const allMoveTiles = [...this.validMoveTiles, { x: unit.x, y: unit.y }];
            
            // Tiles that are valid for attacking from (must be empty or current position)
            const allMoveTilesForAttack = allMoveTiles.filter(t => {
                const occ = this.getUnitAt(t.x, t.y);
                return !occ || occ === unit;
            });

            // 1. Target Property for Infantry or Transports carrying Infantry
            let targetProperty = null;
            if (this.aiDifficulty === 'hard' && hqThreatened && unit.type !== Unit.TYPES.INFANTRY && unit.type !== Unit.TYPES.TRANSPORT && aiHQPos) {
                targetProperty = { x: aiHQPos.x, y: aiHQPos.y };
            } else if (unit.type === Unit.TYPES.INFANTRY || (unit.carriedUnits && unit.carriedUnits.some(u => u.type === Unit.TYPES.INFANTRY))) {
                targetProperty = this.chooseAIPropertyTarget(unit, reservedPropertyTargets);
                if (targetProperty) reservedPropertyTargets.add(targetProperty.key);
            } else if (this.aiDifficulty === 'hard' && (unit.type === Unit.TYPES.TRANSPORT || unit.type === Unit.TYPES.HELI_TRANSPORT || unit.type === Unit.TYPES.HOVERCRAFT) && (!unit.carriedUnits || unit.carriedUnits.length === 0)) {
                const friendlyInfantry = this.units.filter(u => u.owner === unit.owner && u.type === Unit.TYPES.INFANTRY && u.health > 0 && !this.isCapturablePropertyForPlayer(this.map.getTerrainAt(u.x, u.y), u.owner));
                let closestInf = null;
                let minDist = Infinity;
                for (let inf of friendlyInfantry) {
                    const d = this.getDistance(unit.x, unit.y, inf.x, inf.y);
                    if (d < minDist) {
                        minDist = d;
                        closestInf = inf;
                    }
                }
                if (closestInf) targetProperty = { x: closestInf.x, y: closestInf.y };
            }

            // 2. Find all possible attacks
            const enemies = this.units.filter(u => u.owner === 1 && u.health > 0 && u.x !== -1);
            if (enemies.length === 0 && !targetProperty) break;

            let possibleAttacks = [];
            const isIndirect = this.isIndirectUnit(unit);

            if (this.hasAmmo(unit)) {
                for (let enemy of enemies) {
                    for (let tile of allMoveTilesForAttack) {
                        const d = this.getDistance(tile.x, tile.y, enemy.x, enemy.y);
                        if (this.canAttackUnitAtDistance(unit, enemy, d)) {
                            const didMove = (tile.x !== unit.x || tile.y !== unit.y);
                            if (didMove && isIndirect) continue;

                            const baseDamage = Unit.MATCHUPS[unit.type][enemy.type];
                            if (baseDamage > 0) {
                                const terrainDef = this.getUnitDefenseBonus(enemy);
                                const expectedDamage = this.calculateCombatDamage(unit, enemy, terrainDef, d);
                                const killBonus = expectedDamage >= enemy.health ? 20 : 0;
                                const counterDamage = this.estimateCounterAttackDamage(unit, enemy, tile);
                                const riskPenalty = Math.min(12, counterDamage);
                                const enemyValueSwing = Math.min(enemy.health, expectedDamage) * this.getUnitBattleValue(enemy) / 10;
                                
                                // --- Minimax with Alpha-Beta Pruning Integration ---
                                // Evaluate future threat (Min node: opponent's optimal response)
                                const futureThreat = this.getEnemyThreatAtTile(unit, tile.x, tile.y);
                                const nextTurnLoss = futureThreat.valueLoss;
                                
                                // Alpha-Beta Pruning check: If the predicted loss from counterattack and next-turn threat 
                                // exceeds the value of the unit itself, prune this branch early (drastic score reduction)
                                let prunePenalty = 0;
                                const myUnitValue = this.getUnitBattleValue(unit);
                                if (this.aiDifficulty === 'hard' && (counterDamage * this.getUnitBattleValue(unit) / 10 + nextTurnLoss) > myUnitValue) {
                                     prunePenalty = 500; // Alpha cutoff equivalent
                                }

                                const tileScore = this.getStrategicTileScore(unit, tile.x, tile.y, targetProperty);
                                
                                let score = expectedDamage + killBonus + enemyValueSwing / 1000 + tileScore / 10 - riskPenalty - futureThreat.valueLoss / Math.max(1000, myUnitValue) * 8 - prunePenalty;
                                if (this.aiDifficulty === 'hard') {
                                    const isLethal = expectedDamage >= enemy.health;
                                    const lethalBonus = isLethal ? 200 : 0;
                                    const threatPenalty = threatMap.has(`${tile.x},${tile.y}`) && !isLethal ? 100 : 0;
                                    let screenBonus = 0;
                                    if (!isIndirect) {
                                        const adjacentAllies = [{x: tile.x+1, y: tile.y}, {x: tile.x-1, y: tile.y}, {x: tile.x, y: tile.y+1}, {x: tile.x, y: tile.y-1}];
                                        for (let adj of adjacentAllies) {
                                            const ally = this.getUnitAt(adj.x, adj.y);
                                            if (ally && ally.owner === unit.owner && this.isIndirectUnit(ally)) {
                                                screenBonus = 80;
                                                break;
                                            }
                                        }
                                    }
                                    // Deep Minimax evaluation score combining immediate gain and delayed loss
                                    score = expectedDamage * 2 + lethalBonus + enemyValueSwing / 300 + tileScore / 5 + screenBonus - (counterDamage * 3) - (nextTurnLoss / Math.max(1000, myUnitValue)) * 18 - threatPenalty - prunePenalty;
                                    if (expectedDamage < 3 && counterDamage > 5) {
                                        score -= 100;
                                    }
                                } else if (this.aiDifficulty === 'normal') {
                                    score = expectedDamage * 1.5 + (killBonus > 0 ? 30 : 0) + enemyValueSwing / 650 + tileScore / 7 - (counterDamage * 1.5) - (nextTurnLoss / Math.max(1000, myUnitValue)) * 12 - prunePenalty;
                                }

                                possibleAttacks.push({
                                    enemy,
                                    moveTile: tile,
                                    damage: expectedDamage,
                                    killBonus,
                                    counterDamage,
                                    score: score
                                });
                            }
                        }
                    }
                }
            }

            let attackableEnemy = null;
            let targetMoveTile = null;

            if (possibleAttacks.length > 0) {
                const monteCarloConfig = this.getMonteCarloConfig();
                if (monteCarloConfig.trials > 0) {
                    possibleAttacks.sort((a, b) => b.score - a.score);
                    for (const attack of possibleAttacks.slice(0, this.aiDifficulty === 'hard' ? 8 : 5)) {
                        attack.score += this.evaluateAIMonteCarloAction(unit, attack);
                    }
                }

                const isVulnerable = unit.health <= 4 || (Number.isFinite(unit.ammo) && unit.ammo <= 1);
                if (unit.type === Unit.TYPES.INFANTRY) {
                    // Infantry prioritizes attacking other Infantry, then by score
                    possibleAttacks.sort((a, b) => {
                        const aIsInf = (a.enemy.type === Unit.TYPES.INFANTRY) ? 1 : 0;
                        const bIsInf = (b.enemy.type === Unit.TYPES.INFANTRY) ? 1 : 0;
                        if (aIsInf !== bIsInf) return bIsInf - aIsInf;
                        return b.score - a.score;
                    });
                } else {
                    possibleAttacks.sort((a, b) => b.score - a.score);
                }

                const bestAttack = possibleAttacks[0];
                let attackThreshold = isVulnerable ? 14 : 6;
                if (this.aiDifficulty === 'hard') attackThreshold = isVulnerable ? 20 : 10;
                const shouldAttack = !!bestAttack;
                const canCaptureProperty = unit.type === Unit.TYPES.INFANTRY && targetProperty &&
                    this.validMoveTiles.some(t => t.x === targetProperty.x && t.y === targetProperty.y) &&
                    (!this.getUnitAt(targetProperty.x, targetProperty.y) || this.getUnitAt(targetProperty.x, targetProperty.y) === unit);

                if (unit.type === Unit.TYPES.INFANTRY && targetProperty && canCaptureProperty) {
                    attackableEnemy = null;
                    targetMoveTile = null;
                } else if (shouldAttack && bestAttack) {
                    if (this.aiDifficulty === 'hard' && unit.type === Unit.TYPES.INFANTRY && targetProperty && bestAttack.score < 20) {
                        attackableEnemy = null;
                        targetMoveTile = null;
                    } else if (this.aiDifficulty === 'hard' && bestAttack.score < -20) {
                        attackableEnemy = null;
                        targetMoveTile = null;
                    } else {
                        attackableEnemy = bestAttack.enemy;
                        targetMoveTile = bestAttack.moveTile;
                    }
                } else {
                    // Fallback: attack first enemy in range from current position
                    for (let enemy of enemies) {
                        const d = this.getDistance(unit.x, unit.y, enemy.x, enemy.y);
                        if (this.canAttackUnitAtDistance(unit, enemy, d)) {
                            attackableEnemy = enemy;
                            targetMoveTile = { x: unit.x, y: unit.y };
                            break;
                        }
                    }
                }
            }

            if (attackableEnemy && targetMoveTile) {
                const originalX = unit.x;
                const originalY = unit.y;
                const path = this.reconstructMovePath(unit, targetMoveTile.x, targetMoveTile.y);
                
                // Move to position
                unit.x = targetMoveTile.x;
                unit.y = targetMoveTile.y;
                unit.hasMoved = true;
                this.consumeFuelForPath(unit, path);
                this.validMoveTiles = [];
                if (this.resolveFuelDepletion(unit)) {
                    this.clearSelection();
                    this.checkWinCondition();
                    await this.sleep(400);
                    continue;
                }
                
                const didMove = (targetMoveTile.x !== originalX || targetMoveTile.y !== originalY);
                if (didMove && isIndirect) {
                    this.validAttackTiles = [];
                } else {
                    this.calculateAttackRange(unit);
                    if (this.validAttackTiles.some(t => t.x === attackableEnemy.x && t.y === attackableEnemy.y)) {
                        await this.attackUnit(attackableEnemy.x, attackableEnemy.y);
                    }
                }
                await this.sleep(600);
                this.units = this.units.filter(u => u.health > 0);
                if (unit.health > 0) {
                    this.checkCapture(unit);
                }
            } else {
                const moveCandidates = this.validMoveTiles.filter(tile => tile.x !== unit.x || tile.y !== unit.y);
                let targetTile = { x: unit.x, y: unit.y };
                const isVulnerable = unit.health <= 4 || (Number.isFinite(unit.ammo) && unit.ammo <= 1);
                const retreatTile = this.findBestRetreatTile(unit, moveCandidates);

                const chooseClosestTile = (target) => {
                    if (!target) return null;
                    if (this.aiDifficulty === 'hard') {
                        const path = this.findPathAStar(unit, target.x, target.y);
                        if (path && path.length > 0) {
                            let bestPathTile = null;
                            let bestPathScore = -Infinity;
                            for (let i = path.length - 1; i >= 0; i--) {
                                const pt = path[i];
                                if (moveCandidates.some(m => m.x === pt.x && m.y === pt.y)) {
                                    const inThreat = threatMap.has(`${pt.x},${pt.y}`);
                                    const isTarget = pt.x === target.x && pt.y === target.y;
                                    let score = i;
                                    if (inThreat && !isTarget && unit.type !== Unit.TYPES.INFANTRY) {
                                        score -= 100;
                                    }
                                    if (score > bestPathScore) {
                                        bestPathScore = score;
                                        bestPathTile = { x: pt.x, y: pt.y };
                                    }
                                }
                            }
                            if (bestPathTile) return bestPathTile;
                        }
                    }
                    let bestTile = null;
                    let bestScore = -Infinity;
                    for (let tile of moveCandidates) {
                        const d = this.getDistance(tile.x, tile.y, target.x, target.y);
                        let score = -d * 12 + this.getStrategicTileScore(unit, tile.x, tile.y, targetProperty);
                        if (this.aiDifficulty === 'hard' && threatMap.has(`${tile.x},${tile.y}`) && !(tile.x === target.x && tile.y === target.y)) {
                            score -= 1000;
                        }
                        if (score > bestScore) {
                            bestScore = score;
                            bestTile = tile;
                        }
                    }
                    return bestTile;
                };

                if (isVulnerable && retreatTile) {
                    targetTile = retreatTile;
                } else if (targetProperty && targetProperty.x === unit.x && targetProperty.y === unit.y) {
                    targetTile = { x: unit.x, y: unit.y };
                } else if (targetProperty) {
                    targetTile = chooseClosestTile(targetProperty) || targetTile;
                } else if (enemies.length > 0) {
                    let closestEnemy = null;
                    let minEnemyDist = Infinity;
                    for (let enemy of enemies) {
                        const d = this.getDistance(unit.x, unit.y, enemy.x, enemy.y);
                        if (d < minEnemyDist) {
                            minEnemyDist = d;
                            closestEnemy = enemy;
                        }
                    }

                    targetTile = chooseClosestTile(closestEnemy) || targetTile;
                }

                if (moveCandidates.length > 0 && (!targetProperty || this.aiDifficulty !== 'easy')) {
                    const monteCarloConfig = this.getMonteCarloConfig();
                    let bestPositionalTile = targetTile;
                    let bestPositionalScore = this.getStrategicTileScore(unit, targetTile.x, targetTile.y, targetProperty);
                    const positionalCandidates = moveCandidates
                        .map(tile => ({
                            tile,
                            baseScore: this.getStrategicTileScore(unit, tile.x, tile.y, targetProperty)
                        }))
                        .sort((a, b) => b.baseScore - a.baseScore);

                    for (const candidate of positionalCandidates.slice(0, this.aiDifficulty === 'hard' ? 8 : 5)) {
                        let score = candidate.baseScore;
                        if (monteCarloConfig.trials > 0) {
                            score += this.evaluateAIMonteCarloAction(unit, { tile: candidate.tile });
                        }
                        if (score > bestPositionalScore + 10) {
                            bestPositionalScore = score;
                            bestPositionalTile = candidate.tile;
                        }
                    }
                    targetTile = bestPositionalTile;
                }

                const path = this.reconstructMovePath(unit, targetTile.x, targetTile.y);
                unit.x = targetTile.x;
                unit.y = targetTile.y;
                this.consumeFuelForPath(unit, path);
                if (this.resolveFuelDepletion(unit)) {
                    this.clearSelection();
                    this.checkWinCondition();
                    await this.sleep(400);
                    continue;
                }

                // AI Load and Join Logic
                const finalOccupant = this.units.find(u => u !== unit && u.x === targetTile.x && u.y === targetTile.y);
                if (finalOccupant) {
                    if (this.canLoadUnit(unit, finalOccupant)) {
                        finalOccupant.carriedUnits.push(unit);
                        this.units = this.units.filter(u => u !== unit);
                        unit.x = -1; unit.y = -1;
                        unit.hasMoved = true; unit.hasAttacked = true; unit.loadedTurn = this.turnCount;
                        await this.sleep(400);
                        continue;
                    } else if (finalOccupant.owner === unit.owner && finalOccupant.type === unit.type && finalOccupant.health < 10 && unit.health < 10) {
                        const needed = 10 - finalOccupant.health;
                        const transferred = Math.min(unit.health, needed);
                        finalOccupant.health += transferred;
                        
                        if (finalOccupant.maxFuel !== Infinity) {
                            finalOccupant.fuel = Math.min(finalOccupant.maxFuel ?? Unit.getDefaultFuel(finalOccupant.type), finalOccupant.fuel + (unit.fuel ?? 0));
                        }
                        if (finalOccupant.maxAmmo !== undefined && finalOccupant.maxAmmo !== null) {
                            finalOccupant.ammo = Math.min(finalOccupant.maxAmmo, finalOccupant.ammo + (unit.ammo ?? 0));
                        }
                        if (finalOccupant.maxSupplyAmmo > 0) {
                            finalOccupant.supplyAmmo = Math.min(finalOccupant.maxSupplyAmmo, finalOccupant.supplyAmmo + (unit.supplyAmmo ?? 0));
                        }
                        this.units = this.units.filter(u => u !== unit);
                        finalOccupant.hasMoved = true;
                        finalOccupant.hasAttacked = true;
                        await this.sleep(400);
                        continue;
                    }
                }

                // AI Unload Logic
                if (unit.carriedUnits && unit.carriedUnits.length > 0) {
                    this.calculateUnloadRange(unit);
                    if (this.validUnloadTiles.length > 0) {
                        let bestUnloadTile = null;
                        let bestScore = -Infinity;
                        const passenger = unit.carriedUnits[unit.carriedUnits.length - 1];
                        
                        let targetPoints = [];
                        if (passenger.type === Unit.TYPES.INFANTRY) {
                            targetPoints = this.getCapturablePropertiesForPlayer(unit.owner);
                        }
                        if (targetPoints.length === 0) {
                            targetPoints = enemies;
                        }

                        for (let ut of this.validUnloadTiles) {
                            let score = 0;
                            if (targetPoints.length > 0) {
                                let minD = Infinity;
                                for (let p of targetPoints) {
                                    const d = this.getDistance(ut.x, ut.y, p.x, p.y);
                                    if (d < minD) minD = d;
                                }
                                score -= minD * 10;
                            }
                            if (passenger.type === Unit.TYPES.INFANTRY && this.isCapturablePropertyForPlayer(this.map.getTerrainAt(ut.x, ut.y), unit.owner)) {
                                score += 50;
                            }
                            if (score > bestScore) {
                                bestScore = score;
                                bestUnloadTile = ut;
                            }
                        }

                        if (bestUnloadTile) {
                            const unitToUnload = unit.carriedUnits.pop();
                            unitToUnload.x = bestUnloadTile.x;
                            unitToUnload.y = bestUnloadTile.y;
                            unitToUnload.hasMoved = true;
                            unitToUnload.hasAttacked = true;
                            unitToUnload.loadedTurn = null;
                            this.units.push(unitToUnload);
                            this.audioManager.play('unload');
                            console.log('AI unloaded infantry at', bestUnloadTile.x, bestUnloadTile.y);
                            await this.sleep(400);
                        }
                    }
                }

                unit.hasMoved = true;
                unit.hasAttacked = true;
                this.checkCapture(unit);
            }

            this.clearSelection();
            await this.sleep(400);
        }
        
        // Return control to Player 1
        if (this.state !== Game.STATES.GAME_OVER) {
            this.state = Game.STATES.IDLE;
            this.endTurn();
        }
    }
    

    // Spawning / Economical helper methods
    getCapturablePropertiesForPlayer(player) {
        const targets = [];
        for (let y = 0; y < this.map.rows; y++) {
            for (let x = 0; x < this.map.cols; x++) {
                const terrain = this.map.getTerrainAt(x, y);
                if (this.isCapturablePropertyForPlayer(terrain, player)) {
                    targets.push({ x, y, terrain, key: `${x},${y}` });
                }
            }
        }
        return targets;
    }

    isCapturablePropertyForPlayer(terrain, player) {
        if (player === 1) {
            return terrain === GameMap.TERRAIN.CITY_NEUTRAL ||
                   terrain === GameMap.TERRAIN.CITY_P2 ||
                   terrain === GameMap.TERRAIN.HQ_P2 ||
                   terrain === GameMap.TERRAIN.FACTORY_NEUTRAL ||
                   terrain === GameMap.TERRAIN.FACTORY_P2 ||
                   terrain === GameMap.TERRAIN.AIRPORT_NEUTRAL ||
                   terrain === GameMap.TERRAIN.AIRPORT_P2 ||
                   terrain === GameMap.TERRAIN.PORT_NEUTRAL ||
                   terrain === GameMap.TERRAIN.PORT_P2;
        }

        return terrain === GameMap.TERRAIN.CITY_NEUTRAL ||
               terrain === GameMap.TERRAIN.CITY_P1 ||
               terrain === GameMap.TERRAIN.HQ_P1 ||
               terrain === GameMap.TERRAIN.FACTORY_NEUTRAL ||
               terrain === GameMap.TERRAIN.FACTORY_P1 ||
               terrain === GameMap.TERRAIN.AIRPORT_NEUTRAL ||
               terrain === GameMap.TERRAIN.AIRPORT_P1 ||
               terrain === GameMap.TERRAIN.PORT_NEUTRAL ||
               terrain === GameMap.TERRAIN.PORT_P1;
    }

    getPropertyValue(terrain) {
        if (terrain === GameMap.TERRAIN.FACTORY_NEUTRAL ||
            terrain === GameMap.TERRAIN.FACTORY_P1 ||
            terrain === GameMap.TERRAIN.FACTORY_P2) {
            return 5;
        }
        if (terrain === GameMap.TERRAIN.AIRPORT_NEUTRAL ||
            terrain === GameMap.TERRAIN.AIRPORT_P1 ||
            terrain === GameMap.TERRAIN.AIRPORT_P2) {
            return 4;
        }
        if (terrain === GameMap.TERRAIN.CITY_P1 || terrain === GameMap.TERRAIN.CITY_P2 || terrain === GameMap.TERRAIN.HQ_P1 || terrain === GameMap.TERRAIN.HQ_P2) {
            return 5;
        }
        if (terrain === GameMap.TERRAIN.CITY_NEUTRAL) {
            return 3;
        }
        if (terrain === GameMap.TERRAIN.PORT_NEUTRAL || terrain === GameMap.TERRAIN.PORT_P1 || terrain === GameMap.TERRAIN.PORT_P2) {
            return 3;
        }
        return 1;
    }

    chooseAIPropertyTarget(unit, reservedTargets) {
        const targets = this.getCapturablePropertiesForPlayer(unit.owner);
        let bestTarget = null;
        let bestScore = -Infinity;

        for (const target of targets) {
            const occupant = this.getUnitAt(target.x, target.y);
            if (occupant && occupant.owner === unit.owner && occupant !== unit) continue;
            if (reservedTargets.has(target.key) && !(target.x === unit.x && target.y === unit.y)) continue;

            let distance = this.getDistance(unit.x, unit.y, target.x, target.y);
            if (this.aiDifficulty === 'hard') {
                const path = this.findPathAStar(unit, target.x, target.y);
                if (!path) continue; // Unreachable
                distance = path.length;
            }

            const incomeGap = this.estimatePlayerIncome(unit.owner === 1 ? 2 : 1) - this.estimatePlayerIncome(unit.owner);
            // Increased economy bonus for funding tactical thinking
            const economyBonus = incomeGap > 0 ? this.getPropertyValue(target.terrain) * 15 : this.getPropertyValue(target.terrain) * 8;
            
            // Tactical advantage for weapon manufacturing
            let productionBonus = 0;
            if ([GameMap.TERRAIN.FACTORY_NEUTRAL, GameMap.TERRAIN.FACTORY_P1, GameMap.TERRAIN.FACTORY_P2, 
                 GameMap.TERRAIN.AIRPORT_NEUTRAL, GameMap.TERRAIN.AIRPORT_P1, GameMap.TERRAIN.AIRPORT_P2,
                 GameMap.TERRAIN.PORT_NEUTRAL, GameMap.TERRAIN.PORT_P1, GameMap.TERRAIN.PORT_P2].includes(target.terrain)) {
                productionBonus = 60;
            }

            const occupantBonus = occupant && occupant.owner !== unit.owner ? 3 : 0;
            const currentTileBonus = target.x === unit.x && target.y === unit.y ? 150 : 0;
            const score = currentTileBonus + this.getPropertyValue(target.terrain) * 25 + economyBonus + productionBonus + occupantBonus - distance * 1.2;

            if (score > bestScore) {
                bestScore = score;
                bestTarget = target;
            }
        }

        return bestTarget;
    }

    countOwnedProductionTiles(player, productionTerrain) {
        let count = 0;
        for (let y = 0; y < this.map.rows; y++) {
            for (let x = 0; x < this.map.cols; x++) {
                if (this.map.getTerrainAt(x, y) === productionTerrain) count++;
            }
        }
        return count;
    }

    getUnitBattleValue(unit) {
        return Unit.COSTS[unit.type] || 1000;
    }

    estimatePlayerIncome(player) {
        let income = 0;
        for (let y = 0; y < this.map.rows; y++) {
            for (let x = 0; x < this.map.cols; x++) {
                const terrain = this.map.getTerrainAt(x, y);
                if (player === 1) {
                    if (terrain === GameMap.TERRAIN.CITY_P1 || terrain === GameMap.TERRAIN.HQ_P1 || terrain === GameMap.TERRAIN.PORT_P1) income += 1000;
                    if (terrain === GameMap.TERRAIN.FACTORY_P1 || terrain === GameMap.TERRAIN.AIRPORT_P1) income += 500;
                } else {
                    if (terrain === GameMap.TERRAIN.CITY_P2 || terrain === GameMap.TERRAIN.HQ_P2 || terrain === GameMap.TERRAIN.PORT_P2) income += 1000;
                    if (terrain === GameMap.TERRAIN.FACTORY_P2 || terrain === GameMap.TERRAIN.AIRPORT_P2) income += 500;
                }
            }
        }
        return income;
    }

    getAIEconomyPlan(player, capturableTargets, aiUnitsAlive) {
        const enemy = player === 1 ? 2 : 1;
        const aiIncome = this.estimatePlayerIncome(player);
        const enemyIncome = this.estimatePlayerIncome(enemy);
        const infantryCount = aiUnitsAlive.filter(u => u.type === Unit.TYPES.INFANTRY).length;
        const remoteCaptureTargets = capturableTargets.filter(target => {
            const nearestInfantry = aiUnitsAlive
                .filter(u => u.type === Unit.TYPES.INFANTRY)
                .reduce((best, unit) => Math.min(best, this.getDistance(unit.x, unit.y, target.x, target.y)), Infinity);
            return nearestInfantry > 6;
        }).length;

        return {
            aiIncome,
            enemyIncome,
            incomeGap: enemyIncome - aiIncome,
            shouldExpand: capturableTargets.length > 0 && (enemyIncome >= aiIncome || infantryCount < 3),
            remoteCaptureTargets
        };
    }

    chooseAICounterBuild(player, enemyUnits, funds, allowedTypes = null) {
        const candidates = allowedTypes || [
            Unit.TYPES.AA_TANK,
            Unit.TYPES.AA_MISSILE,
            Unit.TYPES.TANK,
            Unit.TYPES.MD_TANK,
            Unit.TYPES.HV_TANK,
            Unit.TYPES.ARTILLERY,
            Unit.TYPES.ROCKET,
            Unit.TYPES.FIGHTER,
            Unit.TYPES.BOMBER
        ];
        let bestType = null;
        let bestScore = -Infinity;

        for (const type of candidates) {
            const cost = Unit.COSTS[type] || Infinity;
            if (cost > Math.max(funds, 22000)) continue;
            let score = 0;
            for (const enemy of enemyUnits) {
                const damage = Unit.MATCHUPS[type]?.[enemy.type] || 0;
                if (damage <= 0) continue;
                const enemyValue = this.getUnitBattleValue(enemy);
                score += damage * enemy.health * enemyValue / 10000;
                if (damage >= 7) score += 8;
            }
            score -= cost / 3500;
            if (funds >= cost) score += 6;
            if (type === Unit.TYPES.FIGHTER || type === Unit.TYPES.BOMBER) score -= 5;
            if (score > bestScore) {
                bestScore = score;
                bestType = type;
            }
        }

        return bestScore >= 12 ? bestType : null;
    }

    isNavalUnitType(type) {
        return type === Unit.TYPES.BATTLESHIP ||
               type === Unit.TYPES.DESTROYER ||
               type === Unit.TYPES.SUBMARINE ||
               type === Unit.TYPES.HOVERCRAFT;
    }

    getNavalMapValue(portX, portY, player) {
        let seaTiles = 0;
        let hoverLandingTiles = 0;
        let nearbySeaTiles = 0;
        let enemyNavalPressure = 0;
        let enemyCoastalPressure = 0;
        let capturablePortTargets = 0;

        for (let y = 0; y < this.map.rows; y++) {
            for (let x = 0; x < this.map.cols; x++) {
                const terrain = this.map.getTerrainAt(x, y);
                const seaCost = this.map.getMovementCost(terrain, Unit.MOVE_TYPES.SEA);
                const hoverCost = this.map.getMovementCost(terrain, Unit.MOVE_TYPES.HOVER);
                const d = this.getDistance(portX, portY, x, y);

                if (seaCost !== Infinity) {
                    seaTiles++;
                    if (d <= 8) nearbySeaTiles++;
                }
                if (hoverCost !== Infinity && seaCost === Infinity && d <= 10) {
                    hoverLandingTiles++;
                }
                if (this.isCapturablePropertyForPlayer(terrain, player) &&
                    (terrain === GameMap.TERRAIN.PORT_NEUTRAL || terrain === GameMap.TERRAIN.PORT_P1 || terrain === GameMap.TERRAIN.PORT_P2)) {
                    capturablePortTargets++;
                }
            }
        }

        const enemyOwner = player === 1 ? 2 : 1;
        for (const enemy of this.units) {
            if (enemy.owner !== enemyOwner || enemy.health <= 0 || enemy.x < 0) continue;
            const d = this.getDistance(portX, portY, enemy.x, enemy.y);
            if (this.isNavalUnitType(enemy.type)) {
                enemyNavalPressure += Math.max(1, 14 - d) * (enemy.type === Unit.TYPES.BATTLESHIP ? 2 : 1);
            } else if (d <= 8 && enemy.moveType !== Unit.MOVE_TYPES.AIR) {
                enemyCoastalPressure += Math.max(1, 9 - d);
            }
        }

        return {
            seaTiles,
            nearbySeaTiles,
            hoverLandingTiles,
            enemyNavalPressure,
            enemyCoastalPressure,
            capturablePortTargets,
            hasUsefulSea: seaTiles >= 8 && nearbySeaTiles >= 2
        };
    }

    chooseAINavalBuild(player, portX, portY, context = {}) {
        const funds = context.funds ?? this.playerFunds[player];
        const navalValue = this.getNavalMapValue(portX, portY, player);
        if (!navalValue.hasUsefulSea) return null;

        const ownedNaval = this.units.filter(u => u.owner === player && u.health > 0 && this.isNavalUnitType(u.type));
        const navalCount = context.aiNavalCount ?? ownedNaval.length;
        const hovercraftCount = context.aiHovercraftCount ?? ownedNaval.filter(u => u.type === Unit.TYPES.HOVERCRAFT).length;
        const hasBattleship = ownedNaval.some(u => u.type === Unit.TYPES.BATTLESHIP);
        const hasDestroyer = ownedNaval.some(u => u.type === Unit.TYPES.DESTROYER);
        const hasSubmarine = ownedNaval.some(u => u.type === Unit.TYPES.SUBMARINE);
        const needsTransport = !!context.shouldBuildTransport &&
            ((context.infantryDemand ?? 0) > 0 || navalValue.capturablePortTargets > 0 || navalValue.hoverLandingTiles >= 12);

        const candidates = [
            Unit.TYPES.DESTROYER,
            Unit.TYPES.SUBMARINE,
            Unit.TYPES.BATTLESHIP,
            Unit.TYPES.HOVERCRAFT
        ].filter(type => funds >= Unit.COSTS[type]);

        let bestType = null;
        let bestScore = -Infinity;
        for (const type of candidates) {
            let score = 0;
            if (type === Unit.TYPES.DESTROYER) {
                score += 20 + navalValue.enemyNavalPressure * 2;
                if (!hasDestroyer) score += 18;
                if (context.primaryThreat === 'AIR') score += 10;
            } else if (type === Unit.TYPES.SUBMARINE) {
                score += 16 + navalValue.enemyNavalPressure * 2.5;
                if (!hasSubmarine && navalValue.enemyNavalPressure > 0) score += 16;
                if (hasDestroyer) score += 6;
            } else if (type === Unit.TYPES.BATTLESHIP) {
                score += 12 + navalValue.enemyCoastalPressure * 1.5 + navalValue.seaTiles / 4;
                if (!hasBattleship && navalCount >= 1) score += 14;
                if (funds < Unit.COSTS[Unit.TYPES.BATTLESHIP] + Unit.COSTS[Unit.TYPES.INFANTRY]) score -= 8;
            } else if (type === Unit.TYPES.HOVERCRAFT) {
                if (!needsTransport) {
                    score -= 100; // Do not build hovercraft if no transport is needed
                } else {
                    score += 34;
                    score += Math.min(20, navalValue.hoverLandingTiles / 2);
                }
                if (hovercraftCount > 0) score -= 16;
            }

            score -= Unit.COSTS[type] / 5000;
            if (this.aiDifficulty === 'hard') {
                score += navalValue.enemyNavalPressure > 0 ? 8 : 0;
            }

            if (score > bestScore) {
                bestScore = score;
                bestType = type;
            }
        }

        if (!bestType) return null;
        if (navalCount >= 3 && navalValue.enemyNavalPressure <= 0 && !needsTransport) return null;
        if (bestScore < (this.aiDifficulty === 'easy' ? 18 : 12)) return null;
        return bestType;
    }

    getLocalProductionNeed(player, x, y) {
        const enemyOwner = player === 1 ? 2 : 1;
        const capturable = this.getCapturablePropertiesForPlayer(player)
            .filter(p => this.getDistance(x, y, p.x, p.y) <= 8);
        const localInfantry = this.units.filter(u =>
            u.owner === player &&
            u.type === Unit.TYPES.INFANTRY &&
            u.health > 0 &&
            this.getDistance(x, y, u.x, u.y) <= 8
        ).length;

        let airPressure = 0;
        let armorPressure = 0;
        for (const enemy of this.units) {
            if (enemy.owner !== enemyOwner || enemy.health <= 0 || enemy.x < 0) continue;
            const d = this.getDistance(x, y, enemy.x, enemy.y);
            if (d > 10) continue;
            const weight = Math.max(1, 11 - d);
            if ([Unit.TYPES.FIGHTER, Unit.TYPES.BOMBER, Unit.TYPES.HELI_TRANSPORT].includes(enemy.type)) {
                airPressure += weight;
            } else if ([Unit.TYPES.TANK, Unit.TYPES.MD_TANK, Unit.TYPES.HV_TANK, Unit.TYPES.ARTILLERY, Unit.TYPES.ROCKET].includes(enemy.type)) {
                armorPressure += weight;
            }
        }

        const incomeGap = this.estimatePlayerIncome(enemyOwner) - this.estimatePlayerIncome(player);
        if ((capturable.length > localInfantry || incomeGap > 0) && localInfantry < 4) return 'INFANTRY';
        if (airPressure >= 10 && airPressure >= armorPressure) return 'ANTI_AIR';
        if (armorPressure >= 10) return 'ANTI_ARMOR';
        return 'BALANCED';
    }

    giveTurnIncome(player) {
        let income = 0;
        for (let y = 0; y < this.map.rows; y++) {
            for (let x = 0; x < this.map.cols; x++) {
                const terrain = this.map.getTerrainAt(x, y);
                if (player === 1) {
                    if (terrain === GameMap.TERRAIN.CITY_P1 || terrain === GameMap.TERRAIN.HQ_P1 || terrain === GameMap.TERRAIN.PORT_P1) income += 1000;
                    if (terrain === GameMap.TERRAIN.FACTORY_P1 || terrain === GameMap.TERRAIN.AIRPORT_P1) income += 500;
                } else {
                    if (terrain === GameMap.TERRAIN.CITY_P2 || terrain === GameMap.TERRAIN.HQ_P2 || terrain === GameMap.TERRAIN.PORT_P2) income += 1000;
                    if (terrain === GameMap.TERRAIN.FACTORY_P2 || terrain === GameMap.TERRAIN.AIRPORT_P2) income += 500;
                }
            }
        }
        
        if (player === 2) {
            if (this.aiDifficulty === 'normal') {
                income = Math.floor(income * 1.2);
            } else if (this.aiDifficulty === 'hard') {
                income = Math.floor(income * 1.5) + 1000;
            }
        }

        this.playerFunds[player] += income;
        this.updateFundsUI();
    }

    updateFundsUI() {
        const fundsIndicator = document.getElementById('funds-indicator');
        if (fundsIndicator) {
            fundsIndicator.textContent = `資金: ${this.playerFunds[this.currentPlayer]} G`;
        }
    }

    checkCapture(unit) {
        if (!unit || unit.type !== Unit.TYPES.INFANTRY) return;
        
        // Clean up stale capture points
        for (const key in this.capturePoints) {
            const [cx, cy] = key.split(',').map(Number);
            const cp = this.capturePoints[key];
            if (cp.capturer.x !== cx || cp.capturer.y !== cy || cp.capturer.health <= 0) {
                delete this.capturePoints[key];
            }
        }

        const x = unit.x;
        const y = unit.y;
        const terrain = this.map.getTerrainAt(x, y);

        // Check if on a capturable building
        const isCapturable = terrain === GameMap.TERRAIN.CITY_NEUTRAL || 
                             terrain === GameMap.TERRAIN.CITY_P1 || 
                             terrain === GameMap.TERRAIN.CITY_P2 ||
                             terrain === GameMap.TERRAIN.HQ_P1 ||
                             terrain === GameMap.TERRAIN.HQ_P2 ||
                             terrain === GameMap.TERRAIN.FACTORY_NEUTRAL ||
                             terrain === GameMap.TERRAIN.FACTORY_P1 ||
                             terrain === GameMap.TERRAIN.FACTORY_P2 ||
                             terrain === GameMap.TERRAIN.PORT_NEUTRAL ||
                             terrain === GameMap.TERRAIN.PORT_P1 ||
                             terrain === GameMap.TERRAIN.PORT_P2 ||
                             terrain === GameMap.TERRAIN.AIRPORT_NEUTRAL ||
                             terrain === GameMap.TERRAIN.AIRPORT_P1 ||
                             terrain === GameMap.TERRAIN.AIRPORT_P2;

        if (!isCapturable) return;

        // Check if building is already owned by the unit's player
        const isOwnedByCurrent = (unit.owner === 1 && (terrain === GameMap.TERRAIN.CITY_P1 || terrain === GameMap.TERRAIN.FACTORY_P1 || terrain === GameMap.TERRAIN.AIRPORT_P1 || terrain === GameMap.TERRAIN.PORT_P1 || terrain === GameMap.TERRAIN.HQ_P1)) ||
                                 (unit.owner === 2 && (terrain === GameMap.TERRAIN.CITY_P2 || terrain === GameMap.TERRAIN.FACTORY_P2 || terrain === GameMap.TERRAIN.AIRPORT_P2 || terrain === GameMap.TERRAIN.PORT_P2 || terrain === GameMap.TERRAIN.HQ_P2));

        if (isOwnedByCurrent) return;

        const key = `${x},${y}`;
        // Initialize points if not exists or if a different unit started capturing
        if (!this.capturePoints[key] || this.capturePoints[key].capturer !== unit) {
            this.capturePoints[key] = { points: 0, capturer: unit };
        }

        // Add points based on unit HP
        this.capturePoints[key].points += unit.health;

        const captureRequired = GameMap.getCapturePointsRequired(terrain);
        console.log(`Unit at ${x},${y} capturing. Points: ${this.capturePoints[key].points}/${captureRequired}`);
        if (this.capturePoints[key].points >= captureRequired) {
            // Capture successful
            if (GameMap.isHQ(terrain)) {
                this.map.grid[y][x] = unit.owner === 1 ? GameMap.TERRAIN.HQ_P1 : GameMap.TERRAIN.HQ_P2;
                delete this.capturePoints[key];
                this.handleHQCaptured(unit.owner);
                return;
            }

            if (unit.owner === 1) {
                if (terrain === GameMap.TERRAIN.CITY_NEUTRAL || terrain === GameMap.TERRAIN.CITY_P2) {
                    this.map.grid[y][x] = GameMap.TERRAIN.CITY_P1;
                } else if (terrain === GameMap.TERRAIN.FACTORY_NEUTRAL || terrain === GameMap.TERRAIN.FACTORY_P2) {
                    this.map.grid[y][x] = GameMap.TERRAIN.FACTORY_P1;
                } else if (terrain === GameMap.TERRAIN.AIRPORT_NEUTRAL || terrain === GameMap.TERRAIN.AIRPORT_P2) {
                    this.map.grid[y][x] = GameMap.TERRAIN.AIRPORT_P1;
                } else if (terrain === GameMap.TERRAIN.PORT_NEUTRAL || terrain === GameMap.TERRAIN.PORT_P2) {
                    this.map.grid[y][x] = GameMap.TERRAIN.PORT_P1;
                }
            } else if (unit.owner === 2) {
                if (terrain === GameMap.TERRAIN.CITY_NEUTRAL || terrain === GameMap.TERRAIN.CITY_P1) {
                    this.map.grid[y][x] = GameMap.TERRAIN.CITY_P2;
                } else if (terrain === GameMap.TERRAIN.FACTORY_NEUTRAL || terrain === GameMap.TERRAIN.FACTORY_P1) {
                    this.map.grid[y][x] = GameMap.TERRAIN.FACTORY_P2;
                } else if (terrain === GameMap.TERRAIN.AIRPORT_NEUTRAL || terrain === GameMap.TERRAIN.AIRPORT_P1) {
                    this.map.grid[y][x] = GameMap.TERRAIN.AIRPORT_P2;
                } else if (terrain === GameMap.TERRAIN.PORT_NEUTRAL || terrain === GameMap.TERRAIN.PORT_P1) {
                    this.map.grid[y][x] = GameMap.TERRAIN.PORT_P2;
                }
            }
            delete this.capturePoints[key];
            console.log(`Captured building at ${x},${y}`);
            this.updateFundsUI(); // Update UI if income changes (though it changes on turn start)
        }
    }

    spawnUnit(type, owner, x, y) {
        const cost = Unit.COSTS[type] || 0;
        if (this.playerFunds[owner] < cost) return false;

        const newUnit = new Unit(type, owner, x, y);
        // Newly spawned units cannot act until the next turn
        newUnit.hasMoved = true;
        newUnit.hasAttacked = true;

        this.units.push(newUnit);
        this.playerFunds[owner] -= cost;
        this.updateFundsUI();
        return true;
    }
} 

if (typeof window !== 'undefined') { window.Game = Game; }
