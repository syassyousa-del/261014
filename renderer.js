class Renderer {
    constructor(canvas, map, game, assetManager = null) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.map = map;
        this.game = game;
        this.assetManager = assetManager;
        this.tileSize = map.tileSize;

        // Load some basic colors for placeholders instead of sprites for prototype
        this.colors = {
            terrain: {
                [GameMap.TERRAIN.PLAINS]: '#7cfc00', // LawnGreen
                [GameMap.TERRAIN.FOREST]: '#228b22', // ForestGreen
                [GameMap.TERRAIN.MOUNTAIN]: '#8b4513', // SaddleBrown
                [GameMap.TERRAIN.WATER]: '#1e90ff', // DodgerBlue
                [GameMap.TERRAIN.ROAD]: '#d3d3d3', // LightGray
                [GameMap.TERRAIN.CITY_NEUTRAL]: '#a9a9a9', // DarkGray
                [GameMap.TERRAIN.CITY_P1]: '#ff8888', // Light Red
                [GameMap.TERRAIN.CITY_P2]: '#8888ff', // Light Blue
                [GameMap.TERRAIN.HQ_P1]: '#ff4444', // Player 1 HQ
                [GameMap.TERRAIN.HQ_P2]: '#4444ff', // Player 2 HQ
                [GameMap.TERRAIN.FACTORY_NEUTRAL]: '#777777', // Dark Slate
                [GameMap.TERRAIN.FACTORY_P1]: '#cc4444', // Red Factory
                [GameMap.TERRAIN.FACTORY_P2]: '#4444cc',  // Blue Factory
                [GameMap.TERRAIN.RIVER_H]: '#4169e1',  // RoyalBlue
                [GameMap.TERRAIN.RIVER_V]: '#4169e1',  // RoyalBlue
                [GameMap.TERRAIN.AIRPORT_NEUTRAL]: '#555555', // Dark Gray Airport
                [GameMap.TERRAIN.AIRPORT_P1]: '#aa5555', // Red Airport
                [GameMap.TERRAIN.AIRPORT_P2]: '#5555aa'  // Blue Airport
            },
            units: {
                1: '#ff0000', // Player 1 Red
                2: '#0000ff'  // Player 2 Blue
            },
            highlights: {
                move: 'rgba(255, 255, 0, 0.4)', // Yellow
                attack: 'rgba(255, 0, 0, 0.5)',  // Red
                enemyAttack: 'rgba(255, 64, 64, 0.35)',
                unload: 'rgba(0, 255, 0, 0.5)'   // Green
            }
        };
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        if (this.game.camera) {
            this.ctx.translate(this.game.camera.x, this.game.camera.y);
            this.ctx.scale(this.game.camera.zoom, this.game.camera.zoom);
        }

        this.drawMap();
        this.drawHighlights();
        this.drawUnits();
        this.drawCaptureProgress();
        this.ctx.restore();

        // Draw overlays outside of camera transform
        if (this.game.state === 'BATTLE_ANIMATION') {
            this.drawBattleAnimation();
        }

        // Draw overlays outside of camera transform
        if (this.game.state === 'BATTLE_ANIMATION') {
            this.drawBattleAnimation();
        }
    }

    drawMap() {
        for (let y = 0; y < this.map.rows; y++) {
            for (let x = 0; x < this.map.cols; x++) {
                const terrain = this.map.getTerrainAt(x, y);
                const px = x * this.tileSize;
                const py = y * this.tileSize;

                let img = null;
                if (this.assetManager) {
                    if (terrain === GameMap.TERRAIN.ROAD) {
                        const bitmask = this.map.getRoadRenderMask(x, y);
                        img = this.assetManager.getRoadImage(bitmask);
                    } else if (terrain === GameMap.TERRAIN.WATER) {
                        const bitmask = this.map.getWaterRenderMask(x, y);
                        img = this.assetManager.getWaterImage(bitmask);
                    } else if (this.map.isRiver(terrain)) {
                        const bitmask = this.map.getRiverRenderMask(x, y);
                        img = this.assetManager.getRiverImage(bitmask);
                    } else if (terrain === GameMap.TERRAIN.PLAINS) {
                        // No coastline images; rely on color fallback
                        // (coastline rendering handled via vector colors)
                    }
                    
                    if (!img) {
                        img = this.assetManager.getImage(terrain);
                    }
                }

                if (img) {
                    // Draw loaded image
                    this.ctx.drawImage(img, px, py, this.tileSize, this.tileSize);
                } else {
                    // Fallback to vector drawing
                    this.ctx.fillStyle = this.colors.terrain[terrain] || '#fff';
                    this.ctx.fillRect(px, py, this.tileSize, this.tileSize);
                    
                    // Draw decorative lines for structures
                    if (terrain === GameMap.TERRAIN.CITY_NEUTRAL || terrain === GameMap.TERRAIN.CITY_P1 || terrain === GameMap.TERRAIN.CITY_P2) {
                        // Draw a small building roof / shape
                        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
                        this.ctx.fillRect(px + 8, py + 12, this.tileSize - 16, this.tileSize - 20);
                        this.ctx.strokeStyle = '#000';
                        this.ctx.lineWidth = 1.5;
                        this.ctx.strokeRect(px + 8, py + 12, this.tileSize - 16, this.tileSize - 20);
                        
                        // Draw simple roof
                        this.ctx.beginPath();
                        this.ctx.moveTo(px + 8, py + 12);
                        this.ctx.lineTo(px + this.tileSize / 2, py + 4);
                        this.ctx.lineTo(px + this.tileSize - 8, py + 12);
                        this.ctx.closePath();
                        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
                        this.ctx.fill();
                        this.ctx.stroke();
                    } else if (terrain === GameMap.TERRAIN.FACTORY_NEUTRAL || terrain === GameMap.TERRAIN.FACTORY_P1 || terrain === GameMap.TERRAIN.FACTORY_P2) {
                        // Draw factory shape with twin chimneys
                        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                        this.ctx.fillRect(px + 6, py + 16, this.tileSize - 12, this.tileSize - 22);
                        this.ctx.strokeStyle = '#000';
                        this.ctx.lineWidth = 1.5;
                        this.ctx.strokeRect(px + 6, py + 16, this.tileSize - 12, this.tileSize - 22);
                        
                        // Draw chimneys
                        this.ctx.fillRect(px + 10, py + 6, 6, 10);
                        this.ctx.strokeRect(px + 10, py + 6, 6, 10);
                        this.ctx.fillRect(px + this.tileSize - 16, py + 6, 6, 10);
                        this.ctx.strokeRect(px + this.tileSize - 16, py + 6, 6, 10);
                        
                        // Smoke puff!
                        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                        this.ctx.beginPath();
                        this.ctx.arc(px + 13, py + 2, 3, 0, Math.PI * 2);
                        this.ctx.arc(px + this.tileSize - 13, py + 2, 3, 0, Math.PI * 2);
                        this.ctx.fill();
                    } else if (terrain === GameMap.TERRAIN.HQ_P1 || terrain === GameMap.TERRAIN.HQ_P2) {
                        // Draw the HQ base
                        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
                        this.ctx.fillRect(px + 6, py + 8, this.tileSize - 12, this.tileSize - 14);
                        this.ctx.strokeStyle = '#000';
                        this.ctx.lineWidth = 1.5;
                        this.ctx.strokeRect(px + 6, py + 8, this.tileSize - 12, this.tileSize - 14);

                        this.ctx.fillStyle = terrain === GameMap.TERRAIN.HQ_P1 ? '#ff0000' : '#0000ff';
                        this.ctx.beginPath();
                        this.ctx.moveTo(px + this.tileSize / 2, py + 10);
                        this.ctx.lineTo(px + this.tileSize - 10, py + 10);
                        this.ctx.lineTo(px + this.tileSize - 10, py + 18);
                        this.ctx.lineTo(px + this.tileSize / 2 + 4, py + 18);
                        this.ctx.lineTo(px + this.tileSize / 2 + 4, py + 24);
                        this.ctx.lineTo(px + this.tileSize / 2 - 4, py + 24);
                        this.ctx.lineTo(px + this.tileSize / 2 - 4, py + 18);
                        this.ctx.lineTo(px + 10, py + 18);
                        this.ctx.lineTo(px + 10, py + 10);
                        this.ctx.closePath();
                        this.ctx.fill();

                        this.ctx.fillStyle = '#000';
                        this.ctx.font = 'bold 14px sans-serif';
                        this.ctx.textAlign = 'center';
                        this.ctx.textBaseline = 'middle';
                        this.ctx.fillText('HQ', px + this.tileSize / 2, py + this.tileSize / 2 + 6);
                    } else if (terrain === GameMap.TERRAIN.AIRPORT_NEUTRAL || terrain === GameMap.TERRAIN.AIRPORT_P1 || terrain === GameMap.TERRAIN.AIRPORT_P2) {
                        // Airport terrain rendering (no movement arrows here)
                        if (terrain === GameMap.TERRAIN.AIRPORT_NEUTRAL || terrain === GameMap.TERRAIN.AIRPORT_P1 || terrain === GameMap.TERRAIN.AIRPORT_P2) {
                            // Simple rectangle with color based on terrain
                            this.ctx.fillStyle = this.colors.terrain[terrain] || '#555';
                            this.ctx.fillRect(px, py, this.tileSize, this.tileSize);
                            // Optional small control tower indicator
                            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                            this.ctx.fillRect(px + this.tileSize - 10, py + 8, 6, 8);
                            this.ctx.strokeStyle = '#000';
                            this.ctx.strokeRect(px + this.tileSize - 10, py + 8, 6, 8);
                        }
                    }
                }

                // Draw grid lines
                this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(px, py, this.tileSize, this.tileSize);
            }
        }
    }

    drawHighlights() {
        if (this.game.state === Game.STATES.IDLE && this.game.previewAttackTiles.length > 0) {
            this.ctx.fillStyle = this.colors.highlights.enemyAttack;
            this.game.previewAttackTiles.forEach(tile => {
                this.ctx.fillRect(tile.x * this.tileSize, tile.y * this.tileSize, this.tileSize, this.tileSize);
            });
        } else if (this.game.state === Game.STATES.UNIT_SELECTED) {
            this.ctx.fillStyle = this.colors.highlights.move;
            this.game.validMoveTiles.forEach(tile => {
                this.ctx.fillRect(tile.x * this.tileSize, tile.y * this.tileSize, this.tileSize, this.tileSize);
            });
        } else if (this.game.state === Game.STATES.ATTACKING || this.game.state === Game.STATES.POST_MOVE_MENU) {
            this.ctx.fillStyle = this.colors.highlights.attack;
            this.game.validAttackTiles.forEach(tile => {
                this.ctx.fillRect(tile.x * this.tileSize, tile.y * this.tileSize, this.tileSize, this.tileSize);
            });
        } else if (this.game.state === Game.STATES.UNLOADING) {
            this.ctx.fillStyle = this.colors.highlights.unload;
            this.game.validUnloadTiles.forEach(tile => {
                this.ctx.fillRect(tile.x * this.tileSize, tile.y * this.tileSize, this.tileSize, this.tileSize);
            });
        } else if (this.game.state === Game.STATES.AUTO_DESTINATION && this.game.selectedUnit) {
            this.ctx.fillStyle = 'rgba(80, 220, 255, 0.35)';
            this.ctx.fillRect(this.game.selectedUnit.x * this.tileSize, this.game.selectedUnit.y * this.tileSize, this.tileSize, this.tileSize);
        }

        this.drawAutoMoveMarkers();
    }

    drawAutoMoveMarkers() {
        this.game.units.forEach(unit => {
            if (!unit.autoMoveEnabled || !unit.autoMoveDestination) return;
            const x = unit.autoMoveDestination.x * this.tileSize;
            const y = unit.autoMoveDestination.y * this.tileSize;
            const cx = x + this.tileSize / 2;
            const cy = y + this.tileSize / 2;
            const r = Math.max(6, this.tileSize * 0.22);

            this.ctx.save();
            this.ctx.strokeStyle = unit.owner === 1 ? '#ffdddd' : '#ddddff';
            this.ctx.fillStyle = unit.owner === 1 ? 'rgba(255, 80, 80, 0.35)' : 'rgba(80, 120, 255, 0.35)';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            this.ctx.beginPath();
            this.ctx.moveTo(cx - r * 0.9, cy);
            this.ctx.lineTo(cx + r * 0.9, cy);
            this.ctx.moveTo(cx, cy - r * 0.9);
            this.ctx.lineTo(cx, cy + r * 0.9);
            this.ctx.stroke();
            this.ctx.restore();
        });
    }

    drawUnits() {
        this.game.units.forEach(unit => {
            const px = unit.x * this.tileSize;
            const py = unit.y * this.tileSize;

            // Dim if done
            if (unit.isDone()) {
                 this.ctx.globalAlpha = 0.5;
            }
            
            let img = null;
            if (this.assetManager) {
                img = this.assetManager.getUnitImage(unit.type, unit.owner);
            }

            if (img) {
                this.ctx.drawImage(img, px, py, this.tileSize, this.tileSize);
            } else {
                // Fallback to simple shapes
                this.ctx.fillStyle = this.colors.units[unit.owner];
                this.ctx.beginPath();
                if (unit.type === Unit.TYPES.INFANTRY || unit.type === Unit.TYPES.TRANSPORT) {
                     this.ctx.arc(px + this.tileSize/2, py + this.tileSize/2, this.tileSize/3, 0, Math.PI * 2);
                     this.ctx.fill();
                } else {
                     this.ctx.fillRect(px + this.tileSize*0.1, py + this.tileSize*0.1, this.tileSize*0.8, this.tileSize*0.8);
                }
            }
            
            this.ctx.globalAlpha = 1.0;

            if (unit.maxAmmo !== null && unit.maxAmmo !== undefined) {
                const ammoText = String(unit.ammo);
                const badgeH = Math.max(10, Math.floor(this.tileSize * 0.28));
                const badgeW = Math.max(14, ammoText.length * 7 + 6);
                const badgeX = px + 2;
                const badgeY = py + 2;
                this.ctx.fillStyle = unit.ammo > 0 ? 'rgba(20, 20, 20, 0.78)' : 'rgba(80, 0, 0, 0.82)';
                this.ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
                this.ctx.strokeStyle = unit.ammo > 0 ? '#ffdd55' : '#ff7777';
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);
                this.ctx.fillStyle = unit.ammo > 0 ? '#ffdd55' : '#ff9999';
                this.ctx.font = `${Math.max(8, Math.floor(badgeH * 0.72))}px Arial`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(ammoText, badgeX + badgeW / 2, badgeY + badgeH / 2);
            }

            // Selection indicator
            if (this.game.selectedUnit === unit) {
                this.ctx.strokeStyle = '#fff';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(px, py, this.tileSize, this.tileSize);
            }

            // Draw Health Gauge (5 blocks, each represents 2 HP)
            const gaugeWidth = this.tileSize - 4;
            const blockW = (gaugeWidth - 4) / 5;
            const blockH = 4;
            const startX = px + 2;
            const startY = py + this.tileSize - 8;

            // Gauge background
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            this.ctx.fillRect(startX - 1, startY - 1, gaugeWidth + 2, blockH + 2);

            let blocks = unit.health / 2;
            for (let i = 0; i < 5; i++) {
                let bx = startX + i * (blockW + 1);

                // Empty block background
                this.ctx.fillStyle = 'rgba(50, 50, 50, 0.8)';
                this.ctx.fillRect(bx, startY, blockW, blockH);

                let fillRatio = Math.max(0, Math.min(1, blocks - i));
                if (fillRatio > 0) {
                    // Color based on health
                    if (unit.health > 6) this.ctx.fillStyle = '#00ff00';
                    else if (unit.health > 3) this.ctx.fillStyle = '#ffff00';
                    else this.ctx.fillStyle = '#ff0000';

                    this.ctx.fillRect(bx, startY, blockW * fillRatio, blockH);
                }
            }

            const fuelRatio = Math.max(0, Math.min(1, (unit.fuel ?? 0) / (unit.maxFuel || 1)));
            const fuelY = py + this.tileSize - 2;
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            this.ctx.fillRect(startX - 1, fuelY - 1, gaugeWidth + 2, 3);
            this.ctx.fillStyle = '#2dff55';
            this.ctx.fillRect(startX, fuelY, gaugeWidth * fuelRatio, 1);
            
            if (!img) {
                // Draw type initial only if no image
                const typeInitial = {
                    'INFANTRY': 'I',
                    'TRANSPORT': 'T',
                    'TANK': 'T',
                    'MD_TANK': 'MT',
                    'HV_TANK': 'HT',
                    'ARTILLERY': 'A',
                    'ROCKET': 'R',
                    'HELI_TRANSPORT': 'H',
                    'FIGHTER': 'F',
                    'BOMBER': 'B',
                    'AA_TANK': 'AT',
                    'AA_MISSILE': 'AM',
                    'BATTLESHIP': 'BS',
                    'DESTROYER': 'D',
                    'SUBMARINE': 'S',
                    'HOVERCRAFT': 'HC'
                }[unit.type] || unit.type.charAt(0);
                this.ctx.fillStyle = '#000';
                this.ctx.fillText(typeInitial, px + this.tileSize/2, py + this.tileSize/2 + 12);
            }

            // Draw carried units indicator (badge)
if ((unit.type === Unit.TYPES.TRANSPORT || unit.type === Unit.TYPES.HELI_TRANSPORT || unit.type === Unit.TYPES.HOVERCRAFT) && unit.carriedUnits && unit.carriedUnits.length > 0) {
    const badgeSize = this.tileSize / 3;
    const badgeX = px + this.tileSize - badgeSize - 2;
    const badgeY = py + 2;
    this.ctx.fillStyle = 'rgba(0,0,0,0.6)';
    this.ctx.fillRect(badgeX, badgeY, badgeSize, badgeSize);
    this.ctx.fillStyle = '#fff';
    this.ctx.font = `${badgeSize * 0.6}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(unit.carriedUnits.length, badgeX + badgeSize / 2, badgeY + badgeSize / 2);
}
        });
    }

    drawCaptureProgress() {
        for (const key in this.game.capturePoints) {
            const [x, y] = key.split(',').map(Number);
            const cp = this.game.capturePoints[key];
            const px = x * this.tileSize;
            const py = y * this.tileSize;

            const points = cp.points;
            
            // Draw a small background box
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(px + 2, py + this.tileSize - 14, this.tileSize - 4, 12);
            
            // Draw a small progress bar
            this.ctx.fillStyle = '#ffff00'; // Yellow for progress
            const barWidth = (this.tileSize - 6) * (points / 20);
            this.ctx.fillRect(px + 3, py + this.tileSize - 13, barWidth, 10);
            
            // Draw text
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 9px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(`${points}/20`, px + this.tileSize / 2, py + this.tileSize - 8);
        }
    }

    drawExplosions() {
        if (!this.game.explosions || this.game.explosions.length === 0) return;

        const now = Date.now();
        this.game.explosions = this.game.explosions.filter(explosion => {
            const elapsed = now - explosion.startTime;
            const progress = elapsed / explosion.duration;
            if (progress >= 1) return false;

            const cx = explosion.x * this.tileSize + this.tileSize / 2;
            const cy = explosion.y * this.tileSize + this.tileSize / 2;
            const burstRadius = this.tileSize * (0.25 + progress * 0.7);
            const fade = 1 - progress;

            this.ctx.save();
            this.ctx.globalAlpha = Math.max(0, fade);

            const gradient = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, burstRadius);
            gradient.addColorStop(0, 'rgba(255, 255, 210, 1)');
            gradient.addColorStop(0.35, 'rgba(255, 160, 0, 0.95)');
            gradient.addColorStop(0.7, 'rgba(220, 40, 0, 0.7)');
            gradient.addColorStop(1, 'rgba(80, 80, 80, 0)');
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, burstRadius, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.fillStyle = `rgba(45, 45, 45, ${0.55 * fade})`;
            this.ctx.beginPath();
            this.ctx.arc(cx - this.tileSize * 0.12, cy - this.tileSize * 0.18, this.tileSize * (0.18 + progress * 0.25), 0, Math.PI * 2);
            this.ctx.arc(cx + this.tileSize * 0.15, cy - this.tileSize * 0.1, this.tileSize * (0.14 + progress * 0.22), 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.strokeStyle = `rgba(255, 230, 120, ${fade})`;
            this.ctx.lineWidth = 2;
            for (let i = 0; i < 8; i++) {
                const angle = (Math.PI * 2 / 8) * i;
                const inner = this.tileSize * 0.15;
                const outer = this.tileSize * (0.25 + progress * 0.55);
                this.ctx.beginPath();
                this.ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
                this.ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
                this.ctx.stroke();
            }

            this.ctx.restore();
            return true;
        });
    }

    drawBattleAnimation() {
        const anim = this.game.battleAnimation;
        if (!anim) return;
        
        const now = Date.now();
        const elapsed = now - anim.startTime;
        
        if (elapsed > anim.duration) {
            if (anim.onComplete) {
                const completeFn = anim.onComplete;
                anim.onComplete = null;
                completeFn();
            }
            return;
        }

        const width = this.canvas.width;
        const height = this.canvas.height;
        const panelWidth = Math.min(width * 0.8, 600);
        const panelHeight = Math.min(height * 0.5, 300);
        const px = (width - panelWidth) / 2;
        const py = (height - panelHeight) / 2;

        this.ctx.save();
        
        // Background dimming
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(0, 0, width, height);

        // Battle panel background
        this.ctx.fillStyle = '#223';
        this.ctx.fillRect(px, py, panelWidth, panelHeight);
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(px, py, panelWidth, panelHeight);

        // Ground line
        const groundY = py + panelHeight * 0.7;
        this.ctx.strokeStyle = '#555';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(px, groundY);
        this.ctx.lineTo(px + panelWidth, groundY);
        this.ctx.stroke();

        // Unit count determination
        const attackerCount = Math.max(1, Math.ceil(anim.attackerInitialHealth));
        const defenderCount = Math.max(1, Math.ceil(anim.defenderInitialHealth));

        // Damage resolution over time
        // 0 - 1000ms: Attacker fires
        // 1000 - 1500ms: Defender takes damage
        // 1500 - 2500ms: Defender counter fires (if alive) and Attacker takes damage
        let currentDefenderHealth = anim.defenderInitialHealth;
        let currentAttackerHealth = anim.attackerInitialHealth;

        if (elapsed > 1000) {
            const damageProgress = Math.min(1, (elapsed - 1000) / 500);
            currentDefenderHealth = anim.defenderInitialHealth - (anim.damage * damageProgress);
        }
        
        if (elapsed > 2000 && anim.counterDamage > 0 && anim.defenderInitialHealth - anim.damage > 0) {
            const counterProgress = Math.min(1, (elapsed - 2000) / 500);
            currentAttackerHealth = anim.attackerInitialHealth - (anim.counterDamage * counterProgress);
        }

        const currentDefenderCount = Math.ceil(currentDefenderHealth);
        const currentAttackerCount = Math.ceil(currentAttackerHealth);

        const spriteSize = 32;

        // Draw Attacker (Left side)
        const attackerImg = this.assetManager ? this.assetManager.getUnitImage(anim.attacker.type, anim.attacker.owner) : null;
        for (let i = 0; i < attackerCount; i++) {
            const row = Math.floor(i / 5);
            const col = i % 5;
            const x = px + 40 + col * 40;
            const y = groundY - spriteSize - 10 - row * 30;
            
            this.ctx.globalAlpha = (i < currentAttackerCount) ? 1.0 : 0.2;
            
            // Attacker firing animation (jitter)
            let drawX = x;
            if (elapsed > 200 && elapsed < 800 && i < currentAttackerCount) {
                drawX += (Math.random() - 0.5) * 4;
            }

            if (attackerImg) {
                this.ctx.drawImage(attackerImg, drawX, y, spriteSize, spriteSize);
            } else {
                this.ctx.fillStyle = this.colors.units[anim.attacker.owner];
                this.ctx.fillRect(drawX, y, spriteSize, spriteSize);
            }
        }
        this.ctx.globalAlpha = 1.0;

        // Draw Defender (Right side)
        const defenderImg = this.assetManager ? this.assetManager.getUnitImage(anim.defender.type, anim.defender.owner) : null;
        for (let i = 0; i < defenderCount; i++) {
            const row = Math.floor(i / 5);
            const col = i % 5;
            const x = px + panelWidth - 40 - col * 40 - spriteSize;
            const y = groundY - spriteSize - 10 - row * 30;
            
            this.ctx.globalAlpha = (i < currentDefenderCount) ? 1.0 : 0.2;
            
            // Defender firing animation (jitter)
            let drawX = x;
            if (elapsed > 1500 && elapsed < 2100 && i < currentDefenderCount && anim.counterDamage > 0 && currentDefenderCount > 0) {
                drawX += (Math.random() - 0.5) * 4;
            }

            // Flip defender image horizontally
            this.ctx.save();
            this.ctx.translate(drawX + spriteSize / 2, y + spriteSize / 2);
            this.ctx.scale(-1, 1);
            this.ctx.translate(-spriteSize / 2, -spriteSize / 2);

            if (defenderImg) {
                this.ctx.drawImage(defenderImg, 0, 0, spriteSize, spriteSize);
            } else {
                this.ctx.fillStyle = this.colors.units[anim.defender.owner];
                this.ctx.fillRect(0, 0, spriteSize, spriteSize);
            }
            this.ctx.restore();
        }
        this.ctx.globalAlpha = 1.0;

        // Draw projectiles / hit effects
        if (elapsed > 800 && elapsed < 1200) {
            // Attacker hitting defender
            this.ctx.fillStyle = 'yellow';
            this.ctx.beginPath();
            this.ctx.arc(px + panelWidth - 80 + (Math.random()-0.5)*20, groundY - 30 + (Math.random()-0.5)*20, 15, 0, Math.PI*2);
            this.ctx.fill();
        }
        
        if (elapsed > 1900 && elapsed < 2300 && anim.counterDamage > 0 && currentDefenderCount > 0) {
            // Defender hitting attacker
            this.ctx.fillStyle = 'yellow';
            this.ctx.beginPath();
            this.ctx.arc(px + 80 + (Math.random()-0.5)*20, groundY - 30 + (Math.random()-0.5)*20, 15, 0, Math.PI*2);
            this.ctx.fill();
        }

        this.ctx.restore();
    }
}
