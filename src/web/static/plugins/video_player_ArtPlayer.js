window.CrowAPI.registerPlugin('video_player_ArtPlayer', {
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

        let prebufferMB = parseFloat(localStorage.getItem('crowgram_prebuffer_mb') ?? '5');
        if (isNaN(prebufferMB) || prebufferMB < 0) prebufferMB = 5;
        let isPrebuffering = prebufferMB > 0;

        const streamUrl = `/api/stream/${fileId}`;

        previewContent.innerHTML = `
            <div id="artplayerWrapper" style="position: relative; width: 100%; height: 70vh; background: #000; border-radius: 8px; overflow: hidden;">
                <div id="artplayerContainer" style="width: 100%; height: 100%;"></div>
                
                <!-- Верхний информационный виджет (чистая компактная строка) -->
                <div id="artBufferingWidget" style="position: absolute; top: 12px; left: 12px; z-index: 10; background: rgba(10, 15, 25, 0.92); backdrop-filter: blur(8px); border: 1px solid rgba(59, 130, 246, 0.4); padding: 6px 14px; border-radius: 8px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #E2E8F0; display: flex; align-items: center; gap: 12px; box-shadow: 0 6px 20px rgba(0,0,0,0.7);">
                    
                    <!-- Кэш Telegram (только проценты и цифры) -->
                    <span>📥 Кэш Telegram: <b id="artBufferingPercent" style="color: #38bdf8;">0%</b> <span id="artBufferingMB" style="color: #94a3b8; font-size: 10px;">0.0 / 0.0 MB</span></span>

                    <span style="color: #475569;">|</span>

                    <!-- Скорость и запас времени -->
                    <span>⚡ <b id="artBufferingSpeed" style="color: #facc15;">0.0 MB/s</b></span>
                    <span id="artBufferAhead" style="color: #a7f3d0; font-size: 10px;">(⏱ +0.0с)</span>

                    <span style="color: #475569;">|</span>

                    <!-- Настройка предбуфера и его процент наполнения -->
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="color: #94a3b8;">⚙️ Предбуфер:</span>
                        <select id="artPrebufferSelect" style="background: rgba(30, 41, 59, 0.95); border: 1px solid rgba(148, 163, 184, 0.3); color: #38bdf8; border-radius: 4px; font-size: 11px; padding: 2px 5px; cursor: pointer; outline: none;">
                            <option value="0" ${prebufferMB === 0 ? 'selected' : ''}>0 MB (Сразу)</option>
                            <option value="2" ${prebufferMB === 2 ? 'selected' : ''}>2 MB</option>
                            <option value="5" ${prebufferMB === 5 ? 'selected' : ''}>5 MB (Реком.)</option>
                            <option value="10" ${prebufferMB === 10 ? 'selected' : ''}>10 MB</option>
                            <option value="25" ${prebufferMB === 25 ? 'selected' : ''}>25 MB</option>
                            <option value="50" ${prebufferMB === 50 ? 'selected' : ''}>50 MB</option>
                            <option value="100" ${prebufferMB === 100 ? 'selected' : ''}>100 MB</option>
                            <option value="custom" ${![0,2,5,10,25,50,100].includes(prebufferMB) ? 'selected' : ''}>✏️ Свой...</option>
                        </select>
                        <div id="customPrebufferBox" style="display: ${![0,2,5,10,25,50,100].includes(prebufferMB) ? 'flex' : 'none'}; align-items: center; gap: 3px;">
                            <input id="customPrebufferInput" type="number" min="0" max="2000" step="1" value="${prebufferMB}" style="width: 48px; background: rgba(15, 23, 42, 0.95); border: 1px solid #38bdf8; color: #fff; border-radius: 4px; padding: 1px 4px; font-size: 11px; text-align: center; outline: none;">
                            <span style="color: #94a3b8; font-size: 10px;">MB</span>
                        </div>
                        <span id="artPrebufBadge" style="font-weight: 600; font-size: 11px; padding: 2px 6px; border-radius: 4px; background: rgba(56, 189, 248, 0.15); color: #38bdf8;">0%</span>
                    </div>
                </div>

                <!-- Центральный оверлей предбуферизации с наглядным прогресс-баром -->
                <div id="artPrebufferOverlay" style="position: absolute; inset: 0; z-index: 9; background: rgba(8, 12, 20, 0.78); backdrop-filter: blur(8px); display: ${isPrebuffering ? 'flex' : 'none'}; flex-direction: column; align-items: center; justify-content: center; gap: 14px;">
                    <div style="background: rgba(15, 23, 42, 0.92); border: 1px solid rgba(59, 130, 246, 0.4); border-radius: 12px; padding: 20px 28px; width: 340px; box-shadow: 0 10px 30px rgba(0,0,0,0.8); display: flex; flex-direction: column; align-items: center; gap: 12px;">
                        <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: #E2E8F0;">
                            <span style="font-size: 18px;">⏳</span> Предварительная буферизация
                        </div>
                        
                        <!-- Прогресс-бар наполнения -->
                        <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden; position: relative;">
                            <div id="artPrebufferBar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #3B82F6, #10B981); transition: width 0.25s ease-out; border-radius: 4px;"></div>
                        </div>

                        <!-- Детали прогресса -->
                        <div style="width: 100%; display: flex; justify-content: space-between; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #94A3B8;">
                            <span id="artPrebufferText">0.0 / ${prebufferMB} MB</span>
                            <span id="artPrebufferPercentText" style="color: #38bdf8; font-weight: 600;">0%</span>
                        </div>

                        <div id="artPrebufferEta" style="font-size: 11px; color: #facc15; font-family: 'JetBrains Mono', monospace;">
                            ⚡ Ожидание данных...
                        </div>

                        <button id="artSkipPrebufferBtn" style="margin-top: 4px; background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(59, 130, 246, 0.5); color: #E2E8F0; font-size: 11px; padding: 5px 14px; border-radius: 6px; cursor: pointer; transition: all 0.2s;">
                            ▶ Начать просмотр сразу
                        </button>
                    </div>
                </div>
            </div>
        `;

        previewModal.style.display = 'flex';

        const prebufferSelect = document.getElementById('artPrebufferSelect');
        const customBox = document.getElementById('customPrebufferBox');
        const customInput = document.getElementById('customPrebufferInput');
        const skipBtn = document.getElementById('artSkipPrebufferBtn');

        const setPrebufferSize = (val) => {
            val = Math.max(0, parseFloat(val) || 0);
            prebufferMB = val;
            localStorage.setItem('crowgram_prebuffer_mb', val);
            if (val === 0 && isPrebuffering) {
                isPrebuffering = false;
                const overlay = document.getElementById('artPrebufferOverlay');
                if (overlay) overlay.style.display = 'none';
                if (art) art.play().catch(() => {});
            }
        };

        if (prebufferSelect) {
            prebufferSelect.onchange = (e) => {
                if (e.target.value === 'custom') {
                    if (customBox) customBox.style.display = 'flex';
                    if (customInput) {
                        customInput.focus();
                        setPrebufferSize(customInput.value);
                    }
                } else {
                    if (customBox) customBox.style.display = 'none';
                    setPrebufferSize(e.target.value);
                }
            };
        }

        if (customInput) {
            customInput.oninput = (e) => {
                setPrebufferSize(e.target.value);
            };
        }

        if (skipBtn) {
            skipBtn.onclick = () => {
                isPrebuffering = false;
                const overlay = document.getElementById('artPrebufferOverlay');
                if (overlay) overlay.style.display = 'none';
                if (art) art.play().catch(() => {});
            };
        }

        let art = null;

        if (window.Artplayer) {
            art = new window.Artplayer({
                container: '#artplayerContainer',
                url: streamUrl,
                autoplay: !isPrebuffering,
                isLive: false,
                fullscreen: false,
                fullscreenWeb: true,
                pip: true,
                setting: true,
                flip: true,
                playbackRate: true,
                aspectRatio: true,
                autoOrientation: true,
                settings: [
                    {
                        html: '📦 Размер предбуфера',
                        selector: [
                            { default: prebufferMB === 0, html: '0 MB (Без ожидания)', value: 0 },
                            { default: prebufferMB === 2, html: '2 MB', value: 2 },
                            { default: prebufferMB === 5, html: '5 MB (Рекомендуется)', value: 5 },
                            { default: prebufferMB === 10, html: '10 MB', value: 10 },
                            { default: prebufferMB === 25, html: '25 MB', value: 25 },
                            { default: prebufferMB === 50, html: '50 MB', value: 50 },
                            { default: prebufferMB === 100, html: '100 MB', value: 100 },
                        ],
                        onSelect: function (item) {
                            setPrebufferSize(item.value);
                            if (prebufferSelect) prebufferSelect.value = item.value;
                            if (customBox) customBox.style.display = 'none';
                            return item.html;
                        },
                    }
                ],
                controls: [
                    {
                        position: 'left',
                        html: '<span id="artBottomBufferBadge" style="font-family: monospace; font-size: 11px; color: #38bdf8; padding: 0 8px; opacity: 0.9;">📥 Буфер: 0%</span>',
                    },
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
            previewContent.innerHTML = `<video id="nativeVideoPlayer" controls ${!isPrebuffering ? 'autoplay' : ''} style="width:100%; max-height:70vh;"><source src="${streamUrl}"></video>`;
        }

        const updateStatusUI = async () => {
            try {
                const res = await fetch(`/api/stream/status/${fileId}?_t=` + Date.now());
                if (!res.ok) return;
                const status = await res.json();

                const elPercent = document.getElementById('artBufferingPercent');
                const elMB = document.getElementById('artBufferingMB');
                const elSpeed = document.getElementById('artBufferingSpeed');
                const elBufferAhead = document.getElementById('artBufferAhead');
                const bottomBadge = document.getElementById('artBottomBufferBadge');
                const elPrebufBadge = document.getElementById('artPrebufBadge');

                const overlay = document.getElementById('artPrebufferOverlay');
                const pBar = document.getElementById('artPrebufferBar');
                const pText = document.getElementById('artPrebufferText');
                const pPercentText = document.getElementById('artPrebufferPercentText');
                const pEta = document.getElementById('artPrebufferEta');

                if (elPercent) elPercent.textContent = `${status.percent}%`;
                if (elMB) elMB.textContent = `${status.downloaded_mb} / ${status.total_mb} MB`;
                
                const speed = parseFloat(status.speed_mbps || 0);
                let speedText = '0.0 MB/s';
                if (speed >= 1.0) {
                    speedText = `${speed.toFixed(1)} MB/s`;
                } else if (speed > 0) {
                    speedText = `${Math.round(speed * 1024)} KB/s`;
                } else if (status.percent >= 100) {
                    speedText = 'В кэше ✓';
                }
                if (elSpeed) elSpeed.textContent = speedText;

                // Calculate seconds ahead buffered in HTML5 video element
                const videoElem = art ? art.video : document.getElementById('nativeVideoPlayer');
                let aheadSec = 0;
                if (videoElem && videoElem.buffered && videoElem.buffered.length > 0) {
                    const curTime = videoElem.currentTime || 0;
                    for (let i = 0; i < videoElem.buffered.length; i++) {
                        const start = videoElem.buffered.start(i);
                        const end = videoElem.buffered.end(i);
                        if (curTime >= start && curTime <= end) {
                            aheadSec = Math.max(0, end - curTime);
                            break;
                        }
                    }
                }

                if (elBufferAhead) {
                    if (status.percent >= 100) {
                        elBufferAhead.textContent = `(⏱ Загружено 100%)`;
                        elBufferAhead.style.color = '#10B981';
                    } else if (aheadSec >= 60) {
                        const m = Math.floor(aheadSec / 60);
                        const s = Math.floor(aheadSec % 60);
                        elBufferAhead.textContent = `(⏱ +${m}м ${s}с)`;
                        elBufferAhead.style.color = '#a7f3d0';
                    } else {
                        elBufferAhead.textContent = `(⏱ +${aheadSec.toFixed(1)}с)`;
                        elBufferAhead.style.color = '#a7f3d0';
                    }
                }

                // Update Prebuffer Percentage Badge in top widget
                if (elPrebufBadge) {
                    if (prebufferMB === 0) {
                        elPrebufBadge.textContent = '⚡ 100%';
                        elPrebufBadge.style.color = '#10B981';
                        elPrebufBadge.style.background = 'rgba(16, 185, 129, 0.15)';
                    } else {
                        const curMB = status.downloaded_mb || 0;
                        const targetMB = prebufferMB;
                        const p = Math.min(100, Math.round((curMB / targetMB) * 100));
                        if (p >= 100 || status.percent >= 100) {
                            elPrebufBadge.textContent = `✓ 100%`;
                            elPrebufBadge.style.color = '#10B981';
                            elPrebufBadge.style.background = 'rgba(16, 185, 129, 0.15)';
                        } else {
                            elPrebufBadge.textContent = `⏳ ${p}% (${curMB.toFixed(1)}/${targetMB} MB)`;
                            elPrebufBadge.style.color = '#facc15';
                            elPrebufBadge.style.background = 'rgba(250, 204, 21, 0.15)';
                        }
                    }
                }

                // Update bottom control bar badge
                if (bottomBadge) {
                    if (status.percent >= 100) {
                        bottomBadge.innerHTML = `<span style="color: #10B981;">✓ Кэш 100%</span>`;
                    } else {
                        const aheadStr = aheadSec > 0 ? ` (+${Math.round(aheadSec)}с)` : '';
                        bottomBadge.innerHTML = `<span>📥 Кэш: <b>${status.percent}%</b>${aheadStr}</span>`;
                    }
                }

                // Live prebuffering calculation and progress update
                if (isPrebuffering) {
                    const targetMB = prebufferMB;
                    const curMB = status.downloaded_mb || 0;
                    const bufPercent = targetMB > 0 ? Math.min(100, Math.round((curMB / targetMB) * 100)) : 100;
                    
                    if (pBar) pBar.style.width = `${bufPercent}%`;
                    if (pText) pText.textContent = `${curMB.toFixed(1)} / ${targetMB} MB`;
                    if (pPercentText) pPercentText.textContent = `${bufPercent}%`;

                    if (pEta) {
                        const remMB = Math.max(0, targetMB - curMB);
                        if (remMB <= 0 || status.percent >= 100) {
                            pEta.textContent = '✓ Буфер заполнен, запуск...';
                            pEta.style.color = '#10B981';
                        } else if (speed > 0) {
                            const etaSec = (remMB / speed).toFixed(1);
                            pEta.textContent = `⚡ ${speedText} • До старта ~${etaSec} сек`;
                            pEta.style.color = '#facc15';
                        } else {
                            pEta.textContent = `⚡ Загрузка с серверов Telegram...`;
                            pEta.style.color = '#facc15';
                        }
                    }

                    if (curMB >= targetMB || status.percent >= 100) {
                        isPrebuffering = false;
                        if (overlay) {
                            overlay.style.transition = 'opacity 0.3s ease';
                            overlay.style.opacity = '0';
                            setTimeout(() => { overlay.style.display = 'none'; }, 300);
                        }
                        if (art) {
                            art.play().catch(() => {});
                        } else {
                            const nativeVid = document.getElementById('nativeVideoPlayer');
                            if (nativeVid) nativeVid.play().catch(() => {});
                        }
                    }
                }

                if (status.percent >= 100 && status.total_mb > 0) {
                    const widget = document.getElementById('artBufferingWidget');
                    if (widget) {
                        widget.style.borderColor = 'rgba(16, 185, 129, 0.5)';
                    }
                }
            } catch (e) {}
        };

        updateStatusUI();
        const pollInterval = setInterval(updateStatusUI, 300);

        const closeBtn = document.getElementById('closePreviewBtn');
        const handleClose = () => {
            clearInterval(pollInterval);
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            }
            if (art) art.destroy();
            previewModal.style.display = 'none';
            previewContent.innerHTML = '';
        };

        if (closeBtn) closeBtn.onclick = handleClose;
    }
});
