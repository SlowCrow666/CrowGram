(function() {
    const API_BASE = '/api/plugins/crow-music';

    const state = {
        currentTab: 'albums',
        searchQuery: '',
        albums: [],
        artists: [],
        tracks: [],
        queue: [],
        currentIndex: -1,
        isPlaying: false,
        isShuffle: false,
        repeatMode: 1, // 0: off, 1: all, 2: one
        currentTrack: null,
        audio: new Audio(),
        stats: null
    };

    // DOM Elements
    const elements = {
        searchInput: document.getElementById('searchInput'),
        tabBtns: document.querySelectorAll('.tab-btn'),
        views: {
            albums: document.getElementById('viewAlbums'),
            artists: document.getElementById('viewArtists'),
            tracks: document.getElementById('viewTracks'),
            albumDetail: document.getElementById('viewAlbumDetail')
        },
        containers: {
            albumsGrid: document.getElementById('albumsGrid'),
            artistsGrid: document.getElementById('artistsGrid'),
            tracksTableBody: document.getElementById('tracksTableBody'),
            albumDetailContent: document.getElementById('albumDetailContent')
        },
        rescanBtn: document.getElementById('rescanBtn'),
        statsBadge: document.getElementById('statsBadge'),
        player: {
            bar: document.getElementById('playerBar'),
            cover: document.getElementById('playerCover'),
            title: document.getElementById('playerTitle'),
            artist: document.getElementById('playerArtist'),
            format: document.getElementById('playerFormat'),
            playBtn: document.getElementById('playerPlayBtn'),
            prevBtn: document.getElementById('playerPrevBtn'),
            nextBtn: document.getElementById('playerNextBtn'),
            shuffleBtn: document.getElementById('playerShuffleBtn'),
            repeatBtn: document.getElementById('playerRepeatBtn'),
            seekBar: document.getElementById('playerSeekBar'),
            currentTime: document.getElementById('playerCurrentTime'),
            totalTime: document.getElementById('playerTotalTime'),
            volumeSlider: document.getElementById('playerVolumeSlider'),
            volumeBtn: document.getElementById('playerVolumeBtn')
        }
    };

    // Format seconds to mm:ss
    function formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // Format bytes
    function formatSize(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // Init App
    async function init() {
        bindEvents();
        initAudioEngine();
        await loadStats();
        if (!state.stats || state.stats.total_tracks === 0) {
            await handleRescan();
        } else {
            await switchTab('albums');
        }
    }

    function bindEvents() {
        // Search Input (Debounced)
        let searchTimer = null;
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimer);
                state.searchQuery = e.target.value.trim();
                searchTimer = setTimeout(() => refreshCurrentView(), 250);
            });
        }

        // Tab Navigation
        elements.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                if (tab) switchTab(tab);
            });
        });

        // Rescan Button
        if (elements.rescanBtn) {
            elements.rescanBtn.addEventListener('click', handleRescan);
        }

        // Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;
            if (e.code === 'Space') {
                e.preventDefault();
                togglePlayPause();
            } else if (e.code === 'ArrowRight') {
                e.preventDefault();
                seekRelative(5);
            } else if (e.code === 'ArrowLeft') {
                e.preventDefault();
                seekRelative(-5);
            } else if (e.code === 'KeyM') {
                e.preventDefault();
                toggleMute();
            }
        });
    }

    function initAudioEngine() {
        const audio = state.audio;

        audio.addEventListener('timeupdate', () => {
            if (!audio.duration) return;
            const progress = (audio.currentTime / audio.duration) * 100;
            if (elements.player.seekBar) elements.player.seekBar.value = progress;
            if (elements.player.currentTime) elements.player.currentTime.textContent = formatTime(audio.currentTime);
            if (elements.player.totalTime) elements.player.totalTime.textContent = formatTime(audio.duration);
        });

        audio.addEventListener('ended', () => {
            if (state.repeatMode === 2) {
                // Repeat single track
                audio.currentTime = 0;
                audio.play();
            } else {
                playNext();
            }
        });

        audio.addEventListener('play', () => updatePlayButtonState(true));
        audio.addEventListener('pause', () => updatePlayButtonState(false));

        // Player Controls
        elements.player.playBtn?.addEventListener('click', togglePlayPause);
        elements.player.prevBtn?.addEventListener('click', playPrev);
        elements.player.nextBtn?.addEventListener('click', playNext);
        elements.player.shuffleBtn?.addEventListener('click', toggleShuffle);
        elements.player.repeatBtn?.addEventListener('click', toggleRepeat);

        elements.player.seekBar?.addEventListener('input', (e) => {
            if (!audio.duration) return;
            const targetTime = (e.target.value / 100) * audio.duration;
            audio.currentTime = targetTime;
        });

        elements.player.volumeSlider?.addEventListener('input', (e) => {
            audio.volume = e.target.value / 100;
        });

        elements.player.volumeBtn?.addEventListener('click', toggleMute);
    }

    // Switch View Tabs
    async function switchTab(tab) {
        state.currentTab = tab;
        elements.tabBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
        Object.keys(elements.views).forEach(k => {
            if (elements.views[k]) elements.views[k].classList.toggle('active', k === tab);
        });
        await refreshCurrentView();
    }

    async function refreshCurrentView() {
        if (state.currentTab === 'albums') await loadAlbums();
        else if (state.currentTab === 'artists') await loadArtists();
        else if (state.currentTab === 'tracks') await loadTracks();
    }

    // API Calls
    async function loadStats() {
        try {
            const res = await fetch(`${API_BASE}/status`);
            if (res.ok) {
                state.stats = await res.json();
                if (elements.statsBadge) {
                    elements.statsBadge.textContent = `${state.stats.total_tracks} треков • ${state.stats.total_albums} альбомов`;
                }
            }
        } catch (e) {}
    }

    async function handleRescan() {
        if (elements.rescanBtn) elements.rescanBtn.classList.add('spinning');
        try {
            const res = await fetch(`${API_BASE}/scan`);
            if (res.ok) {
                await loadStats();
                await refreshCurrentView();
            }
        } catch (e) {
            console.error('Scan error:', e);
        } finally {
            if (elements.rescanBtn) elements.rescanBtn.classList.remove('spinning');
        }
    }

    async function loadAlbums() {
        try {
            const q = encodeURIComponent(state.searchQuery);
            const res = await fetch(`${API_BASE}/albums?q=${q}`);
            if (res.ok) {
                state.albums = await res.json();
                renderAlbums(state.albums);
            }
        } catch (e) {
            console.error('Error loading albums:', e);
        }
    }

    async function loadArtists() {
        try {
            const q = encodeURIComponent(state.searchQuery);
            const res = await fetch(`${API_BASE}/artists?q=${q}`);
            if (res.ok) {
                state.artists = await res.json();
                renderArtists(state.artists);
            }
        } catch (e) {
            console.error('Error loading artists:', e);
        }
    }

    async function loadTracks() {
        try {
            const q = encodeURIComponent(state.searchQuery);
            const res = await fetch(`${API_BASE}/tracks?q=${q}`);
            if (res.ok) {
                state.tracks = await res.json();
                renderTracks(state.tracks);
            }
        } catch (e) {
            console.error('Error loading tracks:', e);
        }
    }

    // Render Methods
    function renderAlbums(albums) {
        const grid = elements.containers.albumsGrid;
        if (!grid) return;

        if (albums.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-muted);">
                    <span style="font-size: 40px; display: block; margin-bottom: 12px;">🎵</span>
                    <p style="font-size: 14px; font-weight: 600; color: var(--text-secondary);">Альбомы не найдены</p>
                    <p style="font-size: 12px; margin-top: 4px;">Нажмите кнопку «Пересканировать диски», чтобы проиндексировать аудиофайлы.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = albums.map(album => {
            const coverUrl = album.cover_hash ? `${API_BASE}/cover/${album.cover_hash}` : 'icon.svg';
            return `
                <div class="album-card" data-album-id="${album.id}">
                    <div class="album-cover-wrapper">
                        <img src="${coverUrl}" class="album-cover-img" alt="${escapeHtml(album.title)}" onerror="this.src='icon.svg'" />
                        <div class="play-overlay-btn" title="Воспроизвести альбом">▶</div>
                    </div>
                    <div class="album-title" title="${escapeHtml(album.title)}">${escapeHtml(album.title)}</div>
                    <div class="album-artist" title="${escapeHtml(album.artist)}">${escapeHtml(album.artist)}</div>
                    <div class="album-meta-row">
                        <span>${album.year || 'Music'}</span>
                        <span>${album.track_count} треков</span>
                    </div>
                </div>
            `;
        }).join('');

        // Bind clicks
        grid.querySelectorAll('.album-card').forEach(card => {
            const albumId = card.dataset.albumId;
            card.addEventListener('click', (e) => {
                if (e.target.closest('.play-overlay-btn')) {
                    e.stopPropagation();
                    playAlbumById(albumId);
                } else {
                    openAlbumDetail(albumId);
                }
            });
        });
    }

    function renderArtists(artists) {
        const grid = elements.containers.artistsGrid;
        if (!grid) return;

        if (artists.length === 0) {
            grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:50px; color:var(--text-muted);">Артисты не найдены</div>`;
            return;
        }

        grid.innerHTML = artists.map(artist => `
            <div class="artist-card" data-artist="${escapeHtml(artist.name)}">
                <div class="artist-avatar">👤</div>
                <div class="artist-name" title="${escapeHtml(artist.name)}">${escapeHtml(artist.name)}</div>
                <div class="artist-stat">${artist.album_count} альбомов • ${artist.track_count} треков</div>
            </div>
        `).join('');

        grid.querySelectorAll('.artist-card').forEach(card => {
            card.addEventListener('click', () => {
                state.searchQuery = card.dataset.artist;
                if (elements.searchInput) elements.searchInput.value = state.searchQuery;
                switchTab('tracks');
            });
        });
    }

    function renderTracks(tracks) {
        const tbody = elements.containers.tracksTableBody;
        if (!tbody) return;

        if (tracks.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--text-muted);">Треки не найдены</td></tr>`;
            return;
        }

        tbody.innerHTML = tracks.map((track, idx) => {
            const isActive = state.currentTrack && state.currentTrack.id === track.id;
            return `
                <tr class="${isActive ? 'active' : ''}" data-track-id="${track.id}" data-index="${idx}">
                    <td class="track-play-cell">${isActive && state.isPlaying ? '🔊' : '▶'}</td>
                    <td style="font-weight: 600; color: var(--text-primary);">${escapeHtml(track.title)}</td>
                    <td>${escapeHtml(track.artist)}</td>
                    <td>${escapeHtml(track.album)}</td>
                    <td><span class="format-badge">${track.format || 'AUDIO'}</span></td>
                    <td style="font-family: monospace;">${formatSize(track.file_size)}</td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('tr').forEach(row => {
            row.addEventListener('click', () => {
                const idx = parseInt(row.dataset.index);
                playTrack(tracks[idx], tracks, idx);
            });
        });
    }

    // Album Detail Screen
    async function openAlbumDetail(albumId) {
        try {
            const res = await fetch(`${API_BASE}/album/${encodeURIComponent(albumId)}`);
            if (!res.ok) return;
            const album = await res.json();
            renderAlbumDetail(album);
            switchTab('albumDetail');
        } catch (e) {
            console.error('Error opening album detail:', e);
        }
    }

    function renderAlbumDetail(album) {
        const content = elements.containers.albumDetailContent;
        if (!content) return;

        const coverUrl = album.cover_hash ? `${API_BASE}/cover/${album.cover_hash}` : 'icon.svg';

        content.innerHTML = `
            <div style="margin-bottom: 16px;">
                <button id="backToAlbumsBtn" class="btn-secondary-action" style="cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
                    ⬅ Назад к альбомам
                </button>
            </div>

            <div class="album-hero">
                <img src="${coverUrl}" class="album-hero-cover" alt="${escapeHtml(album.title)}" onerror="this.src='icon.svg'" />
                <div class="album-hero-details">
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--accent-purple); font-weight: 700; margin-bottom: 4px;">Альбом</div>
                    <h1 class="album-hero-title">${escapeHtml(album.title)}</h1>
                    <div class="album-hero-artist">${escapeHtml(album.artist)}</div>
                    <div class="album-hero-meta">
                        <span>📅 ${album.year || '2024'}</span>
                        <span>🎵 ${album.track_count} треков</span>
                        <span>🏷️ ${album.genre || 'Music'}</span>
                    </div>
                    <div class="album-actions">
                        <button id="playAllAlbumBtn" class="btn-primary-action">
                            ▶ Слушать альбом
                        </button>
                        <button id="shuffleAlbumBtn" class="btn-secondary-action">
                            🔀 Вперемешку
                        </button>
                    </div>
                </div>
            </div>

            <div class="tracks-table-container">
                <table class="tracks-table">
                    <thead>
                        <tr>
                            <th style="width: 40px;">#</th>
                            <th>Название</th>
                            <th>Исполнитель</th>
                            <th>Формат</th>
                            <th>Размер</th>
                        </tr>
                    </thead>
                    <tbody id="albumTracksBody">
                        ${album.tracks.map((track, idx) => `
                            <tr data-track-id="${track.id}" data-index="${idx}">
                                <td class="track-play-cell">${track.track_no || idx + 1}</td>
                                <td style="font-weight: 600; color: var(--text-primary);">${escapeHtml(track.title)}</td>
                                <td>${escapeHtml(track.artist)}</td>
                                <td><span class="format-badge">${track.format}</span></td>
                                <td style="font-family: monospace;">${formatSize(track.file_size)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('backToAlbumsBtn')?.addEventListener('click', () => switchTab('albums'));
        
        document.getElementById('playAllAlbumBtn')?.addEventListener('click', () => {
            if (album.tracks && album.tracks.length) {
                playTrack(album.tracks[0], album.tracks, 0);
            }
        });

        document.getElementById('shuffleAlbumBtn')?.addEventListener('click', () => {
            if (album.tracks && album.tracks.length) {
                const shuffled = [...album.tracks].sort(() => Math.random() - 0.5);
                playTrack(shuffled[0], shuffled, 0);
            }
        });

        content.querySelectorAll('#albumTracksBody tr').forEach(row => {
            row.addEventListener('click', () => {
                const idx = parseInt(row.dataset.index);
                playTrack(album.tracks[idx], album.tracks, idx);
            });
        });
    }

    async function playAlbumById(albumId) {
        try {
            const res = await fetch(`${API_BASE}/album/${encodeURIComponent(albumId)}`);
            if (!res.ok) return;
            const album = await res.json();
            if (album.tracks && album.tracks.length) {
                playTrack(album.tracks[0], album.tracks, 0);
            }
        } catch (e) {}
    }

    // Playback Engine
    function playTrack(track, queue = [], index = 0) {
        state.currentTrack = track;
        state.queue = queue.length ? queue : [track];
        state.currentIndex = index;

        // Set audio stream url
        const streamUrl = `/api/stream/${track.file_id}`;
        state.audio.src = streamUrl;
        state.audio.play().catch(e => console.error('Audio play error:', e));

        // Update UI
        if (elements.player.title) elements.player.title.textContent = track.title || track.filename;
        if (elements.player.artist) elements.player.artist.textContent = track.artist || 'Unknown Artist';
        if (elements.player.format) elements.player.format.textContent = track.format || 'AUDIO';
        
        const coverUrl = track.cover_hash ? `${API_BASE}/cover/${track.cover_hash}` : 'icon.svg';
        if (elements.player.cover) elements.player.cover.src = coverUrl;

        // Re-render active rows if visible
        if (state.currentTab === 'tracks') renderTracks(state.tracks);
    }

    function togglePlayPause() {
        if (!state.currentTrack && state.tracks.length) {
            playTrack(state.tracks[0], state.tracks, 0);
            return;
        }
        if (state.audio.paused) {
            state.audio.play().catch(e => {});
        } else {
            state.audio.pause();
        }
    }

    function playNext() {
        if (!state.queue.length) return;
        let nextIdx = state.currentIndex + 1;
        if (state.isShuffle) {
            nextIdx = Math.floor(Math.random() * state.queue.length);
        }
        if (nextIdx >= state.queue.length) {
            if (state.repeatMode === 1) nextIdx = 0;
            else return;
        }
        playTrack(state.queue[nextIdx], state.queue, nextIdx);
    }

    function playPrev() {
        if (!state.queue.length) return;
        if (state.audio.currentTime > 3) {
            state.audio.currentTime = 0;
            return;
        }
        let prevIdx = state.currentIndex - 1;
        if (prevIdx < 0) prevIdx = state.queue.length - 1;
        playTrack(state.queue[prevIdx], state.queue, prevIdx);
    }

    function toggleShuffle() {
        state.isShuffle = !state.isShuffle;
        elements.player.shuffleBtn?.classList.toggle('active', state.isShuffle);
    }

    function toggleRepeat() {
        state.repeatMode = (state.repeatMode + 1) % 3;
        const icons = ['➡️', '🔁', '🔂'];
        if (elements.player.repeatBtn) {
            elements.player.repeatBtn.textContent = icons[state.repeatMode];
            elements.player.repeatBtn.classList.toggle('active', state.repeatMode > 0);
        }
    }

    function seekRelative(deltaSec) {
        if (!state.audio.duration) return;
        state.audio.currentTime = Math.max(0, Math.min(state.audio.duration, state.audio.currentTime + deltaSec));
    }

    function toggleMute() {
        state.audio.muted = !state.audio.muted;
        if (elements.player.volumeBtn) {
            elements.player.volumeBtn.textContent = state.audio.muted ? '🔇' : '🔊';
        }
    }

    function updatePlayButtonState(isPlaying) {
        state.isPlaying = isPlaying;
        if (elements.player.playBtn) {
            elements.player.playBtn.textContent = isPlaying ? '⏸' : '▶';
        }
    }

    function escapeHtml(str) {
        return String(str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // Start on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
