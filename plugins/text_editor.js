window.CrowAPI.registerPlugin('TextCodeEditor', {
    init: function(api) {
        console.log('[TextCodeEditor] Инициализация локального редактора...');
        
        if (!document.getElementById('crow-editor-styles')) {
            const style = document.createElement('style');
            style.id = 'crow-editor-styles';
            style.textContent = `
                .crow-editor-overlay {
                    position: fixed;
                    top: 0; left: 0; width: 100vw; height: 100vh;
                    background: rgba(5, 10, 20, 0.85);
                    backdrop-filter: blur(8px);
                    z-index: 9999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    box-sizing: border-box;
                }
                .crow-editor-panel {
                    background: #0f172a;
                    border: 1px solid #2ec4b6;
                    border-radius: 12px;
                    width: 100%;
                    max-width: 950px;
                    height: 85vh;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.8);
                    overflow: hidden;
                }
                .crow-editor-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 20px;
                    background: rgba(255,255,255,0.03);
                    border-bottom: 1px solid rgba(255,255,255,0.08);
                }
                .crow-editor-body {
                    flex-grow: 1;
                    display: flex;
                    background: #050a14;
                    font-family: 'JetBrains Mono', Consolas, monospace;
                    font-size: 13px;
                    overflow: hidden;
                }
                .crow-editor-line-numbers {
                    padding: 12px 8px;
                    background: rgba(255,255,255,0.02);
                    color: #475569;
                    user-select: none;
                    text-align: right;
                    border-right: 1px solid rgba(255,255,255,0.05);
                    line-height: 1.5;
                    min-width: 35px;
                    overflow: hidden;
                }
                .crow-editor-textarea {
                    flex-grow: 1;
                    background: transparent;
                    border: none;
                    color: #e2e8f0;
                    padding: 12px;
                    font-family: inherit;
                    font-size: inherit;
                    line-height: 1.5;
                    resize: none;
                    outline: none;
                    white-space: pre;
                    overflow: auto;
                }
            `;
            document.head.appendChild(style);
        }

        const mounts = document.getElementById('plugin-mounts') || document.body;
        const modal = document.createElement('div');
        modal.id = 'crow-editor-modal';
        modal.className = 'crow-editor-overlay';
        modal.style.display = 'none';
        modal.innerHTML = `
            <div class="crow-editor-panel">
                <div class="crow-editor-header">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 18px;">📝</span>
                        <span id="crow-editor-filename" style="font-size: 14px; font-weight: 600; color: #ccd6f6;">filename.txt</span>
                        <span id="crow-editor-status" style="font-size: 11px; color: #2ec4b6; margin-left: 10px;"></span>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button id="crow-editor-save-btn" class="hud-btn primary" style="padding: 6px 14px; font-size: 12px; background: #2ec4b6; color: #0f172a; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">💾 Сохранить (Ctrl+S)</button>
                        <button id="crow-editor-close-btn" class="hud-btn danger" style="padding: 6px 14px; font-size: 12px; background: rgba(255,85,85,0.2); color: #ff5555; border: 1px solid #ff5555; border-radius: 6px; cursor: pointer;">✖ Закрыть</button>
                    </div>
                </div>
                <div class="crow-editor-body">
                    <div id="crow-editor-linenumbers" class="crow-editor-line-numbers">1</div>
                    <textarea id="crow-editor-textarea" class="crow-editor-textarea" spellcheck="false"></textarea>
                </div>
            </div>
        `;
        mounts.appendChild(modal);

        this.currentFileId = null;
        this.currentFileName = '';
        this.originalContent = '';
        this.isDirty = false;

        api.addHook('onFileClick', (id, name, ext) => {
            const textExts = ['txt', 'md', 'py', 'js', 'html', 'css', 'json', 'xml', 'log', 'ini', 'sh', 'bat', 'csv'];
            if (textExts.includes(ext)) {
                this.openEditor(id, name);
                return true;
            }
            return false;
        });

        this.bindEvents();
    },

    bindEvents: function() {
        const textarea = document.getElementById('crow-editor-textarea');
        const saveBtn = document.getElementById('crow-editor-save-btn');
        const closeBtn = document.getElementById('crow-editor-close-btn');

        if (textarea) {
            textarea.oninput = () => {
                this.updateLineNumbers();
                this.checkDirtyState();
            };
            textarea.onscroll = () => {
                const lineNums = document.getElementById('crow-editor-linenumbers');
                if (lineNums) lineNums.scrollTop = textarea.scrollTop;
            };
            
            textarea.onkeydown = (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    this.saveFile();
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this.closeEditor();
                }
                if (e.key === 'Tab') {
                    e.preventDefault();
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    textarea.value = textarea.value.substring(0, start) + "    " + textarea.value.substring(end);
                    textarea.selectionStart = textarea.selectionEnd = start + 4;
                    this.updateLineNumbers();
                    this.checkDirtyState();
                }
            };
        }

        if (saveBtn) saveBtn.onclick = () => this.saveFile();
        if (closeBtn) closeBtn.onclick = () => this.closeEditor();
    },

    checkDirtyState: function() {
        const textarea = document.getElementById('crow-editor-textarea');
        const status = document.getElementById('crow-editor-status');
        if (!textarea || !status) return;

        if (textarea.value !== this.originalContent) {
            this.isDirty = true;
            status.textContent = 'Изменён *';
            status.style.color = '#eab308'; // Желтый цвет для несохраненного состояния
        } else {
            this.isDirty = false;
            status.textContent = 'Готово';
            status.style.color = '#2ec4b6';
        }
    },

    updateLineNumbers: function() {
        const textarea = document.getElementById('crow-editor-textarea');
        const lineNums = document.getElementById('crow-editor-linenumbers');
        if (!textarea || !lineNums) return;

        const lines = textarea.value.split('\n').length;
        let numsHtml = '';
        for (let i = 1; i <= lines; i++) {
            numsHtml += i + '<br>';
        }
        lineNums.innerHTML = numsHtml;
    },

    openEditor: async function(id, name) {
        this.currentFileId = id;
        this.currentFileName = name;

        document.getElementById('crow-editor-filename').textContent = name;
        const status = document.getElementById('crow-editor-status');
        status.textContent = 'Загрузка...';
        status.style.color = '#2ec4b6';
        
        const modal = document.getElementById('crow-editor-modal');
        const textarea = document.getElementById('crow-editor-textarea');
        modal.style.display = 'flex';

        try {
            const text = await window.CrowAPI.readFile(id);
            textarea.value = text;
            this.originalContent = text;
            this.isDirty = false;
            this.updateLineNumbers();
            status.textContent = 'Готово';
        } catch (e) {
            alert('Ошибка загрузки содержимого файла');
            this.closeEditor(true);
        }
    },

    saveFile: async function() {
        if (!this.currentFileId) return;

        const status = document.getElementById('crow-editor-status');
        const textarea = document.getElementById('crow-editor-textarea');
        status.textContent = 'Сохранение в облако...';
        status.style.color = '#2ec4b6';

        try {
            await window.CrowAPI.saveFile(this.currentFileId, this.currentFileName, textarea.value);
            this.originalContent = textarea.value;
            this.isDirty = false;
            status.textContent = 'Сохранено ✔';
        } catch (e) {
            console.error(e);
            status.textContent = 'Ошибка сохранения ✖';
            status.style.color = '#ff5555';
        }
    },

    closeEditor: function(force = false) {
        if (this.isDirty && !force) {
            const answer = confirm('В файле есть несохранённые изменения! Сохранить перед закрытием?');
            if (answer) {
                this.saveFile().then(() => {
                    this.forceClose();
                });
                return;
            }
        }
        this.forceClose();
    },

    forceClose: function() {
        this.isDirty = false;
        this.originalContent = '';
        document.getElementById('crow-editor-modal').style.display = 'none';
        document.getElementById('crow-editor-textarea').value = '';
    }
});