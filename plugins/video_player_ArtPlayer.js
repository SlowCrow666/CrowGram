/**
 * ArtPlayer Plugin v2.0 — Исправление полноэкранного режима и прямого потока
 */

(function() {
    const PLUGIN_NAME = 'video_player_ArtPlayer';

    const ArtVideoPlugin = {
        init: function(api) {
            api.addHook('onFileClick', (fileId, fileName, ext) => {
                const videoExts = ['mp4', 'webm', 'mkv', 'mov', 'avi', 'wmv', 'flv', 'm4v', 'ts'];
                if (videoExts.includes(ext.toLowerCase())) {
                    this.openArtPlayer(fileId, fileName, ext.toLowerCase());
                    return true;
                }
                return false;
            });
        },

        openArtPlayer: function(fileId, fileName, ext) {
            const previewTitle = document.getElementById('previewTitle');
            const previewContent = document.getElementById('previewContent');
            const previewModal = document.getElementById('previewModal');

            if (previewTitle) previewTitle.textContent = fileName;
            if (!previewContent || !previewModal) return;

            const streamUrl = `/api/stream/${fileId}`;

            previewContent.innerHTML = `
                <div id="artplayerWrapper" style="position: relative; width: 100%; height: 70vh; background: #000; border-radius: 8px; overflow: hidden;">
                    <div id="artplayerContainer" style="width: 100%; height: 100%;"></div>
                    
                    <div id="artBufferingWidget" style="position: absolute; top: 12px; left: 12px; z-index: 10; background: rgba(0,0,0,0.8); backdrop-filter: blur(4px); border: 1px solid var(--border-color, #333); padding: 6px 12px; border-radius: 6px; font-family: monospace; font-size: 11px; color: #00ffff; display: flex; align-items: center; gap: 8px;">
                        <span>📥 Кэш Telegram: <b id="artBufferingPercent">0%</b> (<span id="artBufferingMB">0/0 MB</span>)</span>
                        <span style="color: #8892b0;">|</span>
                        <span>⚡ <b id="artBufferingSpeed">0.0 MB/s</b></span>
                    </div>
                </div>
            `;

            previewModal.style.display = 'flex';

            let art = null;

            if (window.Artplayer) {
                art = new window.Artplayer({
                    container: '#artplayerContainer',
                    url: streamUrl,
                    type: 'mp4',
                    autoplay: true,
                    isLive: false,
                    fullscreen: false,
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
                            html: '📺 Во весь экран',
                            click: function () {
                                const wrapper = document.getElementById('artplayerWrapper');
                                if (wrapper) {
                                    if (!document.fullscreenElement) {
                                        wrapper.requestFullscreen().catch(err => console.error(err));
                                    } else {
                                        document.exitFullscreen().catch(err => console.error(err));
                                    }
                                }
                            },
                        },
                        {
                            position: 'right',
                            html: '📋 Ссылка для VLC',
                            tooltip: 'Скопировать прямой URL потока для вставки в VLC (Ctrl+N)',
                            click: function () {
                                const fullUrl = `${window.location.origin}${streamUrl}`;
                                navigator.clipboard.writeText(fullUrl).then(() => {
                                    alert(`Прямая ссылка скопирована!\n\nОткройте VLC -> Нажмите Ctrl+N -> Вставьте ссылку:\n${fullUrl}`);
                                });
                            },
                        },
                        {
                            position: 'right',
                            html: '🚀 M3U Плейлист',
                            tooltip: 'Скачать .m3u плейлист для автоматического открытия в VLC',
                            click: function () {
                                const playlistUrl = `/api/stream/playlist/${fileId}.m3u`;
                                window.location.href = playlistUrl;
                            },
                        }
                    ]
                });
            } else {
                previewContent.innerHTML = `<video controls autoplay style="width:100%; max-height:70vh;"><source src="${streamUrl}"></video>`;
            }

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
                } catch (e) {}
            }, 1000);

            const closeBtn = document.getElementById('closePreviewBtn');
            const handleClose = () => {
                clearInterval(pollInterval);
                if (document.fullscreenElement) {
                    document.exitFullscreen().catch(() => {});
                }
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
