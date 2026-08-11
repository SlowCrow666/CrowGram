let currentLang = 'ru';
let isAuthorized = false;
let currentFolderId = 0;
let currentDriveId = 1;
let isTrashView = false;
let currentViewMode = 'table'; 
let allItems = [];
let selectedFileIds = new Set();
let pluginDefaultsMap = {};

window.CrowAPI = {
    plugins: {},
    hooks: { 
        onFileClick: [], 
        onAppReady: [],
        renderContextMenu: [],
        renderSidebarItem: [],
        onFileUpload: [],
        onFileDelete: []
    },
    
    registerPlugin: function(name, plugin) {
        this.plugins[name] = plugin;
        try {
            if (plugin.init) plugin.init(this);
            console.log('[CrowGram Plugin System] Плагин успешно зарегистрирован:', name);
        } catch (e) {
            console.error('[CrowGram Plugin System] Ошибка инициализации плагина:', name, e);
        }
    },
    
    addHook: function(hookName, callback) {
        if (this.hooks[hookName]) {
            this.hooks[hookName].push(callback);
        } else {
            console.warn('[CrowGram Plugin System] Попытка подписки на неизвестный хук:', hookName);
        }
    },
    
    emit: function(hookName, ...args) {
        if (this.hooks[hookName]) {
            let handled = false;
            for (let cb of this.hooks[hookName]) {
                try { 
                    const result = cb(...args);
                    if (result === true) handled = true; 
                } catch (e) { 
                    console.error('[CrowGram Plugin System] Ошибка в хуке ' + hookName + ':', e); 
                }
            }
            return handled;
        }
        return false;
    },

    emitRenderButtons: function(fileId, fileExt, isFolder) {
        let buttonsHTML = '';
        if (this.hooks.renderContextMenu) {
            for (let cb of this.hooks.renderContextMenu) {
                try {
                    const html = cb(fileId, fileExt, isFolder);
                    if (html && typeof html === 'string') {
                        buttonsHTML += html;
                    }
                } catch (e) {
                    console.error('[CrowGram Plugin System] Ошибка renderContextMenu:', e);
                }
            }
        }
        return buttonsHTML;
    },
    
    readFile: async function(fileId) {
        const res = await fetch('/api/download/' + fileId);
        if (!res.ok) throw new Error('Ошибка чтения файла');
        return await res.text();
    },
    saveFile: async function(fileId, fileName, textContent) {
        const res = await fetch('/api/files/' + fileId + '/save', { method: 'POST', body: textContent });
        if (!res.ok) throw new Error('Ошибка перезаписи файла');
        const data = await res.json();
        if (window.loadFiles) await window.loadFiles();
        return data.new_id || fileId;
    },
    ui: {
        addBottomBar: function(id, html) {
            let mounts = document.getElementById('plugin-mounts');
            if (!mounts) { mounts = document.createElement('div'); mounts.id = 'plugin-mounts'; document.body.appendChild(mounts); }
            let bar = document.createElement('div');
            bar.id = id; bar.className = 'plugin-bottom-bar'; bar.innerHTML = html;
            mounts.appendChild(bar);
            return bar;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    bindUIEvents();
    bindUploadEvents();
    bindSettingsAndAuthEvents();
    bindAppLockEvents();
    bindBatchEvents();
    bindPluginManagerEvents();
    checkAppAuthStatus();
    loadPlugins();
});

async function checkAppAuthStatus() {
    try {
        const res = await fetch('/api/app-auth/status?_t=' + Date.now());
        if (res.ok) {
            const data = await res.json();
            if (data.has_password) {
                document.getElementById('appLockModal').style.display = 'flex';
            } else {
                checkConfig();
            }
        } else {
            checkConfig();
        }
    } catch (e) {
        checkConfig();
    }
}

function bindAppLockEvents() {
    document.getElementById('appLockForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pass = document.getElementById('appLockPassword').value;
        const fd = new FormData();
        fd.append('password', pass);
        
        try {
            const res = await fetch('/api/app-auth/verify', { method: 'POST', body: fd });
            if (res.ok) {
                document.getElementById('appLockModal').style.display = 'none';
                document.getElementById('appLockPassword').value = '';
                checkConfig();
            } else {
                alert('Неверный пароль!');
            }
        } catch (e) {
            alert('Ошибка сервера');
        }
    });

    document.getElementById('forgotPasswordBtn')?.addEventListener('click', async () => {
        const statusBox = document.getElementById('recoveryStatusBox');
        statusBox.style.display = 'block';
        statusBox.innerHTML = '<i>Запрос восстановления...</i>';

        try {
            const res = await fetch('/api/app-auth/recover', { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                let html = '<b>Результат сброса:</b><br>';
                if (data.hint) {
                    html += `💡 Подсказка: <u>${data.hint}</u><br>`;
                } else {
                    html += `💡 Подсказка не задана.<br>`;
                }

                if (data.sent_telegram) {
                    html += `📩 Пароль выслан в ваши <b>Saved Messages (Избранное)</b> в Telegram!`;
                } else {
                    html += `⚠️ Не удалось отправить пароль в Telegram (проверьте подключение аккаунта).`;
                }
                statusBox.innerHTML = html;
            }
        } catch (e) {
            statusBox.innerHTML = '❌ Ошибка выполнения запроса';
        }
    });

    const wizToggle = document.getElementById('wizardEnablePassToggle');
    wizToggle?.addEventListener('change', (e) => {
        document.getElementById('wizardPassFieldsBlock').style.display = e.target.checked ? 'flex' : 'none';
    });

    document.getElementById('wizardPasswordSetupForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const enabled = document.getElementById('wizardEnablePassToggle').checked;
        const pass = document.getElementById('wizardAppPassword').value;
        const confirmPass = document.getElementById('wizardAppPasswordConfirm').value;
        const hint = document.getElementById('wizardPassHint').value;
        const email = document.getElementById('wizardPassEmail').value;
        const sendTg = document.getElementById('wizardSendPassToTg').checked;

        if (enabled && pass !== confirmPass) {
            alert('Пароли не совпадают!');
            return;
        }

        const fd = new FormData();
        fd.append('enabled', enabled ? 'true' : 'false');
        fd.append('password', pass);
        fd.append('password_confirm', confirmPass);
        fd.append('hint', hint);
        fd.append('email', email);
        fd.append('send_to_tg', sendTg ? 'true' : 'false');

        const res = await fetch('/api/app-auth/setup', { method: 'POST', body: fd });
        if (res.ok) {
            document.getElementById('wizardModal').style.display = 'none';
            checkConfig();
        } else {
            const err = await res.json();
            alert('Ошибка: ' + (err.detail || 'Не удалось сохранить пароль'));
        }
    });

    const setToggle = document.getElementById('settingsEnablePassToggle');
    setToggle?.addEventListener('change', (e) => {
        document.getElementById('settingsPassFieldsBlock').style.display = e.target.checked ? 'flex' : 'none';
    });

    document.getElementById('settingsAppPasswordForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const enabled = document.getElementById('settingsEnablePassToggle').checked;
        const pass = document.getElementById('settingsAppPassword').value;
        const confirmPass = document.getElementById('settingsAppPasswordConfirm').value;
        const hint = document.getElementById('settingsPassHint').value;
        const email = document.getElementById('settingsPassEmail').value;

        if (enabled && pass !== confirmPass) {
            alert('Пароли не совпадают!');
            return;
        }

        const fd = new FormData();
        fd.append('enabled', enabled ? 'true' : 'false');
        fd.append('password', pass);
        fd.append('password_confirm', confirmPass);
        fd.append('hint', hint);
        fd.append('email', email);
        fd.append('send_to_tg', 'true');

        const res = await fetch('/api/app-auth/setup', { method: 'POST', body: fd });
        if (res.ok) {
            alert('Пароль приложения обновлен!');
        } else {
            alert('Ошибка при обновлении пароля');
        }
    });
}

function openAuthOrWizardModal() {
    const wizardModal = document.getElementById('wizardModal');
    const settingsModal = document.getElementById('settingsModal');
    
    if (wizardModal) {
        wizardModal.style.display = 'flex';
    } else if (settingsModal) {
        settingsModal.style.display = 'flex';
    }
}

function bindUIEvents() {
    // Кликер по плашке статуса в шапке
    const systemStatusBadge = document.getElementById('systemStatus');
    if (systemStatusBadge) {
        systemStatusBadge.style.cursor = 'pointer';
        systemStatusBadge.addEventListener('click', () => {
            openAuthOrWizardModal();
        });
    }

    document.getElementById('sidebarToggle')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
        document.getElementById('appWrapper').classList.toggle('collapsed');
    });

    document.getElementById('navDriveBtn')?.addEventListener('click', (e) => {
        e.preventDefault(); 
        document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
        e.currentTarget.classList.add('active');
        setViewMode(false);
    });

    document.getElementById('navTrashBtn')?.addEventListener('click', (e) => {
        e.preventDefault(); 
        document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
        e.currentTarget.classList.add('active');
        setViewMode(true);
    });

    document.getElementById('navCommanderBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('commanderModal').style.display = 'flex';
        if (window.CrowCommanderInstance) {
            window.CrowCommanderInstance.open();
        }
    });

    document.getElementById('closeCommanderBtn')?.addEventListener('click', () => {
        if (window.CrowCommanderInstance) window.CrowCommanderInstance.isModalOpen = false;
        document.getElementById('commanderModal').style.display = 'none';
    });

    document.getElementById('navPluginsBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('pluginsModal').style.display = 'flex';
        renderPluginManager();
    });

    document.getElementById('closePluginsBtn')?.addEventListener('click', () => {
        document.getElementById('pluginsModal').style.display = 'none';
    });

    document.getElementById('navSettingsBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('settingsModal').style.display = 'flex';
    });

    document.getElementById('closeSettingsBtn')?.addEventListener('click', () => {
        document.getElementById('settingsModal').style.display = 'none';
    });

    document.getElementById('openDriveModalBtn')?.addEventListener('click', () => {
        document.getElementById('driveModal').style.display = 'flex';
        document.getElementById('driveForm').reset();
    });

    document.getElementById('closeDriveBtn')?.addEventListener('click', () => {
        document.getElementById('driveModal').style.display = 'none';
    });

    document.getElementById('closePreviewBtn')?.addEventListener('click', () => {
        document.getElementById('previewModal').style.display = 'none';
        document.getElementById('previewContent').innerHTML = '';
    });

    document.getElementById('themeSwitcher')?.addEventListener('change', (e) => {
        const theme = e.target.value;
        let path = '/themes/default/theme.css';
        if (theme === 'telegram_dark') path = '/themes/telegram_dark/theme.css';
        if (theme === 'macos_light') path = '/themes/macos_light/theme.css';
        document.getElementById('themeStylesheet').href = path;
        localStorage.setItem('theme', theme);
    });
    
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        const ts = document.getElementById('themeSwitcher');
        if (ts) { ts.value = savedTheme; ts.dispatchEvent(new Event('change')); }
    }

    document.getElementById('viewSwitcher')?.addEventListener('change', (e) => {
        currentViewMode = e.target.value;
        renderView();
    });

    document.getElementById('searchInput')?.addEventListener('input', renderView);
    document.getElementById('sortSelect')?.addEventListener('change', renderView);

    document.getElementById('createFolderBtn')?.addEventListener('click', async () => {
        const name = prompt('Введите имя папки:');
        if (!name) return;
        const fd = new FormData();
        fd.append('name', name);
        fd.append('parent_id', currentFolderId);
        fd.append('drive_id', currentDriveId);
        await fetch('/api/folders', { method: 'POST', body: fd });
        loadFiles();
    });

    document.getElementById('emptyTrashBtn')?.addEventListener('click', async () => {
        if (confirm('Вы уверены, что хотите навсегда очистить корзину?')) {
            await fetch('/api/trash/empty', { method: 'DELETE' });
            loadFiles();
        }
    });

    document.getElementById('queueToggleBtn')?.addEventListener('click', () => {
        const body = document.getElementById('queueBody');
        body.style.display = body.style.display === 'none' ? 'flex' : 'none';
    });
    
    document.getElementById('queueClearBtn')?.addEventListener('click', () => {
        document.getElementById('queueBody').innerHTML = '';
        document.getElementById('queueWidget').style.display = 'none';
        activeUploadsCount = 0;
        completedUploadsCount = 0;
        updateQueueHeaderCounter();
    });
}

function bindPluginManagerEvents() {
    const dropZone = document.getElementById('pluginDropZone');
    const input = document.getElementById('pluginZipInput');

    if (!dropZone || !input) return;

    dropZone.addEventListener('click', () => input.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--accent-blue)';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = 'var(--border-color)';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border-color)';
        if (e.dataTransfer.files.length > 0) {
            uploadPluginZip(e.dataTransfer.files[0]);
        }
    });

    input.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            uploadPluginZip(e.target.files[0]);
            input.value = '';
        }
    });
}

async function uploadPluginZip(file) {
    if (!file.name.endsWith('.zip')) {
        alert('Пожалуйста, выберите .zip файл плагина');
        return;
    }

    const fd = new FormData();
    fd.append('file', file);

    try {
        const res = await fetch('/api/plugins/upload', { method: 'POST', body: fd });
        if (res.ok) {
            alert('Плагин успешно установлен!');
            await loadPlugins();
            renderPluginManager();
        } else {
            const err = await res.json();
            alert('Ошибка установки: ' + (err.detail || 'Не удалось установить плагин'));
        }
    } catch (e) {
        alert('Ошибка связи с сервером');
    }
}

async function renderPluginManager() {
    const container = document.getElementById('pluginManagerList');
    if (!container) return;

    try {
        const res = await fetch('/api/plugins?_t=' + Date.now());
        if (!res.ok) return;
        const data = await res.json();
        const plugins = data.plugins || [];
        const defaults = data.defaults || {};

        container.innerHTML = '';

        if (plugins.length === 0) {
            container.innerHTML = '<div style="color: #8892b0; font-size: 12px; text-align: center; padding: 20px;">Установленных плагинов пока нет</div>';
            return;
        }

        plugins.forEach(p => {
            const isDefault = defaults[p.category] === p.name;
            const card = document.createElement('div');
            card.className = 'plugin-card';
            card.innerHTML = `
                <div class="plugin-card-info">
                    <div class="plugin-card-title">${p.title} <span style="font-size: 10px; color: var(--accent-blue);">v${p.version}</span></div>
                    <div class="plugin-card-desc">${p.description} (Категория: <b>${p.category}</b>)</div>
                </div>
                <div class="plugin-card-actions">
                    ${p.category !== 'general' ? `
                        <label style="font-size: 11px; display: flex; align-items: center; gap: 4px; cursor: pointer; color: #ccd6f6;">
                            <input type="radio" name="default_${p.category}" ${isDefault ? 'checked' : ''} onchange="window.setDefaultPlugin('${p.category}', '${p.name}')">
                            По умолчанию
                        </label>
                    ` : ''}
                    <button type="button" class="hud-btn danger" style="padding: 4px 8px; font-size: 11px;" onclick="window.removePlugin('${p.name}')">Удалить</button>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (e) {
        container.innerHTML = '<div style="color: var(--accent-red); font-size: 12px;">Ошибка загрузки списка плагинов</div>';
    }
}

window.setDefaultPlugin = async function(category, pluginName) {
    const fd = new FormData();
    fd.append('category', category);
    fd.append('plugin_name', pluginName);
    await fetch('/api/plugins/default', { method: 'POST', body: fd });
    renderPluginManager();
};

window.removePlugin = async function(pluginName) {
    if (!confirm(`Удалить плагин "${pluginName}"?`)) return;
    await fetch('/api/plugins/' + pluginName, { method: 'DELETE' });
    await loadPlugins();
    renderPluginManager();
};

function bindBatchEvents() {
    document.getElementById('selectAllCheckbox')?.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const checkboxes = document.querySelectorAll('.file-checkbox');
        
        selectedFileIds.clear();
        checkboxes.forEach(cb => {
            cb.checked = isChecked;
            if (isChecked) {
                const id = parseInt(cb.getAttribute('data-id'));
                if (id) selectedFileIds.add(id);
            }
        });
        updateBatchPanel();
    });

    document.getElementById('downloadFilesBtn')?.addEventListener('click', () => {
        selectedFileIds.forEach((id, idx) => {
            setTimeout(() => {
                const a = document.createElement('a');
                a.href = '/api/download/' + id;
                a.download = '';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }, idx * 250);
        });
    });

    document.getElementById('downloadZipBtn')?.addEventListener('click', () => {
        if (selectedFileIds.size === 0) return;
        const idsArray = Array.from(selectedFileIds).join(',');
        const currentFolder = allItems.find(item => item.id === currentFolderId && item.is_folder);
        const zipName = currentFolder ? currentFolder.name : 'selection_archive';
        
        window.location.href = '/api/download-zip?ids=' + idsArray + '&name=' + encodeURIComponent(zipName);
    });

    document.getElementById('deleteBatchBtn')?.addEventListener('click', async () => {
        if (selectedFileIds.size === 0) return;
        if (!confirm(`Переместить выбранные элементы (${selectedFileIds.size} шт.) в корзину?`)) return;

        const fd = new FormData();
        selectedFileIds.forEach(id => fd.append('ids', id));
        
        await fetch('/api/files/batch-trash', { method: 'POST', body: fd });
        selectedFileIds.clear();
        loadFiles();
    });
}

function updateBatchPanel() {
    const container = document.getElementById('batchPanelContainer');
    const countLabel = document.getElementById('batchCount');
    const selectAllCb = document.getElementById('selectAllCheckbox');

    if (countLabel) countLabel.textContent = `Выбрано: ${selectedFileIds.size}`;

    if (selectedFileIds.size > 0) {
        if (container) container.style.display = 'block';
    } else {
        if (container) container.style.display = 'none';
        if (selectAllCb) selectAllCb.checked = false;
    }
}

window.handleCheckboxChange = function(e, fileId) {
    e.stopPropagation();
    if (e.target.checked) {
        selectedFileIds.add(fileId);
    } else {
        selectedFileIds.delete(fileId);
    }
    
    const selectAllCb = document.getElementById('selectAllCheckbox');
    const allCbs = document.querySelectorAll('.file-checkbox');
    if (selectAllCb && allCbs.length > 0) {
        selectAllCb.checked = selectedFileIds.size === allCbs.length;
    }
    
    updateBatchPanel();
};

window.downloadFolderZip = function(folderId) {
    const folderObj = allItems.find(item => item.id === folderId && item.is_folder);
    const folderName = folderObj ? folderObj.name : 'archive';

    const folderFiles = allItems.filter(item => item.parent_id === folderId && !item.is_folder);
    if (folderFiles.length === 0) {
        alert('Папка пуста или содержит только другие папки.');
        return;
    }
    const ids = folderFiles.map(f => f.id).join(',');
    window.location.href = '/api/download-zip?ids=' + ids + '&name=' + encodeURIComponent(folderName);
};

function bindUploadEvents() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    if (!dropZone || !fileInput) return;

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('active');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('active');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('active');
        if (e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFiles(e.target.files);
            fileInput.value = ''; 
        }
    });
}

let activeUploadsCount = 0;
let completedUploadsCount = 0;

function updateQueueHeaderCounter() {
    const el = document.getElementById('queueProgressCount');
    if (el) {
        el.textContent = `${completedUploadsCount}/${activeUploadsCount + completedUploadsCount}`;
    }
}

function handleFiles(files) {
    if (!files.length) return;
    document.getElementById('queueWidget').style.display = 'block';
    activeUploadsCount += files.length;
    updateQueueHeaderCounter();

    for (let i = 0; i < files.length; i++) {
        uploadFile(files[i]);
    }
}

function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('parent_id', currentFolderId);
    formData.append('drive_id', currentDriveId);
    formData.append('thumbnail', '');

    const qBody = document.getElementById('queueBody');
    const qItem = document.createElement('div');
    qItem.className = 'queue-item';
    const safeName = file.name.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    qItem.innerHTML = `
        <div class="queue-item-header">
            <span class="queue-item-name">${safeName}</span>
            <span class="queue-item-meta">ПК ➔ Сервер: 0%</span>
        </div>
        <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: 0%;"></div>
        </div>
    `;
    qBody.appendChild(qItem);
    const fill = qItem.querySelector('.progress-bar-fill');
    const meta = qItem.querySelector('.queue-item-meta');

    let lastLoadedBytes = 0;
    let lastTime = Date.now();

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload', true);
    
    xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
            const now = Date.now();
            const timeDiff = (now - lastTime) / 1000;
            let speedStr = '';
            
            if (timeDiff > 0.5) {
                const bytesDiff = e.loaded - lastLoadedBytes;
                const speedBytesPerSec = bytesDiff / timeDiff;
                const speedMB = (speedBytesPerSec / (1024 * 1024)).toFixed(1);
                speedStr = ` [${speedMB} MB/s]`;
                lastLoadedBytes = e.loaded;
                lastTime = now;
            }

            const percent = Math.round((e.loaded / e.total) * 100);
            fill.style.width = percent + '%';
            meta.textContent = `ПК ➔ Сервер: ${percent}%${speedStr}`;
        }
    };
    
    xhr.onload = () => {
        if (xhr.status === 200) {
            const resp = JSON.parse(xhr.responseText);
            if (resp.task_id) {
                fill.style.width = '0%';
                meta.textContent = 'Сервер ➔ TG: Старт...';
                pollTelegramUpload(resp.task_id, fill, meta, file.name, file.size);
            }
        } else {
            meta.textContent = 'Ошибка';
            fill.style.backgroundColor = 'var(--accent-red)';
            activeUploadsCount = Math.max(0, activeUploadsCount - 1);
            updateQueueHeaderCounter();
        }
    };
    
    xhr.onerror = () => {
        meta.textContent = 'Ошибка сети';
        fill.style.backgroundColor = 'var(--accent-red)';
        activeUploadsCount = Math.max(0, activeUploadsCount - 1);
        updateQueueHeaderCounter();
    };
    
    xhr.send(formData);
}

function pollTelegramUpload(taskId, fill, meta, fileName, fileSize) {
    let lastBytes = 0;
    let lastTime = Date.now();

    const interval = setInterval(async () => {
        try {
            const res = await fetch('/api/upload/status?_t=' + Date.now());
            if (!res.ok) return;
            const tasks = await res.json();
            const task = tasks[taskId];
            
            if (!task) {
                clearInterval(interval);
                return;
            }
            
            if (task.status === 'processing') {
                const currentBytes = task.completed_bytes + task.current_chunk_bytes;
                const now = Date.now();
                const timeDiff = (now - lastTime) / 1000;
                let speedStr = '';

                if (timeDiff >= 1.0) {
                    const bytesDiff = currentBytes - lastBytes;
                    const speedMB = ((bytesDiff / timeDiff) / (1024 * 1024)).toFixed(1);
                    speedStr = ` [${speedMB} MB/s]`;
                    lastBytes = currentBytes;
                    lastTime = now;
                }

                const percent = Math.round((currentBytes / task.total_size) * 100);
                fill.style.width = percent + '%';
                const mbDone = (currentBytes / (1024*1024)).toFixed(1);
                const mbTotal = (task.total_size / (1024*1024)).toFixed(1);
                meta.textContent = `Сервер ➔ TG: ${percent}% (${mbDone}/${mbTotal} MB)${speedStr}`;
            } else if (task.status === 'done') {
                clearInterval(interval);
                meta.textContent = 'Готово';
                fill.style.width = '100%';
                fill.classList.add('done');
                
                activeUploadsCount = Math.max(0, activeUploadsCount - 1);
                completedUploadsCount++;
                updateQueueHeaderCounter();

                window.CrowAPI.emit('onFileUpload', { name: fileName, size: fileSize });
                loadFiles();
            } else if (task.status === 'error') {
                clearInterval(interval);
                meta.textContent = 'Ошибка TG';
                fill.style.backgroundColor = 'var(--accent-red)';
                
                activeUploadsCount = Math.max(0, activeUploadsCount - 1);
                updateQueueHeaderCounter();
            }
        } catch(e) {
            console.error('Ошибка поллинга', e);
        }
    }, 1000);
}

function bindSettingsAndAuthEvents() {
    document.getElementById('settingsForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData();
        fd.append('api_id', document.getElementById('apiIdInput').value);
        fd.append('api_hash', document.getElementById('apiHashInput').value);
        fd.append('chunk_size', document.getElementById('chunkSizeInput').value);
        fd.append('max_concurrent_uploads', document.getElementById('maxConcurrentUploadsInput').value);
        await fetch('/api/config', { method: 'POST', body: fd });
        checkConfig();
        alert('Настройки сохранены');
    });

    document.getElementById('sendCodeBtn')?.addEventListener('click', async () => {
        const fd = new FormData();
        fd.append('phone', document.getElementById('phoneInput').value);
        const res = await fetch('/api/auth/send-code', { method: 'POST', body: fd });
        if (res.ok) {
            document.getElementById('codeGroup').style.display = 'block';
        } else {
            alert('Ошибка отправки кода');
        }
    });

    document.getElementById('signInBtn')?.addEventListener('click', async () => {
        const fd = new FormData();
        fd.append('code', document.getElementById('codeInput').value);
        const res = await fetch('/api/auth/sign-in', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.status === 'password_required') {
            document.getElementById('passwordGroup').style.display = 'block';
        } else {
            checkConfig();
            alert('Авторизация успешна');
        }
    });

    document.getElementById('submitPasswordBtn')?.addEventListener('click', async () => {
        const fd = new FormData();
        fd.append('password', document.getElementById('passwordInput').value);
        const res = await fetch('/api/auth/password', { method: 'POST', body: fd });
        if (res.ok) {
            checkConfig();
            alert('Авторизация успешна');
        } else {
            alert('Неверный пароль');
        }
    });
    
    document.getElementById('driveForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData();
        fd.append('letter', document.getElementById('driveLetterInput').value);
        fd.append('label', document.getElementById('driveLabelInput').value);
        
        const actionInput = document.querySelector('input[name="driveAction"]:checked');
        const action = actionInput ? actionInput.value : 'create_new';
        fd.append('action', action);
        
        if (action === 'create_new') {
            fd.append('title', document.getElementById('newChannelTitle').value);
        } else {
            fd.append('tg_chat_id', document.getElementById('existingChannelSelect').value);
        }
        
        await fetch('/api/drives', { method: 'POST', body: fd });
        document.getElementById('driveModal').style.display = 'none';
        loadDrives();
    });

    document.getElementById('wizardDriveForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData();
        fd.append('letter', document.getElementById('wizardDriveLetter').value);
        fd.append('label', document.getElementById('wizardDriveLabel').value);
        
        const actionInput = document.querySelector('input[name="wizardDriveAction"]:checked');
        const action = actionInput ? actionInput.value : 'create_new';
        fd.append('action', action);
        
        if (action === 'create_new') {
            fd.append('title', document.getElementById('wizardNewChannelTitle').value);
        } else {
            fd.append('tg_chat_id', document.getElementById('wizardExistingChannelSelect').value);
        }

        await fetch('/api/drives', { method: 'POST', body: fd });
        
        document.getElementById('wizardStep3').style.display = 'none';
        document.getElementById('wizardStep4').style.display = 'block';
    });
}

async function checkConfig() {
    try {
        const res = await fetch('/api/config?_t=' + Date.now());
        if (!res.ok) return;
        const cfg = await res.json();
        isAuthorized = cfg.is_authorized;
        const status = document.getElementById('systemStatus');
        
        if (document.getElementById('apiIdInput') && cfg.api_id) document.getElementById('apiIdInput').value = cfg.api_id;
        if (document.getElementById('apiHashInput') && cfg.api_hash) document.getElementById('apiHashInput').value = cfg.api_hash;
        if (document.getElementById('settingsEnablePassToggle')) {
            document.getElementById('settingsEnablePassToggle').checked = !!cfg.has_app_password;
        }

        await loadDrives();
        
        if (isAuthorized) {
            if (status) {
                status.textContent = "СИСТЕМА ГОТОВА"; 
                status.classList.remove('unauth');
            }
            window.CrowAPI.emit('onAppReady');
        } else {
            if (status) {
                status.textContent = "ТРЕБУЕТСЯ АВТОРИЗАЦИЯ"; 
                status.classList.add('unauth');
            }
            // Вызываем мастер установки автоматически, если аккаунт не привязан
            openAuthOrWizardModal();
        }
    } catch (e) { console.error("Ошибка проверки конфига:", e); }
}

async function loadDrives() {
    try {
        const res = await fetch('/api/drives?_t=' + Date.now());
        if (!res.ok) return [];
        const drives = await res.json();
        const list = document.getElementById('drivesList');
        if (!list) return drives;
        list.innerHTML = '';
        
        if (drives.length > 0 && !drives.find(d => d.id === currentDriveId)) {
            currentDriveId = drives[0].id;
        }

        drives.forEach(function(d) {
            const container = document.createElement('div');
            container.style.display = 'flex';
            container.style.alignItems = 'center';
            container.style.justifyContent = 'space-between';
            container.className = 'nav-link ' + ((!isTrashView && d.id === currentDriveId) ? 'active' : '');
            
            const driveIcon = d.icon || '💽';
            const a = document.createElement('a');
            a.href = '#';
            a.style.display = 'flex';
            a.style.alignItems = 'center';
            a.style.flexGrow = '1';
            a.style.color = 'inherit';
            a.style.textDecoration = 'none';
            a.innerHTML = '<span class="nav-icon">' + driveIcon + '</span><span class="nav-text">' + d.letter + ': ' + d.label + '</span>';
            a.onclick = function(e) {
                e.preventDefault();
                currentDriveId = d.id;
                currentFolderId = 0;
                setViewMode(false);
                
                document.querySelectorAll('#drivesList .nav-link').forEach(el => el.classList.remove('active'));
                container.classList.add('active');
            };

            const editBtn = document.createElement('button');
            editBtn.innerHTML = '✏️';
            editBtn.style.background = 'none'; 
            editBtn.style.border = 'none'; 
            editBtn.style.cursor = 'pointer';
            
            container.appendChild(a);
            container.appendChild(editBtn);
            list.appendChild(container);
        });
        
        fetch('/api/stats').then(r => r.json()).then(stats => {
            if (document.getElementById('statsSize')) document.getElementById('statsSize').textContent = (stats.total_size / (1024*1024)).toFixed(2) + ' MB';
            if (document.getElementById('statsFiles')) document.getElementById('statsFiles').textContent = stats.files_count;
            if (document.getElementById('statsFolders')) document.getElementById('statsFolders').textContent = stats.folders_count;
        });

        loadFiles();
        return drives;
    } catch (e) { return []; }
}

async function loadPlugins() {
    try {
        const res = await fetch('/api/plugins?_t=' + Date.now());
        if (res.ok) {
            const data = await res.json();
            const plugins = data.plugins || [];
            pluginDefaultsMap = data.defaults || {};

            for (let p of plugins) {
                try {
                    let script = document.createElement('script');
                    script.src = '/plugins/' + p.file + '?_t=' + Date.now();
                    document.body.appendChild(script);
                } catch (pluginErr) {
                    console.error('[CrowGram Plugin System] Ошибка загрузки скрипта плагина ' + p.file + ':', pluginErr);
                }
            }
        }
    } catch (e) { console.error("Ошибка загрузки плагинов:", e); }
}

function setViewMode(trash) {
    isTrashView = trash;
    currentFolderId = 0;
    selectedFileIds.clear();
    updateBatchPanel();

    const createFolderBtn = document.getElementById('createFolderBtn');
    const emptyTrashBtn = document.getElementById('emptyTrashBtn');
    const dropZone = document.getElementById('dropZone');
    
    if (createFolderBtn) createFolderBtn.style.display = trash ? 'none' : 'block';
    if (emptyTrashBtn) emptyTrashBtn.style.display = trash ? 'block' : 'none';
    if (dropZone) dropZone.style.display = trash ? 'none' : 'block';
    
    loadFiles();
}

async function loadFiles() {
    try {
        const url = isTrashView ? '/api/trash/files?_t=' + Date.now() : '/api/files?drive_id=' + currentDriveId + '&_t=' + Date.now();
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) { 
            allItems = await res.json(); 
            selectedFileIds.clear();
            updateBatchPanel();
            renderView(); 
        }
    } catch (e) { console.error("Ошибка загрузки файлов:", e); }
}

window.handleFileClick = function(id, name) {
    const ext = name.split('.').pop().toLowerCase();
    const isIntercepted = window.CrowAPI.emit('onFileClick', id, name, ext);
    if (!isIntercepted) openPreview(id, name);
};

window.moveToTrash = async function(fileId, isFolder) { 
    await fetch('/api/files/' + fileId + '/trash?is_folder=' + !!isFolder, { method: 'POST' }); 
    window.CrowAPI.emit('onFileDelete', fileId);
    loadFiles(); 
};

window.restoreFromTrash = async function(fileId, isFolder) { 
    await fetch('/api/files/' + fileId + '/restore?is_folder=' + !!isFolder, { method: 'POST' }); 
    loadFiles(); 
};

window.deletePermanently = async function(fileId) {
    if (!confirm("Окончательно удалить элемент?")) return;
    await fetch('/api/files/' + fileId + '/permanent', { method: 'DELETE' }); 
    window.CrowAPI.emit('onFileDelete', fileId);
    loadFiles(); 
};

function navigateTo(folderId) {
    currentFolderId = folderId; 
    selectedFileIds.clear();
    updateBatchPanel();
    renderView();
}

function getFileIcon(name, isFolder) {
    if (isFolder) return '📁';
    const ext = name.split('.').pop().toLowerCase();
    const img = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
    const vid = ['mp4', 'webm', 'mkv', 'mov', 'avi', 'wmv', 'flv'];
    const aud = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'];
    const arc = ['zip', 'rar', '7z', 'tar', 'gz'];
    if (img.includes(ext)) return '🖼️';
    if (vid.includes(ext)) return '🎬';
    if (aud.includes(ext)) return '🎵';
    if (arc.includes(ext)) return '📦';
    return '📄';
}

function openPreview(id, name) {
    const ext = name.split('.').pop().toLowerCase();
    const url = '/api/stream/' + id;
    const previewTitle = document.getElementById('previewTitle');
    if (previewTitle) previewTitle.textContent = name;
    
    let html = '';
    const imgExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
    const videoExts = ['mp4', 'webm', 'mkv', 'mov', 'avi', 'wmv', 'flv', 'm4v'];
    const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'];
    const textExts = ['txt', 'md', 'json', 'py', 'js', 'html', 'css', 'csv', 'xml', 'cpp', 'java', 'php', 'log'];

    const previewContent = document.getElementById('previewContent');
    const previewModal = document.getElementById('previewModal');

    if (imgExts.includes(ext)) {
        html = '<div style="text-align:center; max-height:80vh; overflow:auto;"><img src="' + url + '" style="max-width:100%; max-height:75vh; border-radius:8px; object-fit:contain;"></div>';
        if (previewContent) previewContent.innerHTML = html;
        if (previewModal) previewModal.style.display = 'flex';
    } else if (videoExts.includes(ext)) {
        html = '<video controls autoplay style="width:100%; max-height:70vh;"><source src="' + url + '"></video>';
        if (previewContent) previewContent.innerHTML = html;
        if (previewModal) previewModal.style.display = 'flex';
    } else if (audioExts.includes(ext)) {
        html = '<audio controls autoplay style="width:100%; margin-top:20px;"><source src="' + url + '"></audio>';
        if (previewContent) previewContent.innerHTML = html;
        if (previewModal) previewModal.style.display = 'flex';
    } else if (textExts.includes(ext)) {
        html = '<pre style="max-height:70vh; overflow:auto; padding:15px; background:rgba(0,0,0,0.3); border-radius:6px; white-space:pre-wrap; word-break:break-word;">Загрузка текста...</pre>';
        fetch('/api/download/' + id).then(function(r) { return r.text(); }).then(function(txt) {
            if (previewContent) previewContent.innerHTML = '<pre style="max-height:70vh; overflow:auto; padding:15px; background:rgba(0,0,0,0.3); border-radius:6px; white-space:pre-wrap; word-break:break-word;">' + txt.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre>';
        }).catch(function(e) {
            if (previewContent) previewContent.innerHTML = '<div style="color:var(--accent-red); padding:20px;">Ошибка загрузки текста</div>';
        });
        if (previewModal) previewModal.style.display = 'flex';
    } else {
        const a = document.createElement('a');
        a.href = '/api/download/' + id;
        a.click();
    }
}

function renderBreadcrumbs() {
    const bcContainer = document.getElementById('breadcrumbs');
    if (!bcContainer) return;
    bcContainer.innerHTML = '<span class="crumb" onclick="navigateTo(0)">🏠 Главная</span>';
}

function renderView() {
    renderBreadcrumbs();
    const searchInput = document.getElementById('searchInput');
    const query = searchInput ? searchInput.value.toLowerCase() : '';
    
    let displayItems = allItems.filter(function(item) {
        if (query) return item.name.toLowerCase().includes(query);
        return isTrashView ? true : item.parent_id === currentFolderId;
    });

    const tableView = document.getElementById('tableViewContainer');
    const gridView = document.getElementById('gridViewContainer');
    const tbody = document.getElementById('fileList');

    if (tbody) tbody.innerHTML = ''; 
    if (gridView) gridView.innerHTML = '';

    if (currentViewMode === 'table') {
        if (tableView) tableView.style.display = 'block'; 
        if (gridView) gridView.style.display = 'none';
    } else {
        if (tableView) tableView.style.display = 'none'; 
        if (gridView) {
            gridView.style.display = 'grid';
            gridView.className = currentViewMode === 'grid_large' ? 'file-grid large' : 'file-grid small';
        }
    }

    displayItems.forEach(function(f) {
        const sizeStr = f.is_folder ? '--' : (f.size / (1024*1024)).toFixed(2) + ' MB';
        const date = f.created_at ? new Date(f.created_at).toLocaleString() : '--';
        let typeIcon = getFileIcon(f.name, f.is_folder);
        const fileExt = f.name.split('.').pop().toLowerCase();
        const safeName = f.name.replace(/'/g, "\\'").replace(/"/g, "&quot;");
        const isChecked = selectedFileIds.has(f.id) ? 'checked' : '';

        const pluginButtonsHTML = window.CrowAPI.emitRenderButtons(f.id, fileExt, f.is_folder);

        let actionButtonsHTML = '';
        if (!isTrashView) {
            if (f.is_folder) {
                actionButtonsHTML += '<button type="button" class="action-btn" title="Скачать папку в ZIP" onclick="event.stopPropagation(); window.downloadFolderZip(' + f.id + ')">📦</button>';
            } else {
                actionButtonsHTML += '<button type="button" class="action-btn" title="Воспроизвести / Открыть" onclick="event.stopPropagation(); handleFileClick(' + f.id + ', \'' + safeName + '\')">▶</button>';
                actionButtonsHTML += '<a href="/api/download/' + f.id + '" class="action-btn" title="Скачать" onclick="event.stopPropagation();" download style="text-decoration:none; display:inline-flex; align-items:center; justify-content:center;">📥</a>';
            }
            actionButtonsHTML += pluginButtonsHTML;
            actionButtonsHTML += '<button type="button" class="action-btn danger" title="В корзину" onclick="event.stopPropagation(); window.moveToTrash(' + f.id + ', ' + f.is_folder + ')">🗑</button>';
        } else {
            actionButtonsHTML += '<button type="button" class="action-btn" title="Восстановить" onclick="event.stopPropagation(); window.restoreFromTrash(' + f.id + ', ' + f.is_folder + ')">↩</button>';
            actionButtonsHTML += '<button type="button" class="action-btn danger" title="Удалить навсегда" onclick="event.stopPropagation(); window.deletePermanently(' + f.id + ')">🔥</button>';
        }

        const actionCellHTML = '<div class="row-actions" style="display:flex; gap:6px; justify-content:flex-end;">' + actionButtonsHTML + '</div>';

        if (currentViewMode === 'table') {
            if (tbody) {
                const tr = document.createElement('tr');
                tr.className = 'draggable-row';
                tr.innerHTML = '<td><input type="checkbox" class="hud-checkbox file-checkbox" data-id="' + f.id + '" ' + isChecked + ' onchange="window.handleCheckboxChange(event, ' + f.id + ')"></td>' +
                    '<td><button class="fav-btn">' + (f.is_favorite ? '⭐' : '☆') + '</button></td>' +
                    '<td onclick="' + (f.is_folder && !isTrashView ? 'navigateTo(' + f.id + ')' : 'handleFileClick(' + f.id + ', \'' + safeName + '\')') + '" style="cursor: pointer;">' +
                        '<span class="table-icon">' + typeIcon + '</span>' + f.name +
                    '</td>' +
                    '<td>' + sizeStr + '</td>' +
                    '<td>' + date + '</td>' +
                    '<td class="action-cell" style="text-align:right;">' +
                        actionCellHTML +
                    '</td>';
                tbody.appendChild(tr);
            }
        } else {
            if (gridView) {
                const card = document.createElement('div');
                card.className = 'file-card';
                card.onclick = function() {
                    if (f.is_folder && !isTrashView) navigateTo(f.id);
                    else if (!f.is_folder) handleFileClick(f.id, f.name);
                };
                card.innerHTML = '<div class="file-card-icon">' + typeIcon + '</div>' +
                    '<div class="file-card-name" title="' + f.name + '">' + f.name + '</div>' +
                    '<div class="file-card-size">' + sizeStr + '</div>' +
                    '<div class="file-card-actions" onclick="event.stopPropagation()" style="margin-top:8px;">' +
                        actionCellHTML +
                    '</div>';
                gridView.appendChild(card);
            }
        }
    });
}