/**
 * CrowGram - Modular Internationalization (i18n) System
 * Supports: Russian (ru), English (en), with easy extensibility for additional languages.
 */
(function() {
    const STORAGE_KEY = 'crowgram_lang';
    const DEFAULT_LANG = 'ru';

    const dictionaries = {
        ru: {
            common: {
                save: 'Сохранить',
                cancel: 'Отмена',
                close: 'Закрыть',
                back: 'Назад',
                next: 'Далее',
                finish: 'Завершить',
                delete: 'Удалить',
                edit: 'Редактировать',
                loading: 'Загрузка...',
                success: 'Успешно',
                error: 'Ошибка',
                confirm: 'Подтвердить',
                refresh: 'Обновить',
                select: 'Выбрать',
                copy: 'Копировать',
                move: 'Переместить',
                name: 'Имя',
                size: 'Размер',
                date: 'Дата',
                type: 'Тип',
                actions: 'Действия',
                files: 'файлов',
                folders: 'папок',
                mb: 'МБ',
                gb: 'ГБ'
            },
            sidebar: {
                overview: 'Оглавление',
                music: 'CrowMusic',
                trash: 'Корзина',
                commander: 'CrowCommander',
                drives: 'ДИСКИ',
                addDrive: 'Добавить диск',
                plugins: 'Плагины',
                settings: 'Настройки',
                wizard: 'Мастер настройки',
                spaceUsed: 'ЗАНЯТО МЕСТА',
                filesCount: 'Файлы:',
                foldersCount: 'Папки:',
                collapseMenu: 'Свернуть меню',
                expandMenu: 'Развернуть меню'
            },
            header: {
                title: 'CROWGRAM CLOUD',
                statusReady: '🟢 СИСТЕМА ГОТОВА ({user})',
                statusUnauth: '🔴 ТРЕБУЕТСЯ АВТОРИЗАЦИЯ',
                statusChecking: '🔄 ПРОВЕРКА СВЯЗИ...',
                themeDefault: '🎨 Linear Dark',
                themeGemini: '✨ Google Gemini',
                themeYandexDisk: '🟡 Яндекс Диск',
                themeRetroGreen: '📟 CRT Зеленый терминал',
                themeRetroAmber: '📺 Янтарный VT220',
                themeZXSpectrum: '🕹️ ZX Spectrum (8-bit)',
                themeDendy: '🎮 Dendy / NES (8-bit)',
                langRu: '🇷🇺 Русский',
                langEn: '🇬🇧 English'
            },
            toolbar: {
                dropZoneText: 'ПЕРЕТАЩИТЕ ФАЙЛЫ ИЛИ ПАПКИ ДЛЯ ЗАГРУЗКИ В ГНЕЗДО',
                pasteHere: '📋 Вставить сюда',
                viewTable: '📑 Таблица',
                viewGridLarge: '🔲 Крупные значки',
                viewGridSmall: '🔳 Мелкие значки',
                searchPlaceholder: 'Поиск файлов...',
                sortDateDesc: 'Сначала новые',
                sortDateAsc: 'Сначала старые',
                sortNameAsc: 'Имя (А-Я)',
                sortNameDesc: 'Имя (Я-А)',
                sortSizeDesc: 'Размер (Крупные)',
                sortSizeAsc: 'Размер (Мелкие)',
                newFolder: '+ Новая папка',
                emptyTrash: '🗑 Очистить корзину'
            },
            batch: {
                selected: 'Выбрано: {count}',
                downloadFiles: '📄 Скачать файлами',
                downloadZip: '📦 Скачать ZIP',
                move: '📋 Перенести',
                toTrash: '🗑 В корзину'
            },
            table: {
                colFav: '⭐',
                colName: 'ИМЯ',
                colSize: 'РАЗМЕР',
                colDate: 'ДАТА',
                colActions: 'ДЕЙСТВИЯ',
                folderTag: '<ПАПКА>',
                emptyFolder: 'Папка пуста. Перетащите файлы для загрузки.',
                rootBreadcrumb: 'Корень'
            },
            queue: {
                title: 'Загрузка файлов ({progress})',
                clearCompleted: 'Очистить завершенные',
                toggle: 'Свернуть/Развернуть',
                uploading: 'Загрузка...',
                completed: 'Завершено',
                failed: 'Ошибка'
            },
            settings: {
                title: 'НАСТРОЙКИ ПОДКЛЮЧЕНИЯ',
                langSelectLabel: 'ЯЗЫК ИНТЕРФЕЙСА:',
                themeSelectLabel: 'ТЕМА ОФОРМЛЕНИЯ:',
                apiIdLabel: 'API ID:',
                apiHashLabel: 'API HASH:',
                chunkSizeLabel: 'РАЗМЕР ЧАНКА НАРЕЗКИ:',
                maxUploadsLabel: 'МАКС. ОДНОВРЕМЕННЫХ ЗАГРУЗОК:',
                saveConfigBtn: 'СОХРАНИТЬ КОНФИГУРАЦИЮ',
                authTitle: 'АВТОРИЗАЦИЯ В TELEGRAM',
                statusAuthorized: 'АВТОРИЗОВАН 🟢',
                statusNotAuthorized: 'НЕ АВТОРИЗОВАН 🔴',
                authorizedAs: '✓ Вы авторизованы как: {name}',
                logoutBtn: '🚪 ВЫЙТИ ИЗ TELEGRAM',
                phonePrompt: 'Введите номер телефона для получения кода входа в Telegram:',
                phonePlaceholder: '+79801234567',
                getCodeBtn: 'ПОЛУЧИТЬ КОД',
                codePrompt: '📩 Код отправлен в Telegram. Введите его:',
                codePlaceholder: '12345',
                signInBtn: 'ВОЙТИ',
                passPrompt: '🔐 Требуется двухфакторный пароль (2FA):',
                passPlaceholder: 'Облачный пароль',
                submit2faBtn: 'ПОДТВЕРДИТЬ',
                appPassTitle: 'ЗАЩИТА ПАРОЛЕМ ПРИЛОЖЕНИЯ',
                enablePassLabel: 'Включить пароль входа:',
                newPassPlaceholder: 'Новый пароль',
                confirmPassPlaceholder: 'Повторите новый пароль',
                passHintPlaceholder: 'Подсказка для пароля',
                updatePassBtn: 'ОБНОВИТЬ ПАРОЛЬ',
                backupTitle: 'РЕЗЕРВНОЕ КОПИРОВАНИЕ (JSON)',
                backupDesc: 'Экспорт и импорт полной базы данных без повторной передачи файлов в сеть.',
                exportBackupBtn: '📥 Скачать дамп (JSON)',
                importBackupBtn: '📤 Восстановить из файла',
                syncTitle: 'СИНХРОНИЗАЦИЯ (ОБЛАКО)',
                syncDesc: 'Структура файлов и дисков сохраняется в вашем Избранном (Saved Messages).',
                pullSyncBtn: '📥 Скачать из Telegram',
                pushSyncBtn: '📤 Сохранить принудительно',
                backupSuccess: '✓ Резервная копия успешно восстановлена!',
                backupError: 'Ошибка при восстановлении базы данных'
            },
            driveModal: {
                title: 'ДОБАВЛЕНИЕ ДИСКА',
                driveLetterLabel: 'БУКВА ДИСКА:',
                driveLabelLabel: 'МЕТКА (НАЗВАНИЕ):',
                driveLabelPlaceholder: 'Например: Фильмы, Документы, Общий',
                actionLabel: 'ЦЕЛЕВОЙ КАНАЛ В TELEGRAM:',
                createNewRadio: 'Создать новый приватный канал',
                linkExistingRadio: 'Привязать к «Избранное» (Saved Messages) или каналу',
                newChannelTitleLabel: 'НАЗВАНИЕ КАНАЛА В TELEGRAM:',
                newChannelTitlePlaceholder: 'CrowGram Storage Channel',
                existingChannelLabel: 'ВЫБЕРИТЕ КАНАЛ ИЛИ ДИАЛОГ:',
                savedMessagesOption: '💬 Избранное (Saved Messages)',
                saveBtn: 'СОЗДАТЬ ДИСК',
                cancelBtn: 'ОТМЕНА'
            },
            wizard: {
                title: '⚔️ МАСТЕР НАСТРОЙКИ CROWGRAM',
                subtitle: 'Быстрый старт: ваше персональное безлимитное облако за 1 минуту',
                step1_tab: '1. Язык',
                step2_tab: '2. Telegram API',
                step3_tab: '3. Вход в аккаунт',
                step4_tab: '4. Создание диска',
                step5_tab: '5. Готово',
                step1_title: 'Выберите язык интерфейса / Select Language',
                step1_desc: 'Вы сможете изменить язык в любой момент в верхнем меню или в настройках.',
                step1_ru_title: 'Русский',
                step1_ru_desc: 'Русский язык интерфейса со всеми подсказками',
                step1_en_title: 'English',
                step1_en_desc: 'English interface language with full guidance',
                step2_title: 'Параметры Telegram API',
                step2_desc: 'Для прямого подключения к облаку Telegram требуются ключи API ID и API Hash. Получить их бесплатно можно на сайте my.telegram.org (раздел «API development tools»).',
                step2_link: 'Открыть my.telegram.org ↗',
                step3_title: 'Авторизация в Telegram',
                step3_desc: 'Введите номер телефона вашего аккаунта Telegram. Код подтверждения придёт в официальное приложение Telegram.',
                step4_title: 'Создание первого облачного диска',
                step4_desc: 'Файлы будут автоматически шифроваться, нарезаться на чанки и безопасно сохраняться в Telegram.',
                step4_default_drive: 'Основной диск',
                orDivider: '— ИЛИ —',
                step4_restore_title: 'У вас уже есть облако CrowGram?',
                step4_restore_desc: 'Восстановите все ваши диски, папки и файлы в 1 клик без создания пустого диска.',
                step4_restore_tg: '📥 Восстановить из Telegram (Pull)',
                step4_restore_file: '📁 Загрузить бэкап из файла (.json)',
                wizard_or_divider: '— ИЛИ —',
                wizard_restore_title: 'У вас уже есть облако CrowGram?',
                wizard_restore_tg: 'Восстановить из Telegram',
                wizard_restore_file: 'Загрузить бэкап из файла',
                step5_title: '🎉 Настройка успешно завершена!',
                step5_desc: 'CrowGram полностью готов к работе. Загружайте файлы любого размера, стримьте видео, слушайте аудио и управляйте архивами!',
                step5_restore_title: '📥 Восстановление существующей базы:',
                step5_restore_desc: 'Если у вас уже была база на этом аккаунте или сохранённый JSON-дамп',
                step5_pull_btn: '📥 Из Telegram (Pull)',
                step5_import_btn: '📄 Из файла (.json)',
                openStorageBtn: '🚀 ОТКРЫТЬ ХРАНИЛИЩЕ'
            },
            commander: {
                title: 'CROWCOMMANDER',
                preview: 'F3 Просмотр',
                edit: 'F4 Правка',
                copy: 'F5 Копия ➔',
                move: 'F6 Перенос ➔',
                newFolder: 'F7 Нов. папка',
                delete: 'F8 Удалить',
                switchPanel: 'Tab Смена панели',
                swapPanels: '⇄ Swap',
                refreshPanels: '🔄 Обновить',
                filterPlaceholder: 'Фильтр...',
                colName: 'Имя файла',
                colType: 'Тип',
                colSize: 'Размер',
                colDate: 'Дата',
                promptNewFolder: 'Название новой папки:',
                statusItems: '📁 {folders} папок, 📄 {files} файлов ({size})',
                statusSelected: 'Выделено: {count} ({size})',
                toastCopied: '✓ Успешно скопировано ({count})',
                toastMoved: '✓ Успешно перемещено ({count})',
                toastDeleted: '🗑 Удалено ({count})',
                toastFolderCreated: '📁 Папка создана: {name}',
                toastSwap: 'Панели поменялись местами',
                toastRefreshed: 'Панели обновлены'
            },
            messages: {
                folderCreated: 'Папка создана',
                filesUploaded: 'Файлы успешно загружены',
                deletedSuccess: 'Успешно удалено',
                movedSuccess: 'Успешно перемещено',
                copiedSuccess: 'Успешно скопировано',
                syncSuccess: 'Синхронизация выполнена',
                configSaved: 'Конфигурация сохранена',
                errorGeneral: 'Произошла ошибка при выполнении операции',
                confirmDelete: 'Удалить выбранные элементы ({count} шт.)?',
                confirmEmptyTrash: 'Очистить корзину навсегда? Все удаленные файлы будут стерты.',
                promptFolderName: 'Введите имя папки:'
            }
        },
        en: {
            common: {
                save: 'Save',
                cancel: 'Cancel',
                close: 'Close',
                back: 'Back',
                next: 'Next',
                finish: 'Finish',
                delete: 'Delete',
                edit: 'Edit',
                loading: 'Loading...',
                success: 'Success',
                error: 'Error',
                confirm: 'Confirm',
                refresh: 'Refresh',
                select: 'Select',
                copy: 'Copy',
                move: 'Move',
                name: 'Name',
                size: 'Size',
                date: 'Date',
                type: 'Type',
                actions: 'Actions',
                files: 'files',
                folders: 'folders',
                mb: 'MB',
                gb: 'GB'
            },
            sidebar: {
                overview: 'Overview',
                music: 'CrowMusic',
                trash: 'Trash',
                commander: 'CrowCommander',
                drives: 'DRIVES',
                addDrive: 'Add Drive',
                plugins: 'Plugins',
                settings: 'Settings',
                wizard: 'Setup Wizard',
                spaceUsed: 'STORAGE USED',
                filesCount: 'Files:',
                foldersCount: 'Folders:',
                collapseMenu: 'Collapse menu',
                expandMenu: 'Expand menu'
            },
            header: {
                title: 'CROWGRAM CLOUD',
                statusReady: '🟢 SYSTEM READY ({user})',
                statusUnauth: '🔴 AUTHORIZATION REQUIRED',
                statusChecking: '🔄 CHECKING CONNECTION...',
                themeDefault: '🎨 Linear Dark',
                themeGemini: '✨ Google Gemini',
                themeYandexDisk: '🟡 Yandex Disk',
                themeRetroGreen: '📟 CRT Green Terminal',
                themeRetroAmber: '📺 Amber VT220',
                themeZXSpectrum: '🕹️ ZX Spectrum (8-bit)',
                themeDendy: '🎮 Dendy / NES (8-bit)',
                langRu: '🇷🇺 Русский',
                langEn: '🇬🇧 English'
            },
            toolbar: {
                dropZoneText: 'DRAG & DROP FILES OR FOLDERS HERE TO UPLOAD',
                pasteHere: '📋 Paste Here',
                viewTable: '📑 Table',
                viewGridLarge: '🔲 Large Icons',
                viewGridSmall: '🔳 Small Icons',
                searchPlaceholder: 'Search files...',
                sortDateDesc: 'Newest first',
                sortDateAsc: 'Oldest first',
                sortNameAsc: 'Name (A-Z)',
                sortNameDesc: 'Name (Z-A)',
                sortSizeDesc: 'Size (Largest)',
                sortSizeAsc: 'Size (Smallest)',
                newFolder: '+ New Folder',
                emptyTrash: '🗑 Empty Trash'
            },
            batch: {
                selected: 'Selected: {count}',
                downloadFiles: '📄 Download Files',
                downloadZip: '📦 Download ZIP',
                move: '📋 Move',
                toTrash: '🗑 To Trash'
            },
            table: {
                colFav: '⭐',
                colName: 'NAME',
                colSize: 'SIZE',
                colDate: 'DATE',
                colActions: 'ACTIONS',
                folderTag: '<DIR>',
                emptyFolder: 'Folder is empty. Drag and drop files to upload.',
                rootBreadcrumb: 'Root'
            },
            queue: {
                title: 'File Upload ({progress})',
                clearCompleted: 'Clear completed',
                toggle: 'Collapse/Expand',
                uploading: 'Uploading...',
                completed: 'Completed',
                failed: 'Failed'
            },
            settings: {
                title: 'CONNECTION SETTINGS',
                langSelectLabel: 'INTERFACE LANGUAGE:',
                themeSelectLabel: 'COLOR THEME:',
                apiIdLabel: 'API ID:',
                apiHashLabel: 'API HASH:',
                chunkSizeLabel: 'CHUNK SLICE SIZE:',
                maxUploadsLabel: 'MAX CONCURRENT UPLOADS:',
                saveConfigBtn: 'SAVE CONFIGURATION',
                authTitle: 'TELEGRAM AUTHORIZATION',
                statusAuthorized: 'AUTHORIZED 🟢',
                statusNotAuthorized: 'NOT AUTHORIZED 🔴',
                authorizedAs: '✓ You are authorized as: {name}',
                logoutBtn: '🚪 LOG OUT OF TELEGRAM',
                phonePrompt: 'Enter your phone number to receive Telegram login code:',
                phonePlaceholder: '+1234567890',
                getCodeBtn: 'GET CODE',
                codePrompt: '📩 Code sent to your Telegram. Enter code:',
                codePlaceholder: '12345',
                signInBtn: 'SIGN IN',
                passPrompt: '🔐 Two-Factor Authentication password required (2FA):',
                passPlaceholder: 'Cloud Password',
                submit2faBtn: 'CONFIRM',
                appPassTitle: 'APP PASSWORD PROTECTION',
                enablePassLabel: 'Enable login password:',
                newPassPlaceholder: 'New Password',
                confirmPassPlaceholder: 'Confirm New Password',
                passHintPlaceholder: 'Password Hint',
                passEmailPlaceholder: 'Recovery Email',
                updatePassBtn: 'UPDATE PASSWORD',
                backupTitle: 'BACKUP & RESTORE (JSON)',
                backupDesc: 'Export and import full database snapshot without re-uploading file data.',
                exportBackupBtn: '📥 Export Dump (JSON)',
                importBackupBtn: '📤 Restore from File',
                syncTitle: 'CLOUD SYNCHRONIZATION',
                syncDesc: 'File and drive index structure is preserved in your Saved Messages.',
                pullSyncBtn: '📥 Pull from Telegram',
                pushSyncBtn: '📤 Push to Telegram',
                backupSuccess: '✓ Database backup restored successfully!',
                backupError: 'Error restoring database backup'
            },
            driveModal: {
                title: 'ADD STORAGE DRIVE',
                driveLetterLabel: 'DRIVE LETTER:',
                driveLabelLabel: 'LABEL (NAME):',
                driveLabelPlaceholder: 'e.g.: Movies, Documents, Shared',
                actionLabel: 'TELEGRAM TARGET:',
                createNewRadio: 'Create a new private channel',
                linkExistingRadio: 'Link to Saved Messages or existing channel',
                newChannelTitleLabel: 'TELEGRAM CHANNEL NAME:',
                newChannelTitlePlaceholder: 'CrowGram Storage Channel',
                existingChannelLabel: 'SELECT CHANNEL OR DIALOG:',
                savedMessagesOption: '💬 Saved Messages',
                saveBtn: 'CREATE DRIVE',
                cancelBtn: 'CANCEL'
            },
            wizard: {
                title: '⚔️ CROWGRAM SETUP WIZARD',
                subtitle: 'Quick start: your personal unlimited cloud in 1 minute',
                step1_tab: '1. Language',
                step2_tab: '2. Telegram API',
                step3_tab: '3. Log In',
                step4_tab: '4. Create Drive',
                step5_tab: '5. Ready',
                step1_title: 'Select Interface Language / Выберите язык',
                step1_desc: 'You can change the language anytime in the top bar or settings.',
                step1_ru_title: 'Русский',
                step1_ru_desc: 'Russian interface language with all tooltips',
                step1_en_title: 'English',
                step1_en_desc: 'English interface language with full guidance',
                step2_title: 'Telegram API Credentials',
                step2_desc: 'API ID and API Hash keys are required to connect directly to Telegram cloud. You can get them for free at my.telegram.org (API development tools section).',
                step2_link: 'Open my.telegram.org ↗',
                step3_title: 'Telegram Authorization',
                step3_desc: 'Enter your Telegram phone number. Confirmation code will arrive in your Telegram app.',
                step4_title: 'Create Your First Virtual Drive',
                step4_desc: 'Files will be automatically encrypted, chunked, and safely stored in Telegram.',
                step4_default_drive: 'Main Drive',
                orDivider: '— OR —',
                step4_restore_title: 'Already have a CrowGram cloud?',
                step4_restore_desc: 'Restore all your drives, folders and files in 1 click without creating a blank drive.',
                step4_restore_tg: '📥 Restore from Telegram (Pull)',
                step4_restore_file: '📁 Load backup from file (.json)',
                wizard_or_divider: '— OR —',
                wizard_restore_title: 'Already have a CrowGram cloud?',
                wizard_restore_tg: 'Restore from Telegram',
                wizard_restore_file: 'Load backup from file',
                step5_title: '🎉 Setup Completed Successfully!',
                step5_desc: 'CrowGram is ready to go. Upload files of any size, stream video, play music, and manage files!',
                step5_restore_title: '📥 Restore Existing Database:',
                step5_restore_desc: 'If you already have a database in Telegram or a saved JSON dump',
                step5_pull_btn: '📥 From Telegram (Pull)',
                step5_import_btn: '📄 From File (.json)',
                openStorageBtn: '🚀 OPEN STORAGE'
            },
            commander: {
                title: 'CROWCOMMANDER',
                preview: 'F3 View',
                edit: 'F4 Edit',
                copy: 'F5 Copy ➔',
                move: 'F6 Move ➔',
                newFolder: 'F7 New Folder',
                delete: 'F8 Delete',
                switchPanel: 'Tab Switch Panel',
                swapPanels: '⇄ Swap',
                refreshPanels: '🔄 Refresh',
                filterPlaceholder: 'Filter...',
                colName: 'File Name',
                colType: 'Type',
                colSize: 'Size',
                colDate: 'Date',
                promptNewFolder: 'New folder name:',
                statusItems: '📁 {folders} folders, 📄 {files} files ({size})',
                statusSelected: 'Selected: {count} ({size})',
                toastCopied: '✓ Successfully copied ({count})',
                toastMoved: '✓ Successfully moved ({count})',
                toastDeleted: '🗑 Deleted ({count})',
                toastFolderCreated: '📁 Folder created: {name}',
                toastSwap: 'Panels swapped',
                toastRefreshed: 'Panels refreshed'
            },
            messages: {
                folderCreated: 'Folder created',
                filesUploaded: 'Files uploaded successfully',
                deletedSuccess: 'Successfully deleted',
                movedSuccess: 'Successfully moved',
                copiedSuccess: 'Successfully copied',
                syncSuccess: 'Synchronization completed',
                configSaved: 'Configuration saved',
                errorGeneral: 'An error occurred during the operation',
                confirmDelete: 'Delete selected items ({count})?',
                confirmEmptyTrash: 'Empty trash permanently? All deleted items will be lost.',
                promptFolderName: 'Enter folder name:'
            }
        }
    };

    class CrowI18nEngine {
        constructor() {
            this.currentLang = this.detectLanguage();
        }

        detectLanguage() {
            try {
                const saved = localStorage.getItem(STORAGE_KEY);
                if (saved && dictionaries[saved]) return saved;
                
                const navLang = (navigator.language || navigator.userLanguage || '').substring(0, 2).toLowerCase();
                if (dictionaries[navLang]) return navLang;
            } catch (e) {}
            return DEFAULT_LANG;
        }

        getLanguage() {
            return this.currentLang;
        }

        getAvailableLanguages() {
            return [
                { code: 'ru', name: 'Русский', flag: '🇷🇺' },
                { code: 'en', name: 'English', flag: '🇬🇧' }
            ];
        }

        setLanguage(lang) {
            if (!dictionaries[lang]) {
                console.warn(`[i18n] Unknown language code: ${lang}`);
                return false;
            }
            this.currentLang = lang;
            try {
                localStorage.setItem(STORAGE_KEY, lang);
            } catch (e) {}

            document.documentElement.lang = lang;
            this.applyTranslations();
            this.syncLanguageSelectors();

            if (window.CrowAPI && typeof window.CrowAPI.emit === 'function') {
                window.CrowAPI.emit('languageChanged', lang);
            }
            return true;
        }

        registerTranslations(namespace, translationsObj) {
            if (!namespace || typeof namespace !== 'string' || !translationsObj || typeof translationsObj !== 'object') {
                console.warn('[i18n] Invalid arguments for registerTranslations', namespace, translationsObj);
                return false;
            }

            for (const lang in translationsObj) {
                if (!dictionaries[lang]) {
                    dictionaries[lang] = {};
                }
                if (!dictionaries[lang][namespace]) {
                    dictionaries[lang][namespace] = {};
                }
                Object.assign(dictionaries[lang][namespace], translationsObj[lang]);
            }

            // Re-apply translations across the DOM
            this.applyTranslations();
            return true;
        }

        _lookup(dict, keys) {
            if (!dict || typeof dict !== 'object') return null;
            let val = dict;
            for (const k of keys) {
                if (val && typeof val === 'object' && k in val) {
                    val = val[k];
                } else {
                    return null;
                }
            }
            return val;
        }

        t(path, params = {}) {
            if (!path || typeof path !== 'string') return '';
            
            const keys = path.split('.');

            // 1. Try current language
            let val = this._lookup(dictionaries[this.currentLang], keys);

            // 2. Fallback to English ('en') if missing in current language
            if ((val === null || val === undefined) && this.currentLang !== 'en') {
                val = this._lookup(dictionaries['en'], keys);
            }

            // 3. Fallback to Russian ('ru') as base fallback
            if ((val === null || val === undefined) && this.currentLang !== 'ru') {
                val = this._lookup(dictionaries['ru'], keys);
            }

            // 4. If still not found, return key path as last resort
            if (val === null || val === undefined) {
                return path;
            }

            if (typeof val !== 'string') {
                return typeof val === 'number' ? String(val) : path;
            }

            // Parameter substitution {paramName}
            return val.replace(/\{(\w+)\}/g, (_, k) => (k in params ? params[k] : `{${k}}`));
        }

        applyTranslations(root = document) {
            if (!root) return;

            // 1. Text content: data-i18n
            root.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (key) {
                    const text = this.t(key);
                    if (text && text !== key) {
                        el.textContent = text;
                    }
                }
            });

            // 2. HTML content: data-i18n-html
            root.querySelectorAll('[data-i18n-html]').forEach(el => {
                const key = el.getAttribute('data-i18n-html');
                if (key) {
                    const html = this.t(key);
                    if (html && html !== key) {
                        el.innerHTML = html;
                    }
                }
            });

            // 3. Placeholders: data-i18n-placeholder
            root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
                const key = el.getAttribute('data-i18n-placeholder');
                if (key) {
                    const ph = this.t(key);
                    if (ph && ph !== key) {
                        el.placeholder = ph;
                    }
                }
            });

            // 4. Tooltips / Titles: data-i18n-title
            root.querySelectorAll('[data-i18n-title]').forEach(el => {
                const key = el.getAttribute('data-i18n-title');
                if (key) {
                    const title = this.t(key);
                    if (title && title !== key) {
                        el.title = title;
                    }
                }
            });
        }

        syncLanguageSelectors() {
            const selects = document.querySelectorAll('.crow-lang-selector, #langSwitcher, #settingsLangSelect');
            selects.forEach(sel => {
                if (sel) sel.value = this.currentLang;
            });
        }
    }

    const instance = new CrowI18nEngine();
    window.CrowI18n = instance;
    window.t = (key, params) => instance.t(key, params);

    // Auto-apply on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            instance.applyTranslations();
            instance.syncLanguageSelectors();
        });
    } else {
        instance.applyTranslations();
        instance.syncLanguageSelectors();
    }
})();
