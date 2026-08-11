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
    // Явная кнопка Возврата
    document.getElementById('wizardBackToStep1Btn')?.addEventListener('click', () => {
        clearWizardError();
        document.getElementById('wizardStep2').style.display = 'none';
        document.getElementById('wizardStep1').style.display = 'block';
    });

    // Сохранение API ID / HASH
    document.getElementById('wizardSaveApiBtn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        clearWizardError();

        const apiId = document.getElementById('wizardApiId').value.trim().replace(/\D/g, '');
        const apiHash = document.getElementById('wizardApiHash').value.trim();

        if (!apiId || !apiHash) {
            showWizardError('Заполните API ID (только цифры) и API HASH!');
            return;
        }

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
        }
    });

    // Отправка телефона
    document.getElementById('wizardSendCodeBtn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        clearWizardError();

        const phone = document.getElementById('wizardPhone').value.trim();
        if (!phone) {
            showWizardError('Введите номер телефона!');
            return;
        }

        const fd = new FormData();
        fd.append('phone', phone);

        try {
            const res = await fetch('/api/auth/send-code', { method: 'POST', body: fd });
            if (res.ok) {
                document.getElementById('wizardCodeGroup').style.display = 'block';
            } else {
                const data = await res.json().catch(() => ({}));
                showWizardError(data.detail || 'Ошибка отправки кода');
            }
        } catch (e) {
            showWizardError('Ошибка сервера при отправке кода');
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
