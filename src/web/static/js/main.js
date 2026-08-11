let currentLang = 'ru';
let isAuthorized = false;
let currentFolderId = 0;
let currentDriveId = 1;
let isTrashView = false;
let allItems = [];
let selectedFileIds = new Set();

window.CrowAPI = {
    plugins: {},
    hooks: { onFileClick: [], onAppReady: [], renderContextMenu: [] },
    registerPlugin: function(name, plugin) {
        this.plugins[name] = plugin;
        try { if (plugin.init) plugin.init(this); } catch (e) {}
    }
};

document.addEventListener('DOMContentLoaded', () => {
    bindWizardEvents();
    bindGlobalEvents();
    checkAppAuthStatus();
});

function showWizardError(msg) {
    const box = document.getElementById('wizardErrorBox');
    if (box) {
        box.style.display = 'block';
        box.innerHTML = '⚠️ ' + msg;
    }
}

function clearWizardError() {
    const box = document.getElementById('wizardErrorBox');
    if (box) box.style.display = 'none';
}

function finishAuthAndOpenApp() {
    const modal = document.getElementById('wizardModal');
    if (modal) modal.style.display = 'none';
    initAppCore();
}

async function initAppCore() {
    await loadDrives();
    await loadFiles();
    setupDragAndDrop();
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
        const endpoint = isTrashView 
            ? '/api/files/trash' 
            : `/api/files?drive_id=${currentDriveId}&parent_id=${currentFolderId}`;
        
        const res = await fetch(endpoint);
        if (res.ok) {
            const files = await res.json();
            allItems = files;
            renderFileList(files);
        }
    } catch (e) {}
}

function renderFileList(items) {
    const tbody = document.getElementById('fileList');
    if (!tbody) return;

    if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #8892b0; padding: 30px;">Папка пуста. Перетащите сюда файлы для загрузки.</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(item => `
        <tr data-id="${item.id}">
            <td><input type="checkbox" value="${item.id}"></td>
            <td style="cursor: pointer;" onclick="handleItemClick(${item.id}, ${item.is_folder})">
                ${item.is_folder ? '📁' : '📄'} <strong>${item.name}</strong>
            </td>
            <td>${item.is_folder ? '--' : formatBytes(item.size)}</td>
            <td>${item.created_at || '--'}</td>
        </tr>
    `).join('');
}

function handleItemClick(id, isFolder) {
    if (isFolder) {
        currentFolderId = id;
        loadFiles();
    } else {
        window.open('/api/download/' + id, '_blank');
    }
}

function selectDrive(driveId) {
    currentDriveId = driveId;
    currentFolderId = 0;
    isTrashView = false;
    loadDrives();
    loadFiles();
}

function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function setupDragAndDrop() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    if (!dropZone) return;

    dropZone.addEventListener('click', () => fileInput?.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
    });

    fileInput?.addEventListener('change', () => {
        if (fileInput.files.length) uploadFiles(fileInput.files);
    });
}

async function uploadFiles(files) {
    for (let file of files) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('drive_id', currentDriveId);
        fd.append('parent_id', currentFolderId);

        try {
            document.getElementById('systemStatus').textContent = 'ЗАГРУЗКА: ' + file.name;
            await fetch('/api/files/upload', { method: 'POST', body: fd });
        } catch (e) {}
    }
    document.getElementById('systemStatus').textContent = 'СИСТЕМА ГОТОВА';
    loadFiles();
}

function bindGlobalEvents() {
    document.getElementById('navDriveBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        isTrashView = false;
        currentFolderId = 0;
        loadFiles();
    });

    document.getElementById('navTrashBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        isTrashView = true;
        loadFiles();
    });

    document.getElementById('sidebarToggle')?.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.toggle('collapsed');
    });
}

function bindWizardEvents() {
    // НАЗАД К КЛЮЧАМ
    document.getElementById('wizardBackToStep1Btn')?.addEventListener('click', () => {
        clearWizardError();
        document.getElementById('wizardStep2').style.display = 'none';
        document.getElementById('wizardStep1').style.display = 'block';
    });

    // ШАГ 1: КЛЮЧИ
    document.getElementById('wizardSaveApiBtn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        clearWizardError();

        const btn = document.getElementById('wizardSaveApiBtn');
        const apiId = document.getElementById('wizardApiId').value.trim().replace(/\D/g, '');
        const apiHash = document.getElementById('wizardApiHash').value.trim();

        if (!apiId || !apiHash) {
            showWizardError('Заполните API ID и API HASH!');
            return;
        }

        btn.disabled = true;
        btn.textContent = 'СОХРАНЕНИЕ...';

        const fd = new FormData();
        fd.append('api_id', apiId);
        fd.append('api_hash', apiHash);

        try {
            const res = await fetch('/api/config', { method: 'POST', body: fd });
            if (res.ok) {
                document.getElementById('wizardStep1').style.display = 'none';
                document.getElementById('wizardStep2').style.display = 'block';
            } else {
                const errData = await res.json().catch(() => ({}));
                showWizardError(errData.detail || 'Ошибка сохранения API ключей');
            }
        } catch (err) {
            showWizardError('Ошибка связи с сервером');
        } finally {
            btn.disabled = false;
            btn.textContent = 'СОХРАНИТЬ И ДАЛЕЕ ➔';
        }
    });

    // ШАГ 2: ОТПРАВКА СМС
    document.getElementById('wizardSendCodeBtn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        clearWizardError();

        const btn = document.getElementById('wizardSendCodeBtn');
        const phone = document.getElementById('wizardPhone').value.trim();

        if (!phone) {
            showWizardError('Введите номер телефона!');
            return;
        }

        btn.disabled = true;
        btn.textContent = '⏳ ЗАПРОС КОДА У TELEGRAM...';

        const fd = new FormData();
        fd.append('phone', phone);

        try {
            const res = await fetch('/api/auth/send-code', { method: 'POST', body: fd });
            if (res.ok) {
                document.getElementById('wizardCodeGroup').style.display = 'block';
                btn.textContent = '✅ КОД ЗАПРОШЕН. ПРОВЕРЬТЕ TELEGRAM';
            } else {
                const data = await res.json().catch(() => ({}));
                showWizardError(data.detail || 'Ошибка отправки кода');
                btn.disabled = false;
                btn.textContent = 'ОТПРАВИТЬ КОД';
            }
        } catch (e) {
            showWizardError('Сбой сети при запросе кода');
            btn.disabled = false;
            btn.textContent = 'ОТПРАВИТЬ КОД';
        }
    });

    // ШАГ 2: ВХОД ПО КОДУ
    document.getElementById('wizardSignInBtn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        clearWizardError();

        const btn = document.getElementById('wizardSignInBtn');
        const code = document.getElementById('wizardCode').value.trim();

        if (!code) {
            showWizardError('Введите код подтверждения!');
            return;
        }

        btn.disabled = true;
        btn.textContent = 'ПРОВЕРКА...';

        const fd = new FormData();
        fd.append('code', code);

        try {
            const res = await fetch('/api/auth/sign-in', { method: 'POST', body: fd });
            const data = await res.json().catch(() => ({}));

            if (data.status === 'password_required') {
                document.getElementById('wizardPasswordGroup').style.display = 'block';
            } else if (res.ok && data.status === 'success') {
                document.getElementById('wizardStep2').style.display = 'none';
                document.getElementById('wizardStep3').style.display = 'block';
            } else {
                showWizardError(data.detail || 'Неверный код!');
            }
        } catch (e) {
            showWizardError('Ошибка проверки кода');
        } finally {
            btn.disabled = false;
            btn.textContent = 'ПОДТВЕРДИТЬ';
        }
    });

    // ШАГ 2: 2FA ПАРОЛЬ
    document.getElementById('wizardSubmitPasswordBtn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        clearWizardError();

        const btn = document.getElementById('wizardSubmitPasswordBtn');
        const password = document.getElementById('wizardPassword').value;

        if (!password) {
            showWizardError('Введите 2FA пароль!');
            return;
        }

        btn.disabled = true;
        btn.textContent = 'ВХОД...';

        const fd = new FormData();
        fd.append('password', password);

        try {
            const res = await fetch('/api/auth/password', { method: 'POST', body: fd });
            const data = await res.json().catch(() => ({}));

            if (res.ok && data.status === 'success') {
                document.getElementById('wizardStep2').style.display = 'none';
                document.getElementById('wizardStep3').style.display = 'block';
            } else {
                showWizardError(data.detail || 'Неверный 2FA пароль!');
            }
        } catch (e) {
            showWizardError('Ошибка проверки пароля');
        } finally {
            btn.disabled = false;
            btn.textContent = 'ВОЙТИ';
        }
    });

    // ШАГ 3: СИНХРОНИЗАЦИЯ И ДИСК
    document.getElementById('wizardStep3NextBtn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        clearWizardError();

        const btn = document.getElementById('wizardStep3NextBtn');
        let chatId = document.getElementById('wizardChatId').value.trim();
        const importInput = document.getElementById('wizardImportDbInput');

        if (!chatId) chatId = 'me';

        btn.disabled = true;
        btn.textContent = 'СОХРАНЕНИЕ ДИСКА...';

        // Если прикрепили файл импорта БД — загружаем его
        if (importInput && importInput.files.length > 0) {
            const file = importInput.files[0];
            const reader = new FileReader();
            reader.onload = async (evt) => {
                try {
                    await fetch('/api/local/import-db', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: evt.target.result
                    });
                } catch (e) {}
            };
            reader.readAsText(file);
        }

        const fd = new FormData();
        fd.append('letter', 'C');
        fd.append('label', 'Основной');
        fd.append('tg_chat_id', chatId);

        try {
            await fetch('/api/drives', { method: 'POST', body: fd });
            document.getElementById('wizardStep3').style.display = 'none';
            document.getElementById('wizardStep4').style.display = 'block';
        } catch (e) {
            showWizardError('Ошибка сохранения диска');
        } finally {
            btn.disabled = false;
            btn.textContent = 'ПЕРЕЙТИ К ЗАЩИТЕ ➔';
        }
    });

    // ШАГ 4: УСТАНОВКА ЛОКАЛЬНОГО ПАРОЛЯ ПРИЛОЖЕНИЯ
    document.getElementById('wizardFinishAllBtn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        clearWizardError();

        const btn = document.getElementById('wizardFinishAllBtn');
        const pass = document.getElementById('wizardAppPassword').value;
        const hint = document.getElementById('wizardAppPasswordHint').value;

        btn.disabled = true;
        btn.textContent = 'ФИНАЛИЗАЦИЯ...';

        if (pass) {
            const fd = new FormData();
            fd.append('password', pass);
            fd.append('hint', hint);
            try {
                await fetch('/api/config/app-password', { method: 'POST', body: fd });
            } catch (e) {}
        }

        finishAuthAndOpenApp();
    });
}

async function checkAppAuthStatus() {
    try {
        const res = await fetch('/api/config?_t=' + Date.now());
        if (res.ok) {
            const cfg = await res.json();
            if (!cfg.is_authorized) {
                document.getElementById('wizardModal').style.display = 'flex';
            } else {
                document.getElementById('wizardModal').style.display = 'none';
                initAppCore();
            }
        }
    } catch (e) {}
}
