window.CrowAPI.registerPlugin('TextCodeEditor', {
    init: function(api) {
        api.addHook('onFileClick', (id, name, ext) => {
            const textExts = ['txt', 'md', 'py', 'js', 'html', 'css', 'json', 'xml', 'log', 'ini', 'sh', 'bat', 'csv', 'yaml', 'yml', 'sql', 'ts', 'jsx', 'tsx', 'php', 'c', 'cpp', 'h', 'hpp', 'java', 'rs', 'go', 'env', 'toml'];
            if (textExts.includes((ext || '').toLowerCase())) {
                this.openEditor(id, name);
                return true;
            }
            return false;
        });
    },

    openEditor: async function(id, name) {
        // Clean up any lingering dynamic modals
        document.querySelectorAll('.plugin-dynamic-modal').forEach(m => m.remove());

        const previewTitle = document.getElementById('previewTitle');
        const previewContent = document.getElementById('previewContent');
        const previewModal = document.getElementById('previewModal');

        if (previewTitle) previewTitle.textContent = name;
        if (!previewContent || !previewModal) return;

        previewContent.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:center; height:60vh; font-family:'JetBrains Mono', monospace; color:#38bdf8; gap:10px;">
                <span style="font-size:20px;">⏳</span> Загрузка файла ${name}...
            </div>
        `;
        previewModal.style.display = 'flex';

        try {
            const initialText = await window.CrowAPI.readFile(id);
            const ext = (name.split('.').pop() || '').toLowerCase();
            const isJson = ext === 'json';

            previewContent.innerHTML = `
                <div id="crowEditorWrapper" style="width: 100%; height: 75vh; display: flex; flex-direction: column; background: #0a0e17; border-radius: 8px; overflow: hidden; border: 1px solid rgba(59, 130, 246, 0.3); box-shadow: 0 12px 40px rgba(0,0,0,0.8); font-family: 'JetBrains Mono', Consolas, monospace;">
                    
                    <!-- 1. Верхняя панель инструментов (Toolbar) -->
                    <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; background: #0f172a; padding: 8px 14px; border-bottom: 1px solid rgba(255,255,255,0.08); gap: 8px; user-select: none;">
                        
                        <!-- Левая группа: Статус файла и кодировка -->
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 13px; font-weight: 600; color: #E2E8F0; max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${name}">📄 ${name}</span>
                            <span style="font-size: 10px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 2px 6px; border-radius: 4px; font-weight: bold; border: 1px solid rgba(56, 189, 248, 0.3);">UTF-8</span>
                            <span id="editorStatusBadge" style="font-size: 11px; color: #10B981; font-weight: 500; margin-left: 4px;">Сохранено ✔</span>
                        </div>

                        <!-- Правая группа: Инструменты, Поиск, Формат и Действия -->
                        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                            
                            <!-- Кнопка Поиск / Замена -->
                            <button id="editorToggleSearchBtn" class="editor-btn" title="Поиск и замена (Ctrl + F / Ctrl + H)">🔍 Поиск</button>

                            <!-- Размер шрифта -->
                            <select id="editorFontSizeSelect" class="editor-select" title="Размер шрифта">
                                <option value="12px">12px</option>
                                <option value="14px" selected>14px</option>
                                <option value="16px">16px</option>
                                <option value="18px">18px</option>
                            </select>

                            <!-- Перенос строк (Wrap) -->
                            <button id="editorWrapBtn" class="editor-btn" title="Перенос длинных строк">Wrap: Выкл</button>

                            <!-- Копировать и Очистить -->
                            <button id="editorCopyBtn" class="editor-btn" title="Скопировать весь текст в буфер">📋 Копировать</button>
                            <button id="editorClearBtn" class="editor-btn" title="Очистить всё содержимое">🗑</button>

                            <span style="color: #334155;">|</span>

                            <!-- Скачать -->
                            <a id="editorDownloadLink" href="/api/download/${id}" download="${name}" class="editor-btn" style="text-decoration: none;" title="Скачать файл на диск">📥 Скачать</a>

                            <!-- Главная кнопка Сохранить -->
                            <button id="editorSaveBtn" class="editor-btn primary" title="Сохранить изменения (Ctrl + S)">💾 Сохранить</button>
                        </div>
                    </div>

                    <!-- 2. Выезжающая панель поиска и автозамены (Search & Replace Bar) -->
                    <div id="editorSearchBar" style="display: none; background: #131d31; padding: 8px 14px; border-bottom: 1px solid rgba(59, 130, 246, 0.3); gap: 10px; align-items: center; flex-wrap: wrap; font-size: 12px; z-index: 10;">
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <input id="editorSearchInput" type="text" placeholder="Найти..." style="background: #0a0f1d; border: 1px solid rgba(59, 130, 246, 0.4); color: #fff; border-radius: 4px; padding: 3px 8px; font-size: 12px; outline: none; width: 160px;">
                            <button id="editorFindPrevBtn" class="editor-btn" title="Предыдущее совпадение (Shift + F3)">⬆</button>
                            <button id="editorFindNextBtn" class="editor-btn" title="Следующее совпадение (F3 / Enter)">⬇</button>
                            <span id="editorMatchCount" style="color: #94a3b8; font-size: 11px; min-width: 75px;">0 найдено</span>
                        </div>

                        <div style="display: flex; align-items: center; gap: 4px;">
                            <input id="editorReplaceInput" type="text" placeholder="Заменить на..." style="background: #0a0f1d; border: 1px solid rgba(59, 130, 246, 0.4); color: #fff; border-radius: 4px; padding: 3px 8px; font-size: 12px; outline: none; width: 150px;">
                            <button id="editorReplaceBtn" class="editor-btn" title="Заменить текущее">Заменить</button>
                            <button id="editorReplaceAllBtn" class="editor-btn" title="Заменить все совпадения">Заменить всё</button>
                        </div>

                        <label style="display: flex; align-items: center; gap: 4px; color: #94a3b8; cursor: pointer; user-select: none;">
                            <input id="editorMatchCaseCb" type="checkbox" style="cursor: pointer;">
                            <span>Учитывать регистр (Aa)</span>
                        </label>

                        <button id="editorCloseSearchBtn" class="editor-btn" style="margin-left: auto; border-color: transparent; color: #94a3b8;" title="Закрыть панель поиска (Esc)">✖</button>
                    </div>

                    <!-- 3. Центральное поле редактора с номерами строк -->
                    <div id="editorContainer" style="flex-grow: 1; display: flex; position: relative; overflow: hidden; background: #060911;">
                        <!-- Нумерация строк -->
                        <div id="editorLineNumbers" style="width: 48px; min-width: 48px; padding: 12px 6px; background: #0a0f1d; border-right: 1px solid rgba(255, 255, 255, 0.08); font-size: 14px; line-height: 1.5; color: #475569; text-align: right; user-select: none; overflow: hidden; white-space: pre;">1</div>
                        
                        <!-- Основной Textarea -->
                        <textarea id="editorTextarea" wrap="off" spellcheck="false" style="flex-grow: 1; width: calc(100% - 48px); background: transparent; color: #E2E8F0; border: none; padding: 12px 14px; font-size: 14px; line-height: 1.5; outline: none; resize: none; tab-size: 4; white-space: pre; overflow: auto; font-family: 'JetBrains Mono', Consolas, monospace;"></textarea>
                    </div>

                    <!-- 4. Информационная статусная строка (Status Bar) -->
                    <div style="display: flex; justify-content: space-between; align-items: center; background: #0a0f1d; padding: 5px 14px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 11px; color: #94a3b8; user-select: none;">
                        
                        <!-- Позиция курсора и метрики -->
                        <div style="display: flex; align-items: center; gap: 14px;">
                            <span id="editorCursorPos" style="color: #38bdf8;">Стр 1, Кол 1</span>
                            <span style="color: #334155;">|</span>
                            <span id="editorMetrics">Слов: 0 | Символов: 0</span>
                            <span style="color: #334155;">|</span>
                            <span id="editorFileSize">0 B</span>
                        </div>

                        <!-- JSON Tools и Хоткей подсказка -->
                        <div style="display: flex; align-items: center; gap: 8px;">
                            ${isJson ? `
                                <button id="editorJsonPrettyBtn" class="editor-btn-small" title="Форматировать JSON с отступами">✨ Pretty</button>
                                <button id="editorJsonMinifyBtn" class="editor-btn-small" title="Сжать JSON в одну строку">📦 Minify</button>
                                <span style="color: #334155;">|</span>
                            ` : ''}
                            <span style="color: #64748b; font-size: 10px;">Ctrl+S: Сохранить • Ctrl+F: Поиск • Ctrl+/: Коммент</span>
                        </div>
                    </div>
                </div>

                <style>
                    .editor-btn {
                        background: rgba(30, 41, 59, 0.8);
                        border: 1px solid rgba(148, 163, 184, 0.3);
                        color: #cbd5e1;
                        padding: 3px 9px;
                        border-radius: 4px;
                        font-size: 11px;
                        font-family: 'JetBrains Mono', monospace;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .editor-btn:hover {
                        background: rgba(59, 130, 246, 0.3);
                        border-color: #38bdf8;
                        color: #38bdf8;
                    }
                    .editor-btn.primary {
                        background: #2563eb;
                        border-color: #3b82f6;
                        color: #ffffff;
                        font-weight: 600;
                    }
                    .editor-btn.primary:hover {
                        background: #1d4ed8;
                        border-color: #60a5fa;
                        box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
                    }
                    .editor-btn-small {
                        background: rgba(30, 41, 59, 0.6);
                        border: 1px solid rgba(148, 163, 184, 0.25);
                        color: #cbd5e1;
                        padding: 1px 6px;
                        border-radius: 3px;
                        font-size: 10px;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .editor-btn-small:hover {
                        background: rgba(56, 189, 248, 0.2);
                        color: #38bdf8;
                        border-color: #38bdf8;
                    }
                    .editor-select {
                        background: rgba(30, 41, 59, 0.9);
                        border: 1px solid rgba(148, 163, 184, 0.3);
                        color: #38bdf8;
                        border-radius: 4px;
                        padding: 2px 4px;
                        font-size: 11px;
                        outline: none;
                        cursor: pointer;
                    }
                </style>
            `;

            const textarea = document.getElementById('editorTextarea');
            const lineNumbers = document.getElementById('editorLineNumbers');
            const statusBadge = document.getElementById('editorStatusBadge');
            const saveBtn = document.getElementById('editorSaveBtn');
            const wrapBtn = document.getElementById('editorWrapBtn');
            const fontSizeSelect = document.getElementById('editorFontSizeSelect');
            const copyBtn = document.getElementById('editorCopyBtn');
            const clearBtn = document.getElementById('editorClearBtn');
            const toggleSearchBtn = document.getElementById('editorToggleSearchBtn');
            const searchBar = document.getElementById('editorSearchBar');
            const searchInput = document.getElementById('editorSearchInput');
            const replaceInput = document.getElementById('editorReplaceInput');
            const findNextBtn = document.getElementById('editorFindNextBtn');
            const findPrevBtn = document.getElementById('editorFindPrevBtn');
            const replaceBtn = document.getElementById('editorReplaceBtn');
            const replaceAllBtn = document.getElementById('editorReplaceAllBtn');
            const matchCountEl = document.getElementById('editorMatchCount');
            const matchCaseCb = document.getElementById('editorMatchCaseCb');
            const closeSearchBtn = document.getElementById('editorCloseSearchBtn');
            const cursorPosEl = document.getElementById('editorCursorPos');
            const metricsEl = document.getElementById('editorMetrics');
            const fileSizeEl = document.getElementById('editorFileSize');
            const closeModalBtn = document.getElementById('closePreviewBtn');

            textarea.value = initialText;
            let isModified = false;
            let isWordWrap = false;

            // Update line numbers & scroll sync
            const updateLineNumbers = () => {
                const linesCount = (textarea.value.match(/\n/g) || []).length + 1;
                let nums = '';
                for (let i = 1; i <= linesCount; i++) {
                    nums += i + '\n';
                }
                lineNumbers.textContent = nums;
            };

            textarea.onscroll = () => {
                lineNumbers.scrollTop = textarea.scrollTop;
            };

            // Update metrics & cursor position
            const updateMetrics = () => {
                const pos = textarea.selectionStart || 0;
                const textBefore = textarea.value.substring(0, pos);
                const lines = textBefore.split('\n');
                const lineNum = lines.length;
                const colNum = lines[lines.length - 1].length + 1;
                
                if (cursorPosEl) cursorPosEl.textContent = `Стр ${lineNum}, Кол ${colNum}`;

                const totalChars = textarea.value.length;
                const words = (textarea.value.trim().match(/\S+/g) || []).length;
                if (metricsEl) metricsEl.textContent = `Слов: ${words.toLocaleString()} | Символов: ${totalChars.toLocaleString()}`;

                const bytes = new Blob([textarea.value]).size;
                let sizeStr = bytes + ' B';
                if (bytes >= 1024 * 1024) sizeStr = (bytes / (1024 * 1024)).toFixed(1) + ' MB';
                else if (bytes >= 1024) sizeStr = (bytes / 1024).toFixed(1) + ' KB';
                if (fileSizeEl) fileSizeEl.textContent = sizeStr;
            };

            const markModified = () => {
                if (!isModified) {
                    isModified = true;
                    if (statusBadge) {
                        statusBadge.textContent = 'Изменён •';
                        statusBadge.style.color = '#facc15';
                    }
                }
            };

            textarea.oninput = () => {
                markModified();
                updateLineNumbers();
                updateMetrics();
            };

            textarea.onmouseup = updateMetrics;
            textarea.onkeyup = updateMetrics;

            // Save Action
            const saveAction = async () => {
                if (statusBadge) {
                    statusBadge.textContent = 'Сохранение...';
                    statusBadge.style.color = '#38bdf8';
                }
                try {
                    await window.CrowAPI.saveFile(id, name, textarea.value);
                    isModified = false;
                    if (statusBadge) {
                        statusBadge.textContent = 'Сохранено ✔';
                        statusBadge.style.color = '#10B981';
                    }
                } catch (err) {
                    if (statusBadge) {
                        statusBadge.textContent = 'Ошибка ✖';
                        statusBadge.style.color = '#ef4444';
                    }
                    alert('Не удалось сохранить файл: ' + (err.message || err));
                }
            };

            if (saveBtn) saveBtn.onclick = saveAction;

            // Font Size Changer
            if (fontSizeSelect) {
                fontSizeSelect.onchange = (e) => {
                    textarea.style.fontSize = e.target.value;
                    lineNumbers.style.fontSize = e.target.value;
                };
            }

            // Word Wrap Toggle
            if (wrapBtn) {
                wrapBtn.onclick = () => {
                    isWordWrap = !isWordWrap;
                    textarea.setAttribute('wrap', isWordWrap ? 'soft' : 'off');
                    textarea.style.whiteSpace = isWordWrap ? 'pre-wrap' : 'pre';
                    wrapBtn.textContent = `Wrap: ${isWordWrap ? 'Вкл' : 'Выкл'}`;
                    wrapBtn.style.color = isWordWrap ? '#38bdf8' : '#cbd5e1';
                };
            }

            // Copy All
            if (copyBtn) {
                copyBtn.onclick = () => {
                    navigator.clipboard.writeText(textarea.value).then(() => {
                        const origText = copyBtn.textContent;
                        copyBtn.textContent = 'Скопировано ✔';
                        setTimeout(() => { copyBtn.textContent = origText; }, 1500);
                    });
                };
            }

            // Clear All
            if (clearBtn) {
                clearBtn.onclick = () => {
                    if (confirm('Очистить весь текст в редакторе?')) {
                        textarea.value = '';
                        markModified();
                        updateLineNumbers();
                        updateMetrics();
                    }
                };
            }

            // Search & Replace logic
            let currentMatches = [];
            let currentMatchIdx = -1;

            const performSearch = () => {
                const query = searchInput ? searchInput.value : '';
                if (!query) {
                    currentMatches = [];
                    currentMatchIdx = -1;
                    if (matchCountEl) matchCountEl.textContent = '0 найдено';
                    return;
                }
                const isCase = matchCaseCb && matchCaseCb.checked;
                const text = textarea.value;
                const flags = isCase ? 'g' : 'gi';
                const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(safeQuery, flags);
                
                currentMatches = [];
                let match;
                while ((match = regex.exec(text)) !== null) {
                    currentMatches.push({ start: match.index, end: match.index + match[0].length });
                }

                if (currentMatches.length === 0) {
                    currentMatchIdx = -1;
                    if (matchCountEl) {
                        matchCountEl.textContent = '0 найдено';
                        matchCountEl.style.color = '#ef4444';
                    }
                } else {
                    if (currentMatchIdx < 0 || currentMatchIdx >= currentMatches.length) {
                        currentMatchIdx = 0;
                    }
                    if (matchCountEl) {
                        matchCountEl.textContent = `${currentMatchIdx + 1} из ${currentMatches.length}`;
                        matchCountEl.style.color = '#38bdf8';
                    }
                    highlightCurrentMatch();
                }
            };

            const highlightCurrentMatch = () => {
                if (currentMatchIdx >= 0 && currentMatchIdx < currentMatches.length) {
                    const m = currentMatches[currentMatchIdx];
                    textarea.focus();
                    textarea.setSelectionRange(m.start, m.end);
                    
                    const linesBefore = textarea.value.substring(0, m.start).split('\n').length;
                    const totalLines = textarea.value.split('\n').length;
                    const targetScroll = (linesBefore / totalLines) * textarea.scrollHeight - (textarea.clientHeight / 2);
                    textarea.scrollTop = Math.max(0, targetScroll);
                }
            };

            const nextMatch = () => {
                if (currentMatches.length === 0) return;
                currentMatchIdx = (currentMatchIdx + 1) % currentMatches.length;
                if (matchCountEl) matchCountEl.textContent = `${currentMatchIdx + 1} из ${currentMatches.length}`;
                highlightCurrentMatch();
            };

            const prevMatch = () => {
                if (currentMatches.length === 0) return;
                currentMatchIdx = (currentMatchIdx - 1 + currentMatches.length) % currentMatches.length;
                if (matchCountEl) matchCountEl.textContent = `${currentMatchIdx + 1} из ${currentMatches.length}`;
                highlightCurrentMatch();
            };

            const replaceCurrent = () => {
                if (currentMatchIdx >= 0 && currentMatchIdx < currentMatches.length) {
                    const m = currentMatches[currentMatchIdx];
                    const rep = replaceInput.value || '';
                    const text = textarea.value;
                    textarea.value = text.substring(0, m.start) + rep + text.substring(m.end);
                    markModified();
                    updateLineNumbers();
                    updateMetrics();
                    performSearch();
                }
            };

            const replaceAll = () => {
                const query = searchInput ? searchInput.value : '';
                if (!query) return;
                const isCase = matchCaseCb && matchCaseCb.checked;
                const flags = isCase ? 'g' : 'gi';
                const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(safeQuery, flags);
                const rep = replaceInput.value || '';
                textarea.value = textarea.value.replace(regex, rep);
                markModified();
                updateLineNumbers();
                updateMetrics();
                performSearch();
            };

            const toggleSearch = (focusReplace = false) => {
                if (!searchBar) return;
                if (searchBar.style.display === 'none' || !searchBar.style.display) {
                    searchBar.style.display = 'flex';
                    if (focusReplace && replaceInput) {
                        replaceInput.focus();
                    } else if (searchInput) {
                        searchInput.focus();
                        searchInput.select();
                    }
                    performSearch();
                } else if (!focusReplace) {
                    searchBar.style.display = 'none';
                    textarea.focus();
                } else if (replaceInput) {
                    replaceInput.focus();
                }
            };

            if (toggleSearchBtn) toggleSearchBtn.onclick = () => toggleSearch();
            if (closeSearchBtn) closeSearchBtn.onclick = () => toggleSearch();
            if (searchInput) searchInput.oninput = performSearch;
            if (matchCaseCb) matchCaseCb.onchange = performSearch;
            if (findNextBtn) findNextBtn.onclick = nextMatch;
            if (findPrevBtn) findPrevBtn.onclick = prevMatch;
            if (replaceBtn) replaceBtn.onclick = replaceCurrent;
            if (replaceAllBtn) replaceAllBtn.onclick = replaceAll;

            if (searchInput) {
                searchInput.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (e.shiftKey) prevMatch();
                        else nextMatch();
                    } else if (e.key === 'Escape') {
                        toggleSearch();
                    }
                };
            }

            // JSON Helpers
            if (isJson) {
                const prettyBtn = document.getElementById('editorJsonPrettyBtn');
                const minifyBtn = document.getElementById('editorJsonMinifyBtn');
                if (prettyBtn) {
                    prettyBtn.onclick = () => {
                        try {
                            const parsed = JSON.parse(textarea.value);
                            textarea.value = JSON.stringify(parsed, null, 4);
                            markModified();
                            updateLineNumbers();
                            updateMetrics();
                        } catch (err) {
                            alert('Ошибка парсинга JSON: ' + err.message);
                        }
                    };
                }
                if (minifyBtn) {
                    minifyBtn.onclick = () => {
                        try {
                            const parsed = JSON.parse(textarea.value);
                            textarea.value = JSON.stringify(parsed);
                            markModified();
                            updateLineNumbers();
                            updateMetrics();
                        } catch (err) {
                            alert('Ошибка парсинга JSON: ' + err.message);
                        }
                    };
                }
            }

            // Keyboard navigation & smart editing
            textarea.onkeydown = (e) => {
                const isCtrl = e.ctrlKey || e.metaKey;

                // Ctrl + S (Save)
                if (isCtrl && e.key === 's') {
                    e.preventDefault();
                    saveAction();
                    return;
                }

                // Ctrl + F (Search)
                if (isCtrl && (e.key === 'f' || e.key === 'F')) {
                    e.preventDefault();
                    toggleSearch(false);
                    return;
                }

                // Ctrl + H (Replace)
                if (isCtrl && (e.key === 'h' || e.key === 'H')) {
                    e.preventDefault();
                    toggleSearch(true);
                    return;
                }

                // Tab support (4 spaces)
                if (e.key === 'Tab') {
                    e.preventDefault();
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const val = textarea.value;

                    if (start === end) {
                        textarea.value = val.substring(0, start) + '    ' + val.substring(end);
                        textarea.selectionStart = textarea.selectionEnd = start + 4;
                    } else {
                        const before = val.substring(0, start);
                        const lineStart = before.lastIndexOf('\n') + 1;
                        let lineEnd = val.indexOf('\n', end);
                        if (lineEnd === -1) lineEnd = val.length;

                        const selectedBlock = val.substring(lineStart, lineEnd);
                        const lines = selectedBlock.split('\n');

                        if (e.shiftKey) {
                            const unindented = lines.map(l => l.startsWith('    ') ? l.substring(4) : (l.startsWith('\t') ? l.substring(1) : l)).join('\n');
                            textarea.value = val.substring(0, lineStart) + unindented + val.substring(lineEnd);
                            textarea.selectionStart = lineStart;
                            textarea.selectionEnd = lineStart + unindented.length;
                        } else {
                            const indented = lines.map(l => '    ' + l).join('\n');
                            textarea.value = val.substring(0, lineStart) + indented + val.substring(lineEnd);
                            textarea.selectionStart = lineStart;
                            textarea.selectionEnd = lineStart + indented.length;
                        }
                    }
                    markModified();
                    updateLineNumbers();
                    updateMetrics();
                    return;
                }

                // Enter auto-indent
                if (e.key === 'Enter') {
                    const pos = textarea.selectionStart;
                    const val = textarea.value;
                    const lineStart = val.lastIndexOf('\n', pos - 1) + 1;
                    const currentLine = val.substring(lineStart, pos);
                    const matchIndent = currentLine.match(/^[ \t]+/);
                    if (matchIndent) {
                        e.preventDefault();
                        const indent = matchIndent[0];
                        textarea.value = val.substring(0, pos) + '\n' + indent + val.substring(pos);
                        textarea.selectionStart = textarea.selectionEnd = pos + 1 + indent.length;
                        markModified();
                        updateLineNumbers();
                        updateMetrics();
                        return;
                    }
                }

                // Ctrl + / (Toggle Comment)
                if (isCtrl && e.key === '/') {
                    e.preventDefault();
                    let commentPrefix = '// ';
                    if (['py', 'sh', 'bash', 'ini', 'conf', 'yaml', 'yml', 'toml'].includes(ext)) {
                        commentPrefix = '# ';
                    } else if (['bat', 'cmd'].includes(ext)) {
                        commentPrefix = 'REM ';
                    }

                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const val = textarea.value;

                    const lineStart = val.lastIndexOf('\n', start - 1) + 1;
                    let lineEnd = val.indexOf('\n', end);
                    if (lineEnd === -1) lineEnd = val.length;

                    const selectedBlock = val.substring(lineStart, lineEnd);
                    const lines = selectedBlock.split('\n');
                    const allCommented = lines.every(l => l.trimStart().startsWith(commentPrefix.trim()));

                    let newBlock;
                    if (allCommented) {
                        newBlock = lines.map(l => {
                            const idx = l.indexOf(commentPrefix.trim());
                            if (idx !== -1) {
                                return l.substring(0, idx) + l.substring(idx + (l.startsWith(commentPrefix) ? commentPrefix.length : commentPrefix.trim().length));
                            }
                            return l;
                        }).join('\n');
                    } else {
                        newBlock = lines.map(l => commentPrefix + l).join('\n');
                    }

                    textarea.value = val.substring(0, lineStart) + newBlock + val.substring(lineEnd);
                    textarea.selectionStart = lineStart;
                    textarea.selectionEnd = lineStart + newBlock.length;
                    markModified();
                    updateLineNumbers();
                    updateMetrics();
                    return;
                }

                // Escape key
                if (e.key === 'Escape') {
                    if (searchBar && searchBar.style.display !== 'none') {
                        searchBar.style.display = 'none';
                        textarea.focus();
                    }
                }
            };

            // Close handling with confirmation
            if (closeModalBtn) {
                closeModalBtn.onclick = () => {
                    if (isModified) {
                        if (!confirm('Есть несохранённые изменения. Вы действительно хотите закрыть файл?')) {
                            return;
                        }
                    }
                    previewModal.style.display = 'none';
                    previewContent.innerHTML = '';
                };
            }

            // Initial render
            updateLineNumbers();
            updateMetrics();
            textarea.focus();

        } catch (e) {
            previewContent.innerHTML = `
                <div style="color:#ef4444; font-family:'JetBrains Mono', monospace; padding:30px; text-align:center;">
                    <div style="font-size:32px; margin-bottom:10px;">⚠️</div>
                    <b>Ошибка загрузки файла</b>
                    <p style="color:#94a3b8; font-size:12px; margin-top:8px;">${e.message || 'Не удалось прочитать содержимое.'}</p>
                </div>
            `;
        }
    }
});
