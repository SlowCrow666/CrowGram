/**
 * ArtPlayer Plugin v1.2 — Видеоплеер для CrowGram с индикатором кэширования Telegram
 */

(function() {
    const PLUGIN_NAME = 'video_player_ArtPlayer';

    const ArtVideoPlugin = {
        init: function(api) {
            api.addHook('onFileClick', (fileId, fileName, ext) => {
                const videoExts = ['mp4', 'webm', 'mkv', 'mov', 'avi', 'wmv', 'flv', 'm4v', 'ts'];
                if (videoExts.includes(ext.toLowerCase())) {
                    this.openArtPlayer(fileId, fileName);
                    return true;
                }
                return false;
            });
        },

        openArtPlayer: function(fileId, fileName) {
            const previewTitle = document.getElementById('previewTitle');
            const previewContent = document.getElementById('previewContent');
            const previewModal = document.getElementById('previewModal');

            if (previewTitle) previewTitle.textContent = fileName;
            if (!previewContent || !previewModal) return;

            const streamUrl = `/api/stream/${fileId}`;

            previewContent.innerHTML = `
                <div style="position: relative; width: 100%; height: 70vh;">
                    <div id="artplayerContainer" style="width: 100%; height: 100%; border-radius: 8px; overflow: hidden;"></div>
                    <div id="artBufferingWidget" style="position: absolute; top: 12px; left: 12px; z-index: 10; background: rgba(0,0,0,0.75); backdrop-filter: blur(4px); border: 1px solid var(--border-color, #333); padding: 6px 12px; border-radius: 6px; font-family: monospace; font-size: 11px; color: #00ffff; display: flex; align-items: center; gap: 8px;">
                        <span>📥 Кэширование Telegram: <b id="artBufferingPercent">0%</b> (<span id="artBufferingMB">0/0 MB</span>)</span>
                        <span style="color: #8892b0;">|</span>
                        <span>⚡ Скорость: <b id="artBufferingSpeed">0.0 MB/s</b></span>
                    </div>
                </div>
            `;

            previewModal.style.display = 'flex';

            let art = null;

            if (window.Artplayer) {
                art = new window.Artplayer({
                    container: '#artplayerContainer',
                    url: streamUrl,
                    type: 'mkv',
                    autoplay: true,
                    isLive: false,
                    fullscreen: true,
                    fullscreenWeb: true,
                    pip: true,
                    setting: true,
                    flip: true,
                    playbackRate: true,
                    aspectRatio: true,
                    autoOrientation: true,
                    controls: [
                        {
                            position: 'right',
                            html: '🚀 Открыть в VLC',
                            tooltip: 'Запустить потоковое вещание через сторонний плеер',
                            click: function () {
                                const vlcUrl = `vlc://${window.location.origin}${streamUrl}`;
                                window.location.href = vlcUrl;
                            },
                        },
                        {
                            position: 'right',
                            html: '📥 Скачать',
                            click: function () {
                                const a = document.createElement('a');
                                a.href = `/api/download/${fileId}`;
                                a.download = fileName;
                                a.click();
                            },
                        }
                    ]
                });
            } else {
                previewContent.innerHTML = `<video controls autoplay style="width:100%; max-height:70vh;"><source src="${streamUrl}"></video>`;
            }

            // Поллинг прогресса скачивания чанков из Telegram
            const pollInterval = setInterval(async () => {
                try {
                    const res = await fetch(`/api/stream/status/${fileId}?_t=` + Date.now());
                    if (!res.ok) return;
                    const status = await res.json();

                    const elPercent = document.getElementById('artBufferingPercent');
                    const elMB = document.getElementById('artBufferingMB');
                    const elSpeed = document.getElementById('artBufferingSpeed');

                    if (elPercent) elPercent.textContent = `${status.percent}%`;
                    if (elMB) elMB.textContent = `${status.downloaded_mb}/${status.total_mb} MB`;
                    if (elSpeed) elSpeed.textContent = `${status.speed_mbps} MB/s`;

                    if (status.percent >= 100 && status.total_mb > 0) {
                        const widget = document.getElementById('artBufferingWidget');
                        if (widget) widget.style.display = 'none';
                        clearInterval(pollInterval);
                    }
                } catch (e) {
                    console.error('Ошибка получения статуса буфера', e);
                }
            }, 1000);

            const closeBtn = document.getElementById('closePreviewBtn');
            const handleClose = () => {
                clearInterval(pollInterval);
                if (art) {
                    art.destroy();
                }
                previewModal.style.display = 'none';
                previewContent.innerHTML = '';
            };

            if (closeBtn) {
                closeBtn.onclick = handleClose;
            }
        }
    };

    if (window.CrowAPI) {
        window.CrowAPI.registerPlugin(PLUGIN_NAME, ArtVideoPlugin);
    }
})();
