(function() {
    const PLUGIN_NAME = 'CrowCommander';

    const TC_CSS = `
        #commanderModal {
            position: fixed !important;
            inset: 0 !important;
            z-index: 2000 !important;
            background: rgba(4, 7, 13, 0.88) !important;
            backdrop-filter: blur(10px) !important;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            box-sizing: border-box;
            user-select: none;
        }
        #commanderModal .modal-panel {
            position: relative !important;
            max-width: 1280px !important;
            width: 94vw !important;
            height: 84vh !important;
            background: #0d1117 !important;
            border: 1px solid #30363d !important;
            border-radius: 8px !important;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.85) !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
            padding: 0 !important;
            box-sizing: border-box !important;
        }
        .commander-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #161b22;
            padding: 10px 16px;
            border-bottom: 1px solid #30363d;
            font-family: 'JetBrains Mono', Consolas, monospace;
        }
        .commander-layout-wrapper {
            display: flex !important;
            gap: 8px !important;
            flex: 1 1 auto !important;
            min-height: 0 !important;
            padding: 8px 12px 4px 12px !important;
            width: 100% !important;
            box-sizing: border-box !important;
            background: #090d13;
        }
        .tc-panel {
            flex: 1 1 50% !important;
            min-width: 0 !important;
            background-color: #161b22;
            color: #c9d1d9;
            font-family: 'JetBrains Mono', Consolas, monospace;
            font-size: 12px;
            display: flex;
            flex-direction: column;
            height: 100%;
            border: 1px solid #30363d;
            border-radius: 6px;
            box-sizing: border-box;
            overflow: hidden;
            transition: border-color 0.15s ease-out;
        }
        .tc-active-panel {
            border: 1px solid #38bdf8 !important;
            box-shadow: 0 0 12px rgba(56, 189, 248, 0.15);
        }
        .tc-header {
            background-color: #1c2128;
            padding: 6px 8px;
            display: flex;
            gap: 6px;
            align-items: center;
            border-bottom: 1px solid #30363d;
            box-sizing: border-box;
        }
        .tc-active-panel .tc-header {
            background-color: #21262d;
            border-bottom-color: rgba(56, 189, 248, 0.3);
        }
        .tc-drive-select {
            background: #0d1117;
            color: #38bdf8;
            border: 1px solid #30363d;
            border-radius: 4px;
            padding: 3px 6px;
            font-size: 11px;
            font-family: inherit;
            outline: none;
            cursor: pointer;
            max-width: 130px;
        }
        .tc-nav-btn {
            background: #0d1117;
            border: 1px solid #30363d;
            color: #8b949e;
            padding: 3px 7px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            transition: all 0.1s;
        }
        .tc-nav-btn:hover {
            color: #38bdf8;
            border-color: #38bdf8;
            background: rgba(56, 189, 248, 0.1);
        }
        .tc-path {
            flex: 1 1 auto;
            min-width: 0;
            background: #0d1117;
            color: #e6edf3;
            padding: 3px 8px;
            border: 1px solid #30363d;
            border-radius: 4px;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
            font-size: 11px;
        }
        .tc-active-panel .tc-path {
            color: #38bdf8;
            border-color: rgba(56, 189, 248, 0.4);
        }
        .tc-filter-wrap {
            position: relative;
            display: flex;
            align-items: center;
        }
        .tc-filter {
            background: #0d1117;
            color: #7ee787;
            border: 1px solid #30363d;
            border-radius: 4px;
            padding: 3px 6px;
            width: 85px;
            font-family: inherit;
            font-size: 11px;
            outline: none;
        }
        .tc-filter:focus {
            border-color: #7ee787;
            width: 110px;
        }
        .tc-table-header {
            display: flex;
            background: #161b22;
            border-bottom: 1px solid #30363d;
            font-weight: 600;
            color: #8b949e;
            font-size: 11px;
            user-select: none;
        }
        .tc-col {
            padding: 5px 8px;
            cursor: pointer;
            user-select: none;
            border-right: 1px solid #21262d;
            transition: background 0.1s;
        }
        .tc-col:hover { background: #21262d; color: #c9d1d9; }
        .tc-col-name { flex: 1 1 auto; min-width: 0; }
        .tc-col-ext { width: 55px; text-align: center; flex-shrink: 0; }
        .tc-col-size { width: 95px; text-align: right; flex-shrink: 0; }
        .tc-col-date { width: 130px; text-align: right; flex-shrink: 0; }
        
        .tc-list {
            flex: 1 1 auto;
            overflow-y: auto;
            outline: none;
            background: #0d1117;
        }
        
        .tc-row {
            display: flex;
            padding: 4px 0;
            cursor: pointer;
            user-select: none;
            font-size: 12px;
            color: #f0f2f5;
            transition: background 0.06s ease-out;
            border-bottom: 1px solid rgba(255, 255, 255, 0.03);
        }
        .tc-row:hover { background: rgba(255, 255, 255, 0.04); }
        .tc-row.selected-item { background: rgba(239, 68, 68, 0.12) !important; color: #fca5a5 !important; }
        .tc-row.cursor { 
            background: rgba(56, 189, 248, 0.16) !important; 
            color: #ffffff !important; 
            outline: 1px solid rgba(56, 189, 248, 0.35);
        }
        .tc-row.cursor.selected-item { background: rgba(239, 68, 68, 0.25) !important; color: #ffffff !important; }
        
        .tc-cell { padding: 0 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; }
        .tc-cell-name { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 2px; }
        .tc-cell-ext { width: 60px; justify-content: center; flex-shrink: 0; font-size: 11px; }
        .tc-cell-size { width: 95px; justify-content: flex-end; flex-shrink: 0; }
        .tc-cell-date { width: 130px; justify-content: flex-end; flex-shrink: 0; font-size: 11px; }

        .tc-footer {
            background-color: #161b22;
            border-top: 1px solid #30363d;
            padding: 5px 10px;
            font-size: 11px;
            color: #8b949e;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .commander-hotbar {
            display: flex;
            gap: 4px;
            padding: 8px 12px;
            background: #161b22;
            border-top: 1px solid #30363d;
            font-family: 'JetBrains Mono', Consolas, monospace;
            box-sizing: border-box;
        }
        .cmd-btn {
            flex: 1 1 0;
            background: #21262d;
            border: 1px solid #30363d;
            color: #c9d1d9;
            padding: 6px 4px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
            text-align: center;
            cursor: pointer;
            transition: all 0.12s ease-out;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            white-space: nowrap;
        }
        .cmd-btn kbd {
            background: #30363d;
            color: #38bdf8;
            padding: 1px 4px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: bold;
        }
        .cmd-btn:hover {
            background: #30363d;
            border-color: #38bdf8;
            color: #ffffff;
            transform: translateY(-1px);
        }
        .cmd-btn.danger:hover {
            border-color: #ef4444;
            background: rgba(239, 68, 68, 0.2);
            color: #f87171;
        }
        .cmd-btn.danger kbd {
            color: #f87171;
        }

        .tc-toast {
            position: absolute;
            bottom: 52px;
            left: 50%;
            transform: translateX(-50%);
            background: #1f3554;
            color: #ffffff;
            border: 1px solid #38bdf8;
            border-radius: 6px;
            padding: 6px 16px;
            font-size: 12px;
            font-weight: 500;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7);
            z-index: 9999;
            pointer-events: none;
            transition: opacity 0.2s ease-out, transform 0.2s ease-out;
            font-family: 'JetBrains Mono', Consolas, monospace;
            display: none;
            opacity: 0;
        }
        .tc-toast.error {
            background: #3f1212 !important;
            border-color: #ef4444 !important;
            color: #fca5a5 !important;
        }
        .tc-toast.success {
            background: #0d3326 !important;
            border-color: #10b981 !important;
            color: #6ee7b7 !important;
        }
    `;

    function i18n(key, fallback, params) {
        if (window.t) {
            const res = window.t(key, params);
            if (res && res !== key) return res;
        }
        return fallback;
    }

    class CrowCommanderEngine {
        constructor() {
            this.leftState = this.createDefaultState('cloud', 1, 0, 'C: /');
            this.rightState = this.createDefaultState('cloud', 1, 0, 'C: /');
            this.activeSide = 'left';
            this.cloudDrives = [];
            this.localDrives = [];
            this.isInitialized = false;
            this.isModalOpen = false;
            this._toastTimer = null;
        }

        createDefaultState(type, driveId, folderId, pathStr) {
            return {
                type, driveId, folderId, pathStr, parentPath: null,
                items: [], displayItems: [], selectedItems: new Set(),
                cursorIndex: 0, filterText: '',
                sortCol: 'name', sortAsc: true
            };
        }

        showToast(msg, type = 'info') {
            let toast = document.getElementById('commanderToast');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'commanderToast';
                const modalPanel = document.querySelector('#commanderModal .modal-panel');
                if (modalPanel) modalPanel.appendChild(toast);
                else return;
            }
            toast.className = `tc-toast ${type}`;
            toast.textContent = msg;
            toast.style.display = 'block';
            requestAnimationFrame(() => {
                toast.style.opacity = '1';
            });
            
            if (this._toastTimer) clearTimeout(this._toastTimer);
            this._toastTimer = setTimeout(() => {
                if (toast) {
                    toast.style.opacity = '0';
                    setTimeout(() => { if (toast) toast.style.display = 'none'; }, 200);
                }
            }, 2500);
        }

        async init(api) {
            if (!document.getElementById('crow-commander-styles')) {
                const style = document.createElement('style');
                style.id = 'crow-commander-styles';
                style.innerHTML = TC_CSS;
                document.head.appendChild(style);
            }
            
            window.addEventListener('keydown', (e) => this.handleGlobalKeydown(e), true);
            window.CrowCommanderInstance = this;

            const cmdBtn = document.getElementById('navCommanderBtn');
            if (cmdBtn) {
                cmdBtn.onclick = (e) => {
                    e.preventDefault();
                    this.open();
                };
            }

            if (window.CrowAPI && typeof window.CrowAPI.on === 'function') {
                window.CrowAPI.on('languageChanged', () => {
                    if (this.isModalOpen) {
                        this.injectTCLayout();
                        this.renderSelects();
                        this.bindUI();
                        this.renderPanelItems('left');
                        this.renderPanelItems('right');
                    }
                });
            }
        }

        async open() {
            this.isModalOpen = true;
            const modal = document.getElementById('commanderModal');
            if (modal) modal.style.display = 'flex';
            
            this.injectTCLayout();
            await this.loadSources();
            this.renderSelects();
            this.bindUI();
            
            await this.refreshPanel('left');
            await this.refreshPanel('right');
            this.isInitialized = true;
            this.focusActiveList();
        }

        injectTCLayout() {
            const modalPanel = document.querySelector('#commanderModal .modal-panel');
            if (!modalPanel) return;

            const previewText = i18n('commander.preview', 'F3 Просмотр');
            const editText = i18n('commander.edit', 'F4 Правка');
            const copyText = i18n('commander.copy', 'F5 Копия ➔');
            const moveText = i18n('commander.move', 'F6 Перенос ➔');
            const newFolderText = i18n('commander.newFolder', 'F7 Нов. папка');
            const deleteText = i18n('commander.delete', 'F8 Удалить');
            const tabText = i18n('commander.switchPanel', 'Tab Смена панели');
            const swapText = i18n('commander.swapPanels', '⇄ Swap');
            const refreshText = i18n('commander.refreshPanels', '🔄 Обновить');

            modalPanel.innerHTML = `
                <div class="commander-header">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 16px;">⚔️</span>
                        <span style="font-size: 14px; font-weight: bold; color: #e6edf3; letter-spacing: 0.5px;">CROWCOMMANDER</span>
                        <span style="font-size: 11px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(56, 189, 248, 0.3);">v2.0 PRO</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button id="cmdSwapPanelsBtn" class="tc-nav-btn" title="Ctrl + U">${swapText}</button>
                        <button id="cmdRefreshPanelsBtn" class="tc-nav-btn" title="Ctrl + .">${refreshText}</button>
                        <button class="close-btn" id="closeCommanderBtn" title="Esc">&times;</button>
                    </div>
                </div>
                <div class="commander-layout-wrapper">
                    <div id="leftPanelContainer" style="flex:1; min-width:0; height:100%;"></div>
                    <div id="rightPanelContainer" style="flex:1; min-width:0; height:100%;"></div>
                </div>
                <div class="commander-hotbar">
                    <div class="cmd-btn" id="cmdBtnF3"><kbd>F3</kbd> ${previewText.replace(/^F3\s*/, '')}</div>
                    <div class="cmd-btn" id="cmdBtnF4"><kbd>F4</kbd> ${editText.replace(/^F4\s*/, '')}</div>
                    <div class="cmd-btn" id="cmdBtnF5"><kbd>F5</kbd> ${copyText.replace(/^F5\s*/, '')}</div>
                    <div class="cmd-btn" id="cmdBtnF6"><kbd>F6</kbd> ${moveText.replace(/^F6\s*/, '')}</div>
                    <div class="cmd-btn" id="cmdBtnF7"><kbd>F7</kbd> ${newFolderText.replace(/^F7\s*/, '')}</div>
                    <div class="cmd-btn danger" id="cmdBtnF8"><kbd>F8</kbd> ${deleteText.replace(/^F8\s*/, '')}</div>
                    <div class="cmd-btn" id="cmdBtnTab"><kbd>Tab</kbd> ${tabText.replace(/^Tab\s*/, '')}</div>
                </div>
                <div id="commanderToast" class="tc-toast"></div>
            `;

            const leftContainer = document.getElementById('leftPanelContainer');
            const rightContainer = document.getElementById('rightPanelContainer');
            if (leftContainer) leftContainer.innerHTML = this.getPanelHTML('left');
            if (rightContainer) rightContainer.innerHTML = this.getPanelHTML('right');
        }

        getPanelHTML(side) {
            const colName = i18n('commander.colName', 'Имя файла');
            const colType = i18n('commander.colType', 'Тип');
            const colSize = i18n('commander.colSize', 'Размер');
            const colDate = i18n('commander.colDate', 'Дата');
            const filterPlaceholder = i18n('commander.filterPlaceholder', 'Фильтр...');

            return `
                <div class="tc-panel" id="${side}TcPanel">
                    <div class="tc-header">
                        <select id="${side}SourceSelect" class="tc-drive-select" title="Выбор диска / накопителя"></select>
                        <button id="${side}HomeBtn" class="tc-nav-btn" title="В корень диска">🏠</button>
                        <button id="${side}UpBtn" class="tc-nav-btn" title="На уровень вверх (Backspace)">⬆</button>
                        <div class="tc-path" id="${side}PathLabel">/</div>
                        <div class="tc-filter-wrap">
                            <input type="text" id="${side}Filter" class="tc-filter" placeholder="${filterPlaceholder}">
                        </div>
                    </div>
                    <div class="tc-table-header">
                        <div class="tc-col tc-col-name" onclick="window.CrowCommanderInstance.sortBy('${side}', 'name')">${colName}</div>
                        <div class="tc-col tc-col-ext" onclick="window.CrowCommanderInstance.sortBy('${side}', 'ext')">${colType}</div>
                        <div class="tc-col tc-col-size" onclick="window.CrowCommanderInstance.sortBy('${side}', 'size')">${colSize}</div>
                        <div class="tc-col tc-col-date" onclick="window.CrowCommanderInstance.sortBy('${side}', 'date')">${colDate}</div>
                    </div>
                    <div class="tc-list" id="${side}PanelList" tabindex="0"></div>
                    <div class="tc-footer">
                        <span id="${side}StatusLabel">0 файлов (0 B)</span>
                        <span id="${side}SelStatusLabel" style="color: #f87171; font-weight: 600;"></span>
                    </div>
                </div>
            `;
        }

        async loadSources() {
            try {
                const resDrives = await fetch('/api/drives?_t=' + Date.now());
                if (resDrives.ok) {
                    this.cloudDrives = await resDrives.json();
                    if (this.cloudDrives.length > 0 && !this.leftState.driveId) this.leftState.driveId = this.cloudDrives[0].id;
                    if (this.cloudDrives.length > 1 && !this.rightState.driveId) this.rightState.driveId = this.cloudDrives[1].id;
                    else if (this.cloudDrives.length > 0 && !this.rightState.driveId) this.rightState.driveId = this.cloudDrives[0].id;
                }
                const resLocal = await fetch('/api/local/drives?_t=' + Date.now());
                if (resLocal.ok) {
                    this.localDrives = await resLocal.json();
                }
            } catch (e) {}
        }

        renderSelects() {
            ['left', 'right'].forEach(side => {
                const sel = document.getElementById(`${side}SourceSelect`);
                if (!sel) return;
                let html = '<optgroup label="Облако Telegram">';
                this.cloudDrives.forEach(d => html += `<option value="cloud_${d.id}">[${d.letter}:] ${d.label}</option>`);
                html += '</optgroup>';
                
                if (this.localDrives && this.localDrives.length > 0) {
                    html += '<optgroup label="Локальный ПК">';
                    this.localDrives.forEach(l => html += `<option value="local_${l.path}">[${l.letter}:] ${l.label}</option>`);
                    html += '</optgroup>';
                }
                sel.innerHTML = html;
                
                const state = side === 'left' ? this.leftState : this.rightState;
                sel.value = state.type === 'cloud' ? `cloud_${state.driveId}` : `local_${state.pathStr}`;
            });
        }

        bindUI() {
            ['left', 'right'].forEach(side => {
                const selectEl = document.getElementById(`${side}SourceSelect`);
                if (selectEl) selectEl.onchange = (e) => this.handleSourceChange(side, e.target.value);
                
                const filterEl = document.getElementById(`${side}Filter`);
                if (filterEl) {
                    filterEl.oninput = (e) => {
                        const state = side === 'left' ? this.leftState : this.rightState;
                        state.filterText = e.target.value.toLowerCase();
                        state.cursorIndex = 0;
                        this.renderPanelItems(side);
                    };
                }

                const homeBtn = document.getElementById(`${side}HomeBtn`);
                if (homeBtn) homeBtn.onclick = () => this.goHome(side);

                const upBtn = document.getElementById(`${side}UpBtn`);
                if (upBtn) upBtn.onclick = () => this.goUp(side);

                const listEl = document.getElementById(`${side}PanelList`);
                if (listEl) {
                    listEl.onclick = () => this.setActiveSide(side);
                }
            });

            const swapBtn = document.getElementById('cmdSwapPanelsBtn');
            if (swapBtn) swapBtn.onclick = () => this.swapPanels();

            const refreshBtn = document.getElementById('cmdRefreshPanelsBtn');
            if (refreshBtn) refreshBtn.onclick = () => this.refreshBoth();

            document.getElementById('cmdBtnF3').onclick = () => this.previewSelected();
            document.getElementById('cmdBtnF4').onclick = () => this.editSelected();
            document.getElementById('cmdBtnF5').onclick = () => this.copySelected();
            document.getElementById('cmdBtnF6').onclick = () => this.moveSelected();
            document.getElementById('cmdBtnF7').onclick = () => this.createNewFolder();
            document.getElementById('cmdBtnF8').onclick = () => this.deleteSelected();
            document.getElementById('cmdBtnTab').onclick = () => this.switchActivePanel();
            
            document.getElementById('closeCommanderBtn').onclick = () => {
                this.isModalOpen = false;
                document.getElementById('commanderModal').style.display = 'none';
            };
        }

        setActiveSide(side) {
            this.activeSide = side;
            const leftPanel = document.getElementById('leftTcPanel');
            const rightPanel = document.getElementById('rightTcPanel');
            if (leftPanel) leftPanel.classList.toggle('tc-active-panel', side === 'left');
            if (rightPanel) rightPanel.classList.toggle('tc-active-panel', side === 'right');
            this.focusActiveList();
        }

        switchActivePanel() {
            this.setActiveSide(this.activeSide === 'left' ? 'right' : 'left');
        }

        focusActiveList() {
            const list = document.getElementById(`${this.activeSide}PanelList`);
            if (list) list.focus();
        }

        swapPanels() {
            const temp = this.leftState;
            this.leftState = this.rightState;
            this.rightState = temp;
            this.renderSelects();
            this.refreshBoth();
            this.showToast(i18n('commander.toastSwap', 'Панели поменялись местами'));
        }

        async refreshBoth() {
            await this.refreshPanel('left');
            await this.refreshPanel('right');
        }

        async handleSourceChange(side, val) {
            const state = side === 'left' ? this.leftState : this.rightState;
            if (val.startsWith('cloud_')) {
                state.type = 'cloud';
                state.driveId = parseInt(val.replace('cloud_', ''));
                state.folderId = 0;
            } else {
                state.type = 'local';
                state.pathStr = val.replace('local_', '');
            }
            await this.refreshPanel(side);
            this.setActiveSide(side);
        }

        goHome(side) {
            const state = side === 'left' ? this.leftState : this.rightState;
            if (state.type === 'cloud') {
                state.folderId = 0;
            } else {
                if (this.localDrives && this.localDrives.length > 0) {
                    const match = this.localDrives.find(d => state.pathStr.startsWith(d.path));
                    state.pathStr = match ? match.path : state.pathStr;
                }
            }
            this.refreshPanel(side);
        }

        goUp(side) {
            const state = side === 'left' ? this.leftState : this.rightState;
            if (state.type === 'cloud') {
                if (state.folderId !== 0) {
                    state.folderId = 0;
                    this.refreshPanel(side);
                }
            } else {
                if (state.parentPath) {
                    state.pathStr = state.parentPath;
                    this.refreshPanel(side);
                }
            }
        }

        async refreshPanel(side) {
            const state = side === 'left' ? this.leftState : this.rightState;
            const listEl = document.getElementById(`${side}PanelList`);
            const pathEl = document.getElementById(`${side}PathLabel`);
            
            state.selectedItems.clear();
            state.cursorIndex = 0;
            if (listEl) listEl.innerHTML = '<div style="padding:20px; text-align:center; color:#8b949e;">⏳ Загрузка...</div>';

            try {
                if (state.type === 'cloud') {
                    const res = await fetch(`/api/files?drive_id=${state.driveId}&_t=${Date.now()}`);
                    if (res.ok) {
                        const allCloudFiles = await res.json();
                        state.items = allCloudFiles.filter(i => Number(i.parent_id || 0) === Number(state.folderId));
                        const driveObj = this.cloudDrives.find(d => d.id === state.driveId);
                        const driveLetter = driveObj ? driveObj.letter : 'C';
                        if (pathEl) {
                            pathEl.textContent = state.folderId === 0 
                                ? `${driveLetter}:/` 
                                : `${driveLetter}:/ [Папка #${state.folderId}]`;
                        }
                    }
                } else {
                    const res = await fetch(`/api/local/list?path=${encodeURIComponent(state.pathStr)}&_t=${Date.now()}`);
                    if (res.ok) {
                        const data = await res.json();
                        state.items = data.items || [];
                        state.parentPath = data.parent_path;
                        state.pathStr = data.current_path;
                        if (pathEl) pathEl.textContent = state.pathStr;
                    }
                }
            } catch (e) {}

            this.renderPanelItems(side);
        }

        sortBy(side, col) {
            const state = side === 'left' ? this.leftState : this.rightState;
            if (state.sortCol === col) state.sortAsc = !state.sortAsc;
            else { state.sortCol = col; state.sortAsc = true; }
            state.cursorIndex = 0;
            this.renderPanelItems(side);
            this.setActiveSide(side);
        }

        formatDate(val) {
            if (!val) return '--';
            const d = new Date(typeof val === 'number' ? val : val);
            if (isNaN(d.getTime())) return '--';
            const lang = window.CrowI18n ? window.CrowI18n.getLanguage() : 'ru';
            return d.toLocaleString(lang === 'en' ? 'en-US' : 'ru-RU', {day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit'});
        }

        processItemsForDisplay(state) {
            let arr = state.items.filter(i => (i.name || '').toLowerCase().includes(state.filterText));
            
            arr.sort((a, b) => {
                const isDirA = a.is_folder === true || a.is_folder === 1;
                const isDirB = b.is_folder === true || b.is_folder === 1;
                if (isDirA && !isDirB) return -1;
                if (!isDirA && isDirB) return 1;

                let valA, valB;
                if (state.sortCol === 'name') { valA = (a.name || '').toLowerCase(); valB = (b.name || '').toLowerCase(); }
                else if (state.sortCol === 'ext') { valA = (a.name || '').split('.').pop(); valB = (b.name || '').split('.').pop(); }
                else if (state.sortCol === 'size') { valA = a.size || 0; valB = b.size || 0; }
                else if (state.sortCol === 'date') { valA = new Date(a.mtime || a.created_at || 0).getTime(); valB = new Date(b.mtime || b.created_at || 0).getTime(); }
                
                if (valA < valB) return state.sortAsc ? -1 : 1;
                if (valA > valB) return state.sortAsc ? 1 : -1;
                return 0;
            });

            const canGoUp = (state.type === 'cloud' && state.folderId !== 0) || (state.type === 'local' && state.parentPath);
            if (canGoUp) {
                arr.unshift({ id: 'UP', name: '..', is_folder: true, size: 0, isUpDir: true });
            }
            return arr;
        }

        renderPanelItems(side) {
            const state = side === 'left' ? this.leftState : this.rightState;
            const listEl = document.getElementById(`${side}PanelList`);
            if (!listEl) return;

            state.displayItems = this.processItemsForDisplay(state);
            if (state.cursorIndex >= state.displayItems.length) state.cursorIndex = Math.max(0, state.displayItems.length - 1);

            listEl.innerHTML = '';

            state.displayItems.forEach((item, idx) => {
                const isDir = item.is_folder === true || item.is_folder === 1;
                const row = document.createElement('div');
                
                row.className = `tc-row ${isDir ? 'folder' : ''} ${idx === state.cursorIndex ? 'cursor' : ''} ${state.selectedItems.has(item) ? 'selected-item' : ''}`;
                
                let ext = '', nameObj = item.name || '';
                if (!isDir && nameObj.includes('.')) {
                    ext = nameObj.split('.').pop();
                    nameObj = nameObj.substring(0, nameObj.lastIndexOf('.'));
                }
                const folderTag = i18n('table.folderTag', '<ПАПКА>');
                const sizeStr = isDir ? folderTag : formatBytesShort(item.size);
                const dateStr = item.isUpDir ? '' : this.formatDate(item.mtime || item.created_at);

                const typeInfo = getTCFileTypeInfo(item.name, isDir);
                const icon = item.isUpDir ? '📁' : typeInfo.icon;
                const iconClass = item.isUpDir ? 'file-color-folder' : typeInfo.colorClass;
                const extBadge = (!isDir && ext) ? `<span class="file-badge-ext ${typeInfo.colorClass}">${ext}</span>` : '';

                row.innerHTML = `
                    <div class="tc-cell tc-cell-name" title="${item.name}">
                        <span class="file-icon ${iconClass}">${icon}</span>
                        <span style="color: var(--text-primary); font-weight: 500;">${nameObj}</span>
                    </div>
                    <div class="tc-cell tc-cell-ext">${extBadge}</div>
                    <div class="tc-cell tc-cell-size mono" style="color: var(--text-muted);">${sizeStr}</div>
                    <div class="tc-cell tc-cell-date mono" style="color: var(--text-muted);">${dateStr}</div>
                `;
                
                row.onmousedown = (e) => {
                    this.setActiveSide(side);
                    state.cursorIndex = idx;
                    if (e.button === 2 || e.ctrlKey) { 
                        if (!item.isUpDir) {
                            if (state.selectedItems.has(item)) state.selectedItems.delete(item);
                            else state.selectedItems.add(item);
                        }
                    }
                    this.updateSelectionView(side);
                };

                row.ondblclick = (e) => {
                    e.stopPropagation();
                    this.executeItem(side, item);
                };
                
                listEl.appendChild(row);
            });

            this.updateStatusBar(side);
            const panel = document.getElementById(`${side}TcPanel`);
            if (panel) {
                panel.className = `tc-panel ${this.activeSide === side ? 'tc-active-panel' : ''}`;
            }
        }

        updateSelectionView(side) {
            const state = side === 'left' ? this.leftState : this.rightState;
            const listEl = document.getElementById(`${side}PanelList`);
            if (!listEl) return;
            
            Array.from(listEl.children).forEach((row, idx) => {
                const item = state.displayItems[idx];
                if (!item) return;
                
                row.classList.remove('cursor', 'selected-item');
                if (idx === state.cursorIndex) {
                    row.classList.add('cursor');
                    if (row.offsetTop < listEl.scrollTop) {
                        listEl.scrollTop = row.offsetTop;
                    } else if (row.offsetTop + row.offsetHeight > listEl.scrollTop + listEl.clientHeight) {
                        listEl.scrollTop = row.offsetTop + row.offsetHeight - listEl.clientHeight;
                    }
                }
                if (state.selectedItems.has(item)) row.classList.add('selected-item');
            });
            this.updateStatusBar(side);
        }

        updateStatusBar(side) {
            const state = side === 'left' ? this.leftState : this.rightState;
            let totalSize = 0, totalFiles = 0, totalFolders = 0;
            let selSize = 0, selCount = 0;
            
            state.displayItems.forEach((item) => {
                if (item.isUpDir) return;
                const isDir = item.is_folder === true || item.is_folder === 1;
                if (isDir) {
                    totalFolders++;
                } else {
                    totalSize += item.size || 0;
                    totalFiles++;
                }
                if (state.selectedItems.has(item)) {
                    selSize += item.size || 0;
                    selCount++;
                }
            });
            
            const statusLabel = document.getElementById(`${side}StatusLabel`);
            const selLabel = document.getElementById(`${side}SelStatusLabel`);
            if (statusLabel) {
                const fallbackStatus = `📁 ${totalFolders} папок, 📄 ${totalFiles} файлов (${formatBytesShort(totalSize)})`;
                statusLabel.textContent = i18n('commander.statusItems', fallbackStatus, {
                    folders: totalFolders,
                    files: totalFiles,
                    size: formatBytesShort(totalSize)
                });
            }
            if (selLabel) {
                const fallbackSel = `Выделено: ${selCount} (${formatBytesShort(selSize)})`;
                selLabel.textContent = selCount > 0 
                    ? i18n('commander.statusSelected', fallbackSel, { count: selCount, size: formatBytesShort(selSize) })
                    : '';
            }
        }

        executeItem(side, item) {
            const state = side === 'left' ? this.leftState : this.rightState;
            const isDir = item.is_folder === true || item.is_folder === 1;
            
            if (item.isUpDir) {
                this.goUp(side);
                return;
            }

            if (isDir) {
                if (state.type === 'cloud') state.folderId = item.id;
                else state.pathStr = item.path;
                this.refreshPanel(side);
            } else {
                this.previewItem(item, state);
            }
        }

        previewItem(item, state) {
            if (!item || item.is_folder) return;
            const ext = (item.name || '').split('.').pop().toLowerCase();
            
            if (state.type === 'cloud') {
                if (window.handleFileClick) {
                    window.handleFileClick(item.id, item.name, ext);
                } else if (window.CrowAPI) {
                    window.CrowAPI.emit('onFileClick', item.id, item.name, ext);
                }
            } else {
                this.showToast(`Локальный файл: ${item.name} (${formatBytesShort(item.size)})`);
            }
        }

        previewSelected() {
            const state = this.activeSide === 'left' ? this.leftState : this.rightState;
            const item = state.displayItems[state.cursorIndex];
            if (item) {
                if (item.is_folder) {
                    this.executeItem(this.activeSide, item);
                } else {
                    this.previewItem(item, state);
                }
            }
        }

        editSelected() {
            const state = this.activeSide === 'left' ? this.leftState : this.rightState;
            const item = state.displayItems[state.cursorIndex];
            if (!item || item.is_folder) return;
            const ext = (item.name || '').split('.').pop().toLowerCase();
            
            if (state.type === 'cloud') {
                if (window.CrowAPI && window.CrowAPI.plugins && window.CrowAPI.plugins.TextCodeEditor) {
                    window.CrowAPI.plugins.TextCodeEditor.openEditor(item.id, item.name);
                } else if (window.handleFileClick) {
                    window.handleFileClick(item.id, item.name, ext);
                }
            }
        }

        toggleCurrentSelection() {
            const state = this.activeSide === 'left' ? this.leftState : this.rightState;
            const item = state.displayItems[state.cursorIndex];
            if (item && !item.isUpDir) {
                if (state.selectedItems.has(item)) state.selectedItems.delete(item);
                else state.selectedItems.add(item);
            }
            if (state.cursorIndex < state.displayItems.length - 1) {
                state.cursorIndex++;
            }
            this.updateSelectionView(this.activeSide);
        }

        selectAll() {
            const state = this.activeSide === 'left' ? this.leftState : this.rightState;
            const allSelected = state.selectedItems.size >= state.displayItems.filter(i => !i.isUpDir).length;
            
            state.selectedItems.clear();
            if (!allSelected) {
                state.displayItems.forEach(item => {
                    if (!item.isUpDir) state.selectedItems.add(item);
                });
            }
            this.updateSelectionView(this.activeSide);
        }

        handleGlobalKeydown(e) {
            if (!this.isModalOpen) return;
            
            if (['F5', 'F6', 'F3', 'F4', 'F7', 'F8'].includes(e.key)) {
                e.preventDefault();
                e.stopPropagation();
            }

            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
                if (e.key === 'Escape') {
                    e.target.blur();
                    this.focusActiveList();
                }
                return;
            }

            const state = this.activeSide === 'left' ? this.leftState : this.rightState;

            if (e.key === 'Tab') {
                e.preventDefault();
                this.switchActivePanel();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (state.cursorIndex < state.displayItems.length - 1) {
                    state.cursorIndex++;
                    this.updateSelectionView(this.activeSide);
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (state.cursorIndex > 0) {
                    state.cursorIndex--;
                    this.updateSelectionView(this.activeSide);
                }
            } else if (e.key === 'PageDown') {
                e.preventDefault();
                state.cursorIndex = Math.min(state.displayItems.length - 1, state.cursorIndex + 10);
                this.updateSelectionView(this.activeSide);
            } else if (e.key === 'PageUp') {
                e.preventDefault();
                state.cursorIndex = Math.max(0, state.cursorIndex - 10);
                this.updateSelectionView(this.activeSide);
            } else if (e.key === 'Home') {
                e.preventDefault();
                state.cursorIndex = 0;
                this.updateSelectionView(this.activeSide);
            } else if (e.key === 'End') {
                e.preventDefault();
                state.cursorIndex = Math.max(0, state.displayItems.length - 1);
                this.updateSelectionView(this.activeSide);
            } else if (e.key === ' ' || e.key === 'Insert') {
                e.preventDefault();
                this.toggleCurrentSelection();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const item = state.displayItems[state.cursorIndex];
                if (item) this.executeItem(this.activeSide, item);
            } else if (e.key === 'Backspace') {
                e.preventDefault();
                this.goUp(this.activeSide);
            } else if (e.key === 'F3') {
                e.preventDefault();
                this.previewSelected();
            } else if (e.key === 'F4') {
                e.preventDefault();
                this.editSelected();
            } else if (e.key === 'F5') {
                e.preventDefault();
                this.copySelected();
            } else if (e.key === 'F6') {
                e.preventDefault();
                this.moveSelected();
            } else if (e.key === 'F7') {
                e.preventDefault();
                this.createNewFolder();
            } else if (e.key === 'F8' || e.key === 'Delete') {
                e.preventDefault();
                this.deleteSelected();
            } else if (e.ctrlKey && (e.key === 'a' || e.key === 'A' || e.key === 'ф' || e.key === 'Ф')) {
                e.preventDefault();
                this.selectAll();
            } else if (e.ctrlKey && (e.key === 'u' || e.key === 'U' || e.key === 'г' || e.key === 'Г')) {
                e.preventDefault();
                this.swapPanels();
            } else if (e.ctrlKey && (e.key === '.' || e.key === 'r' || e.key === 'R')) {
                e.preventDefault();
                this.refreshBoth();
                this.showToast(i18n('commander.toastRefreshed', 'Панели обновлены'));
            } else if (e.key === 'Escape') {
                this.isModalOpen = false;
                const modal = document.getElementById('commanderModal');
                if (modal) modal.style.display = 'none';
            }
        }

        async copySelected() {
            const srcState = this.activeSide === 'left' ? this.leftState : this.rightState;
            const destState = this.activeSide === 'left' ? this.rightState : this.leftState;

            let itemsToProcess = Array.from(srcState.selectedItems);
            if (itemsToProcess.length === 0) {
                const cur = srcState.displayItems[srcState.cursorIndex];
                if (cur && !cur.isUpDir) itemsToProcess = [cur];
            }

            if (itemsToProcess.length === 0) {
                this.showToast('Выберите файлы или папки для копирования', 'error');
                return;
            }

            this.showToast(`⏳ Копирование ${itemsToProcess.length} элемент(ов)...`);

            try {
                if (srcState.type === 'cloud' && destState.type === 'cloud') {
                    for (let item of itemsToProcess) {
                        const fd = new FormData();
                        fd.append('new_parent_id', destState.folderId || 0);
                        if (destState.driveId) fd.append('new_drive_id', destState.driveId);
                        fd.append('is_folder', Boolean(item.is_folder));
                        
                        const res = await fetch(`/api/files/${item.id}/copy`, { method: 'POST', body: fd });
                        if (!res.ok) {
                            const err = await res.json().catch(() => ({}));
                            throw new Error(err.detail || `Ошибка ${res.status}`);
                        }
                    }
                } else if (srcState.type === 'local' && destState.type === 'cloud') {
                    for (let item of itemsToProcess) {
                        if (item.is_folder) continue;
                        const fd = new FormData();
                        fd.append('local_path', item.path);
                        fd.append('parent_id', destState.folderId || 0);
                        fd.append('drive_id', destState.driveId || 1);
                        const res = await fetch('/api/local/upload-to-cloud', { method: 'POST', body: fd });
                        if (!res.ok) throw new Error(`Ошибка загрузки ${item.name}`);
                    }
                } else if (srcState.type === 'cloud' && destState.type === 'local') {
                    for (let item of itemsToProcess) {
                        if (item.is_folder) continue;
                        const fd = new FormData();
                        fd.append('file_id', item.id);
                        fd.append('target_dir', destState.pathStr);
                        const res = await fetch('/api/local/download-from-cloud', { method: 'POST', body: fd });
                        if (!res.ok) throw new Error(`Ошибка скачивания ${item.name}`);
                    }
                }

                srcState.selectedItems.clear();
                await this.refreshBoth();
                if (window.loadFiles) window.loadFiles();
                this.showToast(i18n('commander.toastCopied', `✓ Успешно скопировано (${itemsToProcess.length})`, { count: itemsToProcess.length }), 'success');
            } catch (err) {
                this.showToast('Ошибка копирования: ' + (err.message || err), 'error');
            }
        }

        async moveSelected() {
            const srcState = this.activeSide === 'left' ? this.leftState : this.rightState;
            const destState = this.activeSide === 'left' ? this.rightState : this.leftState;

            let itemsToProcess = Array.from(srcState.selectedItems);
            if (itemsToProcess.length === 0) {
                const cur = srcState.displayItems[srcState.cursorIndex];
                if (cur && !cur.isUpDir) itemsToProcess = [cur];
            }

            if (itemsToProcess.length === 0) {
                this.showToast('Выберите файлы или папки для перемещения', 'error');
                return;
            }

            this.showToast(`⏳ Перемещение ${itemsToProcess.length} элемент(ов)...`);

            try {
                if (srcState.type === 'cloud' && destState.type === 'cloud') {
                    for (let item of itemsToProcess) {
                        const fd = new FormData();
                        fd.append('new_parent_id', destState.folderId || 0);
                        if (destState.driveId) fd.append('new_drive_id', destState.driveId);
                        const res = await fetch(`/api/files/${item.id}/move`, { method: 'POST', body: fd });
                        if (!res.ok) throw new Error(`Ошибка перемещения ${item.name}`);
                    }
                } else if (srcState.type === 'local' && destState.type === 'cloud') {
                    for (let item of itemsToProcess) {
                        if (item.is_folder) continue;
                        const fd = new FormData();
                        fd.append('local_path', item.path);
                        fd.append('parent_id', destState.folderId || 0);
                        fd.append('drive_id', destState.driveId || 1);
                        const res = await fetch('/api/local/upload-to-cloud', { method: 'POST', body: fd });
                        if (res.ok) {
                            const delFd = new FormData();
                            delFd.append('path', item.path);
                            await fetch('/api/local/delete', { method: 'POST', body: delFd });
                        }
                    }
                } else if (srcState.type === 'cloud' && destState.type === 'local') {
                    for (let item of itemsToProcess) {
                        if (item.is_folder) continue;
                        const fd = new FormData();
                        fd.append('file_id', item.id);
                        fd.append('target_dir', destState.pathStr);
                        const res = await fetch('/api/local/download-from-cloud', { method: 'POST', body: fd });
                        if (res.ok) {
                            await fetch(`/api/files/${item.id}/trash?is_folder=false`, { method: 'POST' });
                        }
                    }
                }

                srcState.selectedItems.clear();
                await this.refreshBoth();
                if (window.loadFiles) window.loadFiles();
                this.showToast(i18n('commander.toastMoved', `✓ Успешно перемещено (${itemsToProcess.length})`, { count: itemsToProcess.length }), 'success');
            } catch (err) {
                this.showToast('Ошибка перемещения: ' + (err.message || err), 'error');
            }
        }

        async deleteSelected() {
            const state = this.activeSide === 'left' ? this.leftState : this.rightState;
            let itemsToProcess = Array.from(state.selectedItems);
            if (itemsToProcess.length === 0) {
                const cur = state.displayItems[state.cursorIndex];
                if (cur && !cur.isUpDir) itemsToProcess = [cur];
            }

            if (itemsToProcess.length === 0) return;

            try {
                if (state.type === 'cloud') {
                    for (let item of itemsToProcess) {
                        const isDir = item.is_folder === true || item.is_folder === 1;
                        await fetch(`/api/files/${item.id}/trash?is_folder=${isDir}`, { method: 'POST' });
                    }
                } else {
                    for (let item of itemsToProcess) {
                        const fd = new FormData();
                        fd.append('path', item.path);
                        await fetch('/api/local/delete', { method: 'POST', body: fd });
                    }
                }
                state.selectedItems.clear();
                await this.refreshPanel(this.activeSide);
                if (window.loadFiles) window.loadFiles();
                this.showToast(i18n('commander.toastDeleted', `🗑 Удалено (${itemsToProcess.length})`, { count: itemsToProcess.length }), 'success');
            } catch (err) {
                this.showToast('Ошибка удаления: ' + (err.message || err), 'error');
            }
        }

        async createNewFolder() {
            const state = this.activeSide === 'left' ? this.leftState : this.rightState;
            const promptText = i18n('commander.promptNewFolder', 'Название новой папки:');
            const name = prompt(promptText);
            if (!name || !name.trim()) return;

            try {
                if (state.type === 'cloud') {
                    const fd = new FormData();
                    fd.append('name', name.trim());
                    fd.append('parent_id', state.folderId);
                    fd.append('drive_id', state.driveId);
                    await fetch('/api/folders', { method: 'POST', body: fd });
                } else {
                    const fd = new FormData();
                    fd.append('path', state.pathStr);
                    fd.append('name', name.trim());
                    await fetch('/api/local/mkdir', { method: 'POST', body: fd });
                }
                await this.refreshPanel(this.activeSide);
                if (window.loadFiles) window.loadFiles();
                this.showToast(i18n('commander.toastFolderCreated', `📁 Папка создана: ${name}`, { name }), 'success');
            } catch (err) {
                this.showToast('Ошибка создания папки: ' + (err.message || err), 'error');
            }
        }
    }

    function formatBytesShort(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + (sizes[i] || 'B');
    }

    function getTCFileTypeInfo(filename, isDir) {
        if (window.getFileTypeInfo) {
            return window.getFileTypeInfo(filename, isDir);
        }
        if (isDir) return { colorClass: 'file-color-folder', icon: '📁' };
        const ext = (filename || '').split('.').pop().toLowerCase();
        if (['mp4', 'mkv', 'mov', 'avi', 'webm', 'flv', 'ts'].includes(ext)) return { colorClass: 'file-color-video', icon: '🎬', ext };
        if (['mp3', 'flac', 'wav', 'ogg', 'aac', 'm4a'].includes(ext)) return { colorClass: 'file-color-audio', icon: '🎵', ext };
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return { colorClass: 'file-color-image', icon: '🖼️', ext };
        if (['txt', 'md', 'doc', 'docx', 'pdf', 'xls', 'xlsx'].includes(ext)) return { colorClass: 'file-color-doc', icon: '📄', ext };
        if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'iso'].includes(ext)) return { colorClass: 'file-color-archive', icon: '📦', ext };
        if (['js', 'ts', 'py', 'json', 'html', 'css', 'c', 'cpp'].includes(ext)) return { colorClass: 'file-color-code', icon: '💻', ext };
        if (['exe', 'msi', 'bat', 'cmd', 'ps1', 'apk'].includes(ext)) return { colorClass: 'file-color-exe', icon: '⚙️', ext };
        return { colorClass: 'file-color-default', icon: '📄', ext };
    }

    const CrowCommander = {
        init: function(api) {
            const engine = new CrowCommanderEngine();
            engine.init(api);
        }
    };

    if (window.CrowAPI) {
        window.CrowAPI.registerPlugin(PLUGIN_NAME, CrowCommander);
    }
})();
