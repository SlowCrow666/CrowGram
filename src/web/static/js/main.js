let currentLang = 'ru';
let isAuthorized = false;
let selectedFileIds = new Set();
let allItems = [];
let currentFolderId = 0;
let currentDriveId = 1;
let isTrashView = false;
let currentViewMode = 'table';
let uploadQueue = [];
let maxConcurrentUploads = 3;
let activeUploads = 0;
let clipboardItems = null;

window.CrowAPI = {
    plugins: {},
    hooks: { onFileClick: [], onAppReady: [], onFolderChange: [], languageChanged: [], themeChanged: [] },
    events: {},

    registerPlugin: function(nameOrManifest, plugin) {
        let name = nameOrManifest;
        let pluginObj = plugin;
        let manifest = {};

        if (typeof nameOrManifest === 'object' && nameOrManifest !== null) {
            manifest = nameOrManifest;
            name = manifest.name || manifest.id;
            pluginObj = plugin || manifest;
        } else if (plugin && plugin.manifest) {
            manifest = plugin.manifest;
        }

        if (!name) {
            console.error('Plugin registration failed: missing plugin name');
            return;
        }

        this.plugins[name] = {
            manifest: manifest,
            instance: pluginObj
        };

        try {
            if (pluginObj && typeof pluginObj.init === 'function') {
                pluginObj.init(this);
            }
        } catch (e) {
            console.error(`Error initializing plugin "${name}":`, e);
        }
    },

    on: function(event, callback) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(callback);
        if (!this.hooks[event]) this.hooks[event] = [];
        this.hooks[event].push(callback);
    },

    off: function(event, callback) {
        if (this.events[event]) {
            this.events[event] = this.events[event].filter(cb => cb !== callback);
        }
        if (this.hooks[event]) {
            this.hooks[event] = this.hooks[event].filter(cb => cb !== callback);
        }
    },

    addHook: function(hookName, callback) {
        this.on(hookName, callback);
    },

    emit: function(event, ...args) {
        let handled = false;
        const cbs = (this.events[event] || []).concat(this.hooks[event] || []);
        const uniqueCbs = Array.from(new Set(cbs));
        for (const cb of uniqueCbs) {
            try {
                const res = cb(...args);
                if (res === true) {
                    handled = true;
                    break;
                }
            } catch (e) {
                console.error(`Error in event listener for "${event}":`, e);
            }
        }
        return handled;
    },

    getCurrentDrive: function() { return currentDriveId; },
    getCurrentFolder: function() { return currentFolderId; },
    getFiles: function() { return window.currentFolderFiles || []; },
    getAllFiles: function() { return window.allItems || []; },
    getTheme: function() { return localStorage.getItem('crowgram_theme') || 'default'; },
    getLanguage: function() { return window.CrowI18n ? window.CrowI18n.currentLang : 'ru'; },
    reloadFiles: async function() { return await loadFiles(); },

    readFile: async function(fileId) {
        const res = await fetch('/api/download/' + fileId);
        if (!res.ok) throw new Error('Ошибка чтения файла (' + res.status + ')');
        return await res.text();
    },

    saveFile: async function(fileId, fileName, textContent) {
        const fd = new FormData();
        const blob = new Blob([textContent], { type: 'text/plain' });
        fd.append('file', blob, fileName);
        fd.append('drive_id', currentDriveId);
        fd.append('parent_id', currentFolderId);
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        if (!res.ok) throw new Error('Ошибка сохранения (' + res.status + ')');
        await loadFiles();
        return fileId;
    },

    ui: {
        addBottomBar: function(id, html) {
            let mounts = document.getElementById('plugin-mounts') || document.body;
            let bar = document.createElement('div');
            bar.id = id;
            bar.className = 'plugin-bottom-bar';
            bar.innerHTML = html;
            mounts.appendChild(bar);
            return bar;
        },
        createModal: function(options = {}) {
            // Clean up any existing dynamic modal with same ID or previous plugin dynamic modal
            const oldModals = document.querySelectorAll('.plugin-dynamic-modal');
            oldModals.forEach(m => m.remove());

            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay plugin-dynamic-modal';
            overlay.id = options.id || ('modal_' + Math.random().toString(36).substr(2, 9));
            overlay.style.display = 'flex';
            overlay.style.zIndex = options.zIndex || '2500';

            const panel = document.createElement('div');
            panel.className = 'modal-panel ' + (options.panelClass || '');
            if (options.maxWidth) panel.style.maxWidth = options.maxWidth;
            if (options.width) panel.style.width = options.width;

            panel.innerHTML = `
                <div class="modal-header">
                    <h3 class="panel-title">${escapeHtml(options.title || '')}</h3>
                    <button class="close-btn modal-close-x">✕</button>
                </div>
                <div class="modal-body">${options.body || ''}</div>
                ${options.footer ? `<div class="modal-footer" style="margin-top: 16px; display: flex; justify-content: flex-end; gap: 8px;">${options.footer}</div>` : ''}
            `;

            overlay.appendChild(panel);
            document.body.appendChild(overlay);

            const close = () => {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.remove(), 140);
            };

            panel.querySelector('.modal-close-x')?.addEventListener('click', close);
            overlay.addEventListener('mousedown', (e) => {
                if (e.target === overlay) close();
            });

            return {
                overlay,
                panel,
                close
            };
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    bindGlobalEvents();
    bindToolbarEvents();
    bindBatchEvents();
    bindModalEvents();
    initUploadQueueEvents();
    initAppCore();
});

async function initAppCore() {
    await initAppAuth();
    await loadDrives();
    await loadFiles();
    await loadPlugins();
    setupDragAndDrop();
    if (window.CrowAPI && typeof window.CrowAPI.emit === 'function') {
        window.CrowAPI.emit('onAppReady');
    }
}

async function initAppAuth() {
    return await loadConfigSettings();
}
window.initAppAuth = initAppAuth;
window.loadConfig = loadConfigSettings;
window.loadConfigSettings = loadConfigSettings;

async function loadConfigSettings() {
    try {
        const res = await fetch('/api/config');
        if (res.ok) {
            const cfg = await res.json();
            if (cfg.max_concurrent_uploads) {
                maxConcurrentUploads = parseInt(cfg.max_concurrent_uploads) || 3;
            }

            const apiIdInput = document.getElementById('apiIdInput');
            const apiHashInput = document.getElementById('apiHashInput');
            const chunkSizeInput = document.getElementById('chunkSizeInput');
            const maxUploadsInput = document.getElementById('maxConcurrentUploadsInput');
            const tgPhoneInput = document.getElementById('tgPhoneInput');

            if (apiIdInput && cfg.api_id) apiIdInput.value = cfg.api_id;
            if (apiHashInput && cfg.api_hash) apiHashInput.value = cfg.api_hash;
            if (chunkSizeInput && cfg.chunk_size) chunkSizeInput.value = cfg.chunk_size;
            if (maxUploadsInput && cfg.max_concurrent_uploads) maxUploadsInput.value = cfg.max_concurrent_uploads;
            if (tgPhoneInput && cfg.phone) tgPhoneInput.value = cfg.phone;

            const isAuth = Boolean(cfg.is_authorized);
            window.isAuthorized = isAuth;
            isAuthorized = isAuth;

            const statusBadge = document.getElementById('tgAuthStatusBadge');
            const systemStatus = document.getElementById('systemStatus');
            const loggedBlock = document.getElementById('tgAuthLoggedBlock');
            const phoneBlock = document.getElementById('tgAuthPhoneBlock');
            const codeBlock = document.getElementById('tgAuthCodeBlock');
            const passBlock = document.getElementById('tgAuthPasswordBlock');
            const userNameEl = document.getElementById('tgUserName');
            const userPhoneEl = document.getElementById('tgUserPhone');

            if (isAuth) {
                if (statusBadge) {
                    statusBadge.textContent = window.t('settings.statusAuthorized') || 'АВТОРИЗОВАН 🟢';
                    statusBadge.className = 'status-badge';
                }
                if (systemStatus) {
                    const uName = cfg.tg_user ? (cfg.tg_user.first_name || 'TELEGRAM') : 'TELEGRAM';
                    systemStatus.textContent = window.t('header.statusReady', { user: uName }) || `🟢 СИСТЕМА ГОТОВА (${uName})`;
                    systemStatus.className = 'status-badge';
                    systemStatus.style.cursor = 'default';
                }
                if (loggedBlock) loggedBlock.style.display = 'block';
                if (phoneBlock) phoneBlock.style.display = 'none';
                if (codeBlock) codeBlock.style.display = 'none';
                if (passBlock) passBlock.style.display = 'none';
                if (userNameEl && cfg.tg_user) {
                    userNameEl.textContent = `${cfg.tg_user.first_name} ${cfg.tg_user.last_name || ''}`.trim();
                }
                if (userPhoneEl && cfg.tg_user) {
                    userPhoneEl.textContent = cfg.tg_user.phone ? `(${cfg.tg_user.phone})` : '';
                }
            } else {
                if (statusBadge) {
                    statusBadge.textContent = window.t('settings.statusNotAuthorized') || 'НЕ АВТОРИЗОВАН 🔴';
                    statusBadge.className = 'status-badge unauth';
                }
                if (systemStatus) {
                    systemStatus.textContent = window.t('header.statusUnauth') || '🔴 ТРЕБУЕТСЯ АВТОРИЗАЦИЯ';
                    systemStatus.className = 'status-badge unauth';
                    systemStatus.style.cursor = 'pointer';
                }
                if (loggedBlock) loggedBlock.style.display = 'none';
                if (phoneBlock) phoneBlock.style.display = 'block';
            }
        }
    } catch (e) {
        console.warn("Config load error", e);
    }
}

async function loadDrives() {
    try {
        const res = await fetch('/api/drives');
        if (res.ok) {
            const drives = await res.json();
            const container = document.getElementById('drivesList');
            if (container) {
                container.innerHTML = drives.map(d => `
                    <a href="#" class="nav-link ${d.id === currentDriveId ? 'active' : ''}" onclick="selectDrive(${d.id}); return false;">
                        <span class="nav-icon">${d.icon || '💽'}</span>
                        <span class="nav-text">${d.letter}: ${d.label}</span>
                    </a>
                `).join('');
            }
        }
    } catch (e) {}
}

async function loadFiles() {
    try {
        const createFolderBtn = document.getElementById('createFolderBtn');
        const emptyTrashBtn = document.getElementById('emptyTrashBtn');
        const pasteBtn = document.getElementById('pasteBtn');

        if (isTrashView) {
            if (createFolderBtn) createFolderBtn.style.display = 'none';
            if (emptyTrashBtn) emptyTrashBtn.style.display = 'inline-flex';
            if (pasteBtn) pasteBtn.style.display = 'none';
        } else {
            if (createFolderBtn) createFolderBtn.style.display = 'inline-flex';
            if (emptyTrashBtn) emptyTrashBtn.style.display = 'none';
            if (pasteBtn) pasteBtn.style.display = (clipboardItems && clipboardItems.ids && clipboardItems.ids.length > 0) ? 'inline-flex' : 'none';
        }

        const endpoint = isTrashView 
            ? '/api/trash/files' 
            : `/api/files?drive_id=${currentDriveId}`;
        
        const res = await fetch(endpoint);
        if (res.ok) {
            const files = await res.json();
            allItems = files;
            window.allItems = files;
            selectedFileIds.clear();
            updateBatchPanel();
            
            const filtered = isTrashView 
                ? files 
                : files.filter(item => Number(item.parent_id || 0) === Number(currentFolderId));
            
            window.currentFolderFiles = filtered;
            applyFilterAndSort();
        }
    } catch (e) {
        console.warn('Error loading files:', e);
    }
}

function updateSortHeaderIndicators(sortVal) {
    const indicators = {
        name: document.getElementById('sortIndicatorName'),
        size: document.getElementById('sortIndicatorSize'),
        date: document.getElementById('sortIndicatorDate')
    };
    const headers = {
        name: document.getElementById('thName'),
        size: document.getElementById('thSize'),
        date: document.getElementById('thDate')
    };

    Object.keys(indicators).forEach(key => {
        if (indicators[key]) indicators[key].textContent = '';
        if (headers[key]) headers[key].classList.remove('active-sort');
    });

    if (!sortVal) sortVal = 'date_desc';

    if (sortVal.startsWith('name_')) {
        if (headers.name) headers.name.classList.add('active-sort');
        if (indicators.name) indicators.name.textContent = sortVal === 'name_asc' ? '▲' : '▼';
    } else if (sortVal.startsWith('size_')) {
        if (headers.size) headers.size.classList.add('active-sort');
        if (indicators.size) indicators.size.textContent = sortVal === 'size_asc' ? '▲' : '▼';
    } else if (sortVal.startsWith('date_')) {
        if (headers.date) headers.date.classList.add('active-sort');
        if (indicators.date) indicators.date.textContent = sortVal === 'date_asc' ? '▲' : '▼';
    }
}

function setSortValue(val) {
    const sel = document.getElementById('sortSelect');
    if (sel) sel.value = val;
    localStorage.setItem('crowgram_sort_val', val);
    applyFilterAndSort();
}

function applyFilterAndSort() {
    let items = window.currentFolderFiles || [];
    const query = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();
    const sortVal = document.getElementById('sortSelect')?.value || localStorage.getItem('crowgram_sort_val') || 'date_desc';

    if (query) {
        items = items.filter(item => (item.name || '').toLowerCase().includes(query));
    }

    items = [...items].sort((a, b) => {
        // Folders ALWAYS on top
        if (a.is_folder && !b.is_folder) return -1;
        if (!a.is_folder && b.is_folder) return 1;

        // If both are folders
        if (a.is_folder && b.is_folder) {
            if (sortVal === 'name_desc') {
                return (b.name || '').localeCompare(a.name || '', undefined, { numeric: true, sensitivity: 'base' });
            } else if (sortVal === 'date_asc') {
                return (new Date(a.created_at || 0)).getTime() - (new Date(b.created_at || 0)).getTime();
            } else if (sortVal === 'date_desc') {
                return (new Date(b.created_at || 0)).getTime() - (new Date(a.created_at || 0)).getTime();
            } else {
                return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' });
            }
        }

        // Both are files
        switch (sortVal) {
            case 'date_asc':
                return (new Date(a.created_at || 0)).getTime() - (new Date(b.created_at || 0)).getTime();
            case 'date_desc':
                return (new Date(b.created_at || 0)).getTime() - (new Date(a.created_at || 0)).getTime();
            case 'name_asc':
                return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' });
            case 'name_desc':
                return (b.name || '').localeCompare(a.name || '', undefined, { numeric: true, sensitivity: 'base' });
            case 'size_desc':
                return (b.size || 0) - (a.size || 0);
            case 'size_asc':
                return (a.size || 0) - (b.size || 0);
            default:
                return 0;
        }
    });

    updateSortHeaderIndicators(sortVal);
    renderView(items);
}

function renderView(items) {
    renderBreadcrumbs();
    const tableContainer = document.getElementById('tableViewContainer');
    const gridContainer = document.getElementById('gridViewContainer');

    if (currentViewMode === 'table') {
        if (tableContainer) tableContainer.style.display = 'block';
        if (gridContainer) gridContainer.style.display = 'none';
        renderTableList(items);
    } else {
        if (tableContainer) tableContainer.style.display = 'none';
        if (gridContainer) {
            gridContainer.style.display = 'grid';
            gridContainer.className = `file-grid ${currentViewMode === 'grid_large' ? 'large' : 'small'}`;
            renderGridList(items);
        }
    }
}

function checkIsFavorite(val) {
    return val === 1 || val === "1" || val === true || val === "true";
}

function getFileSvgIcon(type, size = 18) {
    switch (type) {
        case 'folder':
            return `<svg class="file-svg-icon file-color-folder" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`;
        case 'video':
            return `<svg class="file-svg-icon file-color-video" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`;
        case 'audio':
            return `<svg class="file-svg-icon file-color-audio" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
        case 'image':
            return `<svg class="file-svg-icon file-color-image" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
        case 'doc':
            return `<svg class="file-svg-icon file-color-doc" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
        case 'archive':
            return `<svg class="file-svg-icon file-color-archive" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`;
        case 'code':
            return `<svg class="file-svg-icon file-color-code" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;
        case 'exe':
            return `<svg class="file-svg-icon file-color-exe" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="15" r="1"/><path d="M14 9l-4 6"/></svg>`;
        default:
            return `<svg class="file-svg-icon file-color-default" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`;
    }
}

window.getFileSvgIcon = getFileSvgIcon;

function getFileTypeInfo(filename, isDir) {
    if (isDir) {
        return {
            type: 'folder',
            colorClass: 'file-color-folder',
            icon: '📁',
            getSvg: (size = 18) => getFileSvgIcon('folder', size)
        };
    }
    const ext = (filename || '').split('.').pop().toLowerCase();
    
    // Video
    if (['mp4', 'mkv', 'mov', 'avi', 'webm', 'flv', 'ts', 'm4v', 'wmv', '3gp'].includes(ext)) {
        return { type: 'video', colorClass: 'file-color-video', icon: '🎬', ext, getSvg: (size = 18) => getFileSvgIcon('video', size) };
    }
    // Audio
    if (['mp3', 'flac', 'wav', 'ogg', 'aac', 'm4a', 'opus', 'wma', 'alac'].includes(ext)) {
        return { type: 'audio', colorClass: 'file-color-audio', icon: '🎵', ext, getSvg: (size = 18) => getFileSvgIcon('audio', size) };
    }
    // Image
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'heic'].includes(ext)) {
        return { type: 'image', colorClass: 'file-color-image', icon: '🖼️', ext, getSvg: (size = 18) => getFileSvgIcon('image', size) };
    }
    // Document
    if (['txt', 'md', 'doc', 'docx', 'pdf', 'xls', 'xlsx', 'ppt', 'pptx', 'rtf', 'csv', 'odt', 'ods', 'lottie'].includes(ext)) {
        return { type: 'doc', colorClass: 'file-color-doc', icon: '📄', ext, getSvg: (size = 18) => getFileSvgIcon('doc', size) };
    }
    // Archive
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'tgz'].includes(ext)) {
        return { type: 'archive', colorClass: 'file-color-archive', icon: '📦', ext, getSvg: (size = 18) => getFileSvgIcon('archive', size) };
    }
    // Code
    if (['js', 'ts', 'py', 'json', 'html', 'css', 'c', 'cpp', 'h', 'hpp', 'go', 'rs', 'php', 'rb', 'sql', 'sh', 'yaml', 'yml', 'xml', 'scss', 'less', 'java', 'cs'].includes(ext)) {
        return { type: 'code', colorClass: 'file-color-code', icon: '💻', ext, getSvg: (size = 18) => getFileSvgIcon('code', size) };
    }
    // Executable / Binary
    if (['exe', 'msi', 'bat', 'cmd', 'ps1', 'apk', 'dmg', 'deb', 'rpm', 'bin', 'dll'].includes(ext)) {
        return { type: 'exe', colorClass: 'file-color-exe', icon: '⚙️', ext, getSvg: (size = 18) => getFileSvgIcon('exe', size) };
    }

    return { type: 'default', colorClass: 'file-color-default', icon: '📄', ext, getSvg: (size = 18) => getFileSvgIcon('default', size) };
}

window.getFileTypeInfo = getFileTypeInfo;
window.getFileTypeClass = (filename, isDir) => getFileTypeInfo(filename, isDir).colorClass;

function renderTableList(items) {
    const tbody = document.getElementById('fileList');
    if (!tbody) return;

    if (!items || items.length === 0) {
        const emptyMsg = window.t('table.emptyFolder') || 'Папка пуста.';
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 32px;">${emptyMsg}</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(item => {
        const ext = item.name.split('.').pop().toLowerCase();
        const isChecked = selectedFileIds.has(item.id) ? 'checked' : '';
        const isFav = checkIsFavorite(item.is_favorite);
        const typeInfo = getFileTypeInfo(item.name, item.is_folder);

        return `
        <tr data-id="${item.id}">
            <td><input type="checkbox" class="hud-checkbox" value="${item.id}" ${isChecked} onchange="toggleSelectFile(${item.id})"></td>
            <td>
                <button class="fav-btn ${isFav ? 'active' : ''}" onclick="toggleFav(${item.id}, ${isFav ? 0 : 1})">
                    ${isFav ? '⭐' : '☆'}
                </button>
            </td>
            <td style="cursor: pointer;" onclick="handleItemClick(${item.id}, '${item.name.replace(/'/g, "\\'")}', '${ext}', ${item.is_folder})">
                <span class="file-icon-wrap ${typeInfo.colorClass}">${typeInfo.getSvg(18)}</span>
                <span class="file-name-text">${item.name}</span>
                ${!item.is_folder && ext ? `<span class="file-badge-ext ${typeInfo.colorClass}">${ext}</span>` : ''}
            </td>
            <td class="mono" style="color: var(--text-muted);">${item.is_folder ? '--' : formatBytes(item.size)}</td>
            <td class="mono" style="color: var(--text-muted);">${item.created_at || '--'}</td>
            <td class="action-cell" style="text-align: right;">
                ${!item.is_folder ? `<button onclick="handleItemClick(${item.id}, '${item.name.replace(/'/g, "\\'")}', '${ext}', false)" class="hud-btn" title="Открыть">👁</button>` : ''}
                ${!item.is_folder ? `<a href="/api/download/${item.id}" target="_blank" class="hud-btn primary" title="Скачать">💾</a>` : ''}
                <button onclick="deleteItem(${item.id}, ${item.is_folder})" class="hud-btn danger" title="В корзину">🗑</button>
            </td>
        </tr>
        `;
    }).join('');
}

function renderGridList(items) {
    const grid = document.getElementById('gridViewContainer');
    if (!grid) return;

    if (!items || items.length === 0) {
        const emptyMsg = window.t('table.emptyFolder') || 'Папка пуста';
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 32px;">${emptyMsg}</div>`;
        return;
    }

    const isLarge = currentViewMode === 'grid_large';
    const iconSize = isLarge ? 34 : 24;

    grid.innerHTML = items.map(item => {
        const ext = item.name.split('.').pop().toLowerCase();
        const isChecked = selectedFileIds.has(item.id) ? 'checked' : '';
        const isFav = checkIsFavorite(item.is_favorite);
        const typeInfo = getFileTypeInfo(item.name, item.is_folder);
        const isImage = !item.is_folder && typeInfo.type === 'image';

        const previewContent = isImage ? `
            <img class="grid-thumbnail-img" 
                 src="/api/stream/${item.id}" 
                 alt="${escapeHtml(item.name)}" 
                 loading="lazy" 
                 onload="this.classList.add('loaded')"
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
            <div class="grid-icon-box ${typeInfo.colorClass} grid-fallback-icon" style="display: none;">
                ${typeInfo.getSvg(iconSize)}
            </div>
        ` : `
            <div class="grid-icon-box ${typeInfo.colorClass}">
                ${typeInfo.getSvg(iconSize)}
            </div>
        `;

        return `
        <div class="grid-item ${isImage ? 'has-image-preview' : ''}" onclick="handleItemClick(${item.id}, '${item.name.replace(/'/g, "\\'")}', '${ext}', ${item.is_folder})">
            <input type="checkbox" class="grid-checkbox hud-checkbox" value="${item.id}" ${isChecked} onclick="event.stopPropagation(); toggleSelectFile(${item.id})">
            <button class="fav-btn ${isFav ? 'active' : ''} grid-fav-btn" onclick="event.stopPropagation(); toggleFav(${item.id}, ${isFav ? 0 : 1})">${isFav ? '⭐' : '☆'}</button>
            <div class="grid-preview-box">
                ${previewContent}
                ${!item.is_folder && ext ? `<span class="file-badge-ext ${typeInfo.colorClass} grid-badge-overlay">${ext}</span>` : ''}
            </div>
            <div class="grid-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
        </div>
        `;
    }).join('');
}

function handleItemClick(id, name, ext, isFolder) {
    if (isFolder) {
        currentFolderId = id;
        loadFiles();
        return;
    }

    // Clean up any existing dynamic plugin modals before opening new viewer/editor
    document.querySelectorAll('.plugin-dynamic-modal').forEach(m => m.remove());

    const intercepted = window.CrowAPI.emit('onFileClick', id, name, ext);
    if (!intercepted) {
        previewFile(id, name, ext);
    }
}
window.handleItemClick = handleItemClick;
window.handleFileClick = function(id, name, ext) {
    handleItemClick(id, name, ext, false);
};

async function loadPlugins() {
    try {
        const res = await fetch('/api/plugins');
        if (res.ok) {
            const plugins = await res.json();
            const list = document.getElementById('pluginManagerList');
            if (list) list.innerHTML = '';

            for (let p of plugins) {
                const scriptName = p.file || p;
                const script = document.createElement('script');
                script.src = '/static/plugins/' + scriptName;
                document.head.appendChild(script);

                if (list) {
                    list.innerHTML += `<div style="padding: 8px; background: rgba(255,255,255,0.03); border-radius: 6px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
                        <span>🧩 ${scriptName}</span>
                        <button class="hud-btn danger" style="padding:2px 6px; font-size:10px;" onclick="deletePluginFile('${scriptName}')">🗑 Удалить</button>
                    </div>`;
                }
            }
        }
    } catch (e) {}
}

async function deletePluginFile(pluginName) {
    if (!confirm(`Удалить плагин ${pluginName}?`)) return;
    await fetch(`/api/plugins/${pluginName}`, { method: 'DELETE' });
    loadPlugins();
}

async function readAllDirectoryEntries(dirReader) {
    const allEntries = [];
    let batch;
    do {
        batch = await new Promise((resolve) => {
            dirReader.readEntries(
                (entries) => resolve(entries || []),
                (err) => {
                    console.warn('readEntries error:', err);
                    resolve([]);
                }
            );
        });
        if (batch && batch.length > 0) {
            allEntries.push(...batch);
        }
    } while (batch && batch.length > 0);
    return allEntries;
}

async function scanFileSystemEntry(entry, relativePath = '') {
    if (!entry) return [];

    if (entry.isFile) {
        return new Promise((resolve) => {
            entry.file(
                (file) => {
                    if (file) {
                        file.fullRelativePath = relativePath + file.name;
                        resolve([file]);
                    } else {
                        resolve([]);
                    }
                },
                (err) => {
                    console.warn('entry.file error:', err);
                    resolve([]);
                }
            );
        });
    } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const entries = await readAllDirectoryEntries(dirReader);
        const nextPath = relativePath + entry.name + '/';
        const nestedArrays = await Promise.all(
            entries.map(child => scanFileSystemEntry(child, nextPath))
        );
        return nestedArrays.flat();
    }
    return [];
}

async function handleDroppedItems(dataTransfer) {
    if (!dataTransfer) return;

    const dropZone = document.getElementById('dropZone');
    const dropText = dropZone ? dropZone.querySelector('p') : null;
    const originalText = dropText ? dropText.textContent : '';
    if (dropText) {
        dropText.textContent = window.t ? (window.t('upload.scanning') || '🔍 Сканирование файлов и папок...') : '🔍 Сканирование файлов и папок...';
    }

    try {
        let extractedFiles = [];

        // 1. Try modern DataTransferItemList with FileSystem API (webkitGetAsEntry)
        if (dataTransfer.items && dataTransfer.items.length) {
            const scanPromises = [];
            for (let i = 0; i < dataTransfer.items.length; i++) {
                const item = dataTransfer.items[i];
                if (item.kind === 'file') {
                    const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
                    if (entry) {
                        scanPromises.push(scanFileSystemEntry(entry, ''));
                    } else {
                        const file = item.getAsFile ? item.getAsFile() : null;
                        if (file) {
                            file.fullRelativePath = file.name;
                            scanPromises.push(Promise.resolve([file]));
                        }
                    }
                }
            }
            if (scanPromises.length) {
                const results = await Promise.all(scanPromises);
                extractedFiles = results.flat();
            }
        }

        // 2. Fallback to dataTransfer.files if items scanning returned nothing
        if (!extractedFiles.length && dataTransfer.files && dataTransfer.files.length) {
            for (let i = 0; i < dataTransfer.files.length; i++) {
                const file = dataTransfer.files[i];
                if (file.size > 0 || (file.type !== '' && file.type !== 'application/x-directory')) {
                    file.fullRelativePath = file.webkitRelativePath || file.name;
                    extractedFiles.push(file);
                }
            }
        }

        if (extractedFiles.length > 0) {
            uploadFiles(extractedFiles);
        }
    } catch (err) {
        console.error('Error during drag and drop scanning:', err);
        if (dataTransfer.files && dataTransfer.files.length) {
            uploadFiles(dataTransfer.files);
        }
    } finally {
        if (dropText) {
            dropText.textContent = originalText;
        }
    }
}

function setupDragAndDrop() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    if (!dropZone) return;

    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
        if (!e.target.closest('#dropZone') && !e.target.closest('#pluginDropZone')) {
            e.preventDefault();
        }
    });

    dropZone.addEventListener('click', () => fileInput?.click());
    dropZone.addEventListener('dragover', (e) => { 
        e.preventDefault(); 
        dropZone.classList.add('dragover'); 
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        await handleDroppedItems(e.dataTransfer);
    });

    fileInput?.addEventListener('change', () => {
        if (fileInput.files && fileInput.files.length) {
            const files = Array.from(fileInput.files);
            files.forEach(f => {
                if (f.webkitRelativePath) f.fullRelativePath = f.webkitRelativePath;
            });
            uploadFiles(files);
            fileInput.value = '';
        }
    });
}

function initUploadQueueEvents() {
    const queueToggleBtn = document.getElementById('queueToggleBtn');
    const queueClearBtn = document.getElementById('queueClearBtn');
    const queueBody = document.getElementById('queueBody');

    if (queueToggleBtn && queueBody) {
        queueToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isCollapsed = queueBody.classList.toggle('collapsed');
            queueToggleBtn.textContent = isCollapsed ? '+' : '−';
            queueToggleBtn.title = isCollapsed ? 'Развернуть' : 'Свернуть';
        });
    }

    if (queueClearBtn) {
        queueClearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            clearCompletedUploads();
        });
    }
}

function clearCompletedUploads() {
    const toRemove = uploadQueue.filter(t => t.status === 'done' || t.status === 'error' || t.status === 'cancelled');
    toRemove.forEach(task => {
        if (task.pollTimer) {
            clearInterval(task.pollTimer);
            task.pollTimer = null;
        }
        const el = document.getElementById('task_' + task.id);
        if (el) el.remove();
    });
    uploadQueue = uploadQueue.filter(t => t.status !== 'done' && t.status !== 'error' && t.status !== 'cancelled');
    updateQueueHeader();

    if (uploadQueue.length === 0) {
        const widget = document.getElementById('queueWidget');
        if (widget) widget.style.display = 'none';
    }
}

function updateQueueHeader() {
    const total = uploadQueue.length;
    const done = uploadQueue.filter(t => t.status === 'done').length;
    const counter = document.getElementById('queueProgressCount');
    if (counter) {
        counter.textContent = `${done}/${total}`;
    }
}

function enqueueUploadTask(file) {
    const taskId = 'up_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const relPath = file.fullRelativePath || file.webkitRelativePath || '';
    const displayName = relPath || file.name;
    const task = {
        id: taskId,
        file: file,
        name: displayName,
        rawName: file.name,
        fullRelativePath: relPath,
        size: file.size,
        parentId: currentFolderId,
        driveId: currentDriveId,
        status: 'queued', // 'queued' | 'buffering' | 'uploading_to_tg' | 'done' | 'error'
        progress: 0,
        loaded: 0,
        total: file.size,
        totalChunks: 1,
        currentChunk: 1,
        completedChunks: 0,
        uploadedBytes: 0,
        speedText: '',
        serverTaskId: null,
        pollTimer: null,
        startTime: null,
        error: null,
        xhr: null
    };

    uploadQueue.push(task);

    const widget = document.getElementById('queueWidget');
    const queueBody = document.getElementById('queueBody');
    const queueToggleBtn = document.getElementById('queueToggleBtn');

    if (widget) {
        widget.style.display = 'block';
    }
    if (queueBody && queueBody.classList.contains('collapsed')) {
        queueBody.classList.remove('collapsed');
        if (queueToggleBtn) queueToggleBtn.textContent = '−';
    }

    renderQueueItem(task);
    updateQueueHeader();
    processUploadQueue();
}

function formatProgressInfo(task) {
    let statusText = 'В очереди';
    let statusClass = 'queued';
    let metaLeft = `${formatBytes(task.uploadedBytes || task.loaded || 0)} / ${formatBytes(task.size)}`;
    let metaRight = 'В очереди';
    let percent = task.progress || 0;

    if (task.status === 'paused') {
        statusText = 'Пауза ⏸';
        statusClass = 'paused';
        metaLeft = `${formatBytes(task.uploadedBytes || task.loaded || 0)} / ${formatBytes(task.size)}`;
        metaRight = 'Приостановлено';
    } else if (task.status === 'buffering') {
        statusText = `Буферизация (${percent}%)`;
        statusClass = 'uploading';
        metaLeft = `${formatBytes(task.loaded || 0)} / ${formatBytes(task.size)}`;
        metaRight = task.speedText ? `⚡ ${task.speedText} • Приём на сервер` : 'Передача на сервер...';
    } else if (task.status === 'uploading_to_tg' || task.status === 'processing') {
        const cChunk = task.currentChunk || 1;
        const tChunks = task.totalChunks || 1;
        statusText = `Чанк ${cChunk}/${tChunks} (${percent}%)`;
        statusClass = 'uploading';
        metaLeft = `Чанк ${cChunk} из ${tChunks} • ${formatBytes(task.uploadedBytes || 0)} / ${formatBytes(task.size)}`;
        metaRight = `⚡ ${task.speedText || 'Загрузка...'} • В Telegram`;
    } else if (task.status === 'done') {
        const tChunks = task.totalChunks || 1;
        statusText = 'Готово ✓';
        statusClass = 'done';
        percent = 100;
        metaLeft = `Все ${tChunks} чанка(ов) • ${formatBytes(task.size)}`;
        metaRight = '✓ Загружено в Telegram';
    } else if (task.status === 'error') {
        statusText = 'Ошибка ✖';
        statusClass = 'error';
        percent = 100;
        metaLeft = `${formatBytes(task.size)}`;
        metaRight = `✖ ${task.error || 'Ошибка загрузки'}`;
    } else if (task.status === 'cancelled') {
        statusText = 'Отменено';
        statusClass = 'error';
        percent = 0;
        metaLeft = `${formatBytes(task.size)}`;
        metaRight = 'Отменено пользователем';
    }

    return { statusText, statusClass, metaLeft, metaRight, percent };
}

function renderQueueItem(task) {
    const queueBody = document.getElementById('queueBody');
    if (!queueBody) return;

    let itemEl = document.getElementById('task_' + task.id);
    if (!itemEl) {
        itemEl = document.createElement('div');
        itemEl.id = 'task_' + task.id;
        itemEl.className = 'queue-item';
        queueBody.appendChild(itemEl);
    }

    const { statusText, statusClass, metaLeft, metaRight, percent } = formatProgressInfo(task);
    const showPause = task.status !== 'done' && task.status !== 'error' && task.status !== 'cancelled';
    const pauseIcon = task.status === 'paused' ? '▶' : '⏸';
    const pauseTitle = task.status === 'paused' ? 'Возобновить' : 'Пауза';

    itemEl.innerHTML = `
        <div class="queue-item-header">
            <span class="queue-item-name" title="${escapeHtml(task.name)}">${escapeHtml(task.name)}</span>
            <div class="queue-item-actions">
                <span class="queue-item-status ${statusClass}">${statusText}</span>
                <button class="queue-action-btn queue-pause-btn" title="${pauseTitle}" style="display: ${showPause ? 'inline-flex' : 'none'};">
                    ${pauseIcon}
                </button>
                <button class="queue-action-btn queue-cancel-btn" title="Отменить / Удалить">
                    ✕
                </button>
            </div>
        </div>
        <div class="progress-bar-bg">
            <div class="progress-bar-fill ${statusClass === 'done' ? 'done' : (statusClass === 'error' ? 'error' : (statusClass === 'paused' ? 'paused' : ''))}" style="width: ${percent}%;"></div>
        </div>
        <div class="queue-item-meta">
            <span class="meta-left">${metaLeft}</span>
            <span class="meta-right">${metaRight}</span>
        </div>
    `;

    const pauseBtn = itemEl.querySelector('.queue-pause-btn');
    if (pauseBtn) {
        pauseBtn.onclick = (e) => {
            e.stopPropagation();
            togglePauseUploadTask(task.id);
        };
    }

    const cancelBtn = itemEl.querySelector('.queue-cancel-btn');
    if (cancelBtn) {
        cancelBtn.onclick = (e) => {
            e.stopPropagation();
            cancelUploadTask(task.id);
        };
    }

    queueBody.scrollTop = queueBody.scrollHeight;
}

function updateQueueItemDOM(task) {
    const itemEl = document.getElementById('task_' + task.id);
    if (!itemEl) {
        renderQueueItem(task);
        return;
    }

    const { statusText, statusClass, metaLeft, metaRight, percent } = formatProgressInfo(task);

    const statusBadge = itemEl.querySelector('.queue-item-status');
    if (statusBadge) {
        statusBadge.className = `queue-item-status ${statusClass}`;
        statusBadge.textContent = statusText;
    }

    const pauseBtn = itemEl.querySelector('.queue-pause-btn');
    if (pauseBtn) {
        const showPause = task.status !== 'done' && task.status !== 'error' && task.status !== 'cancelled';
        pauseBtn.style.display = showPause ? 'inline-flex' : 'none';
        pauseBtn.textContent = task.status === 'paused' ? '▶' : '⏸';
        pauseBtn.title = task.status === 'paused' ? 'Возобновить' : 'Пауза';
    }

    const leftSpan = itemEl.querySelector('.meta-left');
    if (leftSpan) leftSpan.textContent = metaLeft;

    const rightSpan = itemEl.querySelector('.meta-right');
    if (rightSpan) rightSpan.textContent = metaRight;

    const fillBar = itemEl.querySelector('.progress-bar-fill');
    if (fillBar) {
        fillBar.style.width = `${percent}%`;
        fillBar.className = `progress-bar-fill ${statusClass === 'done' ? 'done' : (statusClass === 'error' ? 'error' : (statusClass === 'paused' ? 'paused' : ''))}`;
    }
}

function togglePauseUploadTask(taskId) {
    const task = uploadQueue.find(t => t.id === taskId);
    if (!task) return;

    if (task.status === 'paused') {
        if (task.serverTaskId) {
            fetch(`/api/upload/resume/${task.serverTaskId}`, { method: 'POST' }).catch(() => {});
            task.status = 'uploading_to_tg';
        } else {
            task.status = 'queued';
        }
        updateQueueItemDOM(task);
        processUploadQueue();
    } else if (task.status === 'uploading_to_tg' || task.status === 'processing') {
        task.status = 'paused';
        if (task.serverTaskId) {
            fetch(`/api/upload/pause/${task.serverTaskId}`, { method: 'POST' }).catch(() => {});
        }
        updateQueueItemDOM(task);
        processUploadQueue();
    } else if (task.status === 'queued' || task.status === 'buffering') {
        task.status = 'paused';
        updateQueueItemDOM(task);
    }
}

function cancelUploadTask(taskId) {
    const taskIndex = uploadQueue.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;
    const task = uploadQueue[taskIndex];

    if (task.xhr) {
        try { task.xhr.abort(); } catch (e) {}
        task.xhr = null;
    }
    if (task.pollTimer) {
        clearInterval(task.pollTimer);
        task.pollTimer = null;
    }
    if (task.serverTaskId) {
        fetch(`/api/upload/cancel/${task.serverTaskId}`, { method: 'POST' }).catch(() => {});
    }

    const itemEl = document.getElementById('task_' + task.id);
    if (itemEl) itemEl.remove();

    uploadQueue.splice(taskIndex, 1);
    updateQueueHeader();

    if (uploadQueue.length === 0) {
        const widget = document.getElementById('queueWidget');
        if (widget) widget.style.display = 'none';
    }

    processUploadQueue();
}

function processUploadQueue() {
    const running = uploadQueue.filter(t => t.status === 'buffering' || t.status === 'uploading_to_tg' || t.status === 'processing').length;
    if (running >= maxConcurrentUploads) return;

    const availableSlots = maxConcurrentUploads - running;
    const queuedTasks = uploadQueue.filter(t => t.status === 'queued').slice(0, availableSlots);

    queuedTasks.forEach(task => {
        startUploadTask(task);
    });
}

function startUploadTask(task) {
    task.status = 'buffering';
    task.startTime = Date.now();
    task.lastTime = Date.now();
    task.lastLoaded = 0;
    updateQueueItemDOM(task);
    updateQueueHeader();

    const xhr = new XMLHttpRequest();
    task.xhr = xhr;

    const fd = new FormData();
    fd.append('file', task.file);
    fd.append('drive_id', task.driveId);
    fd.append('parent_id', task.parentId);
    if (task.fullRelativePath) {
        fd.append('relative_path', task.fullRelativePath);
    }

    xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && task.status === 'buffering') {
            const percent = Math.min(99, Math.round((e.loaded / e.total) * 100));
            task.progress = percent;
            task.loaded = e.loaded;
            task.total = e.total;

            const now = Date.now();
            const elapsed = (now - (task.startTime || now)) / 1000;
            if (elapsed > 0.3) {
                const speedBytes = e.loaded / elapsed;
                task.speedText = formatBytes(speedBytes) + '/s';
            }

            updateQueueItemDOM(task);
        }
    };

    xhr.onload = () => {
        if (task.status === 'cancelled') return;

        if (xhr.status >= 200 && xhr.status < 300) {
            try {
                const res = JSON.parse(xhr.responseText);
                if (res.task_id) {
                    task.serverTaskId = res.task_id;
                    task.totalChunks = res.total_chunks || 1;
                    task.currentChunk = 1;
                    task.completedChunks = 0;
                    task.status = task.status === 'paused' ? 'paused' : 'uploading_to_tg';
                    task.progress = 0;
                    task.speedText = '';
                    updateQueueItemDOM(task);

                    // Start live polling of Telegram chunk uploads
                    task.pollTimer = setInterval(async () => {
                        try {
                            if (task.status === 'cancelled') return;
                            const pollRes = await fetch(`/api/upload/status/${task.serverTaskId}`);
                            if (!pollRes.ok) return;
                            const data = await pollRes.json();

                            if (data.status === 'paused' && task.status !== 'paused') {
                                task.status = 'paused';
                                updateQueueItemDOM(task);
                                return;
                            }

                            task.totalChunks = data.total_chunks || task.totalChunks || 1;
                            task.currentChunk = data.current_chunk || 1;
                            task.completedChunks = data.completed_chunks || 0;
                            task.uploadedBytes = data.uploaded_bytes || 0;
                            task.progress = data.percent || 0;
                            task.speedText = data.speed_text || (data.speed_mbps ? `${data.speed_mbps} MB/s` : '');

                            if (data.status === 'done') {
                                if (task.pollTimer) {
                                    clearInterval(task.pollTimer);
                                    task.pollTimer = null;
                                }
                                task.status = 'done';
                                task.progress = 100;
                                task.uploadedBytes = task.size;
                                updateQueueItemDOM(task);
                                updateQueueHeader();
                                processUploadQueue();
                                loadFiles();
                            } else if (data.status === 'error' || data.status === 'cancelled') {
                                if (task.pollTimer) {
                                    clearInterval(task.pollTimer);
                                    task.pollTimer = null;
                                }
                                task.status = data.status === 'cancelled' ? 'cancelled' : 'error';
                                task.error = data.error || (data.status === 'cancelled' ? 'Отменено' : 'Ошибка загрузки в Telegram');
                                updateQueueItemDOM(task);
                                updateQueueHeader();
                                processUploadQueue();
                            } else if (task.status !== 'paused') {
                                task.status = 'uploading_to_tg';
                                updateQueueItemDOM(task);
                            }
                        } catch (pollErr) {
                            console.warn("Upload poll error:", pollErr);
                        }
                    }, 350);

                    return;
                }
            } catch (e) {
                console.warn("Parse response error", e);
            }

            task.status = 'done';
            task.progress = 100;
            task.loaded = task.total;
            task.speedText = '';
            updateQueueItemDOM(task);
            updateQueueHeader();
            processUploadQueue();
            loadFiles();
        } else {
            task.status = 'error';
            try {
                const errRes = JSON.parse(xhr.responseText);
                task.error = errRes.detail || 'Ошибка сервера';
            } catch (e) {
                task.error = `Ошибка (${xhr.status})`;
            }
            updateQueueItemDOM(task);
            updateQueueHeader();
            processUploadQueue();
        }
    };

    xhr.onerror = () => {
        if (task.status === 'cancelled') return;
        task.status = 'error';
        task.error = 'Ошибка сети';
        updateQueueItemDOM(task);
        updateQueueHeader();
        processUploadQueue();
    };

    xhr.open('POST', '/api/upload');
    xhr.send(fd);
}

function uploadFiles(files) {
    if (!files || !files.length) return;
    for (let i = 0; i < files.length; i++) {
        enqueueUploadTask(files[i]);
    }
}

function toggleSelectFile(id) {
    if (selectedFileIds.has(id)) selectedFileIds.delete(id);
    else selectedFileIds.add(id);
    updateBatchPanel();
}

function updateBatchPanel() {
    const container = document.getElementById('batchPanelContainer');
    const countLabel = document.getElementById('batchCount');
    if (!container) return;

    if (selectedFileIds.size > 0) {
        container.style.display = 'block';
        if (countLabel) {
            const count = selectedFileIds.size;
            countLabel.textContent = window.t('batch.selected', { count }) || `Выбрано: ${count}`;
        }
    } else {
        container.style.display = 'none';
    }
}

async function createFolderPrompt() {
    const defaultText = window.t('commander.promptNewFolder') || 'Название новой папки:';
    const folderName = prompt(defaultText);
    if (!folderName || !folderName.trim()) return;

    const fd = new FormData();
    fd.append('name', folderName.trim());
    fd.append('parent_id', currentFolderId || 0);
    fd.append('drive_id', currentDriveId || 1);

    try {
        const res = await fetch('/api/folders', { method: 'POST', body: fd });
        if (res.ok) {
            await loadFiles();
        } else {
            const data = await res.json().catch(() => ({}));
            alert(data.detail || 'Ошибка создания папки');
        }
    } catch (err) {
        alert('Ошибка сети: ' + err.message);
    }
}
window.createFolderPrompt = createFolderPrompt;

function bindToolbarEvents() {
    document.getElementById('createFolderBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        createFolderPrompt();
    });

    document.getElementById('emptyTrashBtn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!confirm('Вы уверены, что хотите навсегда очистить корзину?')) return;
        try {
            const res = await fetch('/api/trash/empty', { method: 'POST' });
            if (res.ok) {
                await loadFiles();
            } else {
                alert('Ошибка при очистке корзины');
            }
        } catch (err) {
            alert('Ошибка сети: ' + err.message);
        }
    });

    // Restore saved sort setting
    const savedSort = localStorage.getItem('crowgram_sort_val');
    const sortSelect = document.getElementById('sortSelect');
    if (savedSort && sortSelect) {
        sortSelect.value = savedSort;
    }

    document.getElementById('searchInput')?.addEventListener('input', () => {
        applyFilterAndSort();
    });

    document.getElementById('sortSelect')?.addEventListener('change', (e) => {
        localStorage.setItem('crowgram_sort_val', e.target.value);
        applyFilterAndSort();
    });

    // Interactive Table Header Clicks
    document.getElementById('thName')?.addEventListener('click', () => {
        const cur = document.getElementById('sortSelect')?.value || 'date_desc';
        const next = cur === 'name_asc' ? 'name_desc' : 'name_asc';
        setSortValue(next);
    });

    document.getElementById('thSize')?.addEventListener('click', () => {
        const cur = document.getElementById('sortSelect')?.value || 'date_desc';
        const next = cur === 'size_desc' ? 'size_asc' : 'size_desc';
        setSortValue(next);
    });

    document.getElementById('thDate')?.addEventListener('click', () => {
        const cur = document.getElementById('sortSelect')?.value || 'date_desc';
        const next = cur === 'date_desc' ? 'date_asc' : 'date_desc';
        setSortValue(next);
    });

    document.getElementById('viewSwitcher')?.addEventListener('change', (e) => {
        currentViewMode = e.target.value;
        applyFilterAndSort();
    });

    document.getElementById('pasteBtn')?.addEventListener('click', async () => {
        if (!clipboardItems || !clipboardItems.ids || clipboardItems.ids.length === 0) return;
        for (const id of clipboardItems.ids) {
            const fd = new FormData();
            fd.append('new_parent_id', currentFolderId || 0);
            fd.append('new_drive_id', currentDriveId || 1);
            try {
                await fetch(`/api/files/${id}/move`, { method: 'POST', body: fd });
            } catch (err) {
                console.error(err);
            }
        }
        clipboardItems = null;
        const pasteBtn = document.getElementById('pasteBtn');
        if (pasteBtn) pasteBtn.style.display = 'none';
        await loadFiles();
    });
}

function bindBatchEvents() {
    document.getElementById('selectAllCheckbox')?.addEventListener('change', (e) => {
        const checked = e.target.checked;
        selectedFileIds.clear();
        if (checked) {
            (window.currentFolderFiles || allItems).forEach(item => selectedFileIds.add(item.id));
        }
        applyFilterAndSort();
        updateBatchPanel();
    });

    document.getElementById('downloadFilesBtn')?.addEventListener('click', () => {
        selectedFileIds.forEach(id => {
            const f = allItems.find(i => i.id === id);
            if (f && !f.is_folder) {
                window.open('/api/download/' + id, '_blank');
            }
        });
    });

    document.getElementById('downloadZipBtn')?.addEventListener('click', () => {
        const ids = Array.from(selectedFileIds).join(',');
        window.open(`/api/download-zip?ids=${ids}`, '_blank');
    });

    document.getElementById('moveBatchBtn')?.addEventListener('click', () => {
        if (selectedFileIds.size === 0) return;
        clipboardItems = { action: 'move', ids: Array.from(selectedFileIds) };
        const pasteBtn = document.getElementById('pasteBtn');
        if (pasteBtn) pasteBtn.style.display = 'inline-flex';
        selectedFileIds.clear();
        updateBatchPanel();
        applyFilterAndSort();
    });

    document.getElementById('deleteBatchBtn')?.addEventListener('click', async () => {
        const fd = new FormData();
        selectedFileIds.forEach(id => fd.append('ids', id));
        await fetch('/api/files/batch-trash', { method: 'POST', body: fd });
        loadFiles();
    });
}

function renderBreadcrumbs() {
    const bcContainer = document.getElementById('breadcrumbs');
    if (!bcContainer) return;

    if (isTrashView) {
        const trashLabel = window.t('sidebar.trash') || 'Корзина';
        bcContainer.innerHTML = `<span class="crumb crumb-active">🗑 ${trashLabel}</span>`;
        return;
    }

    let path = []; let curr = currentFolderId;
    while (curr !== 0) {
        const folder = allItems.find(i => i.id === curr);
        if (folder) { path.unshift(folder); curr = folder.parent_id; } else break;
    }

    const rootLabel = window.t('table.rootBreadcrumb') || 'Корень';
    let html = `<span class="crumb" onclick="navigateTo(0)">🏠 ${rootLabel}</span>`;
    path.forEach(f => {
        html += `<span class="crumb-separator">/</span>`;
        html += `<span class="crumb ${f.id === currentFolderId ? 'crumb-active' : ''}" onclick="navigateTo(${f.id})">${f.name}</span>`;
    });
    bcContainer.innerHTML = html;
}

function navigateTo(folderId) {
    currentFolderId = folderId;
    loadFiles();
    if (window.CrowAPI && typeof window.CrowAPI.emit === 'function') {
        window.CrowAPI.emit('onFolderChange', currentFolderId, currentDriveId);
    }
}

function selectDrive(driveId) {
    currentDriveId = driveId;
    currentFolderId = 0;
    isTrashView = false;
    loadDrives();
    loadFiles();
    if (window.CrowAPI && typeof window.CrowAPI.emit === 'function') {
        window.CrowAPI.emit('onFolderChange', currentFolderId, currentDriveId);
    }
}

function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function toggleFav(id, state) {
    const fd = new FormData();
    fd.append('state', state);
    await fetch(`/api/files/${id}/favorite`, { method: 'POST', body: fd });
    loadFiles();
}

async function deleteItem(id, isFolder = false) {
    await fetch(`/api/files/${id}/trash?is_folder=${isFolder}`, { method: 'POST' });
    loadFiles();
}

function previewFile(id, name, ext) {
    const modal = document.getElementById('previewModal');
    const content = document.getElementById('previewContent');
    const title = document.getElementById('previewTitle');

    if (!modal || !content) return;

    if (title) title.textContent = name;
    content.innerHTML = '<div style="color:var(--text-muted); font-size:13px; font-family:monospace; padding:30px;">⏳ Загрузка файла...</div>';
    modal.style.display = 'flex';

    const lowerExt = (ext || '').toLowerCase();
    const videoExts = ['mp4', 'webm', 'mkv', 'mov', 'avi', 'wmv', 'flv', 'm4v', 'ts'];
    const audioExts = ['mp3', 'flac', 'ogg', 'wav', 'm4a', 'aac', 'wma', 'opus'];
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];

    if (videoExts.includes(lowerExt)) {
        content.innerHTML = `<video src="/api/stream/${id}" controls autoplay style="max-width:100%; max-height:70vh; border-radius:6px; outline:none; background:#000;"></video>`;
    } else if (audioExts.includes(lowerExt)) {
        content.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; gap:16px; padding:30px; width:100%;">
                <span style="font-size:48px;">🎵</span>
                <b style="font-size:14px; color:var(--text-primary);">${escapeHtml(name)}</b>
                <audio src="/api/stream/${id}" controls autoplay style="width:100%; max-width:500px;"></audio>
            </div>
        `;
    } else if (imageExts.includes(lowerExt)) {
        content.innerHTML = `<img src="/api/download/${id}" alt="${escapeHtml(name)}" style="max-width:100%; max-height:70vh; object-fit:contain; border-radius:6px;">`;
    } else {
        fetch('/api/download/' + id)
            .then(r => {
                if (!r.ok) throw new Error('Ошибка загрузки содержимого (' + r.status + ')');
                return r.text();
            })
            .then(txt => {
                content.innerHTML = `<pre style="padding:16px; background:rgba(0,0,0,0.5); border-radius:6px; max-height:60vh; overflow:auto; width:100%; box-sizing:border-box; color:#fff; font-family:monospace; font-size:12px; white-space:pre-wrap; text-align:left;">${escapeHtml(txt)}</pre>`;
            })
            .catch(err => {
                content.innerHTML = `<div style="color:var(--accent-red); padding:20px; font-family:monospace;">${escapeHtml(err.message)}</div>`;
            });
    }
}

function escapeHtml(str) {
    return String(str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function safeToggleModal(modalId, displayStyle) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    if (displayStyle === 'none') {
        modal.style.transition = 'opacity 0.12s var(--ease-in-expo, ease-in)';
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.style.display = 'none';
            modal.style.opacity = '';
            modal.style.transition = '';
        }, 120);
    } else {
        modal.style.display = displayStyle || 'flex';
        modal.style.opacity = '0';
        modal.style.transition = 'opacity 0.16s var(--ease-out-expo, ease-out)';
        requestAnimationFrame(() => {
            modal.style.opacity = '1';
        });
    }
}

function showTgAuthMsg(text, type = 'info') {
    const msgEl = document.getElementById('tgAuthMsg');
    if (!msgEl) return;
    msgEl.style.display = 'block';
    msgEl.textContent = text;
    if (type === 'error') {
        msgEl.style.background = 'var(--accent-red-subtle, rgba(239, 68, 68, 0.12))';
        msgEl.style.color = '#f87171';
        msgEl.style.border = '1px solid rgba(239, 68, 68, 0.3)';
    } else if (type === 'success') {
        msgEl.style.background = 'var(--accent-green-subtle, rgba(16, 185, 129, 0.12))';
        msgEl.style.color = '#6ee7b7';
        msgEl.style.border = '1px solid rgba(16, 185, 129, 0.3)';
    } else {
        msgEl.style.background = 'var(--accent-blue-subtle, rgba(56, 189, 248, 0.12))';
        msgEl.style.color = '#7dd3fc';
        msgEl.style.border = '1px solid rgba(56, 189, 248, 0.3)';
    }
}

function bindModalEvents() {
    document.getElementById('navSettingsBtn')?.addEventListener('click', (e) => {
        e.preventDefault(); 
        loadConfigSettings();
        safeToggleModal('settingsModal', 'flex');
    });
    document.getElementById('closeSettingsBtn')?.addEventListener('click', () => {
        safeToggleModal('settingsModal', 'none');
    });

    document.getElementById('systemStatus')?.addEventListener('click', () => {
        if (!window.isAuthorized) {
            loadConfigSettings();
            safeToggleModal('settingsModal', 'flex');
        }
    });

    document.getElementById('navPluginsBtn')?.addEventListener('click', (e) => {
        e.preventDefault(); safeToggleModal('pluginsModal', 'flex');
    });
    document.getElementById('closePluginsBtn')?.addEventListener('click', () => {
        safeToggleModal('pluginsModal', 'none');
    });

    document.getElementById('closePreviewBtn')?.addEventListener('click', () => {
        safeToggleModal('previewModal', 'none');
        const content = document.getElementById('previewContent');
        if (content) content.innerHTML = '';
    });

    // Close on overlay backdrop click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('mousedown', (e) => {
            if (e.target === overlay) {
                overlay.style.display = 'none';
            }
        });
    });

    document.getElementById('viewSwitcher')?.addEventListener('change', (e) => {
        currentViewMode = e.target.value; renderView(allItems);
    });

    // Обработчик сохранения настроек (API ID / Hash)
    document.getElementById('settingsForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const apiId = document.getElementById('apiIdInput').value.trim();
        const apiHash = document.getElementById('apiHashInput').value.trim();
        const chunkSize = document.getElementById('chunkSizeInput').value;
        const maxUploads = document.getElementById('maxConcurrentUploadsInput').value;

        const fd = new FormData();
        fd.append('api_id', apiId);
        fd.append('api_hash', apiHash);
        fd.append('chunk_size', chunkSize);
        fd.append('max_concurrent_uploads', maxUploads);

        showTgAuthMsg('Сохранение конфигурации...', 'info');
        try {
            const res = await fetch('/api/config', { method: 'POST', body: fd });
            if (res.ok) {
                showTgAuthMsg('Конфигурация успешно сохранена!', 'success');
                await loadConfigSettings();
            } else {
                showTgAuthMsg('Ошибка сохранения конфигурации', 'error');
            }
        } catch (err) {
            showTgAuthMsg('Ошибка сети: ' + err.message, 'error');
        }
    });

    // Отправка кода авторизации в Telegram
    document.getElementById('tgSendCodeBtn')?.addEventListener('click', async () => {
        const btn = document.getElementById('tgSendCodeBtn');
        const phone = document.getElementById('tgPhoneInput').value.trim();
        if (!phone) {
            showTgAuthMsg('Введите номер телефона (например +79801234567)', 'error');
            return;
        }
        if (btn) { btn.disabled = true; btn.textContent = 'ОТПРАВКА...'; }
        showTgAuthMsg('Отправка запроса на получение кода...', 'info');
        try {
            const res = await fetch('/api/auth/send-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: phone })
            });
            const data = await res.json();
            if (res.ok && data.status === 'code_sent') {
                window._tg_code_hash = data.phone_code_hash;
                window._tg_phone = phone;
                showTgAuthMsg('✓ Код успешно отправлен в Telegram!', 'success');
                const codeBlock = document.getElementById('tgAuthCodeBlock');
                if (codeBlock) codeBlock.style.display = 'block';
                const codeInput = document.getElementById('tgCodeInput');
                if (codeInput) codeInput.focus();
            } else {
                showTgAuthMsg('Ошибка: ' + (data.detail || 'Не удалось отправить код'), 'error');
            }
        } catch (err) {
            showTgAuthMsg('Ошибка соединения: ' + err.message, 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'ПОЛУЧИТЬ КОД'; }
        }
    });

    // Ввод кода подтверждения
    document.getElementById('tgSignInBtn')?.addEventListener('click', async () => {
        const btn = document.getElementById('tgSignInBtn');
        const code = document.getElementById('tgCodeInput').value.trim();
        const cleanCode = code.replace(/\s+/g, '').replace(/-/g, '');
        if (!cleanCode) {
            showTgAuthMsg('Введите код из Telegram', 'error');
            return;
        }
        if (btn) { btn.disabled = true; btn.textContent = 'ВХОД...'; }
        showTgAuthMsg('Проверка кода...', 'info');

        const phone = window._tg_phone || document.getElementById('tgPhoneInput').value.trim();
        const phoneCodeHash = window._tg_code_hash;

        try {
            const res = await fetch('/api/auth/verify_code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: phone,
                    code: cleanCode,
                    phone_code_hash: phoneCodeHash
                })
            });
            const data = await res.json();
            if (res.ok) {
                if (data.status === '2fa_required' || data.status === 'password_required' || data.status === 'password_needed') {
                    showTgAuthMsg('🔐 Требуется облачный пароль 2FA', 'info');
                    const passBlock = document.getElementById('tgAuthPasswordBlock');
                    if (passBlock) passBlock.style.display = 'block';
                    const passInput = document.getElementById('tg2faPasswordInput');
                    if (passInput) passInput.focus();
                } else {
                    showTgAuthMsg('✓ Авторизация успешно выполнена!', 'success');
                    await loadConfigSettings();
                    await loadFiles();
                }
            } else {
                showTgAuthMsg('Ошибка: ' + (data.detail || 'Введён неверный код подтверждения'), 'error');
            }
        } catch (err) {
            showTgAuthMsg('Ошибка: ' + err.message, 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'ВОЙТИ'; }
        }
    });

    // Ввод 2FA пароля
    const tgSubmit2faBtn = document.getElementById('tgSubmit2faBtn');
    const tg2faPasswordInput = document.getElementById('tg2faPasswordInput');

    const handleSettings2faSubmit = async () => {
        const password = tg2faPasswordInput ? tg2faPasswordInput.value : '';
        if (!password) {
            showTgAuthMsg('Введите 2FA пароль', 'error');
            return;
        }
        if (tgSubmit2faBtn) { tgSubmit2faBtn.disabled = true; tgSubmit2faBtn.textContent = 'ПРОВЕРКА...'; }
        showTgAuthMsg('Проверка пароля 2FA...', 'info');
        try {
            const res = await fetch('/api/auth/verify_password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: password })
            });
            const data = await res.json();
            if (res.ok) {
                showTgAuthMsg('✓ Авторизация успешно завершена!', 'success');
                await loadConfigSettings();
                await loadFiles();
            } else {
                showTgAuthMsg('Ошибка: ' + (data.detail || 'Неверный пароль 2FA'), 'error');
            }
        } catch (err) {
            showTgAuthMsg('Ошибка: ' + err.message, 'error');
        } finally {
            if (tgSubmit2faBtn) { tgSubmit2faBtn.disabled = false; tgSubmit2faBtn.textContent = 'ПОДТВЕРДИТЬ'; }
        }
    };

    tgSubmit2faBtn?.addEventListener('click', handleSettings2faSubmit);
    tg2faPasswordInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSettings2faSubmit();
        }
    });

    // Выход из Telegram
    document.getElementById('tgLogoutBtn')?.addEventListener('click', async () => {
        const btn = document.getElementById('tgLogoutBtn');
        if (!confirm('Выйти из Telegram аккаунта?')) return;
        if (btn) { btn.disabled = true; btn.textContent = 'ВЫХОД...'; }
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            showTgAuthMsg('Вы вышли из аккаунта', 'info');
            await loadConfigSettings();
        } catch (err) {
            showTgAuthMsg('Ошибка при выходе', 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '🚪 ВЫЙТИ ИЗ TELEGRAM'; }
        }
    });

    // Локальный импорт базы данных (JSON)
    const importBackupBtn = document.getElementById('importBackupBtn');
    const backupJsonInput = document.getElementById('backupJsonInput');

    importBackupBtn?.addEventListener('click', () => backupJsonInput?.click());
    backupJsonInput?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        showTgAuthMsg('⏳ Восстановление базы данных из файла...', 'info');
        if (importBackupBtn) { importBackupBtn.disabled = true; importBackupBtn.textContent = '⏳ ИМПОРТ...'; }

        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await fetch('/api/backup/import', { method: 'POST', body: fd });
            const data = await res.json();
            if (res.ok) {
                showTgAuthMsg('✓ ' + (data.message || 'База данных успешно восстановлена!'), 'success');
                await loadDrives();
                await loadFiles();
            } else {
                showTgAuthMsg('Ошибка: ' + (data.detail || 'Не удалось импортировать файл'), 'error');
            }
        } catch (err) {
            showTgAuthMsg('Ошибка: ' + err.message, 'error');
        } finally {
            if (importBackupBtn) { importBackupBtn.disabled = false; importBackupBtn.textContent = '📤 Восстановить из файла'; }
            if (backupJsonInput) backupJsonInput.value = '';
        }
    });

    // Облачная синхронизация Telegram (Pull / Push)
    document.getElementById('pullSyncBtn')?.addEventListener('click', async () => {
        const btn = document.getElementById('pullSyncBtn');
        if (btn) { btn.disabled = true; btn.textContent = '⏳ ЗАГРУЗКА...'; }
        showTgAuthMsg('Загрузка структуры из Telegram...', 'info');
        try {
            const res = await fetch('/api/sync/pull', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                showTgAuthMsg('✓ ' + (data.message || 'Синхронизация успешно выполнена!'), 'success');
                await loadDrives();
                await loadFiles();
            } else {
                showTgAuthMsg('Ошибка: ' + (data.detail || data.message || 'Ошибка синхронизации'), 'error');
            }
        } catch (err) {
            showTgAuthMsg('Ошибка: ' + err.message, 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '📥 Скачать из Telegram'; }
        }
    });

    document.getElementById('pushSyncBtn')?.addEventListener('click', async () => {
        const btn = document.getElementById('pushSyncBtn');
        if (btn) { btn.disabled = true; btn.textContent = '⏳ СОХРАНЕНИЕ...'; }
        showTgAuthMsg('Сохранение структуры в Saved Messages...', 'info');
        try {
            const res = await fetch('/api/sync/push', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                showTgAuthMsg('✓ ' + (data.message || 'Структура успешно сохранена в Telegram!'), 'success');
            } else {
                showTgAuthMsg('Ошибка: ' + (data.detail || data.message || 'Ошибка сохранения'), 'error');
            }
        } catch (err) {
            showTgAuthMsg('Ошибка: ' + err.message, 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '📤 Сохранить принудительно'; }
        }
    });
}

function switchTheme(themeName) {
    const theme = themeName || 'default';
    localStorage.setItem('crowgram_theme', theme);
    const themeLink = document.getElementById('themeStylesheet');
    if (themeLink) {
        if (theme === 'default') {
            themeLink.href = '';
        } else {
            themeLink.href = `/static/css/themes/theme-${theme}.css`;
        }
    }
    document.querySelectorAll('.crow-theme-selector').forEach(sel => {
        sel.value = theme;
    });
    if (window.CrowAPI && typeof window.CrowAPI.emit === 'function') {
        window.CrowAPI.emit('themeChanged', theme);
    }
}
window.switchTheme = switchTheme;

function bindGlobalEvents() {
    const savedTheme = localStorage.getItem('crowgram_theme') || 'default';
    switchTheme(savedTheme);

    document.getElementById('navDriveBtn')?.addEventListener('click', (e) => {
        e.preventDefault(); isTrashView = false; currentFolderId = 0; 
        safeToggleModal('musicModal', 'none');
        loadFiles();
    });

    document.getElementById('navMusicBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.CrowMusicInstance) {
            window.CrowMusicInstance.open();
        } else {
            const modal = document.getElementById('musicModal');
            if (modal) modal.style.display = 'flex';
        }
    });

    document.getElementById('closeMusicBtn')?.addEventListener('click', () => {
        if (window.CrowMusicInstance) {
            window.CrowMusicInstance.close();
        } else {
            const modal = document.getElementById('musicModal');
            if (modal) modal.style.display = 'none';
        }
    });

    document.getElementById('musicRefreshBtn')?.addEventListener('click', () => {
        const frame = document.getElementById('musicIframe');
        if (frame) frame.src = frame.src;
    });

    document.getElementById('navTrashBtn')?.addEventListener('click', (e) => {
        e.preventDefault(); isTrashView = true;
        safeToggleModal('musicModal', 'none');
        loadFiles();
    });

    document.getElementById('sidebarToggle')?.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.toggle('collapsed');
    });

    if (window.CrowAPI && typeof window.CrowAPI.on === 'function') {
        window.CrowAPI.on('languageChanged', () => {
            if (window.CrowI18n) {
                window.CrowI18n.applyTranslations();
            }
            loadConfig();
            renderBreadcrumbs();
            renderView(window.currentFolderFiles || []);
            updateBatchPanel();
        });
    }
}
