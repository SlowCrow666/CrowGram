window.CrowAPI.registerPlugin('audio_player_Wavesurfer', {
    init: function(api) {
        console.log('[AudioPlayer] Инициализация плагина...');

        this.playlist = [];
        this.currentIndex = -1;
        this.wavesurfer = null;
        this.isShuffle = false;
        this.isRepeat = false;

        this.bar = api.ui.addBottomBar('crow-audio-player', `
            <div id="crow-player-container" style="display: none; padding: 10px 20px; align-items: center; gap: 15px; background: rgba(15, 23, 42, 0.95); border-top: 1px solid var(--accent-blue, #2ec4b6); box-shadow: 0 -4px 20px rgba(0,0,0,0.5); position: relative;">
                <div style="font-size: 24px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); border-radius: 6px;">🎵</div>
                
                <div style="flex-grow: 1; min-width: 0;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span id="crow-player-title" style="font-size: 13px; font-weight: 600; color: #ccd6f6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Загрузка...</span>
                        <span id="crow-player-time" style="font-size: 11px; font-family: 'JetBrains Mono', monospace; color: #8892b0;">00:00 / 00:00</span>
                    </div>
                    <div id="crow-waveform" style="width: 100%; height: 35px; cursor: pointer;"></div>
                </div>

                <div style="display: flex; align-items: center; gap: 8px;">
                    <button id="crow-shuffle-btn" title="Случайный порядок" style="background: rgba(255,255,255,0.05); border: 1px solid transparent; color: #8892b0; cursor: pointer; font-size: 14px; padding: 6px 10px; border-radius: 6px; transition: all 0.2s;">🔀</button>
                    <button id="crow-repeat-btn" title="Повтор" style="background: rgba(255,255,255,0.05); border: 1px solid transparent; color: #8892b0; cursor: pointer; font-size: 14px; padding: 6px 10px; border-radius: 6px; transition: all 0.2s;">🔁</button>
                    
                    <button id="crow-prev-btn" title="Предыдущий" style="background: none; border: none; color: #ccd6f6; cursor: pointer; font-size: 18px; padding: 4px 8px;">⏮</button>
                    <button id="crow-play-btn" title="Воспроизвести / Пауза" style="background: var(--accent-blue, #2ec4b6); border: none; color: #0f172a; cursor: pointer; font-size: 16px; width: 36px; height: 36px; border-radius: 50%; font-weight: bold; display: flex; align-items: center; justify-content: center;">▶</button>
                    <button id="crow-next-btn" title="Следующий" style="background: none; border: none; color: #ccd6f6; cursor: pointer; font-size: 18px; padding: 4px 8px;">⏭</button>

                    <div style="display: flex; align-items: center; gap: 6px; margin-left: 8px;">
                        <span style="font-size: 14px;">🔊</span>
                        <input type="range" id="crow-volume-slider" min="0" max="1" step="0.05" value="0.8" style="width: 70px; cursor: pointer;">
                    </div>

                    <button id="crow-playlist-btn" title="Плейлист папки" style="background: rgba(255,255,255,0.05); border: 1px solid transparent; color: #ccd6f6; cursor: pointer; font-size: 14px; margin-left: 8px; padding: 6px 10px; border-radius: 6px;">📋</button>
                    
                    <button id="crow-close-btn" title="Закрыть плеер" style="background: none; border: none; color: #ff5555; cursor: pointer; font-size: 18px; margin-left: 8px;">✖</button>
                </div>

                <div id="crow-playlist-dropdown" style="display: none; position: absolute; right: 20px; bottom: 65px; width: 340px; max-height: 260px; overflow-y: auto; background: #0f172a; border: 1px solid var(--accent-blue, #2ec4b6); border-radius: 8px; padding: 10px; box-shadow: 0 10px 25px rgba(0,0,0,0.8); z-index: 2000;">
                    <div style="font-size: 11px; font-weight: bold; color: #8892b0; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.1); letter-spacing: 1px;">ОЧЕРЕДЬ ВОСПРОИЗВЕДЕНИЯ</div>
                    <div id="crow-playlist-items"></div>
                </div>
            </div>
        `);

        this.loadWaveSurferScript();

        api.addHook('onFileClick', (id, name, ext) => {
            const audioExts = ['mp3', 'flac', 'ogg', 'wav', 'm4a', 'aac'];
            if (audioExts.includes(ext.toLowerCase())) {
                this.startPlayback(id, name);
                return true;
            }
            return false;
        });

        this.bindEvents();
    },

    loadWaveSurferScript: function() {
        if (window.WaveSurfer) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/wavesurfer.js@7/dist/wavesurfer.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    bindEvents: function() {
        document.getElementById('crow-play-btn').onclick = () => {
            if (this.wavesurfer) this.wavesurfer.playPause();
        };
        document.getElementById('crow-prev-btn').onclick = () => this.playPrev();
        document.getElementById('crow-next-btn').onclick = () => this.playNext();
        document.getElementById('crow-close-btn').onclick = () => this.stop();

        const shuffleBtn = document.getElementById('crow-shuffle-btn');
        shuffleBtn.onclick = () => {
            this.isShuffle = !this.isShuffle;
            shuffleBtn.style.color = this.isShuffle ? '#0f172a' : '#8892b0';
            shuffleBtn.style.background = this.isShuffle ? '#2ec4b6' : 'rgba(255,255,255,0.05)';
            shuffleBtn.style.borderColor = this.isShuffle ? '#2ec4b6' : 'transparent';
        };

        const repeatBtn = document.getElementById('crow-repeat-btn');
        repeatBtn.onclick = () => {
            this.isRepeat = !this.isRepeat;
            repeatBtn.style.color = this.isRepeat ? '#0f172a' : '#8892b0';
            repeatBtn.style.background = this.isRepeat ? '#2ec4b6' : 'rgba(255,255,255,0.05)';
            repeatBtn.style.borderColor = this.isRepeat ? '#2ec4b6' : 'transparent';
        };

        document.getElementById('crow-volume-slider').oninput = (e) => {
            if (this.wavesurfer) {
                this.wavesurfer.setVolume(parseFloat(e.target.value));
            }
        };

        document.getElementById('crow-playlist-btn').onclick = () => {
            const el = document.getElementById('crow-playlist-dropdown');
            el.style.display = el.style.display === 'none' ? 'block' : 'none';
        };
    },

    initWavesurfer: function() {
        if (this.wavesurfer) return;

        document.getElementById('crow-waveform').innerHTML = '';

        this.wavesurfer = WaveSurfer.create({
            container: '#crow-waveform',
            waveColor: 'rgba(255, 255, 255, 0.2)',
            progressColor: '#2ec4b6',
            cursorColor: '#2ec4b6',
            barWidth: 2,
            barRadius: 2,
            height: 35,
            responsive: true
        });

        this.wavesurfer.on('play', () => {
            document.getElementById('crow-play-btn').textContent = '⏸';
        });

        this.wavesurfer.on('pause', () => {
            document.getElementById('crow-play-btn').textContent = '▶';
        });

        this.wavesurfer.on('timeupdate', (currentTime) => {
            const duration = this.wavesurfer.getDuration() || 0;
            document.getElementById('crow-player-time').textContent = `${this.formatTime(currentTime)} / ${this.formatTime(duration)}`;
        });

        this.wavesurfer.on('finish', () => {
            if (this.isRepeat) {
                this.wavesurfer.play();
            } else {
                this.playNext();
            }
        });
    },

    buildPlaylistFromUI: function() {
        const audioExts = ['mp3', 'flac', 'ogg', 'wav', 'm4a', 'aac'];
        let items = [];

        if (window.allItems && window.allItems.length > 0) {
            items = window.allItems.filter(f => !f.is_folder && audioExts.includes(f.name.split('.').pop().toLowerCase()));
        }

        this.playlist = items;
    },

    startPlayback: async function(id, name) {
        try {
            await this.loadWaveSurferScript();
        } catch(e) {
            return alert("Не удалось загрузить модуль воспроизведения аудио");
        }

        this.buildPlaylistFromUI();
        this.currentIndex = this.playlist.findIndex(f => f.id === id);
        
        if (this.currentIndex === -1) {
            this.playlist.push({ id: id, name: name });
            this.currentIndex = this.playlist.length - 1;
        }

        document.getElementById('crow-player-container').style.display = 'flex';
        this.initWavesurfer();
        this.loadTrack(id, name);
    },

    loadTrack: function(id, name) {
        document.getElementById('crow-player-title').textContent = name;
        document.getElementById('crow-player-time').textContent = "Загрузка...";
        
        const streamUrl = `/api/stream/${id}`;
        const vol = parseFloat(document.getElementById('crow-volume-slider').value);
        
        this.wavesurfer.load(streamUrl);
        this.wavesurfer.once('ready', () => {
            this.wavesurfer.setVolume(vol);
            this.wavesurfer.play();
        });

        this.renderPlaylistUI();
    },

    playNext: function() {
        if (!this.playlist || this.playlist.length === 0) return;
        
        if (this.isShuffle) {
            this.currentIndex = Math.floor(Math.random() * this.playlist.length);
        } else {
            this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
        }

        const track = this.playlist[this.currentIndex];
        if (track) this.loadTrack(track.id, track.name);
    },

    playPrev: function() {
        if (!this.playlist || this.playlist.length === 0) return;
        
        if (this.isShuffle) {
            this.currentIndex = Math.floor(Math.random() * this.playlist.length);
        } else {
            this.currentIndex = (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
        }

        const track = this.playlist[this.currentIndex];
        if (track) this.loadTrack(track.id, track.name);
    },

    renderPlaylistUI: function() {
        const container = document.getElementById('crow-playlist-items');
        if (!container) return;
        container.innerHTML = '';

        this.playlist.forEach((item, index) => {
            const isCurrent = index === this.currentIndex;
            const div = document.createElement('div');
            div.style.cssText = `
                padding: 6px 10px;
                font-size: 12px;
                cursor: pointer;
                border-radius: 4px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-bottom: 3px;
                transition: background 0.15s;
                background: ${isCurrent ? 'rgba(46, 196, 182, 0.25)' : 'transparent'};
                color: ${isCurrent ? '#2ec4b6' : '#ccd6f6'};
                font-weight: ${isCurrent ? '600' : 'normal'};
            `;
            div.textContent = `${index + 1}. ${item.name}`;
            div.onclick = () => {
                this.currentIndex = index;
                this.loadTrack(item.id, item.name);
            };
            container.appendChild(div);
        });
    },

    stop: function() {
        if (this.wavesurfer) {
            this.wavesurfer.stop();
        }
        document.getElementById('crow-player-container').style.display = 'none';
        document.getElementById('crow-playlist-dropdown').style.display = 'none';
    },

    formatTime: function(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
});
