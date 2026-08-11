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
            } else if (res.ok) {
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

        btn.disabled = true;
        btn.textContent = 'ВХОД...';

        const fd = new FormData();
        fd.append('password', password);

        try {
            const res = await fetch('/api/auth/password', { method: 'POST', body: fd });
            if (res.ok) {
                document.getElementById('wizardStep2').style.display = 'none';
                document.getElementById('wizardStep3').style.display = 'block';
            } else {
                showWizardError('Неверный 2FA пароль!');
            }
        } catch (e) {
            showWizardError('Ошибка проверки пароля');
        } finally {
            btn.disabled = false;
            btn.textContent = 'ВОЙТИ';
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
            }
        }
    } catch (e) {}
}
