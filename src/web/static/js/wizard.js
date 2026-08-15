/**
 * CrowGram - Setup Wizard (Мастер первого запуска)
 * Step 1: Language Selection (Выбор языка)
 * Step 2: Telegram API Credentials (API ID & Hash)
 * Step 3: Telegram Authorization (Вход в аккаунт)
 * Step 4: Virtual Drive Creation (Создание диска)
 * Step 5: Finish (Завершение)
 */
(function() {
    class CrowSetupWizard {
        constructor() {
            this.currentStep = 1;
            this.totalSteps = 5;
            this.modalEl = null;
            this.phoneCodeHash = null;
        }

        init() {
            this.modalEl = document.getElementById('setupWizardModal');
            if (!this.modalEl) return;

            this.bindEvents();
            
            // Check if wizard should automatically open
            const completed = localStorage.getItem('crowgram_wizard_completed');
            if (!completed) {
                setTimeout(() => {
                    if (window.isAuthorized === false) {
                        this.open();
                    }
                }, 400);
            }
        }

        bindEvents() {
            // Language Selection Cards
            const cardRu = document.getElementById('wizardLangRu');
            const cardEn = document.getElementById('wizardLangEn');
            if (cardRu) {
                cardRu.onclick = () => {
                    window.CrowI18n.setLanguage('ru');
                    this.updateLangCards('ru');
                };
            }
            if (cardEn) {
                cardEn.onclick = () => {
                    window.CrowI18n.setLanguage('en');
                    this.updateLangCards('en');
                };
            }

            // Step Navigation Buttons
            document.querySelectorAll('[data-wizard-next]').forEach(btn => {
                btn.onclick = () => this.nextStep();
            });
            document.querySelectorAll('[data-wizard-prev]').forEach(btn => {
                btn.onclick = () => this.prevStep();
            });

            // Close button
            const closeBtn = document.getElementById('closeWizardBtn');
            if (closeBtn) closeBtn.onclick = () => this.close();

            const finishBtn = document.getElementById('wizardFinishBtn');
            if (finishBtn) finishBtn.onclick = () => this.finish();

            // Step 2: Save API Keys
            const saveApiBtn = document.getElementById('wizardSaveApiBtn');
            if (saveApiBtn) {
                saveApiBtn.onclick = async () => {
                    const apiId = document.getElementById('wizardApiId').value.trim();
                    const apiHash = document.getElementById('wizardApiHash').value.trim();
                    const chunkSize = document.getElementById('wizardChunkSize').value;

                    if (!apiId || !apiHash) {
                        this.showMsg('wizardStep2Msg', window.t('settings.apiIdLabel') + ' & ' + window.t('settings.apiHashLabel'), 'error');
                        return;
                    }

                    saveApiBtn.disabled = true;
                    try {
                        const fd = new FormData();
                        fd.append('api_id', apiId);
                        fd.append('api_hash', apiHash);
                        fd.append('chunk_size', chunkSize);
                        fd.append('max_concurrent_uploads', 3);
                        
                        const res = await fetch('/api/config', { method: 'POST', body: fd });
                        if (res.ok) {
                            this.showMsg('wizardStep2Msg', window.t('messages.configSaved'), 'success');
                            setTimeout(() => this.goToStep(3), 600);
                        } else {
                            this.showMsg('wizardStep2Msg', 'Ошибка сохранения API ключей', 'error');
                        }
                    } catch (e) {
                        this.showMsg('wizardStep2Msg', e.message, 'error');
                    } finally {
                        saveApiBtn.disabled = false;
                    }
                };
            }

            // Step 3: Send Code
            const sendCodeBtn = document.getElementById('wizardSendCodeBtn');
            if (sendCodeBtn) {
                sendCodeBtn.onclick = async () => {
                    const phone = document.getElementById('wizardPhoneInput').value.trim();
                    if (!phone) return;

                    sendCodeBtn.disabled = true;
                    sendCodeBtn.textContent = '⏳ ...';
                    try {
                        const res = await fetch('/api/auth/send-code', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ phone: phone })
                        });
                        const data = await res.json();
                        if (res.ok && data.status === 'code_sent') {
                            this.currentPhone = phone;
                            this.phoneCodeHash = data.phone_code_hash;
                            window._tg_code_hash = data.phone_code_hash;
                            const phoneBox = document.getElementById('wizardAuthPhoneBox');
                            if (phoneBox) phoneBox.style.display = 'none';
                            const codeBox = document.getElementById('wizardAuthCodeBox');
                            if (codeBox) codeBox.style.display = 'block';
                            this.showMsg('wizardStep3Msg', window.t('settings.codePrompt') || '📩 Код отправлен в Telegram. Введите его:', 'info');
                            setTimeout(() => document.getElementById('wizardCodeInput')?.focus(), 100);
                        } else {
                            this.showMsg('wizardStep3Msg', data.detail || 'Ошибка отправки кода', 'error');
                        }
                    } catch (e) {
                        this.showMsg('wizardStep3Msg', e.message, 'error');
                    } finally {
                        sendCodeBtn.disabled = false;
                        sendCodeBtn.textContent = window.t('settings.getCodeBtn');
                    }
                };
            }

            // Step 3: Sign In / Verify Code
            const signInBtn = document.getElementById('wizardSignInBtn');
            if (signInBtn) {
                signInBtn.onclick = async () => {
                    const code = document.getElementById('wizardCodeInput').value.trim();
                    const cleanCode = code.replace(/\s+/g, '').replace(/-/g, '');
                    if (!cleanCode) return;

                    const phone = this.currentPhone || window._tg_phone || document.getElementById('wizardPhoneInput').value.trim();
                    const phoneCodeHash = this.phoneCodeHash || window._tg_code_hash;

                    signInBtn.disabled = true;
                    this.showMsg('wizardStep3Msg', '⏳ Проверка кода...', 'info');
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
                        if (res.ok && (data.status === 'ok' || data.status === 'success' || data.status === 'authorized')) {
                            this.onAuthSuccess(data.user);
                        } else if (data.status === '2fa_required' || data.status === 'password_required' || data.status === 'password_needed') {
                            const codeBox = document.getElementById('wizardAuthCodeBox');
                            if (codeBox) codeBox.style.display = 'none';
                            const box2fa = document.getElementById('step3-2fa-container') || document.getElementById('wizardAuth2faBox');
                            if (box2fa) box2fa.style.display = 'block';
                            this.showMsg('wizardStep3Msg', '🔐 ' + (window.t('settings.passPrompt') || 'Введите облачный пароль 2FA'), 'info');
                            setTimeout(() => document.getElementById('wizard2faInput')?.focus(), 100);
                        } else {
                            this.showMsg('wizardStep3Msg', data.detail || 'Введён неверный код подтверждения', 'error');
                        }
                    } catch (e) {
                        this.showMsg('wizardStep3Msg', e.message, 'error');
                    } finally {
                        signInBtn.disabled = false;
                    }
                };
            }

            // Step 3: 2FA Password
            const submit2faBtn = document.getElementById('wizardSubmit2faBtn');
            const wizard2faInput = document.getElementById('wizard2faInput');

            const handle2faSubmit = async () => {
                const password = wizard2faInput ? wizard2faInput.value : '';
                if (!password) {
                    this.showMsg('wizardStep3Msg', 'Введите облачный пароль 2FA', 'error');
                    return;
                }

                if (submit2faBtn) {
                    submit2faBtn.disabled = true;
                    submit2faBtn.textContent = '⏳ ...';
                }
                this.showMsg('wizardStep3Msg', '⏳ Проверка облачного пароля (2FA)...', 'info');
                try {
                    const res = await fetch('/api/auth/verify_password', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ password: password })
                    });
                    const data = await res.json();
                    if (res.ok && (data.status === 'ok' || data.status === 'success' || data.status === 'authorized')) {
                        this.onAuthSuccess(data.user);
                    } else {
                        this.showMsg('wizardStep3Msg', data.detail || 'Неверный облачный пароль', 'error');
                    }
                } catch (e) {
                    this.showMsg('wizardStep3Msg', e.message, 'error');
                } finally {
                    if (submit2faBtn) {
                        submit2faBtn.disabled = false;
                        submit2faBtn.textContent = window.t('settings.submit2faBtn') || 'ПОДТВЕРДИТЬ';
                    }
                }
            };

            if (submit2faBtn) {
                submit2faBtn.onclick = handle2faSubmit;
            }
            if (wizard2faInput) {
                wizard2faInput.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handle2faSubmit();
                    }
                };
            }

            // Step 4: Create Drive
            const createDriveBtn = document.getElementById('wizardCreateDriveBtn');
            if (createDriveBtn) {
                createDriveBtn.onclick = async () => {
                    const letter = (document.getElementById('wizardDriveLetter').value || 'C').toUpperCase();
                    const label = document.getElementById('wizardDriveLabel').value.trim() || 'Main Drive';
                    const target = document.getElementById('wizardDriveTarget').value;

                    createDriveBtn.disabled = true;
                    try {
                        const fd = new FormData();
                        fd.append('letter', letter);
                        fd.append('label', label);
                        fd.append('action', 'link_existing');
                        fd.append('tg_chat_id', target);

                        const res = await fetch('/api/drives', { method: 'POST', body: fd });
                        if (res.ok) {
                            if (window.loadDrives) window.loadDrives();
                            this.goToStep(5);
                        } else {
                            this.showMsg('wizardStep4Msg', 'Ошибка создания диска', 'error');
                        }
                    } catch (e) {
                        this.showMsg('wizardStep4Msg', e.message, 'error');
                    } finally {
                        createDriveBtn.disabled = false;
                    }
                };
            }

            // Step 4: Quick Restore from Telegram
            const step4PullBtn = document.getElementById('btnWizardRestoreTg') || document.getElementById('wizardStep4PullBtn');
            if (step4PullBtn) {
                step4PullBtn.onclick = async () => {
                    step4PullBtn.disabled = true;
                    step4PullBtn.textContent = '⏳ ...';
                    this.showMsg('wizardStep4Msg', '⏳ Загрузка базы из Избранного Telegram...', 'info');
                    try {
                        const res = await fetch('/api/sync/pull', { method: 'POST' });
                        const data = await res.json();
                        if (res.ok) {
                            this.showMsg('wizardStep4Msg', '✓ ' + (data.message || 'База данных успешно восстановлена!'), 'success');
                            if (window.loadDrives) await window.loadDrives();
                            if (window.loadFiles) await window.loadFiles();
                            if (window.CrowAPI && typeof window.CrowAPI.reloadFiles === 'function') {
                                await window.CrowAPI.reloadFiles();
                            }
                            setTimeout(() => this.finish(), 800);
                        } else {
                            this.showMsg('wizardStep4Msg', data.detail || data.message || 'Файл синхронизации не найден в Telegram', 'error');
                        }
                    } catch (e) {
                        this.showMsg('wizardStep4Msg', e.message, 'error');
                    } finally {
                        step4PullBtn.disabled = false;
                        step4PullBtn.textContent = window.t('wizard.step4_restore_tg') || '📥 Восстановить из Telegram (Pull)';
                    }
                };
            }

            // Step 4: Import Database from File (.json)
            const step4FileBtn = document.getElementById('btnWizardRestoreFile') || document.getElementById('wizardStep4FileBtn');
            const step4FileInput = document.getElementById('wizardBackupFileInput') || document.getElementById('wizardStep4FileInput');
            if (step4FileBtn && step4FileInput) {
                step4FileBtn.onclick = () => step4FileInput.click();
                step4FileInput.onchange = async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    step4FileBtn.disabled = true;
                    step4FileBtn.textContent = '⏳ ...';
                    this.showMsg('wizardStep4Msg', '⏳ Восстановление базы из файла...', 'info');
                    try {
                        const fd = new FormData();
                        fd.append('file', file);
                        const res = await fetch('/api/backup/import', { method: 'POST', body: fd });
                        const data = await res.json();
                        if (res.ok) {
                            this.showMsg('wizardStep4Msg', '✓ ' + (data.message || 'База успешно восстановлена!'), 'success');
                            if (window.loadDrives) await window.loadDrives();
                            if (window.loadFiles) await window.loadFiles();
                            if (window.CrowAPI && typeof window.CrowAPI.reloadFiles === 'function') {
                                await window.CrowAPI.reloadFiles();
                            }
                            setTimeout(() => this.finish(), 800);
                        } else {
                            this.showMsg('wizardStep4Msg', data.detail || 'Не удалось импортировать файл', 'error');
                        }
                    } catch (err) {
                        this.showMsg('wizardStep4Msg', err.message, 'error');
                    } finally {
                        step4FileBtn.disabled = false;
                        step4FileBtn.textContent = window.t('wizard.step4_restore_file') || '📁 Загрузить бэкап из файла (.json)';
                        step4FileInput.value = '';
                    }
                };
            }

            // Step 5: Quick Restore from Telegram
            const pullSyncBtn = document.getElementById('wizardPullSyncBtn');
            if (pullSyncBtn) {
                pullSyncBtn.onclick = async () => {
                    pullSyncBtn.disabled = true;
                    pullSyncBtn.textContent = '⏳ ...';
                    this.showMsg('wizardStep5Msg', '⏳ Загрузка резервной копии из Telegram...', 'info');
                    try {
                        const res = await fetch('/api/sync/pull', { method: 'POST' });
                        const data = await res.json();
                        if (res.ok) {
                            this.showMsg('wizardStep5Msg', '✓ ' + (data.message || 'Облако успешно восстановлено!'), 'success');
                            if (window.loadDrives) await window.loadDrives();
                            if (window.loadFiles) await window.loadFiles();
                        } else {
                            this.showMsg('wizardStep5Msg', data.detail || 'Файл синхронизации не найден в Telegram', 'error');
                        }
                    } catch (e) {
                        this.showMsg('wizardStep5Msg', e.message, 'error');
                    } finally {
                        pullSyncBtn.disabled = false;
                        pullSyncBtn.textContent = window.t('wizard.step5_pull_btn') || '📥 Из Telegram (Pull)';
                    }
                };
            }

            // Step 5: Import Database from File (.json)
            const importFileBtn = document.getElementById('wizardImportFileBtn');
            const jsonFileInput = document.getElementById('wizardJsonFileInput');
            if (importFileBtn && jsonFileInput) {
                importFileBtn.onclick = () => jsonFileInput.click();
                jsonFileInput.onchange = async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    importFileBtn.disabled = true;
                    importFileBtn.textContent = '⏳ ...';
                    this.showMsg('wizardStep5Msg', '⏳ Восстановление базы из файла...', 'info');
                    try {
                        const fd = new FormData();
                        fd.append('file', file);
                        const res = await fetch('/api/backup/import', { method: 'POST', body: fd });
                        const data = await res.json();
                        if (res.ok) {
                            this.showMsg('wizardStep5Msg', '✓ ' + (data.message || 'База успешно восстановлена!'), 'success');
                            if (window.loadDrives) await window.loadDrives();
                            if (window.loadFiles) await window.loadFiles();
                        } else {
                            this.showMsg('wizardStep5Msg', data.detail || 'Не удалось импортировать файл', 'error');
                        }
                    } catch (err) {
                        this.showMsg('wizardStep5Msg', err.message, 'error');
                    } finally {
                        importFileBtn.disabled = false;
                        importFileBtn.textContent = window.t('wizard.step5_import_btn') || '📄 Из файла (.json)';
                        jsonFileInput.value = '';
                    }
                };
            }

            // Sidebar trigger
            const navWizardBtn = document.getElementById('navWizardBtn');
            if (navWizardBtn) {
                navWizardBtn.onclick = (e) => {
                    e.preventDefault();
                    this.open();
                };
            }
        }

        updateLangCards(lang) {
            const cardRu = document.getElementById('wizardLangRu');
            const cardEn = document.getElementById('wizardLangEn');
            if (cardRu) cardRu.classList.toggle('active', lang === 'ru');
            if (cardEn) cardEn.classList.toggle('active', lang === 'en');
        }

        onAuthSuccess(user) {
            const codeBox = document.getElementById('wizardAuthCodeBox');
            if (codeBox) codeBox.style.display = 'none';

            const box2fa = document.getElementById('step3-2fa-container') || document.getElementById('wizardAuth2faBox');
            if (box2fa) box2fa.style.display = 'none';

            const phoneBox = document.getElementById('wizardAuthPhoneBox');
            if (phoneBox) phoneBox.style.display = 'none';
            
            const successBox = document.getElementById('wizardAuthSuccessBox');
            if (successBox) {
                successBox.style.display = 'block';
                const name = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Telegram User';
                const userNameEl = document.getElementById('wizardAuthUserName');
                if (userNameEl) userNameEl.textContent = name;
            }
            this.showMsg('wizardStep3Msg', '✓ ' + (window.t('settings.statusAuthorized') || 'Авторизован'), 'success');

            // Enable next buttons if previously disabled
            document.querySelectorAll('#wizardStepBody3 [data-wizard-next]').forEach(btn => {
                btn.disabled = false;
            });

            setTimeout(() => this.goToStep(4), 800);
        }

        showMsg(targetId, text, type = 'info') {
            const el = document.getElementById(targetId);
            if (!el) return;
            el.textContent = text;
            el.className = `wizard-msg ${type}`;
            el.style.display = 'block';
        }

        open() {
            if (!this.modalEl) return;
            this.currentStep = 1;
            this.updateLangCards(window.CrowI18n ? window.CrowI18n.getLanguage() : 'ru');
            this.modalEl.style.display = 'flex';
            this.goToStep(1);
            this.prefillConfig();
        }

        async prefillConfig() {
            try {
                const res = await fetch('/api/config');
                if (res.ok) {
                    const cfg = await res.json();
                    const apiIdEl = document.getElementById('wizardApiId');
                    if (apiIdEl && cfg.api_id) apiIdEl.value = cfg.api_id;
                    const apiHashEl = document.getElementById('wizardApiHash');
                    if (apiHashEl && cfg.api_hash) apiHashEl.value = cfg.api_hash;
                    const phoneEl = document.getElementById('wizardPhoneInput');
                    if (phoneEl && cfg.phone) phoneEl.value = cfg.phone;
                    if (cfg.is_authorized) {
                        this.onAuthSuccess(cfg.tg_user);
                    }
                }
            } catch (e) {}
        }

        close() {
            if (this.modalEl) this.modalEl.style.display = 'none';
        }

        finish() {
            localStorage.setItem('crowgram_wizard_completed', 'true');
            this.close();
            if (window.loadConfig) window.loadConfig();
            if (window.loadDrives) window.loadDrives();
            if (window.loadFiles) window.loadFiles();
        }

        goToStep(stepNum) {
            if (stepNum < 1 || stepNum > this.totalSteps) return;
            this.currentStep = stepNum;

            // Update Stepper Nav
            for (let i = 1; i <= this.totalSteps; i++) {
                const stepHeader = document.getElementById(`wizardStepHeader${i}`);
                const stepBody = document.getElementById(`wizardStepBody${i}`);
                if (stepHeader) {
                    stepHeader.classList.toggle('active', i === stepNum);
                    stepHeader.classList.toggle('completed', i < stepNum);
                }
                if (stepBody) {
                    stepBody.style.display = i === stepNum ? 'block' : 'none';
                }
            }

            if (window.CrowI18n) {
                window.CrowI18n.applyTranslations(this.modalEl);
            }
        }

        nextStep() {
            this.goToStep(this.currentStep + 1);
        }

        prevStep() {
            this.goToStep(this.currentStep - 1);
        }
    }

    window.CrowWizardInstance = new CrowSetupWizard();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.CrowWizardInstance.init());
    } else {
        window.CrowWizardInstance.init();
    }
})();
