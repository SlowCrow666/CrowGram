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
            // Subscribe to hooks here
        }
    };

    window.CrowAPI.registerPlugin(PLUGIN_NAME, MyPlugin);
})();

```

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