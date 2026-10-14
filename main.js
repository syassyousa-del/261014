// Wait for DOM to load
document.addEventListener('DOMContentLoaded', async () => {
    const canvas = document.getElementById('gameCanvas');
    const isElectron = navigator.userAgent.toLowerCase().includes('electron');
    const isFileMode = window.location.protocol === 'file:';
    const bundledMaps = window.BUNDLED_MAPS || {};

    if (isFileMode && !isElectron) {
        const warningBanner = document.createElement('div');
        warningBanner.id = 'file-mode-warning';
        warningBanner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;padding:12px 16px;background:#a00;color:#fff;font-size:14px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.2);';
        warningBanner.innerHTML = 'ローカルファイルでは一部機能が制限され、ブラウザのセキュリティエラーが発生する場合があります。<strong>HTTP サーバーで起動してください</strong>。<br>例: <code>node server.js</code> または <code>start_server.bat</code> から開き、<code>http://localhost:8000</code> へアクセスしてください。';
        document.body.appendChild(warningBanner);
        document.body.style.paddingTop = '52px';
    }

    // Default map dimensions
    let cols = 20;
    let rows = 15;
    const tileSize = 40;

    // Create map and unit list
    let gameMap = new GameMap(cols, rows, tileSize);
    let initialUnits = [];

    const resetBtn = document.getElementById('reset-scenario-btn');
    const customScenarioStr = localStorage.getItem('custom_scenario') || localStorage.getItem('famicomMap');

    if (customScenarioStr) {
        try {
            const scenario = JSON.parse(customScenarioStr);
            const scenarioGrid = Array.isArray(scenario.grid) ? scenario.grid : scenario.mapGrid;
            if (Array.isArray(scenarioGrid) && scenarioGrid.length > 0) {
                rows = scenarioGrid.length;
                cols = scenarioGrid[0].length;
                gameMap = new GameMap(cols, rows, tileSize);
                gameMap.grid = scenarioGrid;
                gameMap.setAutoTileMasks(scenario.autoTileMasks);
                gameMap.bakeAutoTileMasks();
            } else {
                throw new Error('Invalid mapGrid data');
            }
            if (Array.isArray(scenario.unitGrid)) {
                initialUnits = [];
                for (let y = 0; y < rows; y++) {
                    for (let x = 0; x < cols; x++) {
                        const u = scenario.unitGrid[y]?.[x];
                        if (u) initialUnits.push(new Unit(u.type, u.owner, x, y));
                    }
                }
            } else {
                initialUnits = scenario.units.map(u => new Unit(u.type, u.owner, u.x, u.y));
            }
            resetBtn.style.display = 'inline-block';
        } catch (e) {
            console.error('Failed to parse custom scenario, loading default map...', e);
            loadDefaultScenario();
        }
    } else {
        loadDefaultScenario();
    }

    function loadDefaultScenario() {
        cols = 20;
        rows = 15;
        gameMap = new GameMap(cols, rows, tileSize);
        gameMap.initGrid();
        gameMap.bakeAutoTileMasks();
        initialUnits = [
            // Player 1
            new Unit(Unit.TYPES.INFANTRY, 1, 2, 2),
            new Unit(Unit.TYPES.TRANSPORT, 1, 3, 3),
            new Unit(Unit.TYPES.TANK, 1, 2, 4),
            // Player 2
            new Unit(Unit.TYPES.INFANTRY, 2, 17, 12),
            new Unit(Unit.TYPES.TRANSPORT, 2, 16, 11),
            new Unit(Unit.TYPES.TANK, 2, 17, 10),
        ];
        resetBtn.style.display = 'none';
    }

    // Asset manager
    const assetManager = new AssetManager();
    await assetManager.loadAll();

    const audioManager = new AudioManager();
    const savedBgmVolume = Number(localStorage.getItem('bgm_volume'));
    if (Number.isFinite(savedBgmVolume)) {
        audioManager.setBgmVolume(savedBgmVolume);
    }
    setupBgmVolumeControl(audioManager);

    // Core game objects
    const game = new Game(gameMap, initialUnits, audioManager);
    const renderer = new Renderer(canvas, gameMap, game, assetManager);
    const inputHandler = new InputHandler(canvas, gameMap, game);

    // Apply saved AI difficulty (default 'easy')
    const savedAiDifficulty = localStorage.getItem('ai_difficulty') || 'easy';
    if (game.setAIDifficulty) game.setAIDifficulty(savedAiDifficulty);

    // Apply saved AI speed multiplier (default 1)
    const savedAiSpeed = Number(localStorage.getItem('ai_speed_multiplier')) || 1;
    game.setAISpeedMultiplier(savedAiSpeed);

    function setupAiSpeedControl(game) {
        const slider = document.getElementById('ai-speed-slider');
        const valueLabel = document.getElementById('ai-speed-value');
        const btn1 = document.getElementById('speed-slow-btn');
        const btn2 = document.getElementById('speed-fast-btn');
        const btn3 = document.getElementById('speed-faster-btn');
        if (!slider || !valueLabel) return;

        const syncLabel = () => {
            const v = Number(slider.value) || 1;
            valueLabel.textContent = `${v}x`;
        };

        slider.min = 1;
        slider.max = 10;
        slider.value = savedAiSpeed;
        syncLabel();

        slider.addEventListener('input', () => {
            const mult = Number(slider.value) || 1;
            game.setAISpeedMultiplier(mult);
            localStorage.setItem('ai_speed_multiplier', String(mult));
            syncLabel();
        });

        // Preset buttons
        btn1?.addEventListener('click', () => { slider.value = 1; slider.dispatchEvent(new Event('input')); });
        btn2?.addEventListener('click', () => { slider.value = 2; slider.dispatchEvent(new Event('input')); });
        btn3?.addEventListener('click', () => { slider.value = 3; slider.dispatchEvent(new Event('input')); });
    }

    setupAiSpeedControl(game);

    function setupAiDifficultyControl(game) {
        const select = document.getElementById('ai-difficulty-select');
        if (!select) return;

        select.value = savedAiDifficulty;

        select.addEventListener('change', () => {
            const diff = select.value;
            if (game.setAIDifficulty) game.setAIDifficulty(diff);
            localStorage.setItem('ai_difficulty', diff);
        });
    }
    setupAiDifficultyControl(game);

    function resizeCanvasToDisplaySize() {
        const rect = canvas.getBoundingClientRect();
        const width = Math.max(320, Math.round(rect.width || canvas.width));
        const height = Math.max(240, Math.round(rect.height || canvas.height));
        if (canvas.width === width && canvas.height === height) return;

        canvas.width = width;
        canvas.height = height;
        inputHandler.clampCamera();
    }

    resizeCanvasToDisplaySize();
    window.addEventListener('resize', resizeCanvasToDisplaySize);
    window.addEventListener('orientationchange', () => {
        setTimeout(resizeCanvasToDisplaySize, 250);
    });

    function setupBgmVolumeControl(audioManager) {
        const slider = document.getElementById('bgm-volume-slider');
        const value = document.getElementById('bgm-volume-value');
        if (!slider) return;

        const syncLabel = () => {
            if (value) value.textContent = `${Math.round(audioManager.getBgmVolume() * 100)}%`;
        };

        slider.value = Math.round(audioManager.getBgmVolume() * 100);
        syncLabel();

        slider.addEventListener('input', () => {
            const volume = Number(slider.value) / 100;
            audioManager.setBgmVolume(volume);
            localStorage.setItem('bgm_volume', String(volume));
            syncLabel();
        });
    }

    // UI initialization
    game.updateFundsUI();

    function serializeUnit(unit) {
        return {
            type: unit.type,
            owner: unit.owner,
            x: unit.x,
            y: unit.y,
            health: unit.health,
            fuel: unit.fuel,
            ammo: unit.ammo,
            supplyAmmo: unit.supplyAmmo,
            hasMoved: unit.hasMoved,
            hasAttacked: unit.hasAttacked,
            autoMoveEnabled: unit.autoMoveEnabled,
            autoMoveDestination: unit.autoMoveDestination,
            loadedTurn: unit.loadedTurn,
            carriedUnits: (unit.carriedUnits || []).map(serializeUnit)
        };
    }

    function hydrateUnit(data) {
        const unit = new Unit(data.type, data.owner, data.x, data.y);
        unit.health = data.health ?? unit.health;
        unit.fuel = data.fuel ?? unit.fuel;
        unit.ammo = data.ammo ?? unit.ammo;
        unit.supplyAmmo = data.supplyAmmo ?? unit.supplyAmmo;
        unit.hasMoved = Boolean(data.hasMoved);
        unit.hasAttacked = Boolean(data.hasAttacked);
        unit.autoMoveEnabled = Boolean(data.autoMoveEnabled);
        unit.autoMoveDestination = data.autoMoveDestination ?? null;
        unit.loadedTurn = data.loadedTurn ?? null;
        unit.carriedUnits = Array.isArray(data.carriedUnits) ? data.carriedUnits.map(hydrateUnit) : [];
        return unit;
    }

    function buildSaveData() {
        const capturePoints = {};
        for (const key in game.capturePoints) {
            const cp = game.capturePoints[key];
            capturePoints[key] = {
                points: cp.points,
                capturer: cp.capturer ? { x: cp.capturer.x, y: cp.capturer.y } : null
            };
        }

        return {
            version: 1,
            savedAt: new Date().toISOString(),
            map: {
                cols: game.map.cols,
                rows: game.map.rows,
                tileSize: game.map.tileSize,
                grid: game.map.grid,
                autoTileMasks: game.map.autoTileMasks
            },
            units: game.units.map(serializeUnit),
            currentPlayer: game.currentPlayer,
            turnCount: game.turnCount,
            playerFunds: game.playerFunds,
            capturePoints
        };
    }

    function downloadJson(filename, data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function applySaveData(data) {
        if (!data || !data.map || !Array.isArray(data.map.grid) || !Array.isArray(data.units)) {
            throw new Error('セーブデータの形式が無効です。');
        }

        game.clearSelection();
        gameMap.cols = data.map.cols;
        gameMap.rows = data.map.rows;
        gameMap.tileSize = data.map.tileSize || tileSize;
        gameMap.grid = data.map.grid;
        gameMap.setAutoTileMasks(data.map.autoTileMasks);
        gameMap.bakeAutoTileMasks();
        game.map = gameMap;
        game.units = data.units.map(hydrateUnit);
        game.currentPlayer = data.currentPlayer || 1;
        game.turnCount = data.turnCount || 0;
        game.playerFunds = data.playerFunds || { 1: 0, 2: 0 };
        game.capturePoints = {};

        if (data.capturePoints) {
            for (const key in data.capturePoints) {
                const cp = data.capturePoints[key];
                const capturer = cp.capturer ? game.getUnitAt(cp.capturer.x, cp.capturer.y) : null;
                if (capturer) {
                    game.capturePoints[key] = { points: cp.points, capturer };
                }
            }
        }

        game.state = Game.STATES.IDLE;
        game.validMoveTiles = [];
        game.validAttackTiles = [];
        game.validUnloadTiles = [];
        game.explosions = [];

        const turnIndicator = document.getElementById('turn-indicator');
        if (turnIndicator) {
            turnIndicator.textContent = game.currentPlayer === 1 ? 'RED軍' : 'BLUE軍';
            turnIndicator.style.color = game.currentPlayer === 1 ? '#ffaaaa' : '#aaaaff';
        }
        game.updateFundsUI();
        renderer.tileSize = gameMap.tileSize;
        inputHandler.tileSize = gameMap.tileSize;
    }

    async function saveGame() {
        if (game.state === Game.STATES.AI_ACTIVE) {
            alert('AIの行動中はセーブできません。行動終了後にセーブしてください。');
            return;
        }

        if (isFileMode) {
            const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
            downloadJson(`save_${stamp}.json`, buildSaveData());
            return;
        }

        try {
            const res = await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(buildSaveData())
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'セーブに失敗しました。');
            alert(`セーブしました: save/${result.filename}`);
        } catch (err) {
            alert('セーブ失敗: ローカルサーバーを start_famicom_server.bat から起動してください。' + '\n' + err.message);
        }
    }

    async function openSaveList() {
        const overlay = document.getElementById('save-select-overlay');
        const listContainer = document.getElementById('save-list');
        listContainer.innerHTML = '';

        if (isFileMode) {
            const info = document.createElement('div');
            info.textContent = 'サーバーなしの場合、再開は「ファイルから読み込み」からセーブJSONを選択してください。';
            info.style.color = '#ccc';
            info.style.textAlign = 'center';
            info.style.lineHeight = '1.6';
            listContainer.appendChild(info);
            overlay.style.display = 'flex';
            return;
        }

        try {
            const res = await fetch('/api/saves');
            const saves = await res.json();
            if (!res.ok) throw new Error(saves.error || 'セーブ一覧を取得できません。');

            if (saves.length === 0) {
                const empty = document.createElement('div');
                empty.textContent = 'セーブデータがありません。';
                empty.style.textAlign = 'center';
                empty.style.color = '#ccc';
                listContainer.appendChild(empty);
            }

            saves.forEach(save => {
                const btn = document.createElement('button');
                btn.className = 'panel-btn primary';
                btn.style.textAlign = 'left';
                btn.textContent = save.filename;
                btn.addEventListener('click', async () => {
                    try {
                        const saveRes = await fetch('/api/saves/' + encodeURIComponent(save.filename));
                        const data = await saveRes.json();
                        if (!saveRes.ok) throw new Error(data.error || 'ロードに失敗しました。');
                        applySaveData(data);
                        overlay.style.display = 'none';
                        document.getElementById('start-screen-overlay').style.display = 'none';
                    } catch (err) {
                        alert('再開失敗: ' + err.message);
                    }
                });
                listContainer.appendChild(btn);
            });

            
    // Add custom file upload button if it doesn't exist
    if (!document.getElementById('custom-map-btn')) {
        const uploadWrapper = document.createElement('div');
        uploadWrapper.style.marginTop = '15px';
        uploadWrapper.style.paddingTop = '15px';
        uploadWrapper.style.borderTop = '1px solid #555';
        
        const label = document.createElement('p');
        label.textContent = 'エディタで作成したマップ(.json)を読み込む';
        label.style.fontSize = '14px';
        label.style.color = '#ccc';
        label.style.textAlign = 'center';
        label.style.marginBottom = '10px';
        uploadWrapper.appendChild(label);

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'custom-map-upload';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';
        uploadWrapper.appendChild(fileInput);

        const customBtn = document.createElement('button');
        customBtn.id = 'custom-map-btn';
        customBtn.className = 'panel-btn';
        customBtn.style.width = '100%';
        customBtn.style.backgroundColor = '#4CAF50';
        customBtn.textContent = 'ファイルから選択';
        customBtn.addEventListener('click', () => fileInput.click());
        uploadWrapper.appendChild(customBtn);

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    overlay.style.display = 'none';
                    loadScenario(data);
                } catch (err) {
                    alert('ファイルの解析に失敗しました: ' + err.message);
                }
            };
            reader.readAsText(file);
        });

        const closeBtn = document.getElementById('close-map-select-btn');
        if (closeBtn && closeBtn.parentNode) {
            closeBtn.parentNode.insertBefore(uploadWrapper, closeBtn);
        }
    }overlay.style.display = 'flex';
        } catch (err) {
            alert('セーブ一覧の取得失敗: ローカルサーバーを start_famicom_server.bat から起動してください。' + '\n' + err.message);
        }
    }

    document.getElementById('save-game-btn')?.addEventListener('click', saveGame);
    document.getElementById('resume-game-btn')?.addEventListener('click', openSaveList);
    document.getElementById('close-save-select-btn')?.addEventListener('click', () => {
        document.getElementById('save-select-overlay').style.display = 'none';
    });

// Dynamic map list initialization
let mapList = [];
async function initMapList() {
    if (Object.keys(bundledMaps).length > 0) {
        mapList = Object.keys(bundledMaps);
    } else {
        try {
            const res = await fetch('/api/maplist');
            if (res.ok) {
                mapList = await res.json();
            } else {
                console.warn('Failed to fetch map list, status:', res.status);
                mapList = [];
            }
        } catch (e) {
            console.error('Error fetching map list:', e);
            mapList = [];
        }
    }
}
// Populate map list on startup
initMapList();
// Load map button (new)
// mapList will be populated by initMapList before use


    function cloneData(data) {
        return JSON.parse(JSON.stringify(data));
    }

    async function loadMapFile(mapFile) {
        if (bundledMaps[mapFile]) {
            return cloneData(bundledMaps[mapFile]);
        }

        const res = await fetch('./maps/' + encodeURIComponent(mapFile));
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        return res.json();
    }
    
    document.getElementById('load-map-btn').addEventListener('click', async () => {
    // Ensure map list is up to date
    await initMapList();
    const overlay = document.getElementById('map-select-overlay');
    const listContainer = document.getElementById('map-list');
    listContainer.innerHTML = '';

    mapList.forEach(mapFile => {
        const btn = document.createElement('button');
        btn.className = 'panel-btn primary';
        btn.textContent = mapFile;
        btn.style.textAlign = 'left';
        btn.addEventListener('click', async () => {
            try {
                const data = await loadMapFile(mapFile);
                overlay.style.display = 'none';
                loadScenario(data);
            } catch (err) {
                alert('マップ読み込み失敗: ' + err.message);
            }
        });
        listContainer.appendChild(btn);
    });

    
    // Add custom file upload button if it doesn't exist
    if (!document.getElementById('custom-map-btn')) {
        const uploadWrapper = document.createElement('div');
        uploadWrapper.style.marginTop = '15px';
        uploadWrapper.style.paddingTop = '15px';
        uploadWrapper.style.borderTop = '1px solid #555';
        
        const label = document.createElement('p');
        label.textContent = 'エディタで作成したマップ(.json)を読み込む';
        label.style.fontSize = '14px';
        label.style.color = '#ccc';
        label.style.textAlign = 'center';
        label.style.marginBottom = '10px';
        uploadWrapper.appendChild(label);

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'custom-map-upload';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';
        uploadWrapper.appendChild(fileInput);

        const customBtn = document.createElement('button');
        customBtn.id = 'custom-map-btn';
        customBtn.className = 'panel-btn';
        customBtn.style.width = '100%';
        customBtn.style.backgroundColor = '#4CAF50';
        customBtn.textContent = 'ファイルから選択';
        customBtn.addEventListener('click', () => fileInput.click());
        uploadWrapper.appendChild(customBtn);

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    overlay.style.display = 'none';
                    loadScenario(data);
                } catch (err) {
                    alert('ファイルの解析に失敗しました: ' + err.message);
                }
            };
            reader.readAsText(file);
        });

        const closeBtn = document.getElementById('close-map-select-btn');
        if (closeBtn && closeBtn.parentNode) {
            closeBtn.parentNode.insertBefore(uploadWrapper, closeBtn);
        }
    }overlay.style.display = 'flex';
});

    document.getElementById('close-map-select-btn')?.addEventListener('click', () => {
        document.getElementById('map-select-overlay').style.display = 'none';
    });

    // Helper to apply loaded scenario
    function loadScenario(data) {
    // Ensure gameMap exists
    if (typeof gameMap === 'undefined') {
        gameMap = new GameMap(cols, rows, tileSize);
    }
    // Updated validation: support both legacy and new formats
        // Updated validation: support both legacy and new formats
        if (!(
          (Array.isArray(data.mapGrid) && Array.isArray(data.units)) ||
          (typeof data.cols !== 'undefined' && typeof data.rows !== 'undefined' && Array.isArray(data.grid) && Array.isArray(data.unitGrid))
        )) {
          throw new Error("フォーマットが無効です。'mapGrid' または 'units' 配列がありません。");
        }
        // Normalize to legacy format for internal use
        let colsVal = data.cols;
        let rowsVal = data.rows;
        let gridVal = data.grid;
        let unitGridVal = data.unitGrid;
        if (typeof colsVal === 'undefined') {
          // legacy fallback
          colsVal = data.mapGrid[0]?.length || 0;
          rowsVal = data.mapGrid.length;
          gridVal = data.mapGrid;
          // Convert legacy unit list to unitGrid 2D array
          const emptyGrid = Array.from({ length: rowsVal }, () => new Array(colsVal).fill(null));
          unitGridVal = emptyGrid;
          if (Array.isArray(data.units)) {
            data.units.forEach(u => {
              if (u.x >= 0 && u.x < colsVal && u.y >= 0 && u.y < rowsVal) {
                unitGridVal[u.y][u.x] = { type: u.type, owner: u.owner };
              }
            });
          }
        }
        // Apply to game state
        gameMap.cols = colsVal;
        gameMap.rows = rowsVal;
        gameMap.grid = gridVal;
        gameMap.setAutoTileMasks(data.autoTileMasks);
        gameMap.bakeAutoTileMasks();
        const initialUnits = [];
        // Convert unitGrid to flat unit list for Game constructor
        for (let y = 0; y < rowsVal; y++) {
          for (let x = 0; x < colsVal; x++) {
            const u = unitGridVal[y][x];
            if (u) {
              initialUnits.push(new Unit(u.type, u.owner, x, y));
            }
          }
        }
        localStorage.setItem('custom_scenario', JSON.stringify(data));
        window.location.reload();
    }

    document.getElementById('load-file-input').addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const data = JSON.parse(ev.target.result);
                if (data.map && Array.isArray(data.units)) {
                    applySaveData(data);
                    document.getElementById('start-screen-overlay').style.display = 'none';
                } else {
                    loadScenario(data);
                }
            } catch (err) {
                alert('読み込み失敗: ' + err.message);
            }
        };
        reader.readAsText(file);
    });

    document.getElementById('load-file-btn').addEventListener('click', () => {
        document.getElementById('load-file-input').click();
    });

    // Reset button
    resetBtn.addEventListener('click', () => {
        if (confirm('デフォルトのキャンペーンシナリオにリセットしますか？')) {
            localStorage.removeItem('custom_scenario');
            window.location.reload();
        }
    });

    // Game loop
    function gameLoop(timestamp) {
        renderer.render();
        requestAnimationFrame(gameLoop);
    }
    requestAnimationFrame(gameLoop);

    // UI tweaks
    document.getElementById('turn-indicator').style.color = '#ffaaaa';

    // Console messages
    console.log('Famicom Wars Clone Started');
    console.log('Left Click: Select Unit / Move / Attack');
    console.log('Right Click: Cancel / End Turn');

    const startBtn = document.getElementById('start-battle-btn');
    const startOverlay = document.getElementById('start-screen-overlay');
    if (startBtn && startOverlay) {
        startBtn.addEventListener('click', () => {
            startOverlay.style.display = 'none';
            game.startGame();
        });
    } else {
        game.startGame();
    }
});

