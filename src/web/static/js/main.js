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
        } catch (e) {}
    },
    
    addHook: function(hookName, callback) {
        if (this.hooks[hookName]) this.hooks[hookName].push(callback);
    },
    
    emit: function(hookName, ...args) {
        if (this.hooks[hookName]) {
            let handled = false;
            for (let cb of this.hooks[hookName]) {
                try { 
                    if (cb(...args) === true) handled = true; 
                } catch (e) {}
            }
            return handled;
        }
        return false;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    bindWizardEvents();
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

async function loadDrives() {
    try {
        const res = await fetch('/api/drives');
        if (res.ok) {
            const drives = await res.json();
            const container = document.getElementById('drivesList');
            if (container) {
                container.innerHTML = drives.map(d => `
                    <a href="#" class="nav-link ${d.id === currentDriveId ? 'active' : ''}" onclick="selectDrive(${d.id})">
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
        const res = await fetch(`/api/files?drive_id=${currentDriveId}&parent_id=${currentFolderId}`);
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
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #8892b0; padding: 20px;">Папка пуста</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(item => `
        <tr>
            <td><input type="checkbox" value="${item.id}"></td>
            <td>${item.is_folder ? '📁' : '📄'} ${item.name}</td>
            <td>${item.is_folder ? '--' : formatBytes(item.size)}</td>
            <td>${item.created_at || '--'}</td>
        </tr>
    `).join('');
}

function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function selectDrive(driveId) {
    currentDriveId = driveId;
    currentFolderId = 0;
    loadDrives();
    loadFiles();
}

function bindWizardEvents() {
    document.getElementById('wizardBackToStep1Btn')?.addEventListener('click', () => {
        clearWizardError();
        document.getElementById('wizardStep2').style.display = 'none';
        document.getElementById('wizardStep1').style.display = 'block';
    });

    document.getElementById('wizardSaveApiBtn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        clearWizardError();

        const btn = document.getElementById('wizardSaveApiBtn');
        const apiId = document.getElementById('wizardApiId').value.trim().replace(/\D/g, '');
        const apiHash = document.getElementById('wizardApiHash').value.trim();

        if (!apiId || !apiHash) {
            showWizardError('Заполните API ID (только цифры) и API HASH!');
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
            const data = await res.json().catch(() => ({}));

            if (res.ok) {
                document.getElementById('wizardCodeGroup').style.display = 'block';
                btn.textContent = '✅ КОД ЗАПРОШЕН. ПРОВЕРЬТЕ TELEGRAM';
            } else {
                showWizardError(data.detail || 'Ошибка отправки кода');
                btn.disabled = false;
                btn.textContent = 'ОТПРАВИТЬ КОД';
            }
        } catch (e) {
            showWizardError('Сбой сети: ' + e.message);
            btn.disabled = false;
            btn.textContent = 'ОТПРАВИТЬ КОД';
        }
    });

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

    // ШАГ 3: Создание первого диска
    document.getElementById('wizardFinishBtn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        clearWizardError();

        const btn = document.getElementById('wizardFinishBtn');
        let chatId = document.getElementById('wizardChatId').value.trim();

        if (!chatId) chatId = 'me';

        btn.disabled = true;
        btn.textContent = 'СОЗДАНИЕ ДИСКА...';

        const fd = new FormData();
        fd.append('letter', 'C');
        fd.append('label', 'Основной');
        fd.append('tg_chat_id', chatId);

        try {
            const res = await fetch('/api/drives', { method: 'POST', body: fd });
            if (res.ok) {
                document.getElementById('wizardModal').style.display = 'none';
                loadDrives();
                loadFiles();
            } else {
                const errData = await res.json().catch(() => ({}));
                showWizardError(errData.detail || 'Ошибка создания диска');
            }
        } catch (e) {
            showWizardError('Ошибка связи с сервером');
        } finally {
            btn.disabled = false;
            btn.textContent = 'ЗАВЕРШИТЬ НАСТРОЙКУ 🚀';
        }
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
                loadDrives();
                loadFiles();
            }
        }
    } catch (e) {}
}
