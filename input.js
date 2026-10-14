class InputHandler {
    constructor(canvas, map, game) {
        this.canvas = canvas;
        this.map = map;
        this.game = game;
        this.tileSize = map.tileSize;

        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.cameraStartX = 0;
        this.cameraStartY = 0;
        this.hasMovedSignificantDistance = false;
        this.activeTouchId = null;
        this.unitInfoPosition = 'top-right';
        this.lastPointerClient = null;

        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
        this.canvas.addEventListener('touchcancel', this.handleTouchEnd.bind(this), { passive: false });
        window.addEventListener('mousemove', this.handlePointerMoveForOverlay.bind(this));
        window.addEventListener('touchstart', this.handleTouchPointerForOverlay.bind(this), { passive: true });
        window.addEventListener('touchmove', this.handleTouchPointerForOverlay.bind(this), { passive: true });
        window.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        // Right click to cancel/end turn
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (this.isDragging) {
                 this.isDragging = false;
                 return;
            }
            if (this.game.state === Game.STATES.AI_ACTIVE || this.game.currentPlayer === 2) return; // Block input during AI turn
            
            if (this.game.state !== Game.STATES.IDLE) {
                 this.game.cancelAction();
            } else {
                 this.game.clearRangePreview();
            }
        });

        const endTurnBtn = document.getElementById('end-turn-btn');
        if (endTurnBtn) {
            endTurnBtn.addEventListener('click', () => {
                if (this.game.state === Game.STATES.AI_ACTIVE || this.game.currentPlayer === 2) return;
                this.game.endTurn();
            });
        }

        // Wire up Production menu event listeners
        const prodOverlay = document.getElementById('production-overlay');
        const prodCancelBtn = document.getElementById('production-cancel-btn');
        if (prodCancelBtn) {
            prodCancelBtn.addEventListener('click', () => {
                prodOverlay.style.display = 'none';
            });
        }

        const prodConfirmBtn = document.getElementById('production-confirm-btn');
        const prodSelect = document.getElementById('production-select');
        if (prodConfirmBtn && prodSelect) {
            // Revised confirm button handling to prevent premature alerts
            prodConfirmBtn.onclick = () => {
                const selectedOption = prodSelect.options[prodSelect.selectedIndex];
                // If the currently selected unit is unaffordable, show alert and exit early
                if (selectedOption.disabled) {
                    alert('資金が足りません！');
                    return;
                }
                const type = prodSelect.value;
                const x = parseInt(prodOverlay.dataset.x);
                const y = parseInt(prodOverlay.dataset.y);
                // Attempt to spawn the unit; if it fails (e.g., race condition), show alert
                if (this.game.spawnUnit(type, this.game.currentPlayer, x, y)) {
                    prodOverlay.style.display = 'none';
                } else {
                    alert('資金が足りません！');
                }
            };
        }

        const unloadBtn = document.getElementById('unload-btn');
        if (unloadBtn) {
            unloadBtn.addEventListener('click', () => {
                if (this.game.state === Game.STATES.UNIT_SELECTED || this.game.state === Game.STATES.ATTACKING) {
                    // Calculate possible unload positions and enter unloading mode
                    this.game.calculateUnloadRange(this.game.selectedUnit);
                    if (this.game.validUnloadTiles.length > 0) {
                        this.game.state = Game.STATES.UNLOADING;
                    } else {
                        alert("降車できる場所がありません。");
                    }
                }
            });
        }

        const zoomInBtn = document.getElementById('zoom-in-btn');
        const zoomOutBtn = document.getElementById('zoom-out-btn');
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => this.applyZoom(0.2));
        }
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => this.applyZoom(-0.2));
        }

        const speedSlowBtn = document.getElementById('speed-slow-btn');
        const speedFastBtn = document.getElementById('speed-fast-btn');
        const speedFasterBtn = document.getElementById('speed-faster-btn');
        if (speedSlowBtn) {
            speedSlowBtn.addEventListener('click', () => {
                this.game.aiSpeedMultiplier = 1;
                this.updateSpeedButtons();
            });
        }
        if (speedFastBtn) {
            speedFastBtn.addEventListener('click', () => {
                this.game.aiSpeedMultiplier = 2;
                this.updateSpeedButtons();
            });
        }
        if (speedFasterBtn) {
            speedFasterBtn.addEventListener('click', () => {
                this.game.aiSpeedMultiplier = 3;
                this.updateSpeedButtons();
            });
        }

        this.createPostMoveMenu();
        this.updateSpeedButtons();
        this.updatePostMoveMenu();
    }

    updateSpeedButtons() {
        const speedSlowBtn = document.getElementById('speed-slow-btn');
        const speedFastBtn = document.getElementById('speed-fast-btn');
        const speedFasterBtn = document.getElementById('speed-faster-btn');
        
        [speedSlowBtn, speedFastBtn, speedFasterBtn].forEach(btn => {
            if (btn) btn.classList.remove('active');
        });
        
        if (this.game.aiSpeedMultiplier === 1 && speedSlowBtn) {
            speedSlowBtn.classList.add('active');
        } else if (this.game.aiSpeedMultiplier === 2 && speedFastBtn) {
            speedFastBtn.classList.add('active');
        } else if (this.game.aiSpeedMultiplier === 3 && speedFasterBtn) {
            speedFasterBtn.classList.add('active');
        }
    }

    createPostMoveMenu() {
        const wrapper = this.canvas.parentElement;
        if (!wrapper) return;

        this.postMoveMenu = document.createElement('div');
        this.postMoveMenu.className = 'post-move-menu';
        this.postMoveMenu.style.display = 'none';

        const attackButton = document.createElement('button');
        attackButton.className = 'post-move-option post-move-option-attack panel-btn primary';
        attackButton.textContent = '攻撃';
        attackButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.game.state = Game.STATES.ATTACKING;
            this.hidePostMoveMenu();
        });

        const moveButton = document.createElement('button');
        moveButton.className = 'post-move-option post-move-option-move panel-btn';
        moveButton.textContent = '移動';
        moveButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.game.state = Game.STATES.UNIT_SELECTED;
            this.hidePostMoveMenu();
        });

        this.moveButton = moveButton;

        const autoMoveButton = document.createElement('button');
        autoMoveButton.className = 'post-move-option post-move-option-auto panel-btn';
        autoMoveButton.textContent = 'オートON';
        autoMoveButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const unit = this.game.selectedUnit;
            if (!unit || !this.game.isAutoMovableShip(unit)) return;
            if (unit.autoMoveEnabled) {
                this.game.clearAutoMove(unit);
                this.updateUnitInfo(unit);
            } else {
                this.game.beginAutoDestinationSelection(unit);
            }
            this.hidePostMoveMenu();
        });

        this.autoMoveButton = autoMoveButton;

        const waitButton = document.createElement('button');
        waitButton.className = 'post-move-option post-move-option-wait panel-btn';
        waitButton.textContent = '停止';
        waitButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.game.confirmWaitAction();
            this.hidePostMoveMenu();
        });

        this.postMoveMenu.appendChild(attackButton);
        this.postMoveMenu.appendChild(moveButton);
        this.postMoveMenu.appendChild(autoMoveButton);
        this.postMoveMenu.appendChild(waitButton);
        wrapper.appendChild(this.postMoveMenu);
    }

    hidePostMoveMenu() {
        if (this.postMoveMenu) this.postMoveMenu.style.display = 'none';
    }

    updatePostMoveMenu() {
        if (!this.postMoveMenu) return;

        const unit = this.game.selectedUnit;
        const canAttack = this.game.validAttackTiles.length > 0;
        const canMove = unit && !unit.hasMoved && this.game.validMoveTiles.some(t => t.x !== unit.x || t.y !== unit.y);
        const canAutoMove = unit && this.game.isAutoMovableShip(unit);
        const shouldShow = this.game.state === Game.STATES.POST_MOVE_MENU && unit && (canAttack || canMove || canAutoMove);
        if (!shouldShow) {
            this.postMoveMenu.style.display = 'none';
            requestAnimationFrame(() => this.updatePostMoveMenu());
            return;
        }

        if (this.moveButton) {
            this.moveButton.style.display = canMove ? 'inline-flex' : 'none';
        }
        if (this.autoMoveButton) {
            this.autoMoveButton.style.display = canAutoMove ? 'inline-flex' : 'none';
            this.autoMoveButton.textContent = unit?.autoMoveEnabled ? 'オートOFF' : 'オートON';
            this.autoMoveButton.classList.toggle('primary', canAutoMove && !unit?.autoMoveEnabled);
        }

        const zoom = this.game.camera.zoom;
        const tile = this.tileSize * zoom;
        const margin = 8;

        // Compute unit screen position
        const unitScreenX = this.game.camera.x + unit.x * tile;
        const unitScreenY = this.game.camera.y + unit.y * tile;
        const unitCenterX = unitScreenX + tile / 2;

        this.postMoveMenu.style.display = 'flex';
        const menuWidth = this.postMoveMenu.offsetWidth || 112;
        const menuHeight = this.postMoveMenu.offsetHeight || 42;

        let x = unitCenterX - menuWidth / 2;
        let y = unitScreenY - menuHeight - 10;

        if (x < margin) {
            x = margin;
        }
        if (x + menuWidth + margin > this.canvas.width) {
            x = this.canvas.width - menuWidth - margin;
        }
        if (y < margin) {
            y = margin;
        }

        this.postMoveMenu.style.left = `${Math.round(x)}px`;
        this.postMoveMenu.style.top = `${Math.round(y)}px`;
        requestAnimationFrame(() => this.updatePostMoveMenu());
    }

    applyZoom(delta) {
        let newZoom = this.game.camera.zoom * (1 + delta);
        newZoom = Math.max(0.5, Math.min(newZoom, 3));
        
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        const worldX = (centerX - this.game.camera.x) / this.game.camera.zoom;
        const worldY = (centerY - this.game.camera.y) / this.game.camera.zoom;

        this.game.camera.zoom = newZoom;
        this.game.camera.x = centerX - worldX * this.game.camera.zoom;
        this.game.camera.y = centerY - worldY * this.game.camera.zoom;
        this.clampCamera();
    }

    clampCamera() {
        const minX = Math.min(0, this.canvas.width - this.map.cols * this.tileSize * this.game.camera.zoom);
        const minY = Math.min(0, this.canvas.height - this.map.rows * this.tileSize * this.game.camera.zoom);
        
        this.game.camera.x = Math.max(minX, Math.min(0, this.game.camera.x));
        this.game.camera.y = Math.max(minY, Math.min(0, this.game.camera.y));
    }

    handleKeyDown(e) {
        if (this.game.state === Game.STATES.START_SCREEN || this.game.state === Game.STATES.GAME_OVER) return;
        
        // Prevent scrolling main page when using arrows
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
            e.preventDefault();
        }

        const speed = 30;
        let panned = false;
        
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
            this.game.camera.y += speed;
            panned = true;
        } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
            this.game.camera.y -= speed;
            panned = true;
        } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
            this.game.camera.x += speed;
            panned = true;
        } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
            this.game.camera.x -= speed;
            panned = true;
        }
        
        if (panned) {
            this.clampCamera();
        }
    }

    handleWheel(e) {
        e.preventDefault();
        
        const zoomSensitivity = 0.001;
        const zoomDelta = -e.deltaY * zoomSensitivity;
        
        let newZoom = this.game.camera.zoom * (1 + zoomDelta);
        // Clamp zoom between 0.5 and 3.0
        newZoom = Math.max(0.5, Math.min(newZoom, 3));
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldX = (mouseX - this.game.camera.x) / this.game.camera.zoom;
        const worldY = (mouseY - this.game.camera.y) / this.game.camera.zoom;

        this.game.camera.zoom = newZoom;
        this.game.camera.x = mouseX - worldX * this.game.camera.zoom;
        this.game.camera.y = mouseY - worldY * this.game.camera.zoom;
        this.clampCamera();
    }

    handleMouseDown(e) {
        if (e.button !== 0) return; // Only left click
        this.lastPointerClient = { x: e.clientX, y: e.clientY };

        const rect = this.canvas.getBoundingClientRect();
        this.dragStartX = e.clientX - rect.left;
        this.dragStartY = e.clientY - rect.top;
        this.cameraStartX = this.game.camera.x;
        this.cameraStartY = this.game.camera.y;
        this.isDragging = true;
        this.hasMovedSignificantDistance = false;
    }

    handleMouseMove(e) {
        this.handlePointerMoveForOverlay(e);
        if (!this.isDragging) return;

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const dx = mouseX - this.dragStartX;
        const dy = mouseY - this.dragStartY;

        // If moved more than 5 pixels, consider it a pan
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            this.hasMovedSignificantDistance = true;
        }

        if (this.hasMovedSignificantDistance) {
            this.game.camera.x = this.cameraStartX + dx;
            this.game.camera.y = this.cameraStartY + dy;
            this.clampCamera();
        }
    }

    handlePointerMoveForOverlay(e) {
        this.lastPointerClient = { x: e.clientX, y: e.clientY };
        this.updateUnitInfoOverlayPosition(e.clientX, e.clientY);
    }

    handleTouchPointerForOverlay(e) {
        const touch = e.touches?.[0] || e.changedTouches?.[0];
        if (!touch) return;
        this.lastPointerClient = { x: touch.clientX, y: touch.clientY };
        this.updateUnitInfoOverlayPosition(touch.clientX, touch.clientY);
    }

    updateUnitInfoOverlayPosition(clientX, clientY) {
        const infoDiv = document.getElementById('unit-info');
        const wrapper = this.canvas.parentElement;
        if (!infoDiv || !wrapper || infoDiv.style.display === 'none') return;

        const currentRect = infoDiv.getBoundingClientRect();
        const margin = 18;
        const cursorOverOverlay =
            clientX >= currentRect.left - margin &&
            clientX <= currentRect.right + margin &&
            clientY >= currentRect.top - margin &&
            clientY <= currentRect.bottom + margin;
        if (!cursorOverOverlay) return;

        const wrapperRect = wrapper.getBoundingClientRect();
        const positions = [
            { name: 'top-right', x: wrapperRect.right - currentRect.width - 10, y: wrapperRect.top + 10 },
            { name: 'top-left', x: wrapperRect.left + 10, y: wrapperRect.top + 10 },
            { name: 'bottom-right', x: wrapperRect.right - currentRect.width - 10, y: wrapperRect.bottom - currentRect.height - 10 },
            { name: 'bottom-left', x: wrapperRect.left + 10, y: wrapperRect.bottom - currentRect.height - 10 }
        ];

        const nextPosition = positions
            .filter(pos => pos.name !== this.unitInfoPosition)
            .find(pos => !this.pointOverRect(clientX, clientY, {
                left: pos.x - margin,
                right: pos.x + currentRect.width + margin,
                top: pos.y - margin,
                bottom: pos.y + currentRect.height + margin
            }));

        if (nextPosition) {
            this.setUnitInfoPosition(nextPosition.name);
        }
    }

    pointOverRect(x, y, rect) {
        return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    }

    setUnitInfoPosition(position) {
        const infoDiv = document.getElementById('unit-info');
        if (!infoDiv) return;

        this.unitInfoPosition = position;
        infoDiv.classList.toggle('unit-info-top-left', position === 'top-left');
        infoDiv.classList.toggle('unit-info-bottom-right', position === 'bottom-right');
        infoDiv.classList.toggle('unit-info-bottom-left', position === 'bottom-left');
    }

    handleMouseUp(e) {
        if (e.button !== 0) return;
        if (!this.isDragging) return;
        this.lastPointerClient = { x: e.clientX, y: e.clientY };
        this.isDragging = false;

        if (this.hasMovedSignificantDistance) {
            // It was a drag, don't trigger click logic
            return;
        }

        if (this.game.state === Game.STATES.START_SCREEN || this.game.state === Game.STATES.GAME_OVER || this.game.state === Game.STATES.AI_ACTIVE || this.game.currentPlayer === 2) return;

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldX = (mouseX - this.game.camera.x) / this.game.camera.zoom;
        const worldY = (mouseY - this.game.camera.y) / this.game.camera.zoom;

        const gridX = Math.floor(worldX / this.tileSize);
        const gridY = Math.floor(worldY / this.tileSize);

        if (!this.map.isValidTile(gridX, gridY)) return;

        this.processClick(gridX, gridY);
    }

    makeTouchMouseEvent(touch) {
        return {
            button: 0,
            clientX: touch.clientX,
            clientY: touch.clientY,
            preventDefault() {}
        };
    }

    getActiveTouch(touches) {
        for (const touch of touches) {
            if (touch.identifier === this.activeTouchId) return touch;
        }
        return null;
    }

    handleTouchStart(e) {
        if (!this.touches) this.touches = new Map();
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            this.touches.set(e.changedTouches[i].identifier, e.changedTouches[i]);
        }

        if (this.touches.size === 2) {
            if (this.activeTouchId !== null) {
                this.isDragging = false;
                this.hasMovedSignificantDistance = true;
                this.activeTouchId = null;
            }
            let tArray = Array.from(this.touches.values());
            this.initialPinchDistance = Math.hypot(tArray[0].clientX - tArray[1].clientX, tArray[0].clientY - tArray[1].clientY);
            this.initialPinchZoom = this.game.camera.zoom;
            
            const pinchCenterX = (tArray[0].clientX + tArray[1].clientX) / 2;
            const pinchCenterY = (tArray[0].clientY + tArray[1].clientY) / 2;
            const rect = this.canvas.getBoundingClientRect();
            
            this.pinchCenterCanvasX = pinchCenterX - rect.left;
            this.pinchCenterCanvasY = pinchCenterY - rect.top;
            
            this.pinchWorldX = (this.pinchCenterCanvasX - this.game.camera.x) / this.game.camera.zoom;
            this.pinchWorldY = (this.pinchCenterCanvasY - this.game.camera.y) / this.game.camera.zoom;
            this.wasPinching = true;
        } else if (this.touches.size === 1) {
            const touch = e.changedTouches[0];
            this.activeTouchId = touch.identifier;
            this.wasPinching = false;
            this.handleMouseDown(this.makeTouchMouseEvent(touch));
        }
    }

    handleTouchMove(e) {
        e.preventDefault();
        if (!this.touches) this.touches = new Map();
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (this.touches.has(e.changedTouches[i].identifier)) {
                this.touches.set(e.changedTouches[i].identifier, e.changedTouches[i]);
            }
        }

        if (this.touches.size === 2 && this.initialPinchDistance) {
            let tArray = Array.from(this.touches.values());
            let currentDistance = Math.hypot(tArray[0].clientX - tArray[1].clientX, tArray[0].clientY - tArray[1].clientY);
            
            let zoomDelta = currentDistance / this.initialPinchDistance;
            let newZoom = this.initialPinchZoom * zoomDelta;
            newZoom = Math.max(0.5, Math.min(newZoom, 3));
            
            this.game.camera.zoom = newZoom;
            this.game.camera.x = this.pinchCenterCanvasX - this.pinchWorldX * this.game.camera.zoom;
            this.game.camera.y = this.pinchCenterCanvasY - this.pinchWorldY * this.game.camera.zoom;
            this.clampCamera();
            return;
        }

        if (this.activeTouchId !== null && !this.wasPinching) {
            const touch = this.getActiveTouch(e.changedTouches);
            if (touch) {
                this.handleMouseMove(this.makeTouchMouseEvent(touch));
            }
        }
    }

    handleTouchEnd(e) {
        e.preventDefault();
        if (!this.touches) this.touches = new Map();
        
        let activeTouchEnded = false;
        let endedTouch = null;

        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === this.activeTouchId) {
                activeTouchEnded = true;
                endedTouch = e.changedTouches[i];
            }
            this.touches.delete(e.changedTouches[i].identifier);
        }

        if (this.touches.size < 2) {
            this.initialPinchDistance = null;
        }

        if (activeTouchEnded && !this.wasPinching) {
            this.handleMouseUp(this.makeTouchMouseEvent(endedTouch));
            this.activeTouchId = null;
        } else if (this.touches.size === 0) {
            this.wasPinching = false;
            this.activeTouchId = null;
        }
    }

    async processClick(x, y) {
        const clickedUnit = this.game.getUnitAt(x, y);

        switch (this.game.state) {
            case Game.STATES.AUTO_DESTINATION:
                const autoUnit = this.game.selectedUnit;
                if (autoUnit && this.game.setAutoMoveDestination(autoUnit, x, y)) {
                    this.updateUnitInfo(autoUnit);
                } else if (this.game.selectedUnit) {
                    alert('この目的地には移動できません。');
                    this.game.cancelAction();
                }
                break;

            case Game.STATES.IDLE:
                if (clickedUnit) {
                    if (this.game.selectUnit(clickedUnit)) {
                        this.updateUnitInfo(clickedUnit);
                    } else {
                        // Clicked enemy or done unit, maybe show info but don't select
                        if (clickedUnit.owner !== this.game.currentPlayer) {
                            this.game.previewEnemyAttackRange(clickedUnit);
                        } else {
                            this.game.clearRangePreview();
                        }
                        this.updateUnitInfo(clickedUnit);
                    }
                } else {
                    this.game.clearRangePreview();
                    // Clicked empty cell: check if owned factory or airport to open build menu
                    const terrain = this.map.getTerrainAt(x, y);
                const player = this.game.currentPlayer;
                let canProduce = false;
                if (player === 1) {
                    canProduce = (
                        terrain === GameMap.TERRAIN.FACTORY_P1 ||
                        terrain === GameMap.TERRAIN.AIRPORT_P1 ||
                        terrain === GameMap.TERRAIN.PORT_NEUTRAL ||
                        terrain === GameMap.TERRAIN.PORT_P1
                    );
                } else {
                    canProduce = (
                        terrain === GameMap.TERRAIN.FACTORY_P2 ||
                        terrain === GameMap.TERRAIN.AIRPORT_P2 ||
                        terrain === GameMap.TERRAIN.PORT_NEUTRAL ||
                        terrain === GameMap.TERRAIN.PORT_P2
                    );
                }
                if (canProduce) {
                    this.openProductionMenu(x, y);
                }    }
                break;

            case Game.STATES.UNIT_SELECTED:
                if (this.game.moveUnit(x, y)) {
                    // Handled in Game
                } else if (clickedUnit && clickedUnit.owner === this.game.currentPlayer && !clickedUnit.isDone()) {
                    // Select a different friendly unit
                    this.game.cancelAction();
                    this.game.selectUnit(clickedUnit);
                    this.updateUnitInfo(clickedUnit);
                } else {
                     // Clicked invalid empty space
                     this.game.cancelAction();
                }
                break;

            case Game.STATES.POST_MOVE_MENU:
                if (this.game.moveUnit(x, y)) {
                    // Move successful
                } else {
                    this.game.cancelAction();
                    this.hidePostMoveMenu();
                }
                break;

            case Game.STATES.ATTACKING:
                 if (await this.game.attackUnit(x, y)) {
                     // Attack successful
                  } else {
                       // Invalid target: keep the wait button as the explicit commit path, and cancel the tentative move.
                       if (this.game.selectedUnit) {
                            this.game.cancelAction();
                            this.hidePostMoveMenu();
                       }
                 }
                 break;

            case Game.STATES.UNLOADING:
                if (this.game.unloadUnit(x, y)) {
                    // Unload successful
                } else {
                    // Cancel unload
                    if (this.game.selectedUnit) {
                        this.game.selectedUnit.hasAttacked = true;
                        this.game.checkCapture(this.game.selectedUnit);
                        this.game.clearSelection();
                    }
                }
                break;
        }
    }

    updateUnitInfo(unit) {
        const infoDiv = document.getElementById('unit-info');
        const infoTextDiv = document.getElementById('unit-info-text');
        const unloadBtn = document.getElementById('unload-btn');

        if (unit) {
            this.currentInfoUnit = unit;
            infoDiv.style.display = 'block';
            const typeNames = {
                'INFANTRY': '歩兵',
                'TRANSPORT': '輸送車',
                'HELI_TRANSPORT': '輸送ヘリ',
                'FIGHTER': '戦闘機',
                'BOMBER': '爆撃機',
                'TANK': '軽戦車',
                'MD_TANK': '中戦車',
                'HV_TANK': '重戦車',
                'ARTILLERY': '自走砲',
                'ROCKET': 'ロケット砲',
                'AA_TANK': '対空戦車',
                'AA_MISSILE': '対空ミサイル',
                'BATTLESHIP': '戦艦',
                'DESTROYER': '駆逐艦',
                'SUBMARINE': '潜水艦',
                'HOVERCRAFT': '輸送ホバー'
            };
            const jpType = typeNames[unit.type] || unit.type;
            let carryInfo = '';
            if (unit.type === Unit.TYPES.TRANSPORT || unit.type === Unit.TYPES.HELI_TRANSPORT || unit.type === Unit.TYPES.HOVERCRAFT) {
                carryInfo = `<br>搭載: ${unit.carriedUnits ? unit.carriedUnits.length : 0}/${unit.capacity}`;
            }
            const ammoInfo = unit.maxAmmo !== null && unit.maxAmmo !== undefined
                ? `<br>弾薬: ${unit.ammo}/${unit.maxAmmo}`
                : '';
            const supplyAmmoInfo = unit.maxSupplyAmmo > 0
                ? `<br>補給弾薬: ${unit.supplyAmmo}/${unit.maxSupplyAmmo}`
                : '';
            const autoMoveInfo = unit.autoMoveEnabled && unit.autoMoveDestination
                ? `<br>オート: ON (${unit.autoMoveDestination.x},${unit.autoMoveDestination.y})`
                : '';

            if (infoTextDiv) {
                // Generate simple HTML gauge for side panel
                let gaugeHtml = '<div style="display:inline-flex; border:1px solid #000; background:#333; padding:1px;">';
                let blocks = unit.health / 2;
                for(let i=0; i<5; i++) {
                    let fillRatio = Math.max(0, Math.min(1, blocks - i));
                    let color = unit.health > 6 ? '#00ff00' : (unit.health > 3 ? '#ffff00' : '#ff0000');
                    gaugeHtml += `<div style="width:8px; height:8px; margin-right:1px; background:rgba(50,50,50,0.8); position:relative;">
                                    <div style="width:${fillRatio*100}%; height:100%; background:${color}; position:absolute; left:0; top:0;"></div>
                                  </div>`;
                }
                gaugeHtml += '</div>';

                infoTextDiv.innerHTML = `
                    <strong>${jpType}</strong> (P${unit.owner})<br>
                    耐久（HP）: ${Math.ceil(unit.health)}/${unit.maxHealth} <br>${gaugeHtml}<br>
                    燃料: ${Math.ceil(unit.fuel)}/${unit.maxFuel}<br>
                    移動力: ${unit.moveRange}${ammoInfo}${supplyAmmoInfo}${carryInfo}${autoMoveInfo}
                `;
            }

            if (this.lastPointerClient) {
                requestAnimationFrame(() => {
                    this.updateUnitInfoOverlayPosition(this.lastPointerClient.x, this.lastPointerClient.y);
                });
            }

                if (unloadBtn) {
                    if (unit.owner === this.game.currentPlayer && (unit.type === Unit.TYPES.TRANSPORT || unit.type === Unit.TYPES.HELI_TRANSPORT || unit.type === Unit.TYPES.HOVERCRAFT) && unit.carriedUnits && unit.carriedUnits.length > 0) {
                        unloadBtn.style.display = 'block';
                    } else {
                        unloadBtn.style.display = 'none';
                    }
                }
        } else {
            infoDiv.style.display = 'none';
            this.currentInfoUnit = null;
            if (unloadBtn) unloadBtn.style.display = 'none';
        }
    }

    openProductionMenu(x, y) {
        const overlay = document.getElementById('production-overlay');
        if (!overlay) return;

        overlay.dataset.x = x;
        overlay.dataset.y = y;

        const funds = this.game.playerFunds[this.game.currentPlayer];
        const fundsDisplay = document.getElementById('production-funds-amount');
        if (fundsDisplay) {
            fundsDisplay.textContent = funds;
        }

        const select = document.getElementById('production-select');
        const prodConfirmBtn = document.getElementById('production-confirm-btn');
        const prodOverlay = overlay;
        const prodSelect = select;
        
        if (select) {
            // Clear previous options
            select.innerHTML = '';
            // Determine terrain and facility type
            const terrain = this.map.getTerrainAt(x, y);
            const isAirport = (terrain === GameMap.TERRAIN.AIRPORT_P1 || terrain === GameMap.TERRAIN.AIRPORT_P2);
            const isPort = (terrain === GameMap.TERRAIN.PORT_NEUTRAL || terrain === GameMap.TERRAIN.PORT_P1 || terrain === GameMap.TERRAIN.PORT_P2);

            const groundUnits = [
                'INFANTRY', 'TRANSPORT', 'TANK', 'MD_TANK', 'HV_TANK', 
                'AA_TANK', 'ARTILLERY', 'AA_MISSILE', 'ROCKET'
            ];
            const airUnits = ['HELI_TRANSPORT', 'FIGHTER', 'BOMBER'];
            const navalUnits = ['BATTLESHIP', 'DESTROYER', 'SUBMARINE'];
            
            const names = {
                'INFANTRY': '歩兵',
                'TRANSPORT': '輸送車',
                'TANK': '軽戦車',
                'MD_TANK': '中戦車',
                'HV_TANK': '重戦車',
                'AA_TANK': '対空戦車',
                'ARTILLERY': '自走砲',
                'AA_MISSILE': '対空ミサイル',
                'ROCKET': 'ロケット砲',
                'HELI_TRANSPORT': '輸送ヘリ',
                'FIGHTER': '戦闘機',
                'BOMBER': '爆撃機',
                'BATTLESHIP': '戦艦',
                'DESTROYER': '駆逐艦',
                'SUBMARINE': '潜水艦',
                'HOVERCRAFT': '輸送ホバー'
            };
            
            let list = [];
            if (isAirport) {
                list = airUnits;
            } else if (isPort) {
                list = navalUnits.concat(['HOVERCRAFT']);
            } else {
                list = groundUnits;
            }
            
            list.forEach(uType => {
                const cost = Unit.COSTS[uType];
                const option = document.createElement('option');
                option.value = uType;
                option.text = `${names[uType]} (${cost} G)`;
                if (funds >= cost) {
                    option.disabled = false;
                    option.style.color = '#fff';
                } else {
                    option.disabled = true;
                    option.style.color = '#777';
                }
                select.appendChild(option);
            });
            

            const updateConfirmButton = () => {
                const selectedOption = select.options[select.selectedIndex];
                const canAfford = !selectedOption.disabled;
                prodConfirmBtn.disabled = !canAfford;
            };
            // Initial state
            updateConfirmButton();
            // Update on change
            select.addEventListener('change', updateConfirmButton);
            // Ensure confirm button respects funds on click (early check already handled)
            prodConfirmBtn.onclick = () => {
                const type = prodSelect.value;
                const x = parseInt(prodOverlay.dataset.x);
                const y = parseInt(prodOverlay.dataset.y);
                if (this.game.spawnUnit(type, this.game.currentPlayer, x, y)) {
                    prodOverlay.style.display = 'none';
                } else {
                    alert('資金が足りません！');
                }
            };

            // Automatically select the first affordable unit if none selected
            const firstAffordable = Array.from(select.options).find(opt => !opt.disabled);
            if (firstAffordable && !prodSelect.value) {
                prodSelect.value = firstAffordable.value;
                select.value = firstAffordable.value;
            }
            // Ensure button reflects current selection
            updateConfirmButton();
        }

        overlay.style.display = 'flex';
    }
}
