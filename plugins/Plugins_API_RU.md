# 🧩 CrowGram Plugin API (SDK v1.0)

Официальная документация по разработке сторонних плагинов и расширений для облачного хранилища **CrowGram**.

---

## 🚀 Быстрый старт

1. Перейдите в папку `plugins/` в корне проекта.
2. Создайте ваш JavaScript файл (например, `my_custom_plugin.js`).
3. CrowGram автоматически обнаружит и подгрузит его при запуске приложения.

---

## 🛠️ Архитектура плагина

Каждый плагин представляет собой JS-модуль, регистрируемый в глобальном объекте `window.CrowAPI`:

```javascript
(function() {
    const PLUGIN_NAME = 'ИмяПлагина';

    const MyPlugin = {
        init: function(api) {
            // Подписка на хуки
        }
    };

    window.CrowAPI.registerPlugin(PLUGIN_NAME, MyPlugin);
})();

```

---

## 🪝 Доступные хуки (Hooks)

Подписка на хуки осуществляется методом `api.addHook(hookName, callback)`:

* **`onAppReady`**
Вызывается один раз, когда CrowGram полностью загрузил конфигурацию, диски и готов к работе.
*Callback:* `function()`
* **`onFileClick`**
Вызывается при клике пользователя по файлу в таблице или сетке.
*Callback:* `function(fileId, fileName, fileExt)`
*Возвращаемое значение:* Если вернуть `true`, стандартный предпросмотр или плеер CrowGram **не откроется** (управление полностью переходит плагину).
* **`renderContextMenu`**
Позволяет встраивать собственные кнопки действия прямо в строку каждого файла или папки.
*Callback:* `function(fileId, fileExt, isFolder)`
*Возвращаемое значение:* HTML-строка с вашим элементом (например, `<button class="action-btn">...</button>`).
* **`onFileUpload`**
Вызывается после успешной загрузки нового файла в облако.
*Callback:* `function(fileInfo)` — содержит объект `{ name, size }`.
* **`onFileDelete`**
Вызывается при перемещении элемента в корзину или его окончательном удалении.
*Callback:* `function(fileId)`

---

## 📡 Системные методы `CrowAPI`

* **`CrowAPI.readFile(fileId)`**
Асинхронно читает текстовое содержимое файла с сервера.
*Возвращает:* `Promise<string>`
* **`CrowAPI.saveFile(fileId, fileName, textContent)`**
Асинхронно перезаписывает содержимое текстового файла.
*Возвращает:* `Promise<number>` (ID сохраненного файла)
* **`CrowAPI.ui.addBottomBar(id, html)`**
Создает фиксированную нижнюю панель на экране (удобно для аудиоплееров, панелей управления или статусов).
*Возвращает:* `HTMLElement`