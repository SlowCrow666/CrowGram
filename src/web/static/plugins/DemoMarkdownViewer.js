/**
 * CrowGram - Reference Plugin: Demo Markdown Viewer
 * Demonstrates:
 *  1. i18n Registration via window.CrowI18n.registerTranslations
 *  2. Event listening via window.CrowAPI.on('onFileClick')
 *  3. File reading via window.CrowAPI.readFile(fileId)
 *  4. UI creation and Theme token integration
 */
(function() {
    // 1. Register Multi-language Dictionaries
    if (window.CrowI18n) {
        window.CrowI18n.registerTranslations('demoMarkdown', {
            ru: {
                title: '📖 Просмотр Markdown',
                copyBtn: '📋 Копировать разметку',
                copySuccess: '✓ Markdown скопирован!',
                closeBtn: 'Закрыть',
                loading: '⏳ Загрузка Markdown...',
                rawTab: 'Исходный код',
                previewTab: 'Предпросмотр'
            },
            en: {
                title: '📖 Markdown Viewer',
                copyBtn: '📋 Copy Markdown',
                copySuccess: '✓ Markdown copied!',
                closeBtn: 'Close',
                loading: '⏳ Loading Markdown...',
                rawTab: 'Raw Source',
                previewTab: 'Preview'
            }
        });
    }

    function parseMarkdown(md) {
        if (!md) return '';
        let html = md
            // Escape HTML
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            // Code blocks
            .replace(/```([a-zA-Z0-9_]*)\n([\s\S]*?)```/g, function(match, lang, code) {
                return `<pre style="background: rgba(0,0,0,0.5); padding: 12px; border-radius: 6px; overflow-x: auto; border: 1px solid var(--border-subtle); font-family: monospace; font-size: 12px; color: var(--text-primary); margin: 12px 0;"><code>${code.trim()}</code></pre>`;
            })
            // Inline code
            .replace(/`([^`]+)`/g, '<code style="background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 12px; color: var(--accent-blue);">$1</code>')
            // Headers
            .replace(/^### (.*$)/gim, '<h3 style="color: var(--text-primary); font-size: 15px; margin: 14px 0 8px 0; border-bottom: 1px solid var(--border-subtle); padding-bottom: 4px;">$1</h3>')
            .replace(/^## (.*$)/gim, '<h2 style="color: var(--text-primary); font-size: 17px; margin: 16px 0 10px 0; border-bottom: 1px solid var(--border-subtle); padding-bottom: 6px;">$1</h2>')
            .replace(/^# (.*$)/gim, '<h1 style="color: var(--text-primary); font-size: 20px; margin: 18px 0 12px 0; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">$1</h1>')
            // Blockquotes
            .replace(/^\> (.*$)/gim, '<blockquote style="border-left: 3px solid var(--accent-blue); margin: 10px 0; padding-left: 12px; color: var(--text-muted);">$1</blockquote>')
            // Bold & Italic
            .replace(/\*\*([^*]+)\*\*/g, '<strong style="color: var(--text-primary);">$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em style="color: var(--text-secondary);">$1</em>')
            // Links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: var(--accent-blue); text-decoration: underline;">$1</a>')
            // Horizontal rule
            .replace(/^---$/gim, '<hr style="border: 0; border-top: 1px solid var(--border-subtle); margin: 16px 0;" />')
            // Unordered list items
            .replace(/^\s*[-*]\s+(.*$)/gim, '<li style="margin-left: 20px; color: var(--text-secondary); margin-bottom: 4px;">$1</li>')
            // Line breaks
            .replace(/\n\n/g, '<p style="margin: 10px 0; line-height: 1.6; color: var(--text-secondary);"></p>');

        return html;
    }

    const DemoMarkdownViewer = {
        name: 'DemoMarkdownViewer',
        version: '1.0.0',
        author: 'CrowGram Reference Plugins',

        init: function(api) {
            console.log('✓ [DemoMarkdownViewer] Initialized via CrowAPI SDK');

            // Register File Hook for .md and .markdown
            api.on('onFileClick', (id, name, ext) => {
                const lower = (ext || '').toLowerCase();
                if (lower === 'md' || lower === 'markdown') {
                    // If full TextCodeEditor is present, yield to full editor
                    if (window.CrowAPI && (window.CrowAPI.plugins['TextCodeEditor'] || window.CrowAPI.plugins['text_editor'])) {
                        return false;
                    }
                    this.openViewer(id, name);
                    return true; // Intercept event to prevent default handler
                }
                return false;
            });
        },

        openViewer: async function(fileId, fileName) {
            const t = (key) => window.CrowI18n ? window.CrowI18n.t('demoMarkdown.' + key) : key;

            const modal = window.CrowAPI.ui.createModal({
                title: `${t('title')}: ${fileName}`,
                maxWidth: '820px',
                width: '90vw',
                body: `
                    <div style="display: flex; flex-direction: column; gap: 12px; min-height: 480px; max-height: 70vh;">
                        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">
                            <div style="display: flex; gap: 8px;">
                                <button id="demoMdTabPreview" class="hud-btn primary" style="font-size: 11px; padding: 4px 10px;">${t('previewTab')}</button>
                                <button id="demoMdTabRaw" class="hud-btn" style="font-size: 11px; padding: 4px 10px;">${t('rawTab')}</button>
                            </div>
                            <button id="demoMdCopyBtn" class="hud-btn" style="font-size: 11px; padding: 4px 10px;">${t('copyBtn')}</button>
                        </div>
                        <div id="demoMdContentArea" style="flex: 1; overflow-y: auto; padding: 12px; background: rgba(0,0,0,0.25); border-radius: var(--radius-control); border: 1px solid var(--border-subtle);">
                            <div style="color: var(--text-muted); text-align: center; padding: 40px;">${t('loading')}</div>
                        </div>
                    </div>
                `,
                footer: `
                    <button class="hud-btn primary modal-close-btn" style="padding: 6px 16px;">${t('closeBtn')}</button>
                `
            });

            modal.panel.querySelector('.modal-close-btn')?.addEventListener('click', modal.close);

            try {
                const rawMarkdown = await window.CrowAPI.readFile(fileId);
                const contentArea = modal.panel.querySelector('#demoMdContentArea');
                const btnCopy = modal.panel.querySelector('#demoMdCopyBtn');
                const tabPreview = modal.panel.querySelector('#demoMdTabPreview');
                const tabRaw = modal.panel.querySelector('#demoMdTabRaw');

                let mode = 'preview';

                const render = () => {
                    if (mode === 'preview') {
                        contentArea.innerHTML = `<div class="markdown-body" style="line-height: 1.6; color: var(--text-secondary);">${parseMarkdown(rawMarkdown)}</div>`;
                        tabPreview.className = 'hud-btn primary';
                        tabRaw.className = 'hud-btn';
                    } else {
                        contentArea.innerHTML = `<pre style="margin: 0; white-space: pre-wrap; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--text-primary);">${rawMarkdown.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
                        tabPreview.className = 'hud-btn';
                        tabRaw.className = 'hud-btn primary';
                    }
                };

                render();

                tabPreview?.addEventListener('click', () => { mode = 'preview'; render(); });
                tabRaw?.addEventListener('click', () => { mode = 'raw'; render(); });

                btnCopy?.addEventListener('click', async () => {
                    try {
                        await navigator.clipboard.writeText(rawMarkdown);
                        btnCopy.textContent = t('copySuccess');
                        setTimeout(() => { btnCopy.textContent = t('copyBtn'); }, 2000);
                    } catch (e) {
                        alert('Ошибка копирования');
                    }
                });

            } catch (err) {
                const contentArea = modal.panel.querySelector('#demoMdContentArea');
                if (contentArea) {
                    contentArea.innerHTML = `<div style="color: var(--accent-red); padding: 20px; text-align: center;">Ошибка загрузки файла: ${err.message}</div>`;
                }
            }
        }
    };

    // Register with CrowAPI
    if (window.CrowAPI) {
        window.CrowAPI.registerPlugin('DemoMarkdownViewer', DemoMarkdownViewer);
    }
})();
