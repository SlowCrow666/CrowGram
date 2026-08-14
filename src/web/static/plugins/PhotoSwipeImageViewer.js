window.CrowAPI.registerPlugin('PhotoSwipeImageViewer', {
    init: function(api) {
        api.addHook('onFileClick', (id, name, ext) => {
            const imgExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
            if (imgExts.includes((ext || '').toLowerCase())) {
                this.openGallery(id, name);
                return true;
            }
            return false;
        });
    },

    ensureUI: function() {
        if (!document.getElementById('crow-gallery-styles')) {
            const style = document.createElement('style');
            style.id = 'crow-gallery-styles';
            style.textContent = `
                .crow-gallery-overlay {
                    position: fixed !important; top: 0 !important; left: 0 !important; 
                    width: 100vw !important; height: 100vh !important;
                    background: rgba(5, 10, 20, 0.96) !important; backdrop-filter: blur(12px) !important;
                    z-index: 9999999 !important; display: none; align-items: center; justify-content: center;
                    user-select: none; overflow: hidden;
                }
                .crow-gallery-open { display: flex !important; }
                .crow-gallery-container { 
                    position: relative; width: 100%; height: 100%; 
                    display: flex; align-items: center; justify-content: center; overflow: hidden;
                }
                .crow-gallery-img { 
                    max-width: 88vw; max-height: 84vh; object-fit: contain; 
                    border-radius: 8px; box-shadow: 0 10px 40px rgba(0,0,0,0.8);
                    transition: transform 0.18s cubic-bezier(0.2, 0, 0.2, 1);
                    cursor: grab;
                }
                .crow-gallery-topbar { 
                    position: fixed !important; top: 20px !important; right: 25px !important; 
                    display: flex !important; align-items: center !important; gap: 8px !important; z-index: 10000005 !important; 
                }
                .crow-gallery-btn {
                    background: rgba(15, 23, 42, 0.9) !important; border: 1px solid rgba(59, 130, 246, 0.4) !important;
                    color: #E2E8F0 !important; padding: 8px 14px !important; border-radius: 6px !important; cursor: pointer !important;
                    font-size: 13px !important; font-weight: 600 !important; transition: all 0.2s !important; backdrop-filter: blur(6px) !important;
                    display: flex !important; align-items: center !important; justify-content: center !important; gap: 4px !important;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;
                }
                .crow-gallery-btn:hover { 
                    background: rgba(59, 130, 246, 0.35) !important; 
                    border-color: #38bdf8 !important; 
                    color: #38bdf8 !important; 
                    transform: translateY(-1px) !important;
                }
                .crow-gallery-btn.close:hover {
                    background: rgba(239, 68, 68, 0.25) !important;
                    border-color: #ef4444 !important;
                    color: #ef4444 !important;
                }
                .crow-gallery-nav {
                    position: fixed !important; top: 50% !important; transform: translateY(-50%) !important;
                    background: rgba(15, 23, 42, 0.9) !important; border: 1px solid rgba(59, 130, 246, 0.45) !important;
                    color: #E2E8F0 !important; width: 54px !important; height: 54px !important; border-radius: 12px !important;
                    display: flex !important; align-items: center !important; justify-content: center !important;
                    cursor: pointer !important; font-size: 26px !important; z-index: 10000005 !important; transition: all 0.2s ease !important;
                    box-shadow: 0 6px 20px rgba(0,0,0,0.6) !important; backdrop-filter: blur(8px) !important;
                }
                .crow-gallery-nav:hover { 
                    background: rgba(59, 130, 246, 0.4) !important; 
                    border-color: #38bdf8 !important; 
                    color: #38bdf8 !important; 
                    transform: translateY(-50%) scale(1.1) !important; 
                }
                .crow-gallery-prev { left: 24px !important; }
                .crow-gallery-next { right: 24px !important; }
                .crow-gallery-caption {
                    position: fixed !important; bottom: 20px !important; left: 50% !important; transform: translateX(-50%) !important;
                    background: rgba(15, 23, 42, 0.92) !important; border: 1px solid rgba(59, 130, 246, 0.35) !important;
                    color: #E2E8F0 !important; padding: 8px 24px !important; border-radius: 20px !important; font-size: 13px !important; 
                    font-family: 'JetBrains Mono', monospace !important; z-index: 10000005 !important;
                    box-shadow: 0 4px 16px rgba(0,0,0,0.6) !important; backdrop-filter: blur(8px) !important;
                    max-width: 80vw !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important;
                }
            `;
            document.head.appendChild(style);
        }

        let modal = document.getElementById('crow-gallery-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'crow-gallery-modal';
            modal.className = 'crow-gallery-overlay';
            modal.innerHTML = `
                <div class="crow-gallery-topbar">
                    <button id="crow-gallery-rotate-ccw" class="crow-gallery-btn" title="Повернуть против часовой (Ctrl + ←)">↺</button>
                    <button id="crow-gallery-rotate-cw" class="crow-gallery-btn" title="Повернуть по часовой (Ctrl + →)">↻</button>
                    <button id="crow-gallery-zoom-in" class="crow-gallery-btn" title="Увеличить (Zoom +)">➕</button>
                    <button id="crow-gallery-zoom-out" class="crow-gallery-btn" title="Уменьшить (Zoom -)">➖</button>
                    <button id="crow-gallery-reset" class="crow-gallery-btn" title="Сбросить масштаб (100%)">🔍</button>
                    <button id="crow-gallery-download" class="crow-gallery-btn" title="Скачать оригинал">📥</button>
                    <button id="crow-gallery-close" class="crow-gallery-btn close" title="Закрыть (Esc)" style="border-color: rgba(239,68,68,0.5); color: #f87171;">✖</button>
                </div>
                <div id="crow-gallery-prev" class="crow-gallery-nav crow-gallery-prev" title="Предыдущее (←)">❮</div>
                <div id="crow-gallery-next" class="crow-gallery-nav crow-gallery-next" title="Следующее (→)">❯</div>
                <div class="crow-gallery-container" id="crow-gallery-container">
                    <img id="crow-gallery-img" class="crow-gallery-img" src="" alt="">
                </div>
                <div id="crow-gallery-caption" class="crow-gallery-caption"></div>
            `;
            document.body.appendChild(modal);
        }
        return modal;
    },

    openGallery: async function(targetFileId, targetName) {
        const modal = this.ensureUI();
        modal.classList.add('crow-gallery-open');

        const imgExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
        let rawList = [];
        if (window.currentFolderFiles && Array.isArray(window.currentFolderFiles) && window.currentFolderFiles.length > 0) {
            rawList = window.currentFolderFiles;
        } else if (window.allItems && Array.isArray(window.allItems) && window.allItems.length > 0) {
            rawList = window.allItems;
        }

        let images = rawList.filter(f => !f.is_folder && !f.in_trash && imgExts.includes(((f.name || '').split('.').pop() || '').toLowerCase()));

        let currentIndex = images.findIndex(f => String(f.id) === String(targetFileId));
        if (currentIndex === -1) {
            images = [{ id: targetFileId, name: targetName }, ...images];
            currentIndex = 0;
        }

        const img = document.getElementById('crow-gallery-img');
        const caption = document.getElementById('crow-gallery-caption');
        const downloadBtn = document.getElementById('crow-gallery-download');
        const closeBtn = document.getElementById('crow-gallery-close');
        const prevBtn = document.getElementById('crow-gallery-prev');
        const nextBtn = document.getElementById('crow-gallery-next');
        const rotateCcwBtn = document.getElementById('crow-gallery-rotate-ccw');
        const rotateCwBtn = document.getElementById('crow-gallery-rotate-cw');
        const zoomInBtn = document.getElementById('crow-gallery-zoom-in');
        const zoomOutBtn = document.getElementById('crow-gallery-zoom-out');
        const resetBtn = document.getElementById('crow-gallery-reset');
        const container = document.getElementById('crow-gallery-container');

        let zoom = 1;
        let rotation = 0;

        const applyTransform = () => { 
            if (img) img.style.transform = `scale(${zoom}) rotate(${rotation}deg)`; 
        };

        const resetTransform = () => { 
            zoom = 1; 
            rotation = 0; 
            applyTransform(); 
        };

        const loadImage = (idx) => {
            if (!images || !images.length) return;
            currentIndex = (idx + images.length) % images.length;
            const item = images[currentIndex];
            if (caption) {
                caption.textContent = `${currentIndex + 1} / ${images.length} — ${item.name}`;
            }
            resetTransform();
            if (img) {
                img.src = `/api/download/${item.id}`;
            }
            if (downloadBtn) {
                downloadBtn.onclick = () => { window.location.href = `/api/download/${item.id}`; };
            }

            if (prevBtn) prevBtn.style.display = 'flex';
            if (nextBtn) nextBtn.style.display = 'flex';
        };

        const rotateCounterClockwise = () => {
            rotation = (rotation - 90) % 360;
            applyTransform();
        };

        const rotateClockwise = () => {
            rotation = (rotation + 90) % 360;
            applyTransform();
        };

        const zoomIn = () => {
            zoom = Math.min(zoom + 0.25, 4);
            applyTransform();
        };

        const zoomOut = () => {
            zoom = Math.max(zoom - 0.25, 0.5);
            applyTransform();
        };

        const closeGallery = () => {
            modal.classList.remove('crow-gallery-open');
            if (img) img.src = '';
            document.removeEventListener('keydown', handleKeyDown);
        };

        const handleKeyDown = (e) => {
            if (!modal.classList.contains('crow-gallery-open')) return;

            if (e.key === 'Escape') {
                e.preventDefault();
                closeGallery();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                if (e.ctrlKey) {
                    rotateCounterClockwise();
                } else {
                    loadImage(currentIndex - 1);
                }
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                if (e.ctrlKey) {
                    rotateClockwise();
                } else {
                    loadImage(currentIndex + 1);
                }
            } else if (e.key === '+' || e.key === '=') {
                e.preventDefault();
                zoomIn();
            } else if (e.key === '-' || e.key === '_') {
                e.preventDefault();
                zoomOut();
            } else if (e.key === '0') {
                e.preventDefault();
                resetTransform();
            }
        };

        document.removeEventListener('keydown', handleKeyDown);
        document.addEventListener('keydown', handleKeyDown);

        if (container) {
            container.onwheel = (e) => {
                e.preventDefault();
                if (e.deltaY < 0) {
                    zoom = Math.min(zoom + 0.2, 4);
                } else {
                    zoom = Math.max(zoom - 0.2, 0.5);
                }
                applyTransform();
            };
        }

        if (rotateCcwBtn) rotateCcwBtn.onclick = rotateCounterClockwise;
        if (rotateCwBtn) rotateCwBtn.onclick = rotateClockwise;
        if (zoomInBtn) zoomInBtn.onclick = zoomIn;
        if (zoomOutBtn) zoomOutBtn.onclick = zoomOut;
        if (resetBtn) resetBtn.onclick = resetTransform;

        if (closeBtn) closeBtn.onclick = closeGallery;
        if (prevBtn) prevBtn.onclick = () => loadImage(currentIndex - 1);
        if (nextBtn) nextBtn.onclick = () => loadImage(currentIndex + 1);

        loadImage(currentIndex);
    }
});
