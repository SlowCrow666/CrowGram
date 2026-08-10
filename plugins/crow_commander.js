/**
 * CrowCommander v2.2 — Classic Dual-Pane File Manager for CrowGram
 */

(function() {
    const PLUGIN_NAME = 'CrowCommander';

    const TC_CSS = `
        .tc-panel {
            background-color: #0b1320; 
            color: #d1d9e6;
            font-family: 'JetBrains Mono', Consolas, monospace;
            font-size: 13px;
            display: flex;
            flex-direction: column;
            height: 100%;
            border: 1px solid #1a2a44;
        }
        .tc-header {
            background-color: #111d33;
            padding: 4px;
            display: flex;
            gap: 4px;
            align-items: center;
            border-bottom: 1px solid #1a2a44;
        }
        .tc-path {
            flex-grow: 1;
            background: #060b14;
            color: #fff;
            padding: 4px 8px;
            border: 1px inset #333;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
        }
        .tc-filter {
            background: #060b14;
            color: #00ffff;
            border: 1px solid #333;
            padding: 4px;
            width: 120px;
            font-family: inherit;
        }
        .tc-table-header {
            display: flex;
            background: #111d33;
            border-bottom: 1px solid #1a2a44;
            font-weight: bold;
            color: #8892b0;
        }
        .tc-col {
            padding: 4px 8px;
            cursor: pointer;
            user-select: none;
            border-right: 1px solid #1a2a44;
        }
        .tc-col:hover { background: #1a2a44; }
        .tc-col-name { flex-grow: 1; }
        .tc-col-ext { width: 60px; text-align: center; }
        .tc-col-size { width: 90px; text-align: right; }
        .tc-col-date { width: 140px; text-align: right; }
        
        .tc-list {
            flex-grow: 1;
            overflow-y: auto;
            outline: none;
        }
        .tc-list:focus { outline: none; }
        
        .tc-row {
            display: flex;
            padding: 2px 0;
            cursor: pointer;
            user-select: none;
        }
        .tc-row.folder { color: #ffd700; font-weight: bold; }
        .tc-row.selected-item { color: #ff5555; }
        .tc-row.cursor { background-color: #005577; color: #fff; }
        
        .tc-cell { padding: 0 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tc-cell-name { flex-grow: 1; display: flex; gap: 6px; }
        .tc-cell-ext { width: 60px; text-align: center; color: #8892b0; }
        .tc-cell-size { width: 90px; text-align: right; }
        .tc-cell-date { width: 140px; text-align: right; }

        .tc-footer {
            background-color: #111d33;
            border-top: 1px solid #1a2a44;
            padding: 4px 8px;
            font-size: 11px;
            color: #8892b0;
            display: flex;
            justify-content: space-between;
        }
        .tc-active-panel .tc-header { background-color: #1a2a44; }
        .tc-active-panel .tc-path { background: #001122; border-color: #005577; }
    `;

    class CrowCommanderEngine {
        constructor() {
            this.leftState = this.createDefaultState('cloud', 1, 0, 'C: /');
            this.rightState = this.createDefaultState('local', null, null, 'C:\\');
            this.activeSide = 'left'; 
            this.cloudDrives = [];
            this.localDrives = [];
            this.isInitialized = false;
            this.isModalOpen = false;
        }

        createDefaultState(type, driveId, folderId, pathStr) {
            return {
                type, driveId, folderId, pathStr, parentPath: null,
                items: [], displayItems: [], selectedItems: new Set(),
                cursorIndex: 0, filterText: '',
                sortCol: 'name', sortAsc: true
            };
        }

        async init(api) {
            const style = document.createElement('style');
            style.innerHTML = TC_CSS;
            document.head.appendChild(style);
            
            document.addEventListener('keydown', (e) => this.handleGlobalKeydown(e));
            window.CrowCommanderInstance = this;
        }

        async open() {
            this.isModalOpen = true;
            document.getElementById('commanderModal').style.display = 'flex';
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
            const leftContainer = document.getElementById('leftPanelContainer');
            const rightContainer = document.getElementById('rightPanelContainer');
            if (leftContainer) leftContainer.innerHTML = this.getPanelHTML('left');
            if (rightContainer) rightContainer.innerHTML = this.getPanelHTML('right');
        }

        getPanelHTML(side) {
            return `
                <div class="tc-panel" id="${side}TcPanel">
                    <div class="tc-header">
                        <select id="${side}SourceSelect" class="hud-select" style="max-width: 140px; font-size:11px; padding:2px; height:auto;"></select>
                        <div class="tc-path" id="${side}PathLabel">/</div>
                        <input type="text" id="${side}Filter" class="tc-filter" placeholder="Фильтр...">
                    </div>
                    <div class="tc-table-header">
                        <div class="tc-col tc-col-name" onclick="window.CrowCommanderInstance.sortBy('${side}', 'name')">Имя</div>
                        <div class="tc-col tc-col-ext" onclick="window.CrowCommanderInstance.sortBy('${side}', 'ext')">Тип</div>
                        <div class="tc-col tc-col-size" onclick="window.CrowCommanderInstance.sortBy('${side}', 'size')">Размер</div>
                        <div class="tc-col tc-col-date" onclick="window.CrowCommanderInstance.sortBy('${side}', 'date')">Дата</div>
                    </div>
                    <div class="tc-list" id="${side}PanelList" tabindex="0"></div>
                    <div class="tc-footer">
                        <span id="${side}StatusLabel">0 байт / 0 файлов</span>
                        <span id="${side}SelStatusLabel" style="color:#ff5555;"></span>
                    </div>
                </div>
            `;
        }

        async loadSources() {
            try {
                const resDrives = await fetch('/api/drives?_t=' + Date.now());
                if (resDrives.ok) {
                    this.cloudDrives = await resDrives.json();
                    if (this.cloudDrives.length > 0) this.leftState.driveId = this.cloudDrives[0].id;
                }
                const resLocal = await fetch('/api/local/drives?_t=' + Date.now());
                if (resLocal.ok) {
                    this.localDrives = await resLocal.json();
                    if (this.localDrives.length > 0) this.rightState.pathStr = this.localDrives[0].path;
                }
            } catch (e) { console.error('Ошибка загрузки дисков', e); }
        }

        renderSelects() {
            ['left', 'right'].forEach(side => {
                const sel = document.getElementById(`${side}SourceSelect`);
                if (!sel) return;
                let html = '<optgroup label="Облако Telegram">';
                this.cloudDrives.forEach(d => html += `<option value="cloud_${d.id}">[${d.letter}:] ${d.label}</option>`);
                html += '</optgroup><optgroup label="ПК">';
                this.localDrives.forEach(l => html += `<option value="local_${l.path}">${l.label}</option>`);
                html += '</optgroup>';
                sel.innerHTML = html;
                
                const state = side === 'left' ? this.leftState : this.rightState;
                sel.value = state.type === 'cloud' ? `cloud_${state.driveId}` : `local_${state.pathStr}`;
            });
        }

        bindUI() {
            ['left', 'right'].forEach(side => {
                document.getElementById(`${side}SourceSelect`).onchange = (e) => this.handleSourceChange(side, e.target.value);
                document.getElementById(`${side}Filter`).oninput = (e) => {
                    const state = side === 'left' ? this.leftState : this.rightState;
                    state.filterText = e.target.value.toLowerCase();
                    state.cursorIndex = 0;
                    this.renderPanelItems(side);
                };
                document.getElementById(`${side}PanelList`).onclick = () => {
                    this.setActiveSide(side);
                };
            });

            document.getElementById('cmdBtnF3').onclick = () => this.previewSelected();
            document.getElementById('cmdBtnF5').onclick = () => this.copySelected();
            document.getElementById('cmdBtnF7').onclick = () => this.createNewFolder();
            document.getElementById('cmdBtnF8').onclick = () => this.deleteSelected();
            
            document.getElementById('closeCommanderBtn').onclick = () => {
                this.isModalOpen = false;
                document.getElementById('commanderModal').style.display = 'none';
            };
        }

        setActiveSide(side) {
            this.activeSide = side;
            document.getElementById('leftTcPanel').classList.remove('tc-active-panel');
            document.getElementById('rightTcPanel').classList.remove('tc-active-panel');
            document.getElementById(`${side}TcPanel`).classList.add('tc-active-panel');
            this.focusActiveList();
        }

        focusActiveList() {
            const list = document.getElementById(`${this.activeSide}PanelList`);
            if (list) list.focus();
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

        async refreshPanel(side) {
            const state = side === 'left' ? this.leftState : this.rightState;
            const listEl = document.getElementById(`${side}PanelList`);
            const pathEl = document.getElementById(`${side}PathLabel`);
            
            state.selectedItems.clear();
            state.cursorIndex = 0;
            if (listEl) listEl.innerHTML = '<div style="padding:15px; text-align:center;">Загрузка...</div>';

            try {
                if (state.type === 'cloud') {
                    const res = await fetch(`/api/files?drive_id=${state.driveId}&_t=${Date.now()}`);
                    if (res.ok) {
                        state.items = (await res.json()).filter(i => i.parent_id === state.folderId);
                        const driveObj = this.cloudDrives.find(d => d.id === state.driveId);
                        if (pathEl) pathEl.textContent = `${driveObj ? driveObj.letter : 'C'}: / [Cloud Folder #${state.folderId}]`;
                    }
                } else {
                    const res = await fetch(`/api/local/list?path=${encodeURIComponent(state.pathStr)}&_t=${Date.now()}`);
                    if (res.ok) {
                        const data = await res.json();
                        state.items = data.items || [];
                        state.parentPath = data.parent_path;
                        state.pathStr = data.current_path;
                        if (pathEl) pathEl.textContent = state.pathStr;
                    } else {
                        if (listEl) listEl.innerHTML = '<div style="padding:15px; color:#ff5555; text-align:center;">Отказано в доступе</div>';
                        return;
                    }
                }
            } catch (e) { console.error(e); }

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
            return d.toLocaleString('ru-RU', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'});
        }

        processItemsForDisplay(state) {
            let arr = state.items.filter(i => i.name.toLowerCase().includes(state.filterText));
            
            arr.sort((a, b) => {
                const isDirA = a.is_folder === true || a.is_folder === 1;
                const isDirB = b.is_folder === true || b.is_folder === 1;
                if (isDirA && !isDirB) return -1;
                if (!isDirA && isDirB) return 1;

                let valA, valB;
                if (state.sortCol === 'name') { valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); }
                else if (state.sortCol === 'ext') { valA = a.name.split('.').pop(); valB = b.name.split('.').pop(); }
                else if (state.sortCol === 'size') { valA = a.size; valB = b.size; }
                else if (state.sortCol === 'date') { valA = new Date(a.mtime || a.created_at).getTime(); valB = new Date(b.mtime || b.created_at).getTime(); }
                
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
                
                let ext = '', nameObj = item.name;
                if (!isDir && nameObj.includes('.')) {
                    ext = nameObj.split('.').pop();
                    nameObj = nameObj.substring(0, nameObj.lastIndexOf('.'));
                }
                const sizeStr = isDir ? '<DIR>' : (item.size).toLocaleString() + ' B';
                const dateStr = item.isUpDir ? '' : this.formatDate(item.mtime || item.created_at);
                const icon = isDir ? '📁' : '📄';

                row.innerHTML = `
                    <div class="tc-cell tc-cell-name">${icon} ${nameObj}</div>
                    <div class="tc-cell tc-cell-ext">${ext}</div>
                    <div class="tc-cell tc-cell-size">${sizeStr}</div>
                    <div class="tc-cell tc-cell-date">${dateStr}</div>
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
            document.getElementById(`${side}TcPanel`).className = `tc-panel ${this.activeSide === side ? 'tc-active-panel' : ''}`;
            
            const cursorRow = listEl.children[state.cursorIndex];
            if (cursorRow) cursorRow.scrollIntoView({block: 'nearest'});
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
                    row.scrollIntoView({block: 'nearest'});
                }
                if (state.selectedItems.has(item)) row.classList.add('selected-item');
            });
            this.updateStatusBar(side);
        }

        updateStatusBar(side) {
            const state = side === 'left' ? this.leftState : this.rightState;
            let totalSize = 0, totalFiles = 0, selSize = 0, selCount = 0;
            state.displayItems.forEach((item) => {
                const isDir = item.is_folder === true || item.is_folder === 1;
                if (!isDir && !item.isUpDir) { totalSize += item.size; totalFiles++; }
                if (state.selectedItems.has(item)) { selSize += item.size; selCount++; }
            });
            
            const statusLabel = document.getElementById(`${side}StatusLabel`);
            const selLabel = document.getElementById(`${side}SelStatusLabel`);
            if (statusLabel) statusLabel.textContent = `${totalSize.toLocaleString()} байт / ${totalFiles} файлов`;
            if (selLabel) selLabel.textContent = selCount > 0 ? `Выделено: ${selSize.toLocaleString()} байт в ${selCount} файлах` : '';
        }

        executeItem(side, item) {
            const state = side === 'left' ? this.leftState : this.rightState;
            const isDir = item.is_folder === true || item.is_folder === 1;
            
            if (item.isUpDir) {
                if (state.type === 'cloud') state.folderId = 0;
                else state.pathStr = state.parentPath;
                this.refreshPanel(side);
                return;
            }

            if (isDir) {
                if (state.type === 'cloud') state.folderId = item.id;
                else state.pathStr = item.path;
                this.refreshPanel(side);
            } else {
                if (state.type === 'cloud' && window.handleFileClick) {
                    this.openPreviewWithOverlay(item.id, item.name);
                }
            }
        }

        openPreviewWithOverlay(id, name) {
            const commanderModal = document.getElementById('commanderModal');
            if (commanderModal) commanderModal.style.display = 'none';

            window.handleFileClick(id, name);

            const previewModal = document.getElementById('previewModal');
            const closeBtn = document.getElementById('closePreviewBtn');

            const restoreCommander = () => {
                if (commanderModal && this.isModalOpen) commanderModal.style.display = 'flex';
                if (closeBtn) closeBtn.removeEventListener('click', restoreCommander);
            };

            if (closeBtn) closeBtn.addEventListener('click', restoreCommander, { once: true });
        }

        handleGlobalKeydown(e) {
            if (!this.isModalOpen) return;
            const state = this.activeSide === 'left' ? this.leftState : this.rightState;
            const isInputFocused = document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT';

            if (e.key === 'Tab') {
                e.preventDefault();
                this.setActiveSide(this.activeSide === 'left' ? 'right' : 'left');
                return;
            }

            if (isInputFocused && !e.key.startsWith('F')) return; 

            if (e.key === 'ArrowDown') {
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
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const item = state.displayItems[state.cursorIndex];
                if (item) this.executeItem(this.activeSide, item);
            } else if (e.key === 'Backspace') {
                e.preventDefault();
                const upItem = state.displayItems.find(i => i.isUpDir);
                if (upItem) this.executeItem(this.activeSide, upItem);
            } else if (e.key === ' ' || e.code === 'Space' || e.key === 'Insert') {
                e.preventDefault();
                const item = state.displayItems[state.cursorIndex];
                if (item && !item.isUpDir) {
                    if (state.selectedItems.has(item)) state.selectedItems.delete(item);
                    else state.selectedItems.add(item);
                    if (state.cursorIndex < state.displayItems.length - 1) state.cursorIndex++;
                    this.updateSelectionView(this.activeSide);
                }
            } else if (e.key === 'F3') { e.preventDefault(); this.previewSelected(); }
            else if (e.key === 'F5') { e.preventDefault(); this.copySelected(); }
            else if (e.key === 'F7') { e.preventDefault(); this.createNewFolder(); }
            else if (e.key === 'F8') { e.preventDefault(); this.deleteSelected(); }
        }

        previewSelected() {
            const state = this.activeSide === 'left' ? this.leftState : this.rightState;
            const item = state.displayItems[state.cursorIndex];
            if (!item || item.is_folder) return;

            if (state.type === 'cloud' && window.handleFileClick) {
                this.openPreviewWithOverlay(item.id, item.name);
            } else alert(`Локальный файл: ${item.path}\n\nПредпросмотр локальных файлов пока недоступен.`);
        }

        async copySelected() {
            const srcState = this.activeSide === 'left' ? this.leftState : this.rightState;
            const destState = this.activeSide === 'left' ? this.rightState : this.leftState;

            let itemsToProcess = Array.from(srcState.selectedItems);
            if (itemsToProcess.length === 0) {
                const cur = srcState.displayItems[srcState.cursorIndex];
                if (cur && !cur.isUpDir && !cur.is_folder) itemsToProcess = [cur];
            }

            if (itemsToProcess.length === 0) return alert('Выберите файлы для копирования (Папки пока не поддерживаются)');

            if (srcState.type === 'local' && destState.type === 'cloud') {
                for (let item of itemsToProcess) {
                    const fd = new FormData();
                    fd.append('local_path', item.path);
                    fd.append('parent_id', destState.folderId);
                    fd.append('drive_id', destState.driveId);
                    await fetch('/api/local/upload-to-cloud', { method: 'POST', body: fd });
                }
                srcState.selectedItems.clear();
                this.refreshPanel(this.activeSide === 'left' ? 'right' : 'left');
                this.renderPanelItems(this.activeSide);
                alert(`Успешно загружено файлов: ${itemsToProcess.length}`);

            } else if (srcState.type === 'cloud' && destState.type === 'local') {
                for (let item of itemsToProcess) {
                    const fd = new FormData();
                    fd.append('file_id', item.id);
                    fd.append('target_dir', destState.pathStr);
                    await fetch('/api/local/download-from-cloud', { method: 'POST', body: fd });
                }
                srcState.selectedItems.clear();
                this.refreshPanel(this.activeSide === 'left' ? 'right' : 'left');
                this.renderPanelItems(this.activeSide);
                alert(`Успешно скачано файлов: ${itemsToProcess.length}`);
            } else {
                alert('Перемещение внутри одной среды пока не реализовано.');
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
            if (!confirm(`Удалить выбранные элементы (${itemsToProcess.length} шт.)?`)) return;

            if (state.type === 'cloud') {
                for (let item of itemsToProcess) {
                    const isDir = item.is_folder === true || item.is_folder === 1;
                    await fetch(`/api/files/${item.id}/trash?is_folder=${isDir}`, { method: 'POST' });
                }
            } else {
                alert('Удаление локальных файлов отключено в целях безопасности.');
            }
            state.selectedItems.clear();
            this.refreshPanel(this.activeSide);
        }

        async createNewFolder() {
            const state = this.activeSide === 'left' ? this.leftState : this.rightState;
            const name = prompt('Создать папку (Имя):');
            if (!name) return;

            if (state.type === 'cloud') {
                const fd = new FormData();
                fd.append('name', name);
                fd.append('parent_id', state.folderId);
                fd.append('drive_id', state.driveId);
                await fetch('/api/folders', { method: 'POST', body: fd });
            } else {
                const fd = new FormData();
                fd.append('path', state.pathStr);
                fd.append('name', name);
                await fetch('/api/local/mkdir', { method: 'POST', body: fd });
            }
            this.refreshPanel(this.activeSide);
        }
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
