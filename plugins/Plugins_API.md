# 🧩 CrowGram Plugin API (SDK v1.0)

Official documentation for developing third-party plugins and extensions for **CrowGram Cloud Storage**.

---

## 🚀 Quick Start

1. Navigate to the `plugins/` directory in the root of the project.
2. Create your JavaScript file (e.g., `my_custom_plugin.js`).
3. CrowGram will automatically discover and load your plugin on startup.

---

## 🛠️ Plugin Architecture

Every plugin is a self-contained JavaScript module registered within the global `window.CrowAPI` object:

```javascript
(function() {
    const PLUGIN_NAME = 'MyPluginName';

    const MyPlugin = {
        init: function(api) {
            // Subscribe to hooks and register translations here
        }
    };

    window.CrowAPI.registerPlugin(PLUGIN_NAME, MyPlugin);
})();
```

---

## 🌐 Интернационализация (i18n) плагинов

CrowGram предоставляет модульную систему локализации `window.CrowI18n`, позволяющую плагинам регистрировать собственные словари переводов и автоматически поддерживать переключение языков (RU / EN / etc.).

### 1. Регистрация словарей плагина

Используйте `window.CrowI18n.registerTranslations(namespace, translationsObj)` при инициализации плагина:

```javascript
(function() {
    const PLUGIN_NAME = 'MarkdownReader';

    const MyPlugin = {
        init: function(api) {
            // Регистрация словарей с пространством имен плагина
            if (window.CrowI18n) {
                window.CrowI18n.registerTranslations('markdownReader', {
                    ru: {
                        title: 'Просмотрщик Markdown',
                        previewBtn: '👁 Предпросмотр',
                        rawBtn: '📄 Исходный код',
                        copied: 'Текст скопирован в буфер!',
                        stats: 'Слов: {words}, Символов: {chars}'
                    },
                    en: {
                        title: 'Markdown Viewer',
                        previewBtn: '👁 Preview',
                        rawBtn: '📄 Raw Code',
                        copied: 'Text copied to clipboard!',
                        stats: 'Words: {words}, Chars: {chars}'
                    }
                });
            }
        }
    };

    window.CrowAPI.registerPlugin(PLUGIN_NAME, MyPlugin);
})();
```

---

### 2. Получение перевода в коде

Используйте `window.CrowI18n.t(key, params)` или глобальный алиас `window.t(key, params)`:

```javascript
// Простое получение строки по ключу (namespace.key)
const title = window.CrowI18n.t('markdownReader.title');

// Получение строки с параметрической подстановкой {paramName}
const statsText = window.CrowI18n.t('markdownReader.stats', {
    words: 142,
    chars: 980
});

// Краткий глобальный вызов через window.t:
const btnText = window.t('markdownReader.previewBtn');
```

#### Принцип fallback (резервных языков):
1. Поиск ключа в **активном языке** интерфейса (`CrowI18n.getLanguage()`).
2. Если строка не найдена — автоматический fallback на **английский язык** (`en`).
3. Если строка не найдена в английском — fallback на **русский язык** (`ru`).
4. Если строка отсутствует вовсе — возвращается сам переданный `key`.

---

### 3. Реактивное обновление при смене языка

Подпишитесь на событие `languageChanged`, чтобы обновлять динамический интерфейс плагина при переключении языка пользователем:

```javascript
if (window.CrowAPI && typeof window.CrowAPI.on === 'function') {
    window.CrowAPI.on('languageChanged', (newLang) => {
        // Перерисовать элементы плагина или обновить заголовки
        this.updatePluginUI();
    });
}
```

---

### 4. Декларативная разметка DOM в плагинах

Если ваш плагин вставляет HTML-шаблоны или модальные окна, вы можете использовать стандартные дата-атрибуты для автоматического перевода:

* **`data-i18n="myPlugin.key"`** — заменяет `textContent` элемента.
* **`data-i18n-placeholder="myPlugin.key"`** — переводит `placeholder` инпута.
* **`data-i18n-title="myPlugin.key"`** — переводит `title` тултипа.
* **`data-i18n-html="myPlugin.key"`** — заменяет `innerHTML` элемента.

При вызове `window.CrowI18n.applyTranslations(containerElement)` все дата-атрибуты внутри контейнера обновятся автоматически.

---

## 🪝 Available Hooks

Subscribe to event hooks using `api.addHook(hookName, callback)`:

* **`onAppReady`**
  Triggered once when CrowGram has finished loading configuration, virtual drives, and UI.
  *Callback:* `function()`
* **`onFileClick`**
  Triggered when a user clicks on a file item in table or grid view.
  *Callback:* `function(fileId, fileName, fileExt)`
  *Return Value:* Return `true` to intercept the click and prevent CrowGram's default player or preview modal from opening.
* **`renderContextMenu`**
  Allows you to inject custom action buttons directly into the action column for each file or folder row.
  *Callback:* `function(fileId, fileExt, isFolder)`
  *Return Value:* An HTML string containing your button element (e.g., `<button class="action-btn">...</button>`).
* **`onFileUpload`**
  Triggered immediately after a new file is uploaded to the cloud.
  *Callback:* `function(fileInfo)` — Object containing `{ name, size }`.
* **`onFileDelete`**
  Triggered when a file or folder is moved to the trash or permanently deleted.
  *Callback:* `function(fileId)`

---

## 📡 CrowAPI Utility Methods

* **`CrowAPI.readFile(fileId)`**
  Asynchronously reads the text content of a file from the server.
  *Returns:* `Promise<string>`
* **`CrowAPI.saveFile(fileId, fileName, textContent)`**
  Asynchronously overwrites the content of a text file.
  *Returns:* `Promise<number>` (ID of the saved file)
* **`CrowAPI.ui.addBottomBar(id, html)`**
  Creates a fixed bottom widget bar across the viewport (ideal for audio players or global status monitors).
  *Returns:* `HTMLElement`
* **`CrowAPI.on(eventName, callback)`**
  Subscribes to global events (e.g., `languageChanged`).
* **`CrowAPI.emit(eventName, ...args)`**
  Emits a global event to all subscribed modules and plugins.