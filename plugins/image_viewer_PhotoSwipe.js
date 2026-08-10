window.CrowAPI.registerPlugin('PhotoSwipeImageViewer', {
    init: function(api) {
        console.log('[PhotoSwipeImageViewer] Инициализация галереи...');

        api.addHook('onFileClick', (id, name, ext) => {
            const imgExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
            if (imgExts.includes(ext.toLowerCase())) {
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
                    z-index: 999999 !important; display: none; align-items: center; justify-content: center;
                    user-select: none; overflow: hidden;
                }
                .crow-gallery-open { display: flex !important; }
                .crow-gallery-container { 
                    position: relative; width: 100%; height: 100%; 
                    display: flex; align-items: center; justify-content: center; overflow: hidden;
                }
                .crow-gallery-img { 
                    max-width: 90vw; max-height: 85vh; object-fit: contain; 
                    border-radius: 8px; box-shadow: 0 10px 40px rgba(0,0,0,0.8);
                    transition: transform 0.15s ease-out; cursor: grab;
                }
                .crow-gallery-topbar { position: absolute; top: 20px; right: 25px; display: flex; gap: 10px; z-index: 1000000; }
                .crow-gallery-btn {
                    background: rgba(15, 23, 42, 0.85); border: 1px solid #2ec4b6;
                    color: #ccd6f6; padding: 8px 14px; border-radius: 6px; cursor: pointer;
                    font-size: 13px; font-weight: 600; transition: all 0.2s; backdrop-filter: blur(4px);
                }
                .crow-gallery-btn:hover { background: #2ec4b6; color: #0f172a; }
                .crow-gallery-nav {
                    position: absolute; top: 50%; transform: translateY(-50%);
                    background: rgba(15, 23, 42, 0.85); border: 1px solid #2ec4b6;
                    color: #ccd6f6; width: 54px; height: 50px; border-radius: 12px;
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer; font-size: 26px; z-index: 1000000; transition: all 0.2s;
                }
                .crow-gallery-nav:hover { background: #2ec4b6; color: #0f172a; }
                .crow-gallery-prev { left: 25px; }
                .crow-gallery-next { right: 25px; }
                .crow-gallery-caption {
                    position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
                    background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255,255,255,0.1);
                    color: #ccd6f6; padding: 6px 20px; border-radius: 20px; font-size: 13px; z-index: 1000000;
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
                    <button id="crow-gallery-rotate" class="crow-gallery-btn">🔄 Повернуть</button>
                    <button id="crow-gallery-reset" class="crow-gallery-btn">🔍 100%</button>
                    <button id="crow-gallery-download" class="crow-gallery-btn">📥 Скачать</button>
                    <button id="crow-gallery-close" class="crow-gallery-btn" style="border-color:#ff5555; color:#ff5555;">✖ Закрыть</button>
                </div>
                <div id="crow-gallery-prev" class="crow-gallery-nav crow-gallery-prev">❮</div>
                <div id="crow-gallery-next" class="crow-gallery-nav crow-gallery-next">❯</div>
                <div class="crow-gallery-container" id="crow-gallery-container">
                    <img id="crow-gallery-img" class="crow-gallery-img" src="" alt="">
                </div>
                <div id="crow-gallery-caption" class="crow-gallery-caption"></div>
            `;
            document.body.appendChild(modal);
        }
        return modal;
    },

    fetchCurrentFolderImages: async function() {
        const imgExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
        const driveId = window.currentDriveId || 1;
        const currentFolder = Number(window.currentFolderId || 0);

        try {
            const res = await fetch(`/api/files?drive_id=${driveId}&_t=${Date.now()}`);
            if (res.ok) {
                const files = await res.json();
                
                // Сначала пробуем строго по текущей папке
                let filtered = files.filter(f => {
                    if (f.is_folder) return false;
                    const fParent = (f.parent_id === null || f.parent_id === undefined) ? 0 : Number(f.parent_id);
                    const ext = (f.name || '').split('.').pop().toLowerCase();
                    return fParent === currentFolder && imgExts.includes(ext);
                });

                // Если строго по папке нашлась 1 или 0 картинок, забираем вообще ВСЕ картинки с этого диска
                if (filtered.length <= 1) {
                    filtered = files.filter(f => {
                        if (f.is_folder) return false;
                        const ext = (f.name || '').split('.').pop().toLowerCase();
                        return imgExts.includes(ext);
                    });
                }

                if (filtered.length > 0) return filtered;
            }
        } catch (e) {
            console.error("Ошибка запроса списка файлов для галереи:", e);
        }

        if (window.allItems && Array.isArray(window.allItems)) {
            return window.allItems.filter(f => !f.is_folder && imgExts.includes((f.name || '').split('.').pop().toLowerCase()));
        }
        return [];
    },

    openGallery: async function(targetFileId, targetName) {
        const modal = this.ensureUI();

        modal.classList.add('crow-gallery-open');

        let images = await this.fetchCurrentFolderImages();
        let currentIndex = images.findIndex(f => String(f.id) === String(targetFileId));

        if (currentIndex === -1) {
            images = [{ id: targetFileId, name: targetName || 'Image' }];
            currentIndex = 0;
        }

        const img = document.getElementById('crow-gallery-img');
        const caption = document.getElementById('crow-gallery-caption');
        const downloadBtn = document.getElementById('crow-gallery-download');
        const closeBtn = document.getElementById('crow-gallery-close');
        const prevBtn = document.getElementById('crow-gallery-prev');
        const nextBtn = document.getElementById('crow-gallery-next');
        const rotateBtn = document.getElementById('crow-gallery-rotate');
        const resetBtn = document.getElementById('crow-gallery-reset');
        const container = document.getElementById('crow-gallery-container');

        let zoom = 1;
        let rotation = 0;

        const applyTransform = () => {
            img.style.transform = `scale(${zoom}) rotate(${rotation}deg)`;
        };

        const resetTransform = () => {
            zoom = 1;
            rotation = 0;
            applyTransform();
        };

        const loadImage = (index) => {
            currentIndex = index;
            const currentItem = images[currentIndex];
            caption.textContent = `⏳ Загрузка... (${currentIndex + 1} / ${images.length})`;
            resetTransform();

            const tempImg = new Image();
            tempImg.onload = () => {
                img.src = tempImg.src;
                caption.textContent = `${currentIndex + 1} / ${images.length} — ${currentItem.name}`;
            };
            tempImg.onerror = () => {
                caption.textContent = `✖ Ошибка загрузки — ${currentItem.name}`;
            };
            tempImg.src = `/api/download/${currentItem.id}`;

            downloadBtn.onclick = () => {
                window.location.href = `/api/download/${currentItem.id}`;
            };
        };

        container.onwheel = (e) => {
            e.preventDefault();
            zoom = e.deltaY < 0 ? Math.min(zoom + 0.15, 4) : Math.max(zoom - 0.15, 0.5);
            applyTransform();
        };

        rotateBtn.onclick = () => {
            rotation = (rotation + 90) % 360;
            applyTransform();
        };

        resetBtn.onclick = resetTransform;

        loadImage(currentIndex);

        if (images.length > 1) {
            prevBtn.style.display = 'flex';
            nextBtn.style.display = 'flex';
        } else {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
        }

        const closeGallery = () => {
            modal.classList.remove('crow-gallery-open');
            img.src = '';
            container.onwheel = null;
            window.removeEventListener('keydown', handleKey);
        };

        const handleKey = (e) => {
            if (e.key === 'Escape') closeGallery();
            if (e.key === 'ArrowRight' && images.length > 1) loadImage((currentIndex + 1) % images.length);
            if (e.key === 'ArrowLeft' && images.length > 1) loadImage((currentIndex - 1 + images.length) % images.length);
        };

        closeBtn.onclick = closeGallery;
        prevBtn.onclick = () => loadImage((currentIndex - 1 + images.length) % images.length);
        nextBtn.onclick = () => loadImage((currentIndex + 1) % images.length);

        window.addEventListener('keydown', handleKey);
    }
});