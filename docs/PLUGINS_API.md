# 🧩 CrowGram Plugin API & Developer SDK (v2.0)

Официальная документация по созданию расширений и плагинов для **CrowGram Cloud Storage**.

---

## ⚡ Быстрый старт: Как создать плагин за 5 минут

1. Перейдите в директорию `plugins/` в корне проекта (или `src/web/static/plugins/`).
2. Создайте файл плагина, например `MyCoolPlugin.js`.
3. Зарегистрируйте плагин через глобальный объект `window.CrowAPI.registerPlugin`:
4. Обновите страницу CrowGram в браузере (**Ctrl + F5**) — плагин будет обнаружен и подключен автоматически!

### Минимальный шаблон плагина:
```javascript
(function() {
    const MyPlugin = {
        name: 'MyCoolPlugin',
        version: '1.0.0',
        author: 'Developer Name',
        description: 'Описание плагина',

        init: function(api) {
            console.log('✓ MyCoolPlugin успешно запущен!');

            // 1. Подписка на открытие файлов с расширением .log
            api.on('onFileClick', (id, name, ext) => {
                if ((ext || '').toLowerCase() === 'log') {
                    this.showLogViewer(id, name);
                    return true; // Перехватить событие, предотвратив стандартное действие
                }
                return false;
            });
        },

        showLogViewer: async function(fileId, fileName) {
            const content = await window.CrowAPI.readFile(fileId);
            window.CrowAPI.ui.createModal({
                title: `Просмотр лога: ${fileName}`,
                maxWidth: '700px',
                body: `<pre style="color: var(--accent-blue); background: rgba(0,0,0,0.5); padding: 12px; border-radius: 6px; max-height: 60vh; overflow: auto; font-family: monospace;">${content}</pre>`
            });
        }
    };

    if (window.CrowAPI) {
        window.CrowAPI.registerPlugin(MyPlugin);
    }
})();
```

---

## 📋 Таблица событий ядра (Event Bus & Hooks)

Вы можете подписываться на события ядра через `window.CrowAPI.on(eventName, callback)`:

| Событие | Аргументы callback | Описание |
| :--- | :--- | :--- |
| **`onFileClick`** | `(fileId, fileName, fileExt)` | Срабатывает при клике на файл в таблице или сетке. **Если вернуть `true`**, стандартное открытие/скачивание отменяется. |
| **`onFolderChange`** | `(folderId, driveId)` | Срабатывает при переходе пользователя в другую папку или на другой диск. |
| **`themeChanged`** | `(themeName)` | Срабатывает при переключении темы оформления (`default`, `gemini`, `yandex-disk`, `retro-green`, `retro-amber`, `zx-spectrum`, `dendy`). |
| **`languageChanged`** | `(langCode)` | Срабатывает при смене языка интерфейса (`ru`, `en`, etc.). |
| **`onAppReady`** | `()` | Срабатывает один раз, когда ядро CrowGram, диски и плагины завершили инициализацию. |
| **`onFileUpload`** | `(fileInfo)` | Срабатывает после успешной загрузки файла в облако. |
| **`onFileDelete`** | `(fileId)` | Срабатывает при перемещении файла или папки в корзину. |

---

## 🌐 Интернационализация (i18n) для сторонних плагинов

CrowGram предоставляет модульную систему локализации `window.CrowI18n`. Каждый плагин может зарегистрировать собственное пространство имён со словарями для любых языков:

### 1. Регистрация словарей
```javascript
if (window.CrowI18n) {
    window.CrowI18n.registerTranslations('myPlugin', {
        ru: {
            title: 'Мой заголовок',
            btnCopy: 'Копировать',
            copiedMsg: 'Успешно скопировано!',
            stats: 'Всего файлов: {count}, размер: {size}'
        },
        en: {
            title: 'My Title',
            btnCopy: 'Copy',
            copiedMsg: 'Copied successfully!',
            stats: 'Total files: {count}, size: {size}'
        }
    });
}
```

### 2. Получение перевода в JS
```javascript
// Обычный вызов
const title = window.CrowI18n.t('myPlugin.title');

// Вызов с параметрической подстановкой {paramName}
const stats = window.CrowI18n.t('myPlugin.stats', { count: 42, size: '120 MB' });

// Короткий глобальный алиас
const btnText = window.t('myPlugin.btnCopy');
```

> **Автоматический Fallback:** Если запрашиваемый ключ отсутствует в текущем языке, система автоматически пробует английский (`en`), затем русский (`ru`), и только если ключ не найден нигде — возвращает сам переданный путь ключа.

---

## 🎨 Интеграция с дизайн-системой и темами

Все плагины автоматически наследуют активную тему оформления, используя стандартные CSS-переменные CrowGram:

```css
/* Пример использования CSS переменных темы внутри плагина */
.my-plugin-panel {
    background: var(--bg-surface);
    color: var(--text-primary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-panel);
    box-shadow: var(--shadow-md);
}

.my-plugin-button {
    background: var(--accent-blue);
    color: #fff;
    border-radius: var(--radius-control);
}
```

### Доступные токены оформления:
* **Фоны:** `var(--bg-main)`, `var(--bg-surface)`, `var(--bg-tertiary)`, `var(--bg-elevated)`
* **Текст:** `var(--text-primary)`, `var(--text-secondary)`, `var(--text-muted)`
* **Границы:** `var(--border-subtle)`, `var(--border-hover)`, `var(--border-focus)`
* **Цвета типов файлов:** `var(--accent-blue)`, `var(--accent-green)`, `var(--accent-amber)`, `var(--accent-red)`
* **Скругления:** `var(--radius-panel)`, `var(--radius-card)`, `var(--radius-control)`

---

## 🛠️ Методы API (`window.CrowAPI`)

### 1. Доступ к состоянию и файлам:
* **`CrowAPI.getCurrentDrive()`** — возвращает ID текущего диска (число).
* **`CrowAPI.getCurrentFolder()`** — возвращает ID текущей открытой папки (0 = корень).
* **`CrowAPI.getFiles()`** — возвращает массив файлов в текущей папке.
* **`CrowAPI.getAllFiles()`** — возвращает все файлы текущего диска.
* **`CrowAPI.getTheme()`** — возвращает имя активной темы оформления.
* **`CrowAPI.getLanguage()`** — возвращает текущий код языка (`ru`, `en`).
* **`CrowAPI.reloadFiles()`** — асинхронно перезагружает список файлов с сервера.

### 2. Чтение и запись файлов:
* **`CrowAPI.readFile(fileId)`** ➔ `Promise<string>`
  Асинхронно скачивает и возвращает текстовое содержимое файла.
* **`CrowAPI.saveFile(fileId, fileName, textContent)`** ➔ `Promise<number>`
  Сохраняет/перезаписывает текстовый файл на сервере.

### 3. UI-компоненты:
* **`CrowAPI.ui.createModal(options)`** ➔ `{ overlay, panel, close }`
  Создает красивое модальное окно с плавными анимациями, заголовком, крестиком закрытия и поддержкой тем.
  *Параметры `options`:* `title`, `body`, `footer`, `maxWidth`, `width`, `zIndex`.
* **`CrowAPI.ui.addBottomBar(id, html)`** ➔ `HTMLElement`
  Добавляет фиксированную нижнюю плашку (для аудиоплееров, статус-баров и т.д.).

---

## 📦 Эталонный пример плагина

Полный исходный код плагина-примера доступен в файле [src/web/static/plugins/DemoMarkdownViewer.js](file:///g:/projects/CrowGram/src/web/static/plugins/DemoMarkdownViewer.js).