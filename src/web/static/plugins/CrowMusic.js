/**
 * CrowGram - CrowMusic Hub (Client-side First Native Plugin)
 * Complete self-contained music player, album catalog, genre & favorites engine,
 * and Batch Tag Editor with instant SQLite synchronization for CrowGram.
 */
(function() {
    const PLUGIN_NAME = 'CrowMusic';

    const MUSIC_CSS = `
        #musicModal {
            position: fixed !important;
            inset: 0 !important;
            z-index: 2000 !important;
            background: rgba(8, 10, 15, 0.94) !important;
            backdrop-filter: blur(16px) !important;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 16px;
            box-sizing: border-box;
            user-select: none;
        }
        #musicModal .modal-panel {
            position: relative !important;
            max-width: 1340px !important;
            width: 96vw !important;
            height: 90vh !important;
            background: #0f1117 !important;
            border: 1px solid #1e2330 !important;
            border-radius: 14px !important;
            box-shadow: 0 24px 70px rgba(0, 0, 0, 0.9), 0 0 30px rgba(0, 136, 204, 0.12) !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
            padding: 0 !important;
            box-sizing: border-box !important;
        }
        
        /* Scoped Root */
        .crow-music-root {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
            background: #0f1117;
            color: #f3f4f6;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            overflow: hidden;
            position: relative;
        }

        /* Toast Notifications */
        .crow-music-toast {
            position: absolute;
            top: 64px;
            right: 24px;
            background: #1e2433;
            border: 1px solid #0088cc;
            color: #ffffff;
            padding: 10px 18px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7), 0 0 15px rgba(0, 136, 204, 0.35);
            z-index: 500;
            display: flex;
            align-items: center;
            gap: 8px;
            opacity: 0;
            transform: translateY(-10px);
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            pointer-events: none;
        }
        .crow-music-toast.show {
            opacity: 1;
            transform: translateY(0);
        }
        .crow-music-toast.toast-error {
            border-color: #ef4444;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7), 0 0 15px rgba(239, 68, 68, 0.35);
        }

        /* Top Navigation Header */
        .crow-music-topbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 24px;
            background: #131722;
            border-bottom: 1px solid #1e2330;
            gap: 14px;
            z-index: 20;
            flex-wrap: wrap;
        }
        .crow-music-search {
            flex: 1;
            min-width: 220px;
            max-width: 320px;
            position: relative;
        }
        .crow-music-search-input {
            width: 100%;
            padding: 8px 14px 8px 34px;
            background: #1a202c;
            border: 1px solid #2d3748;
            border-radius: 20px;
            color: #f3f4f6;
            font-size: 12px;
            outline: none;
            transition: all 0.2s ease;
            box-sizing: border-box;
        }
        .crow-music-search-input:focus {
            border-color: #0088cc;
            background: #222938;
            box-shadow: 0 0 12px rgba(0, 136, 204, 0.25);
        }
        .crow-music-search-icon {
            position: absolute;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            color: #64748b;
            font-size: 12px;
            pointer-events: none;
        }

        /* Pill Buttons Navigation */
        .crow-music-nav-pills {
            display: flex;
            gap: 4px;
            background: #1a202c;
            padding: 4px;
            border-radius: 24px;
            border: 1px solid #2d3748;
            flex-wrap: wrap;
        }
        .crow-music-pill-btn {
            padding: 6px 14px;
            border: none;
            background: transparent;
            color: #9ca3af;
            font-size: 12px;
            font-weight: 600;
            border-radius: 20px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }
        .crow-music-pill-btn:hover {
            color: #ffffff;
        }
        .crow-music-pill-btn.active {
            background: #0088cc;
            color: #ffffff;
            box-shadow: 0 2px 10px rgba(0, 136, 204, 0.35);
        }
        .crow-music-pill-btn.fav-tab.active {
            background: linear-gradient(135deg, #eab308, #ca8a04);
            color: #000000;
            font-weight: 700;
            box-shadow: 0 2px 10px rgba(234, 179, 8, 0.4);
        }

        /* Top Actions */
        .crow-music-top-actions {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .crow-music-scan-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 14px;
            background: rgba(0, 136, 204, 0.12);
            border: 1px solid rgba(0, 136, 204, 0.35);
            color: #38bdf8;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .crow-music-scan-btn:hover {
            background: rgba(0, 136, 204, 0.22);
            border-color: #38bdf8;
            box-shadow: 0 0 12px rgba(56, 189, 248, 0.25);
        }
        .crow-music-scan-btn.spinning .crow-music-spin {
            display: inline-block;
            animation: cmSpin 1s linear infinite;
        }
        @keyframes cmSpin { 100% { transform: rotate(360deg); } }

        .crow-music-badge {
            font-size: 11px;
            color: #64748b;
            font-family: 'JetBrains Mono', monospace;
        }

        /* Content Area */
        .crow-music-content {
            flex: 1;
            overflow-y: auto;
            padding: 24px 28px 100px 28px;
            box-sizing: border-box;
        }
        .crow-music-view {
            display: none;
        }
        .crow-music-view.active {
            display: block;
        }
        .crow-music-view-title {
            font-size: 20px;
            font-weight: 700;
            color: #ffffff;
            margin-bottom: 18px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        /* Modern Album Grid */
        .crow-music-album-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 20px;
        }
        .crow-music-album-card {
            background: #161b26;
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            padding: 12px;
            cursor: pointer;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            box-sizing: border-box;
        }
        .crow-music-album-card:hover {
            background: #1e2433;
            border-color: rgba(56, 189, 248, 0.35);
            transform: translateY(-4px) scale(1.02);
            box-shadow: 0 14px 30px rgba(0, 0, 0, 0.6);
        }
        .crow-music-cover-wrapper {
            width: 100%;
            aspect-ratio: 1;
            border-radius: 8px;
            overflow: hidden;
            margin-bottom: 10px;
            background: #11141d;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }
        .crow-music-cover-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 8px;
            display: block;
        }
        .crow-music-placeholder {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: radial-gradient(circle at center, #1e2433 0%, #0d1117 100%);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            color: #38bdf8;
        }
        .crow-music-placeholder-vinyl {
            width: 52px;
            height: 52px;
            border-radius: 50%;
            background: radial-gradient(circle, #2d3748 10%, #0f172a 12%, #0f172a 60%, #1e293b 70%, #0f172a 80%);
            border: 2px solid rgba(56, 189, 248, 0.4);
            box-shadow: 0 0 15px rgba(0, 136, 204, 0.25);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
        }
        .crow-music-card-title {
            font-weight: 700;
            font-size: 14px;
            color: #ffffff;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-bottom: 3px;
        }
        .crow-music-card-artist {
            font-size: 12px;
            color: #94a3b8;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-bottom: 6px;
        }
        .crow-music-card-meta {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 11px;
            color: #64748b;
        }
        .crow-music-tag-pill {
            background: rgba(56, 189, 248, 0.12);
            color: #38bdf8;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 600;
        }

        /* Modern Track Table */
        .crow-music-table-box {
            background: #161b26;
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            overflow: hidden;
        }
        .crow-music-table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
            font-size: 13px;
        }
        .crow-music-table th {
            background: #11141d;
            color: #64748b;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
            padding: 12px 14px;
            border-bottom: 1px solid #1e2433;
        }
        .crow-music-table td {
            padding: 10px 14px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.03);
            color: #cbd5e1;
            vertical-align: middle;
        }
        .crow-music-table tbody tr {
            cursor: pointer;
            transition: background 0.15s ease;
        }
        .crow-music-table tbody tr:hover {
            background: #1e2433;
        }
        .crow-music-table tbody tr.active {
            background: rgba(0, 136, 204, 0.18);
            color: #38bdf8;
        }
        .crow-music-fav-btn {
            background: none;
            border: none;
            color: #475569;
            font-size: 15px;
            cursor: pointer;
            transition: all 0.15s ease;
            padding: 2px 4px;
        }
        .crow-music-fav-btn:hover {
            color: #eab308;
            transform: scale(1.2);
        }
        .crow-music-fav-btn.active {
            color: #eab308;
        }
        .crow-music-fmt-badge {
            display: inline-block;
            padding: 2px 6px;
            background: rgba(192, 132, 252, 0.12);
            border: 1px solid rgba(192, 132, 252, 0.3);
            border-radius: 4px;
            font-size: 10px;
            font-family: 'JetBrains Mono', monospace;
            color: #c084fc;
        }

        /* Album Detail Hero */
        .crow-music-hero {
            display: flex;
            gap: 24px;
            align-items: flex-end;
            padding: 24px;
            background: linear-gradient(180deg, rgba(0, 136, 204, 0.12) 0%, #161b26 100%);
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.06);
            margin-bottom: 22px;
        }
        .crow-music-hero-cover {
            width: 180px;
            height: 180px;
            border-radius: 12px;
            object-fit: cover;
            box-shadow: 0 12px 30px rgba(0, 0, 0, 0.7);
            background: #11141d;
            flex-shrink: 0;
        }
        .crow-music-hero-title {
            font-size: 26px;
            font-weight: 800;
            color: #ffffff;
            margin-bottom: 6px;
        }
        .crow-music-hero-artist {
            font-size: 15px;
            color: #38bdf8;
            font-weight: 600;
            margin-bottom: 12px;
        }
        .crow-music-hero-meta {
            display: flex;
            gap: 16px;
            font-size: 12px;
            color: #9ca3af;
            margin-bottom: 16px;
            flex-wrap: wrap;
        }
        .crow-music-btn-primary {
            padding: 8px 18px;
            background: #00d26a;
            border: none;
            border-radius: 20px;
            color: #0f172a;
            font-weight: 700;
            font-size: 12px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s ease;
        }
        .crow-music-btn-primary:hover {
            background: #00e877;
            box-shadow: 0 4px 14px rgba(0, 210, 106, 0.4);
            transform: translateY(-1px);
        }
        .crow-music-btn-secondary {
            padding: 8px 16px;
            background: #1f2737;
            border: 1px solid #2d3748;
            border-radius: 20px;
            color: #f3f4f6;
            font-weight: 600;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        .crow-music-btn-secondary:hover {
            background: #283348;
            border-color: #38bdf8;
        }
        .crow-music-btn-secondary:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            border-color: #2d3748;
        }

        /* Genres Grid */
        .crow-music-genres-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 18px;
        }
        .crow-music-genre-card {
            background: linear-gradient(135deg, #1e2433 0%, #161b26 100%);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 12px;
            padding: 20px 16px;
            cursor: pointer;
            transition: all 0.22s ease;
            position: relative;
            overflow: hidden;
        }
        .crow-music-genre-card:hover {
            transform: translateY(-4px);
            border-color: rgba(56, 189, 248, 0.4);
            box-shadow: 0 10px 24px rgba(0, 0, 0, 0.5);
        }
        .crow-music-genre-icon {
            font-size: 28px;
            margin-bottom: 10px;
        }
        .crow-music-genre-name {
            font-size: 15px;
            font-weight: 700;
            color: #ffffff;
            margin-bottom: 4px;
        }
        .crow-music-genre-meta {
            font-size: 11px;
            color: #64748b;
        }

        /* Artists Grid */
        .crow-music-artists-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
            gap: 18px;
        }
        .crow-music-artist-card {
            background: #161b26;
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            padding: 18px 12px;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .crow-music-artist-card:hover {
            background: #1e2433;
            border-color: rgba(56, 189, 248, 0.35);
            transform: translateY(-4px);
        }
        .crow-music-artist-avatar {
            width: 76px;
            height: 76px;
            border-radius: 50%;
            margin: 0 auto 12px auto;
            background: linear-gradient(135deg, #0088cc, #c084fc);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            box-shadow: 0 6px 16px rgba(0, 136, 204, 0.3);
        }
        .crow-music-artist-name {
            font-weight: 700;
            font-size: 14px;
            color: #ffffff;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-bottom: 4px;
        }
        .crow-music-artist-meta {
            font-size: 11px;
            color: #64748b;
        }

        /* Bottom Player Bar */
        .crow-music-player-bar {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 76px;
            background: #131722;
            border-top: 1px solid #1e2330;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 24px;
            box-sizing: border-box;
            z-index: 100;
        }
        .crow-music-player-left {
            display: flex;
            align-items: center;
            gap: 12px;
            width: 240px;
        }
        .crow-music-player-thumb {
            width: 46px;
            height: 46px;
            border-radius: 6px;
            overflow: hidden;
            background: #1e2433;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .crow-music-player-info {
            overflow: hidden;
        }
        .crow-music-player-title {
            font-size: 13px;
            font-weight: 700;
            color: #ffffff;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-bottom: 2px;
        }
        .crow-music-player-artist {
            font-size: 11px;
            color: #9ca3af;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .crow-music-player-center {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 5px;
            flex: 1;
            max-width: 560px;
        }
        .crow-music-player-controls {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        .crow-music-ctl-btn {
            background: transparent;
            border: none;
            color: #9ca3af;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.15s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .crow-music-ctl-btn:hover {
            color: #ffffff;
            transform: scale(1.1);
        }
        .crow-music-ctl-btn.active {
            color: #00d26a;
        }
        .crow-music-play-main {
            width: 38px;
            height: 38px;
            border-radius: 50%;
            background: #00d26a;
            color: #0f172a;
            font-size: 15px;
            font-weight: bold;
            box-shadow: 0 0 16px rgba(0, 210, 106, 0.4);
        }
        .crow-music-play-main:hover {
            transform: scale(1.08);
            background: #00e877;
            box-shadow: 0 0 20px rgba(0, 210, 106, 0.6);
        }

        .crow-music-progress-row {
            display: flex;
            align-items: center;
            gap: 10px;
            width: 100%;
            font-size: 10px;
            font-family: 'JetBrains Mono', monospace;
            color: #64748b;
        }
        .crow-music-seek-slider {
            flex: 1;
            height: 4px;
            -webkit-appearance: none;
            background: #2d3748;
            border-radius: 2px;
            outline: none;
            cursor: pointer;
        }
        .crow-music-seek-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 11px;
            height: 11px;
            border-radius: 50%;
            background: #00d26a;
            cursor: pointer;
            box-shadow: 0 0 6px rgba(0, 210, 106, 0.6);
        }

        .crow-music-player-right {
            display: flex;
            align-items: center;
            gap: 12px;
            width: 220px;
            justify-content: flex-end;
        }
        .crow-music-vol-slider {
            width: 80px;
            height: 4px;
            -webkit-appearance: none;
            background: #2d3748;
            border-radius: 2px;
            outline: none;
            cursor: pointer;
        }
        .crow-music-vol-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #0088cc;
            cursor: pointer;
        }

        /* Tag Editor Modal & Components */
        .cm-tag-modal-overlay {
            position: fixed;
            inset: 0;
            z-index: 999999;
            background: rgba(0, 0, 0, 0.82);
            backdrop-filter: blur(10px);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            box-sizing: border-box;
            animation: cmFadeIn 0.2s ease-out;
        }
        @keyframes cmFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .cm-tag-modal-card {
            width: 620px;
            max-width: 95vw;
            max-height: 90vh;
            background: #141824;
            border: 1px solid rgba(56, 189, 248, 0.25);
            border-radius: 16px;
            box-shadow: 0 24px 60px rgba(0,0,0,0.85), 0 0 25px rgba(0,136,204,0.2);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            color: #f3f4f6;
        }
        .cm-tag-modal-header {
            padding: 14px 20px;
            background: #10131d;
            border-bottom: 1px solid #1e2433;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .cm-tag-modal-body {
            padding: 20px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 14px;
        }
        .cm-tag-modal-footer {
            padding: 14px 20px;
            background: #10131d;
            border-top: 1px solid #1e2433;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 10px;
        }
        .cm-form-row {
            display: flex;
            gap: 12px;
            align-items: flex-start;
        }
        .cm-form-group {
            display: flex;
            flex-direction: column;
            gap: 5px;
            flex: 1;
        }
        .cm-form-label {
            font-size: 11px;
            font-weight: 600;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .cm-input {
            background: #0b0e14;
            border: 1px solid #283348;
            border-radius: 8px;
            padding: 8px 12px;
            color: #ffffff;
            font-size: 13px;
            outline: none;
            transition: all 0.2s ease;
            box-sizing: border-box;
            width: 100%;
        }
        .cm-input:focus {
            border-color: #38bdf8;
            box-shadow: 0 0 10px rgba(56, 189, 248, 0.2);
            background: #10141e;
        }
        .cm-input:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            background: #090c12;
        }
        .cm-dropzone {
            width: 140px;
            height: 140px;
            border: 2px dashed #2d3748;
            border-radius: 12px;
            background: #0b0e14;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
            position: relative;
            overflow: hidden;
            flex-shrink: 0;
            text-align: center;
            padding: 6px;
            box-sizing: border-box;
        }
        .cm-dropzone:hover, .cm-dropzone.dragover {
            border-color: #38bdf8;
            background: rgba(56, 189, 248, 0.08);
        }
        .cm-dropzone-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 8px;
        }
        .cm-quick-genres {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 4px;
        }
        .cm-quick-genre-pill {
            padding: 3px 8px;
            background: #1e2433;
            border: 1px solid #283348;
            border-radius: 12px;
            font-size: 11px;
            color: #94a3b8;
            cursor: pointer;
            transition: all 0.15s ease;
        }
        .cm-quick-genre-pill:hover {
            border-color: #38bdf8;
            color: #ffffff;
            background: rgba(56, 189, 248, 0.15);
        }
        .cm-quick-genre-pill.active {
            background: #0088cc;
            color: #ffffff;
            border-color: #38bdf8;
        }

        /* Floating Batch Action Bar */
        .cm-batch-bar {
            position: absolute;
            bottom: 88px;
            left: 50%;
            transform: translateX(-50%) translateY(20px);
            background: rgba(20, 24, 36, 0.95);
            border: 1px solid #0088cc;
            backdrop-filter: blur(12px);
            border-radius: 30px;
            padding: 8px 18px;
            display: flex;
            align-items: center;
            gap: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.8), 0 0 16px rgba(0,136,204,0.3);
            z-index: 150;
            opacity: 0;
            pointer-events: none;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .cm-batch-bar.show {
            opacity: 1;
            pointer-events: auto;
            transform: translateX(-50%) translateY(0);
        }

        /* Context Menu */
        .cm-context-menu {
            position: fixed;
            z-index: 1000000;
            background: #141824;
            border: 1px solid rgba(56, 189, 248, 0.3);
            border-radius: 10px;
            padding: 6px 0;
            min-width: 180px;
            box-shadow: 0 12px 30px rgba(0,0,0,0.85);
            display: none;
        }
        .cm-context-item {
            padding: 8px 16px;
            font-size: 12px;
            font-weight: 500;
            color: #cbd5e1;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: background 0.15s;
        }
        .cm-context-item:hover {
            background: #1e2433;
            color: #38bdf8;
        }

        /* Now Playing Fullscreen Overlay */
        .cm-nowplaying-modal {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            z-index: 10040 !important;
            background: #080a0f !important;
            display: none;
            flex-direction: column !important;
            overflow: hidden !important;
            color: #f3f4f6;
            font-family: 'Inter', system-ui, sans-serif;
            user-select: none;
        }
        .cm-nowplaying-modal.active, .cm-nowplaying-modal.open {
            display: flex !important;
        }
        .cm-nowplaying-backdrop {
            position: absolute;
            inset: -40px;
            background-size: cover;
            background-position: center;
            filter: blur(70px) brightness(0.35);
            transform: scale(1.15);
            pointer-events: none;
            transition: background-image 0.8s ease-in-out;
            z-index: 1;
        }
        .cm-nowplaying-header {
            position: relative;
            z-index: 10;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 28px;
            background: linear-gradient(180deg, rgba(8,10,15,0.85) 0%, transparent 100%);
        }
        .cm-np-icon-btn {
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: #f3f4f6;
            width: 38px;
            height: 38px;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.2s ease;
        }
        .cm-np-icon-btn:hover {
            background: rgba(0, 240, 255, 0.2);
            border-color: #00f0ff;
            color: #00f0ff;
            box-shadow: 0 0 14px rgba(0, 240, 255, 0.4);
            transform: scale(1.08);
        }
        .cm-np-icon-btn.active {
            background: #0088cc;
            border-color: #38bdf8;
            color: #ffffff;
            box-shadow: 0 0 14px rgba(56, 189, 248, 0.5);
        }
        .cm-np-vis-modes {
            display: flex;
            gap: 6px;
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(10px);
            padding: 4px;
            border-radius: 24px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .cm-np-mode-btn {
            padding: 6px 14px;
            border: none;
            background: transparent;
            color: #94a3b8;
            font-size: 12px;
            font-weight: 600;
            border-radius: 18px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }
        .cm-np-mode-btn:hover {
            color: #ffffff;
        }
        .cm-np-mode-btn.active {
            background: linear-gradient(135deg, #0088cc, #00f0ff);
            color: #080a0f;
            font-weight: 700;
            box-shadow: 0 0 14px rgba(0, 240, 255, 0.45);
        }
        .cm-np-top-actions {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .cm-nowplaying-body {
            position: relative;
            z-index: 10;
            flex: 1;
            display: flex;
            overflow: hidden;
            padding: 10px 32px 20px;
            gap: 32px;
            box-sizing: border-box;
        }
        .cm-np-left-pane {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            position: relative;
            min-width: 320px;
        }
        .cm-np-visualizer-wrap {
            position: relative;
            width: 100%;
            max-width: 520px;
            aspect-ratio: 1 / 1;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .cm-nowplaying-canvas {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 2;
        }
        .cm-np-cover-wrap {
            position: relative;
            width: 240px;
            height: 240px;
            border-radius: 20px;
            overflow: hidden;
            z-index: 3;
            box-shadow: 0 20px 50px rgba(0,0,0,0.8), 0 0 35px rgba(0, 240, 255, 0.2);
            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .cm-np-cover-wrap.spinning {
            border-radius: 50%;
            box-shadow: 0 0 45px rgba(0, 240, 255, 0.4);
            animation: cmCoverSpin 20s linear infinite;
        }
        @keyframes cmCoverSpin {
            100% { transform: rotate(360deg); }
        }
        .cm-np-cover-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }
        .cm-np-meta {
            margin-top: 24px;
            text-align: center;
            z-index: 3;
            max-width: 480px;
        }
        .cm-np-title {
            font-size: 22px;
            font-weight: 700;
            color: #ffffff;
            text-shadow: 0 2px 10px rgba(0,0,0,0.8);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .cm-np-artist {
            font-size: 15px;
            font-weight: 600;
            color: #38bdf8;
            margin-top: 6px;
            text-shadow: 0 0 12px rgba(56, 189, 248, 0.4);
        }
        .cm-np-album {
            font-size: 13px;
            color: #94a3b8;
            margin-top: 4px;
        }

        /* Lyrics / Karaoke Pane */
        .cm-np-lyrics-pane {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: rgba(15, 23, 42, 0.5);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 16px 40px rgba(0,0,0,0.6);
            transition: all 0.3s ease;
        }
        .cm-np-lyrics-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            font-size: 13px;
            font-weight: 600;
            color: #cbd5e1;
        }
        .cm-lyrics-container {
            flex: 1;
            overflow-y: auto;
            padding: 40px 24px;
            box-sizing: border-box;
            scroll-behavior: smooth;
            mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
            -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
        }
        .cm-lyrics-container::-webkit-scrollbar {
            width: 4px;
        }
        .cm-lyrics-container::-webkit-scrollbar-thumb {
            background: rgba(56, 189, 248, 0.2);
            border-radius: 4px;
        }
        .cm-lyrics-list {
            display: flex;
            flex-direction: column;
            gap: 16px;
            padding: 60px 0;
        }
        .cm-lyrics-line {
            padding: 10px 18px;
            font-size: 16px;
            font-weight: 500;
            color: rgba(255, 255, 255, 0.38);
            text-align: center;
            cursor: pointer;
            border-radius: 10px;
            transition: all 0.25s cubic-bezier(0.2, 0, 0, 1);
            line-height: 1.5;
        }
        .cm-lyrics-line:hover {
            color: rgba(255, 255, 255, 0.85);
            background: rgba(255, 255, 255, 0.06);
            transform: scale(1.02);
        }
        .cm-lyrics-line.cm-lyrics-active {
            font-size: 22px;
            font-weight: 700;
            color: #00f0ff;
            text-shadow: 0 0 20px rgba(0, 240, 255, 0.7), 0 0 40px rgba(0, 136, 204, 0.5);
            transform: scale(1.06);
            background: rgba(0, 240, 255, 0.08);
        }
        .cm-lyrics-empty {
            text-align: center;
            color: #64748b;
            font-size: 14px;
            padding: 40px 20px;
        }

        /* Now Playing Footer Player */
        .cm-np-footer {
            position: relative;
            z-index: 10;
            background: linear-gradient(0deg, rgba(8,10,15,0.95) 0%, transparent 100%);
            padding: 12px 32px 24px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .cm-np-progress-bar-row {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 12px;
            color: #94a3b8;
            font-weight: 600;
        }
        .cm-np-controls-row {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 16px;
        }

        /* Top-Level High Z-Index Modal Overlays (Mounted directly to document.body) */
        .cm-modal-overlay {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: rgba(10, 14, 20, 0.94) !important;
            backdrop-filter: blur(20px) !important;
            -webkit-backdrop-filter: blur(20px) !important;
            z-index: 10050 !important;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 16px;
            box-sizing: border-box;
            user-select: none;
        }
        .cm-modal-overlay.active, .cm-modal-overlay.open {
            display: flex !important;
        }

        .cm-lyrics-modal-panel {
            background: #0f131d;
            border: 1px solid rgba(56, 189, 248, 0.3);
            border-radius: 20px;
            width: 95vw;
            max-width: 680px;
            height: 82vh;
            max-height: 720px;
            box-shadow: 0 24px 60px rgba(0,0,0,0.95), 0 0 35px rgba(0, 136, 204, 0.3);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            position: relative;
            z-index: 10055;
        }
        .cm-lyrics-modal-header {
            padding: 16px 24px;
            background: #131826;
            border-bottom: 1px solid #1e2538;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        /* 10-Band Equalizer Modal */
        .cm-eq-modal {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            z-index: 10050 !important;
            background: rgba(5, 7, 12, 0.92) !important;
            backdrop-filter: blur(20px) !important;
            -webkit-backdrop-filter: blur(20px) !important;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 16px;
            box-sizing: border-box;
            user-select: none;
        }
        .cm-eq-modal.active, .cm-eq-modal.open {
            display: flex !important;
        }
        .cm-eq-panel {
            background: #0f131d;
            border: 1px solid #0088cc;
            border-radius: 16px;
            width: 95vw;
            max-width: 820px;
            box-shadow: 0 24px 60px rgba(0,0,0,0.9), 0 0 30px rgba(0, 136, 204, 0.25);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            position: relative;
            z-index: 10055;
        }
        .cm-eq-header {
            padding: 14px 22px;
            background: #131826;
            border-bottom: 1px solid #1e2538;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .cm-eq-switch-label {
            display: inline-flex;
            align-items: center;
            cursor: pointer;
        }
        .cm-eq-switch-label input {
            display: none;
        }
        .cm-eq-switch-slider {
            width: 36px;
            height: 20px;
            background: #334155;
            border-radius: 20px;
            position: relative;
            transition: all 0.2s ease;
        }
        .cm-eq-switch-slider::before {
            content: '';
            position: absolute;
            top: 2px;
            left: 2px;
            width: 16px;
            height: 16px;
            background: #ffffff;
            border-radius: 50%;
            transition: all 0.2s ease;
        }
        .cm-eq-switch-label input:checked + .cm-eq-switch-slider {
            background: #0088cc;
            box-shadow: 0 0 10px rgba(0, 136, 204, 0.5);
        }
        .cm-eq-switch-label input:checked + .cm-eq-switch-slider::before {
            transform: translateX(16px);
        }
        .cm-eq-presets-bar {
            padding: 12px 22px;
            background: #101522;
            border-bottom: 1px solid #1a2030;
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
        }
        .cm-eq-preset-pills {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
        }
        .cm-eq-pill {
            padding: 4px 10px;
            background: #1a2233;
            border: 1px solid #27344d;
            border-radius: 14px;
            color: #94a3b8;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .cm-eq-pill:hover {
            color: #ffffff;
            border-color: #38bdf8;
        }
        .cm-eq-pill.active {
            background: #0088cc;
            border-color: #38bdf8;
            color: #ffffff;
            box-shadow: 0 0 10px rgba(0, 136, 204, 0.4);
        }
        .cm-eq-sliders-box {
            padding: 24px 22px;
            background: #0c1019;
            display: flex;
            justify-content: center;
        }
        .cm-eq-grid {
            display: flex;
            justify-content: space-between;
            width: 100%;
            gap: 12px;
        }
        .cm-eq-col {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
        }
        .cm-eq-db-badge {
            font-size: 11px;
            font-weight: 700;
            color: #38bdf8;
            min-width: 32px;
            text-align: center;
            font-variant-numeric: tabular-nums;
        }
        .cm-eq-slider-wrapper {
            height: 160px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }
        .cm-eq-slider {
            -webkit-appearance: none;
            appearance: none;
            width: 140px;
            height: 6px;
            background: #1e293b;
            border-radius: 4px;
            outline: none;
            transform: rotate(-90deg);
            cursor: pointer;
        }
        .cm-eq-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #00f0ff;
            box-shadow: 0 0 10px #00f0ff;
            cursor: pointer;
            transition: transform 0.15s ease;
        }
        .cm-eq-slider::-webkit-slider-thumb:hover {
            transform: scale(1.25);
        }
        .cm-eq-freq-label {
            font-size: 11px;
            font-weight: 600;
            color: #94a3b8;
            margin-top: 4px;
        }
        .cm-eq-footer {
            padding: 12px 22px;
            background: #131826;
            border-top: 1px solid #1e2538;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
    `;

    class CrowMusicEngine {
        constructor() {
            this.isModalOpen = false;
            this.audioExts = ['mp3', 'flac', 'ogg', 'wav', 'm4a', 'aac', 'opus', 'wma'];
            this.currentTab = 'albums';
            this.searchQuery = '';
            this.allTracks = [];
            this.albums = [];
            this.artists = [];
            this.genres = [];
            this.favoriteTracks = new Set(JSON.parse(localStorage.getItem('crowmusic_fav_tracks') || '[]'));
            this.favoriteAlbums = new Set(JSON.parse(localStorage.getItem('crowmusic_fav_albums') || '[]'));
            this.selectedTrackIds = new Set();
            this.queue = [];
            this.currentIndex = -1;
            this.currentTrack = null;
            this.isPlaying = false;
            this.isShuffle = false;
            this.repeatMode = 1; // 0: off, 1: all, 2: one
            this.audio = new Audio();
            this.activeAlbumId = null;
            this.activeGenreName = null;
            this.toastTimeout = null;

            // Web Audio Graph & 10-Band EQ
            this.audioCtx = null;
            this.audioSourceNode = null;
            this.analyser = null;
            this.eqFilters = [];
            this.gainNode = null;
            this.eqEnabled = localStorage.getItem('crowmusic_eq_enabled') !== 'false';
            this.eqPreset = localStorage.getItem('crowmusic_eq_preset') || 'Flat';
            this.eqFrequencies = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
            this.eqGains = JSON.parse(localStorage.getItem('crowmusic_eq_gains') || '[0,0,0,0,0,0,0,0,0,0]');
            this.eqPresets = {
                'Flat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                'Rock': [4.5, 3.0, 1.5, 0, -1.5, -1.0, 1.0, 3.0, 4.0, 4.5],
                'Punk': [4.0, 3.5, 2.0, 1.0, 0, 1.5, 3.0, 4.5, 5.0, 4.5],
                'Metal': [5.0, 4.0, 2.0, 0, -2.0, -1.0, 2.0, 4.5, 5.0, 5.5],
                'Bass Boost': [7.0, 6.0, 4.5, 2.5, 1.0, 0, 0, 0, 0, 0],
                'Electronic': [5.5, 4.5, 1.0, 0, -2.0, 2.0, 1.0, 3.0, 4.5, 5.0],
                'Vocal': [-2.0, -2.0, 0, 2.5, 4.5, 4.0, 2.5, 1.0, -1.0, -2.0],
                'Acoustic': [3.5, 2.5, 1.5, 1.0, 2.0, 2.0, 3.0, 3.5, 3.0, 2.0]
            };
            this.crossfadeSec = parseInt(localStorage.getItem('crowmusic_crossfade') || '0', 10);
            this.isFadingOut = false;

            // Visualizer & Now Playing
            this.nowPlayingOpen = false;
            this.visualizerMode = localStorage.getItem('crowmusic_vis_mode') || 'bars'; // 'bars', 'radial', 'waveform'
            this.animFrameId = null;
            this.peakBars = new Array(64).fill(0);

            // Lyrics & Karaoke
            this.lyricsOpen = true;
            this.currentLyricsTrackId = null;
            this.parsedLyrics = [];
            this.currentLyricIdx = -1;
        }

        init(api) {
            this.injectStyles();
            this.injectModal();
            this.injectSidebarNav();
            this.injectToolbarButton();
            this.initAudioEngine();

            if (api && typeof api.on === 'function') {
                api.on('onFileClick', (id, name, ext) => {
                    if (this.audioExts.includes((ext || '').toLowerCase())) {
                        this.openAndPlayFile(id, name, ext);
                        return true;
                    }
                    return false;
                });
            }

            window.addEventListener('keydown', (e) => {
                if (this.isModalOpen) {
                    if (e.key === 'Escape') {
                        if (document.getElementById('cmCustomLyricsModal')) {
                            this.closeCustomLyricsModal();
                        } else if (this.lyricsModalOpen || document.getElementById('cmLyricsModal')?.classList.contains('active')) {
                            this.closeLyricsModal();
                        } else if (this.eqModalOpen || document.getElementById('cmEqualizerModal')?.classList.contains('active')) {
                            this.closeEqualizer();
                        } else if (this.nowPlayingOpen || document.getElementById('cmNowPlayingModal')?.classList.contains('active')) {
                            this.closeNowPlaying();
                        } else if (document.getElementById('cmTagModalOverlay')) {
                            this.closeTagEditorModal();
                        } else {
                            this.close();
                        }
                    } else if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && !document.getElementById('cmTagModalOverlay') && !document.getElementById('cmCustomLyricsModal')) {
                        e.preventDefault();
                        this.togglePlayPause();
                    }
                }
            });

            document.addEventListener('click', () => {
                const ctx = document.getElementById('cmContextMenu');
                if (ctx) ctx.style.display = 'none';
            });

            // Instant Stale-While-Revalidate: pre-fetch cached library immediately on startup
            this.fetchLibrary();
        }

        async backgroundSync() {
            try {
                const res = await fetch('/api/plugins/crow-music/scan', { method: 'POST' });
                if (res.ok) {
                    await this.fetchLibrary();
                }
            } catch (e) {
                console.debug('Background sync error:', e);
            }
        }

        injectStyles() {
            if (!document.getElementById('crow-music-styles')) {
                const style = document.createElement('style');
                style.id = 'crow-music-styles';
                style.innerHTML = MUSIC_CSS;
                document.head.appendChild(style);
            }
        }

        injectModal() {
            let container = document.getElementById('musicContainerHolder');
            if (!container) {
                let modal = document.getElementById('musicModal');
                if (!modal) {
                    const modalHtml = `
                        <div class="modal-overlay" id="musicModal">
                            <div class="modal-panel">
                                <div class="modal-header" style="background:#131722; padding:10px 20px; border-bottom:1px solid #1e2330; display:flex; justify-content:space-between; align-items:center;">
                                    <div style="display:flex; align-items:center; gap:10px;">
                                        <span style="font-size:18px;">🎵</span>
                                        <h2 class="panel-title" style="margin:0; font-size:15px; font-weight:700; background:linear-gradient(135deg, #0088cc, #00d26a); -webkit-background-clip:text; -webkit-text-fill-color:transparent;">CROWMUSIC HUB</h2>
                                    </div>
                                    <div style="display:flex; align-items:center; gap:8px;">
                                        <button class="hud-btn" id="musicEnrichAllBtn" title="Обновить обложки и жанры всех альбомов в сети (iTunes / MusicBrainz)" style="padding:4px 10px; font-size:11px; display:inline-flex; align-items:center; gap:4px;">🌐 <span>Инфо из сети</span></button>
                                        <button class="hud-btn" id="musicRefreshBtn" title="Пересканировать диски" style="padding:4px 8px; font-size:12px;">🔄</button>
                                        <button class="close-btn" id="closeMusicBtn" style="font-size:20px; line-height:1; padding:2px 6px;">&times;</button>
                                    </div>
                                </div>
                                <div id="musicContainerHolder" style="flex:1; width:100%; height:calc(100% - 48px); display:flex; flex-direction:column; overflow:hidden; background:#0f1117; position:relative;"></div>
                            </div>
                        </div>
                    `;
                    document.body.insertAdjacentHTML('beforeend', modalHtml);
                    container = document.getElementById('musicContainerHolder');
                }
            }

            // Top-Level Context Menu
            if (!document.getElementById('cmContextMenu')) {
                document.body.insertAdjacentHTML('beforeend', `<div id="cmContextMenu" class="cm-context-menu"></div>`);
            }

            // Top-Level Dedicated Lyrics Overlay Modal
            if (!document.getElementById('cmLyricsModal')) {
                const lyricsModalHtml = `
                    <div id="cmLyricsModal" class="cm-modal-overlay">
                        <div class="cm-lyrics-modal-panel">
                            <div class="cm-lyrics-modal-header">
                                <div style="display:flex; align-items:center; gap:12px;">
                                    <span style="font-size:22px;">💬</span>
                                    <div>
                                        <div id="cmLyricsModalTitle" style="font-size:16px; font-weight:700; color:#f3f4f6;">Текст песни</div>
                                        <div id="cmLyricsModalArtist" style="font-size:13px; color:#38bdf8;">Исполнитель</div>
                                    </div>
                                </div>
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <span id="cmLyricsModalBadge" class="crow-music-badge">LRCLIB</span>
                                    <button id="cmLyricsModalEditBtn" class="crow-music-btn-secondary" style="padding:5px 12px; font-size:11px; cursor:pointer;" title="Вставить свой текст песни">✏️ Свой текст</button>
                                    <button id="cmLyricsModalCloseBtn" class="close-btn" style="font-size:24px; line-height:1; padding:2px 8px; z-index:10060; cursor:pointer;">&times;</button>
                                </div>
                            </div>
                            <div id="cmLyricsModalScroll" class="cm-lyrics-container" style="flex:1; overflow-y:auto; padding:40px 24px;">
                                <div id="cmLyricsModalContent" class="cm-lyrics-list">
                                    <div class="cm-lyrics-empty">Загрузка текста песни... ⏳</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', lyricsModalHtml);
            }

            // Top-Level Equalizer Modal
            if (!document.getElementById('cmEqualizerModal')) {
                const eqModalHtml = `
                    <div id="cmEqualizerModal" class="cm-eq-modal">
                        <div class="cm-eq-panel">
                            <div class="cm-eq-header">
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <span style="font-size:18px;">🎚️</span>
                                    <span style="font-size:15px; font-weight:700; color:#f3f4f6;">10-Полосный Эквалайзер</span>
                                </div>
                                <div style="display:flex; align-items:center; gap:12px;">
                                    <label class="cm-eq-switch-label">
                                        <input type="checkbox" id="cmEqEnableToggle" checked />
                                        <span class="cm-eq-switch-slider"></span>
                                        <span id="cmEqToggleText" style="font-size:12px; font-weight:600; color:#38bdf8; margin-left:6px;">ВКЛ</span>
                                    </label>
                                    <button id="cmEqCloseBtn" class="close-btn" style="font-size:24px; line-height:1; padding:2px 8px; z-index:10060; cursor:pointer;">&times;</button>
                                </div>
                            </div>

                            <div class="cm-eq-presets-bar">
                                <span style="font-size:12px; color:#94a3b8; font-weight:600;">Пресеты:</span>
                                <div class="cm-eq-preset-pills">
                                    <button class="cm-eq-pill active" data-preset="Flat">Flat</button>
                                    <button class="cm-eq-pill" data-preset="Rock">Рок</button>
                                    <button class="cm-eq-pill" data-preset="Punk">Панк</button>
                                    <button class="cm-eq-pill" data-preset="Metal">Метал</button>
                                    <button class="cm-eq-pill" data-preset="Bass Boost">Bass Boost</button>
                                    <button class="cm-eq-pill" data-preset="Electronic">Electronic</button>
                                    <button class="cm-eq-pill" data-preset="Vocal">Vocal</button>
                                    <button class="cm-eq-pill" data-preset="Acoustic">Acoustic</button>
                                </div>
                                <button id="cmEqResetBtn" class="crow-music-btn-secondary" style="padding:4px 10px; font-size:11px; margin-left:auto; cursor:pointer;">Сброс</button>
                            </div>

                            <div class="cm-eq-sliders-box">
                                <div class="cm-eq-grid" id="cmEqSlidersGrid"></div>
                            </div>

                            <div class="cm-eq-footer">
                                <div style="display:flex; align-items:center; gap:12px;">
                                    <span style="font-size:12px; color:#cbd5e1; font-weight:600;">🎛️ Плавное сведение (Crossfade):</span>
                                    <select id="cmCrossfadeSelect" class="crow-music-input" style="width:auto; padding:4px 10px; font-size:12px; border-radius:8px;">
                                        <option value="0">Выкл (0 сек)</option>
                                        <option value="1">1 секунда</option>
                                        <option value="2">2 секунды</option>
                                        <option value="3">3 секунды</option>
                                        <option value="4">4 секунды</option>
                                        <option value="5">5 секунд</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', eqModalHtml);
            }

            // Top-Level Now Playing Fullscreen Overlay Modal
            if (!document.getElementById('cmNowPlayingModal')) {
                const npModalHtml = `
                    <div id="cmNowPlayingModal" class="cm-nowplaying-modal">
                        <div id="cmNpBackdrop" class="cm-nowplaying-backdrop"></div>
                        <div class="cm-nowplaying-header">
                            <button id="cmNpCloseBtn" class="cm-np-icon-btn" title="Свернуть (Esc)" style="z-index:10060; cursor:pointer;">✕</button>
                            <div class="cm-np-vis-modes">
                                <button class="cm-np-mode-btn active" data-mode="bars">📊 Неон</button>
                                <button class="cm-np-mode-btn" data-mode="radial">⭕ Радиальный</button>
                                <button class="cm-np-mode-btn" data-mode="waveform">〰️ Волна</button>
                            </div>
                            <div class="cm-np-top-actions">
                                <button id="cmNpLyricsToggle" class="cm-np-icon-btn active" title="Текст песни (Lyrics)">💬</button>
                                <button id="cmNpEqToggle" class="cm-np-icon-btn" title="Эквалайзер">🎚️</button>
                            </div>
                        </div>
                        
                        <div class="cm-nowplaying-body">
                            <div class="cm-np-left-pane">
                                <div class="cm-np-visualizer-wrap">
                                    <canvas id="cmVisualizerCanvas" class="cm-nowplaying-canvas"></canvas>
                                    <div id="cmNpCoverContainer" class="cm-np-cover-wrap">
                                        <img id="cmNpCoverImg" class="cm-np-cover-img" src="" alt="" />
                                    </div>
                                </div>
                                <div class="cm-np-meta">
                                    <div id="cmNpTitle" class="cm-np-title">Выберите трек</div>
                                    <div id="cmNpArtist" class="cm-np-artist">CrowMusic Player</div>
                                    <div id="cmNpAlbum" class="cm-np-album"></div>
                                </div>
                            </div>

                            <div id="cmNpLyricsPane" class="cm-np-lyrics-pane">
                                <div class="cm-np-lyrics-header">
                                    <span>💬 Текст песни / Караоке</span>
                                    <span id="cmNpLyricsSourceBadge" class="crow-music-badge">LRCLIB</span>
                                </div>
                                <div id="cmNpLyricsScroll" class="cm-lyrics-container">
                                    <div id="cmNpLyricsList" class="cm-lyrics-list">
                                        <div class="cm-lyrics-empty">Выберите трек для отображения текста...</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Now Playing Bottom Player Bar -->
                        <div class="cm-np-footer">
                            <div class="cm-np-progress-bar-row">
                                <span id="cmNpCurTime">0:00</span>
                                <input type="range" id="cmNpSeekBar" class="crow-music-seek-slider" min="0" max="100" value="0" step="0.1" />
                                <span id="cmNpTotTime">0:00</span>
                            </div>
                            <div class="cm-np-controls-row">
                                <button id="cmNpShuffleBtn" class="crow-music-ctl-btn" title="Вперемешку">🔀</button>
                                <button id="cmNpPrevBtn" class="crow-music-ctl-btn" title="Предыдущий">⏮</button>
                                <button id="cmNpPlayBtn" class="crow-music-ctl-btn crow-music-play-main" title="Воспроизведение / Пауза">▶</button>
                                <button id="cmNpNextBtn" class="crow-music-ctl-btn" title="Следующий">⏭</button>
                                <button id="cmNpRepeatBtn" class="crow-music-ctl-btn" title="Повтор">🔁</button>
                                <div style="display:flex; align-items:center; gap:8px; margin-left: 20px;">
                                    <button id="cmNpVolBtn" class="crow-music-ctl-btn">🔊</button>
                                    <input type="range" id="cmNpVolSlider" class="crow-music-vol-slider" min="0" max="100" value="85" style="width:90px;" />
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', npModalHtml);
            }

            document.getElementById('closeMusicBtn')?.addEventListener('click', () => this.close());
            document.getElementById('musicRefreshBtn')?.addEventListener('click', () => this.scanLibrary());
            document.getElementById('musicEnrichAllBtn')?.addEventListener('click', () => this.enrichAllOnline());
            document.getElementById('musicModal')?.addEventListener('mousedown', (e) => {
                if (e.target.id === 'musicModal') this.close();
            });

            this.renderLayout();
        }

        injectSidebarNav() {
            const sidebarNav = document.querySelector('.sidebar-nav');
            if (sidebarNav && !document.getElementById('navMusicBtn')) {
                const navItem = document.createElement('a');
                navItem.href = '#';
                navItem.className = 'nav-link';
                navItem.id = 'navMusicBtn';
                navItem.innerHTML = `
                    <span class="nav-icon">🎵</span>
                    <span class="nav-text">Музыка</span>
                `;
                navItem.onclick = (e) => {
                    e.preventDefault();
                    this.open();
                };
                sidebarNav.appendChild(navItem);
            }
        }

        injectToolbarButton() {
            const headerRight = document.querySelector('.header-right');
            if (!headerRight || document.getElementById('btnCrowMusicToolbar')) return;

            const btn = document.createElement('button');
            btn.id = 'btnCrowMusicToolbar';
            btn.className = 'hud-btn';
            btn.style.fontSize = '11px';
            btn.style.padding = '5px 10px';
            btn.style.display = 'inline-flex';
            btn.style.alignItems = 'center';
            btn.style.gap = '5px';
            btn.innerHTML = '🎵 <span>Музыка</span>';
            btn.title = 'CrowMusic Hub';

            btn.onclick = () => this.open();
            headerRight.insertBefore(btn, headerRight.firstChild);
        }

        renderLayout() {
            const container = document.getElementById('musicContainerHolder');
            if (!container) return;

            container.innerHTML = `
                <div class="crow-music-root">
                    <header class="crow-music-topbar">
                        <div class="crow-music-search">
                            <span class="crow-music-search-icon">🔍</span>
                            <input type="text" id="cm-search-input" class="crow-music-search-input" placeholder="Поиск альбомов, треков, артистов, жанров..." autocomplete="off" />
                        </div>

                        <nav class="crow-music-nav-pills">
                            <button class="crow-music-pill-btn active" data-tab="albums">Альбомы</button>
                            <button class="crow-music-pill-btn" data-tab="tracks">Все треки</button>
                            <button class="crow-music-pill-btn" data-tab="artists">Артисты</button>
                            <button class="crow-music-pill-btn" data-tab="genres">Жанры</button>
                            <button class="crow-music-pill-btn fav-tab" data-tab="favorites">★ Избранное</button>
                        </nav>

                        <div class="crow-music-top-actions">
                            <span id="cmStatsBadge" class="crow-music-badge">0 треков</span>
                            <button id="cmScanBtn" class="crow-music-scan-btn">
                                <span class="crow-music-spin">🔄</span> Сканировать
                            </button>
                        </div>
                    </header>

                    <main class="crow-music-content">
                        <!-- View: Albums -->
                        <section id="cmViewAlbums" class="crow-music-view active">
                            <div class="crow-music-view-title">
                                <span>Коллекция альбомов</span>
                            </div>
                            <div id="cmAlbumsGrid" class="crow-music-album-grid"></div>
                        </section>

                        <!-- View: Tracks -->
                        <section id="cmViewTracks" class="crow-music-view">
                            <div class="crow-music-view-title">
                                <span>Список всех треков</span>
                            </div>
                            <div class="crow-music-table-box">
                                <table class="crow-music-table">
                                    <thead>
                                        <tr>
                                            <th style="width: 28px;"><input type="checkbox" id="cmSelectAllTracks" title="Выбрать все"></th>
                                            <th style="width: 32px;">★</th>
                                            <th style="width: 38px;">▶</th>
                                            <th>Название</th>
                                            <th>Исполнитель</th>
                                            <th>Альбом</th>
                                            <th>Жанр</th>
                                            <th>Формат</th>
                                            <th>Размер</th>
                                            <th style="width: 32px;">⋯</th>
                                        </tr>
                                    </thead>
                                    <tbody id="cmTracksTbody"></tbody>
                                </table>
                            </div>
                        </section>

                        <!-- View: Artists -->
                        <section id="cmViewArtists" class="crow-music-view">
                            <div class="crow-music-view-title">
                                <span>Исполнители</span>
                            </div>
                            <div id="cmArtistsGrid" class="crow-music-artists-grid"></div>
                        </section>

                        <!-- View: Genres -->
                        <section id="cmViewGenres" class="crow-music-view">
                            <div class="crow-music-view-title">
                                <span>Музыкальные жанры</span>
                            </div>
                            <div id="cmGenresGrid" class="crow-music-genres-grid"></div>
                        </section>

                        <!-- View: Favorites -->
                        <section id="cmViewFavorites" class="crow-music-view">
                            <div class="crow-music-view-title">
                                <span>★ Избранное</span>
                            </div>
                            <div id="cmFavoritesBox"></div>
                        </section>

                        <!-- View: Album Detail -->
                        <section id="cmViewAlbumDetail" class="crow-music-view">
                            <div id="cmAlbumDetailBox"></div>
                        </section>

                        <!-- View: Genre Detail -->
                        <section id="cmViewGenreDetail" class="crow-music-view">
                            <div id="cmGenreDetailBox"></div>
                        </section>
                    </main>

                    <!-- Floating Batch Actions Bar -->
                    <div id="cmBatchBar" class="cm-batch-bar">
                        <span id="cmBatchCountText" style="font-size:12px; font-weight:600; color:#38bdf8;">Выбрано: 0 треков</span>
                        <button id="cmBatchEditBtn" class="crow-music-btn-primary" style="padding:4px 12px; font-size:11px;">⚙️ Редактировать теги</button>
                        <button id="cmBatchAutofixBtn" class="crow-music-btn-secondary" style="padding:4px 12px; font-size:11px;">⚡ Автоисправление</button>
                        <button id="cmBatchClearBtn" class="crow-music-btn-secondary" style="padding:4px 10px; font-size:11px;">✕</button>
                    </div>

                    <!-- Sticky Bottom Audio Player -->
                    <footer class="crow-music-player-bar">
                        <div class="crow-music-player-left">
                            <div id="cmPlayerThumbWrapper" class="crow-music-player-thumb">
                                ${this.renderCoverHtml('', 'crow-music-cover-img')}
                            </div>
                            <div class="crow-music-player-info">
                                <div id="cmPlayerTitle" class="crow-music-player-title">Выберите трек</div>
                                <div id="cmPlayerArtist" class="crow-music-player-artist">CrowMusic Player</div>
                            </div>
                            <span id="cmPlayerFormat" class="crow-music-fmt-badge" style="margin-left: 6px;">IDLE</span>
                        </div>

                        <div class="crow-music-player-center">
                            <div class="crow-music-player-controls">
                                <button id="cmShuffleBtn" class="crow-music-ctl-btn" title="Вперемешку (Shuffle)">🔀</button>
                                <button id="cmPrevBtn" class="crow-music-ctl-btn" title="Предыдущий (Prev)">⏮</button>
                                <button id="cmPlayBtn" class="crow-music-ctl-btn crow-music-play-main" title="Воспроизведение / Пауза (Space)">▶</button>
                                <button id="cmNextBtn" class="crow-music-ctl-btn" title="Следующий (Next)">⏭</button>
                                <button id="cmRepeatBtn" class="crow-music-ctl-btn" title="Режим повтора">🔁</button>
                            </div>

                            <div class="crow-music-progress-row">
                                <span id="cmCurrentTime">0:00</span>
                                <input type="range" id="cmSeekBar" class="crow-music-seek-slider" min="0" max="100" value="0" step="0.1" />
                                <span id="cmTotalTime">0:00</span>
                            </div>
                        </div>

                        <div class="crow-music-player-right">
                            <button id="cmEqualizerBtn" class="crow-music-ctl-btn" title="10-Полосный Эквалайзер (EQ)">🎚️</button>
                            <button id="cmLyricsBtn" class="crow-music-ctl-btn" title="Текст песни / Караоке (Lyrics)">💬</button>
                            <button id="cmNowPlayingBtn" class="crow-music-ctl-btn" title="Режим Now Playing / Визуализатор (Full View)">⛶</button>
                            <button id="cmVolumeBtn" class="crow-music-ctl-btn" title="Mute (M)">🔊</button>
                            <input type="range" id="cmVolumeSlider" class="crow-music-vol-slider" min="0" max="100" value="85" />
                        </div>
                    </footer>
                </div>
            `;

            this.bindUIEvents();
        }

        bindUIEvents() {
            // Direct Live Search Handler
            const searchInput = document.querySelector('#cm-search-input') || document.querySelector('#cmSearchInput');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    this.searchQuery = (e.target.value || '').trim().toLowerCase();
                    this.renderCurrentView();
                });
            }

            document.querySelectorAll('.crow-music-pill-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const tab = btn.dataset.tab;
                    if (tab) this.switchTab(tab);
                });
            });

            document.getElementById('cmScanBtn')?.addEventListener('click', () => this.scanLibrary());
            document.getElementById('cmPlayBtn')?.addEventListener('click', () => this.togglePlayPause());
            document.getElementById('cmPrevBtn')?.addEventListener('click', () => this.playPrev());
            document.getElementById('cmNextBtn')?.addEventListener('click', () => this.playNext());
            document.getElementById('cmShuffleBtn')?.addEventListener('click', () => this.toggleShuffle());
            document.getElementById('cmRepeatBtn')?.addEventListener('click', () => this.toggleRepeat());
            document.getElementById('cmVolumeBtn')?.addEventListener('click', () => this.toggleMute());

            const volSlider = document.getElementById('cmVolumeSlider');
            if (volSlider) {
                volSlider.addEventListener('input', (e) => {
                    this.audio.volume = parseFloat(e.target.value) / 100;
                });
            }

            const seekBar = document.getElementById('cmSeekBar');
            if (seekBar) {
                seekBar.addEventListener('input', (e) => {
                    if (this.audio.duration) {
                        this.audio.currentTime = (parseFloat(e.target.value) / 100) * this.audio.duration;
                    }
                });
            }

            // Batch selection events
            document.getElementById('cmSelectAllTracks')?.addEventListener('change', (e) => {
                const checked = e.target.checked;
                document.querySelectorAll('.cm-track-chk').forEach(chk => {
                    chk.checked = checked;
                    const fid = chk.dataset.fileId;
                    if (checked) this.selectedTrackIds.add(fid);
                    else this.selectedTrackIds.delete(fid);
                });
                this.updateBatchBar();
            });

            document.getElementById('cmBatchClearBtn')?.addEventListener('click', () => {
                this.selectedTrackIds.clear();
                document.querySelectorAll('.cm-track-chk').forEach(chk => chk.checked = false);
                const selAll = document.getElementById('cmSelectAllTracks');
                if (selAll) selAll.checked = false;
                this.updateBatchBar();
            });

            document.getElementById('cmBatchEditBtn')?.addEventListener('click', () => {
                const selected = this.allTracks.filter(t => this.selectedTrackIds.has(String(t.file_id || t.id)));
                if (selected.length) {
                    this.openTagEditorModal({ tracks: selected, isAlbumMode: false });
                }
            });

            document.getElementById('cmBatchAutofixBtn')?.addEventListener('click', async () => {
                const fids = Array.from(this.selectedTrackIds);
                if (!fids.length) return;
                await this.autofixTracks(fids);
            });

            // New Module Controls: Now Playing, Lyrics, EQ
            document.getElementById('cmNowPlayingBtn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleNowPlaying();
            });
            document.getElementById('cmLyricsBtn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleLyricsModal();
            });
            document.getElementById('cmEqualizerBtn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleEqualizer();
            });

            // Dedicated Lyrics Overlay Modal Event Handlers
            document.getElementById('cmLyricsModalCloseBtn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeLyricsModal();
            });
            document.getElementById('cmLyricsModalEditBtn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openCustomLyricsModal();
            });
            document.getElementById('cmLyricsModal')?.addEventListener('mousedown', (e) => {
                if (e.target.id === 'cmLyricsModal') this.closeLyricsModal();
            });

            // Now Playing Overlay Event Handlers
            document.getElementById('cmNpCloseBtn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeNowPlaying();
            });
            document.getElementById('cmNpLyricsToggle')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleLyricsPane();
            });
            document.getElementById('cmNpEqToggle')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleEqualizer();
            });
            document.getElementById('cmNpPlayBtn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.togglePlayPause();
            });
            document.getElementById('cmNpPrevBtn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.playPrev();
            });
            document.getElementById('cmNpNextBtn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.playNext();
            });
            document.getElementById('cmNpShuffleBtn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleShuffle();
            });
            document.getElementById('cmNpRepeatBtn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleRepeat();
            });
            document.getElementById('cmNpVolBtn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMute();
            });

            const npVolSlider = document.getElementById('cmNpVolSlider');
            if (npVolSlider) {
                npVolSlider.addEventListener('input', (e) => {
                    const v = parseFloat(e.target.value) / 100;
                    this.audio.volume = v;
                    const mainVol = document.getElementById('cmVolumeSlider');
                    if (mainVol) mainVol.value = e.target.value;
                });
            }

            const npSeekBar = document.getElementById('cmNpSeekBar');
            if (npSeekBar) {
                npSeekBar.addEventListener('input', (e) => {
                    if (this.audio.duration) {
                        this.audio.currentTime = (parseFloat(e.target.value) / 100) * this.audio.duration;
                    }
                });
            }

            document.querySelectorAll('.cm-np-mode-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const mode = btn.dataset.mode;
                    if (mode) this.setVisualizerMode(mode);
                });
            });

            // Equalizer Modal Event Handlers
            document.getElementById('cmEqCloseBtn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeEqualizer();
            });
            document.getElementById('cmEqualizerModal')?.addEventListener('mousedown', (e) => {
                if (e.target.id === 'cmEqualizerModal') this.closeEqualizer();
            });
            document.getElementById('cmEqResetBtn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.resetEq();
            });
            document.getElementById('cmEqEnableToggle')?.addEventListener('change', (e) => {
                this.toggleEqBypass(e.target.checked);
            });
            document.getElementById('cmCrossfadeSelect')?.addEventListener('change', (e) => {
                this.setCrossfadeSec(parseInt(e.target.value, 10));
            });
            document.querySelectorAll('.cm-eq-pill').forEach(pill => {
                pill.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const preset = pill.dataset.preset;
                    if (preset) this.setEqPreset(preset);
                });
            });
            document.getElementById('cmEqualizerModal')?.addEventListener('mousedown', (e) => {
                if (e.target.id === 'cmEqualizerModal') this.closeEqualizer();
            });
        }

        updateBatchBar() {
            const bar = document.getElementById('cmBatchBar');
            const txt = document.getElementById('cmBatchCountText');
            if (!bar) return;
            const count = this.selectedTrackIds.size;
            if (count > 0) {
                if (txt) txt.textContent = `Выбрано: ${count} треков`;
                bar.classList.add('show');
            } else {
                bar.classList.remove('show');
            }
        }

        renderCoverHtml(coverUrl, imgClass = 'crow-music-cover-img') {
            if (coverUrl && typeof coverUrl === 'string' && coverUrl.trim().length > 0) {
                return `<img src="${this.escapeHtml(coverUrl)}" class="${imgClass}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" /><div class="crow-music-placeholder" style="display:none;"><div class="crow-music-placeholder-vinyl">🎵</div></div>`;
            }
            return `
                <div class="crow-music-placeholder">
                    <div class="crow-music-placeholder-vinyl">🎵</div>
                </div>
            `;
        }

        showToast(message, isSuccess = true) {
            let toast = document.querySelector('.crow-music-toast');
            if (!toast) {
                toast = document.createElement('div');
                toast.className = 'crow-music-toast';
                const root = document.querySelector('.crow-music-root');
                if (root) root.appendChild(toast);
            }
            if (!toast) return;

            toast.textContent = message;
            toast.className = `crow-music-toast show ${isSuccess ? '' : 'toast-error'}`;

            if (this.toastTimeout) clearTimeout(this.toastTimeout);
            this.toastTimeout = setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }

        switchTab(tab) {
            this.currentTab = tab;
            document.querySelectorAll('.crow-music-pill-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tab === tab);
            });

            document.querySelectorAll('.crow-music-view').forEach(view => view.classList.remove('active'));
            const targetView = {
                'albums': 'cmViewAlbums',
                'tracks': 'cmViewTracks',
                'artists': 'cmViewArtists',
                'genres': 'cmViewGenres',
                'favorites': 'cmViewFavorites',
                'albumDetail': 'cmViewAlbumDetail',
                'genreDetail': 'cmViewGenreDetail'
            }[tab] || 'cmViewAlbums';

            const el = document.getElementById(targetView);
            if (el) el.classList.add('active');

            this.renderCurrentView();
        }

        async scanLibrary() {
            const scanBtn = document.getElementById('cmScanBtn');
            if (scanBtn) scanBtn.classList.add('spinning');
            try {
                const res = await fetch('/api/plugins/crow-music/scan', { method: 'POST' });
                if (res.ok) {
                    await this.fetchLibrary();
                    this.showToast('✓ Медиатека успешно просканирована!');
                }
            } catch (e) {
                console.error('Scan error:', e);
                this.showToast('Ошибка сканирования дисков', false);
            } finally {
                if (scanBtn) scanBtn.classList.remove('spinning');
            }
        }

        async enrichAllOnline() {
            const btn = document.getElementById('musicEnrichAllBtn');
            if (btn) {
                btn.innerHTML = '⏳ <span>Поиск...</span>';
                btn.disabled = true;
            }
            try {
                const res = await fetch('/api/plugins/crow-music/fetch-all-missing', { method: 'POST' });
                if (res.ok) {
                    const data = await res.json();
                    await this.fetchLibrary();
                    this.showToast(`✓ Найдено и обновлено ${data.enriched_count || 0} альбомов!`);
                }
            } catch (e) {
                this.showToast('Ошибка обновления метаданных', false);
            } finally {
                if (btn) {
                    btn.innerHTML = '🌐 <span>Инфо из сети</span>';
                    btn.disabled = false;
                }
            }
        }

        async fetchLibrary() {
            try {
                const res = await fetch('/api/plugins/crow-music/library');
                if (res.ok) {
                    const data = await res.json();
                    this.albums = data.albums || [];
                    this.allTracks = data.tracks || [];
                    this.artists = data.artists || [];
                    this.genres = data.genres || [];
                    if (data.favorites) {
                        this.favoriteTracks = new Set(data.favorites.track_ids || []);
                        this.favoriteAlbums = new Set(data.favorites.album_ids || []);
                    }
                    this.updateStatsBadge();
                    this.renderCurrentView();
                }
            } catch (e) {
                console.error('Library fetch error:', e);
            }
        }

        updateStatsBadge() {
            const badge = document.getElementById('cmStatsBadge');
            if (badge) {
                badge.textContent = `${this.allTracks.length} треков · ${this.albums.length} альбомов`;
            }
        }

        renderCurrentView() {
            if (this.currentTab === 'albums') this.renderAlbums();
            else if (this.currentTab === 'tracks') this.renderTracks();
            else if (this.currentTab === 'artists') this.renderArtists();
            else if (this.currentTab === 'genres') this.renderGenres();
            else if (this.currentTab === 'favorites') this.renderFavorites();
        }

        renderAlbums() {
            const grid = document.getElementById('cmAlbumsGrid');
            if (!grid) return;

            let filtered = this.albums;
            if (this.searchQuery) {
                filtered = filtered.filter(a => 
                    (a.title || '').toLowerCase().includes(this.searchQuery) ||
                    (a.artist || '').toLowerCase().includes(this.searchQuery) ||
                    (a.genre || '').toLowerCase().includes(this.searchQuery)
                );
            }

            if (filtered.length === 0) {
                grid.innerHTML = `
                    <div style="grid-column:1/-1; text-align:center; padding:60px 20px; color:#64748b;">
                        <div style="font-size:36px; margin-bottom:10px;">💿</div>
                        <div>${this.searchQuery ? `Ничего не найдено по запросу «${this.escapeHtml(this.searchQuery)}»` : 'Альбомы не найдены'}</div>
                    </div>
                `;
                return;
            }

            grid.innerHTML = filtered.map(album => {
                const cover = album.cover_url || album.coverUrl || '';
                const isFav = this.favoriteAlbums.has(String(album.id));
                return `
                    <div class="crow-music-album-card" data-album-id="${album.id}">
                        <div class="crow-music-cover-wrapper">
                            ${this.renderCoverHtml(cover, 'crow-music-cover-img')}
                            <button class="crow-music-fav-btn ${isFav ? 'active' : ''}" style="position:absolute; top:8px; right:8px; z-index:2; background:rgba(0,0,0,0.6); border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center;" data-fav-id="${album.id}">
                                ${isFav ? '★' : '☆'}
                            </button>
                        </div>
                        <div class="crow-music-card-title" title="${this.escapeHtml(album.title)}">${this.escapeHtml(album.title)}</div>
                        <div class="crow-music-card-artist" title="${this.escapeHtml(album.artist)}">${this.escapeHtml(album.artist)}</div>
                        <div class="crow-music-card-meta">
                            <span class="crow-music-tag-pill">${this.escapeHtml(album.genre || 'Разное')}</span>
                            <span>${album.year || ''}</span>
                        </div>
                    </div>
                `;
            }).join('');

            grid.querySelectorAll('.crow-music-album-card').forEach(card => {
                const albumId = card.dataset.albumId;
                card.querySelector('.crow-music-fav-btn')?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleFav('album', albumId, e);
                });
                card.addEventListener('click', () => this.openAlbumDetail(albumId));
            });
        }

        renderTracks() {
            const tbody = document.getElementById('cmTracksTbody');
            if (!tbody) return;

            let filtered = this.allTracks;
            if (this.searchQuery) {
                filtered = filtered.filter(t => 
                    (t.title || '').toLowerCase().includes(this.searchQuery) ||
                    (t.artist || '').toLowerCase().includes(this.searchQuery) ||
                    (t.album || '').toLowerCase().includes(this.searchQuery) ||
                    (t.genre || '').toLowerCase().includes(this.searchQuery) ||
                    (t.filename || t.name || '').toLowerCase().includes(this.searchQuery)
                );
            }

            if (filtered.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="10" style="text-align:center; padding:40px; color:#64748b;">
                            ${this.searchQuery ? `Ничего не найдено по запросу «${this.escapeHtml(this.searchQuery)}»` : 'Треки не найдены'}
                        </td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = filtered.map((track, idx) => {
                const fileId = track.file_id || track.id;
                const isActive = this.currentTrack && (this.currentTrack.id === track.id || this.currentTrack.file_id === track.file_id);
                const isFav = this.favoriteTracks.has(String(fileId));
                const isChecked = this.selectedTrackIds.has(String(fileId));
                const size = track.file_size || track.size || 0;
                return `
                    <tr class="${isActive ? 'active' : ''}" data-idx="${idx}" data-file-id="${fileId}">
                        <td style="text-align:center; width:28px;" onclick="event.stopPropagation();">
                            <input type="checkbox" class="cm-track-chk" data-file-id="${fileId}" ${isChecked ? 'checked' : ''} />
                        </td>
                        <td style="text-align:center; width:32px;">
                            <button class="crow-music-fav-btn ${isFav ? 'active' : ''}" title="В избранное">${isFav ? '★' : '☆'}</button>
                        </td>
                        <td style="text-align:center; width:38px;">${isActive && this.isPlaying ? '🔊' : '▶'}</td>
                        <td style="font-weight:600; color:#ffffff;">${this.escapeHtml(track.title || track.filename || track.name)}</td>
                        <td>${this.escapeHtml(track.artist || 'Unknown Artist')}</td>
                        <td>${this.escapeHtml(track.album || 'Single / Collection')}</td>
                        <td style="color:#64748b;">${this.escapeHtml(track.genre || 'Разное')}</td>
                        <td><span class="crow-music-fmt-badge">${track.format || 'AUDIO'}</span></td>
                        <td style="font-family:monospace;">${this.formatBytes(size)}</td>
                        <td style="text-align:center;">
                            <button class="cm-track-options-btn crow-music-ctl-btn" title="Действия">⋯</button>
                        </td>
                    </tr>
                `;
            }).join('');

            tbody.querySelectorAll('tr').forEach(row => {
                const idx = parseInt(row.dataset.idx);
                const fileId = row.dataset.fileId;
                const track = filtered[idx];

                row.querySelector('.cm-track-chk')?.addEventListener('change', (e) => {
                    if (e.target.checked) this.selectedTrackIds.add(fileId);
                    else this.selectedTrackIds.delete(fileId);
                    this.updateBatchBar();
                });

                row.querySelector('.crow-music-fav-btn')?.addEventListener('click', (e) => {
                    this.toggleFav('track', fileId, e);
                });

                row.querySelector('.cm-track-options-btn')?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showContextMenu(e, track, filtered);
                });

                row.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    this.showContextMenu(e, track, filtered);
                });

                row.addEventListener('click', (e) => {
                    if (e.target.closest('.crow-music-fav-btn') || e.target.closest('.cm-track-chk') || e.target.closest('.cm-track-options-btn')) return;
                    this.playTrack(filtered[idx], filtered, idx);
                });
            });
        }

        renderArtists() {
            const grid = document.getElementById('cmArtistsGrid');
            if (!grid) return;

            let filtered = this.artists;
            if (this.searchQuery) {
                filtered = filtered.filter(a => (a.name || '').toLowerCase().includes(this.searchQuery));
            }

            if (filtered.length === 0) {
                grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:#64748b;">Артисты не найдены</div>`;
                return;
            }

            grid.innerHTML = filtered.map(art => `
                <div class="crow-music-artist-card" data-artist="${this.escapeHtml(art.name)}">
                    <div class="crow-music-artist-avatar">🎤</div>
                    <div class="crow-music-artist-name">${this.escapeHtml(art.name)}</div>
                    <div class="crow-music-artist-meta">${art.album_count || 0} альбомов · ${art.track_count || 0} треков</div>
                </div>
            `).join('');

            grid.querySelectorAll('.crow-music-artist-card').forEach(card => {
                const name = card.dataset.artist;
                card.addEventListener('click', () => {
                    const searchInput = document.querySelector('#cm-search-input');
                    if (searchInput) {
                        searchInput.value = name;
                        this.searchQuery = name.toLowerCase();
                    }
                    this.switchTab('tracks');
                });
            });
        }

        renderGenres() {
            const grid = document.getElementById('cmGenresGrid');
            if (!grid) return;

            const icons = {
                'Рок': '🎸', 'Rock': '🎸', 'Панк': '⚡', 'Punk': '⚡', 'Панк-рок': '⚡',
                'Метал': '🤘', 'Metal': '🤘', 'Поп': '✨', 'Pop': '✨',
                'Электроника': '🎛️', 'Electronic': '🎛️', 'Хип-хоп': '🎤', 'Hip-Hop': '🎤',
                'Саундтрек': '🎬', 'Soundtrack': '🎬', 'Шансон': '🎻', 'Разное': '🎵'
            };

            grid.innerHTML = this.genres.map(g => {
                const icon = icons[g.name] || '🎵';
                return `
                    <div class="crow-music-genre-card" data-genre="${this.escapeHtml(g.name)}">
                        <div class="crow-music-genre-icon">${icon}</div>
                        <div class="crow-music-genre-name">${this.escapeHtml(g.name)}</div>
                        <div class="crow-music-genre-meta">${g.track_count || 0} треков · ${g.album_count || 0} альбомов</div>
                    </div>
                `;
            }).join('');

            grid.querySelectorAll('.crow-music-genre-card').forEach(card => {
                card.addEventListener('click', () => this.openGenreDetail(card.dataset.genre));
            });
        }

        renderFavorites() {
            const box = document.getElementById('cmFavoritesBox');
            if (!box) return;

            const favTracksList = this.allTracks.filter(t => this.favoriteTracks.has(String(t.file_id || t.id)));
            const favAlbumsList = this.albums.filter(a => this.favoriteAlbums.has(String(a.id)));

            box.innerHTML = `
                <div style="margin-bottom: 24px;">
                    <h3 style="font-size:16px; font-weight:700; margin-bottom:12px; color:#eab308;">★ Избранные альбомы (${favAlbumsList.length})</h3>
                    <div class="crow-music-album-grid">
                        ${favAlbumsList.length ? favAlbumsList.map(a => `
                            <div class="crow-music-album-card" data-album-id="${a.id}">
                                <div class="crow-music-cover-wrapper">
                                    ${this.renderCoverHtml(a.cover_url, 'crow-music-cover-img')}
                                </div>
                                <div class="crow-music-card-title">${this.escapeHtml(a.title)}</div>
                                <div class="crow-music-card-artist">${this.escapeHtml(a.artist)}</div>
                            </div>
                        `).join('') : '<div style="color:#64748b; font-size:13px;">Нет избранных альбомов</div>'}
                    </div>
                </div>

                <div>
                    <h3 style="font-size:16px; font-weight:700; margin-bottom:12px; color:#eab308;">★ Избранные треки (${favTracksList.length})</h3>
                    <div class="crow-music-table-box">
                        <table class="crow-music-table">
                            <thead>
                                <tr>
                                    <th style="width:38px;">▶</th>
                                    <th>Название</th>
                                    <th>Исполнитель</th>
                                    <th>Альбом</th>
                                    <th>Формат</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${favTracksList.length ? favTracksList.map((t, idx) => `
                                    <tr data-idx="${idx}">
                                        <td style="text-align:center;">▶</td>
                                        <td style="font-weight:600; color:#fff;">${this.escapeHtml(t.title || t.filename)}</td>
                                        <td>${this.escapeHtml(t.artist)}</td>
                                        <td>${this.escapeHtml(t.album)}</td>
                                        <td><span class="crow-music-fmt-badge">${t.format}</span></td>
                                    </tr>
                                `).join('') : '<tr><td colspan="5" style="text-align:center; padding:30px; color:#64748b;">Нет избранных треков</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            box.querySelectorAll('.crow-music-album-card').forEach(c => {
                c.addEventListener('click', () => this.openAlbumDetail(c.dataset.albumId));
            });

            box.querySelectorAll('tbody tr').forEach(r => {
                const idx = parseInt(r.dataset.idx);
                r.addEventListener('click', () => this.playTrack(favTracksList[idx], favTracksList, idx));
            });
        }

        async openAlbumDetail(albumId) {
            let album = this.albums.find(a => a.id === albumId);
            if (!album) {
                try {
                    const res = await fetch(`/api/plugins/crow-music/album/${encodeURIComponent(albumId)}`);
                    if (res.ok) album = await res.json();
                } catch (e) {}
            }
            if (!album) return;

            this.activeAlbumId = albumId;
            const container = document.getElementById('cmAlbumDetailBox');
            if (!container) return;

            const coverUrl = album.cover_url || album.coverUrl || '';
            const tracks = album.tracks || this.allTracks.filter(t => (t.album_id === album.id) || ((t.album || '').toLowerCase() === (album.title || '').toLowerCase()));
            const isFav = this.favoriteAlbums.has(String(album.id));

            let displayTracks = tracks;
            if (this.searchQuery) {
                displayTracks = displayTracks.filter(t => 
                    (t.title || '').toLowerCase().includes(this.searchQuery) ||
                    (t.artist || '').toLowerCase().includes(this.searchQuery)
                );
            }

            container.innerHTML = `
                <div style="margin-bottom: 16px;">
                    <button id="cmBackToAlbumsBtn" class="crow-music-btn-secondary">
                        ⬅ Назад к альбомам
                    </button>
                </div>

                <div class="crow-music-hero">
                    <div class="crow-music-cover-wrapper" style="width:180px; height:180px; margin-bottom:0; flex-shrink:0;">
                        ${this.renderCoverHtml(coverUrl, 'crow-music-hero-cover')}
                    </div>
                    <div style="flex:1;">
                        <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#0088cc; font-weight:700; margin-bottom:4px;">Альбом</div>
                        <h1 class="crow-music-hero-title">${this.escapeHtml(album.title)}</h1>
                        <div class="crow-music-hero-artist">${this.escapeHtml(album.artist)}</div>
                        <div class="crow-music-hero-meta">
                            <span>📅 ${album.year || 'Music'}</span>
                            <span>🎵 ${tracks.length} треков</span>
                            <span>🏷️ ${album.genre || 'Разное'}</span>
                        </div>
                        <div style="display:flex; gap:10px; margin-top:12px; flex-wrap:wrap;">
                            <button id="cmPlayAlbumBtn" class="crow-music-btn-primary">▶ Слушать альбом</button>
                            <button id="cmShuffleAlbumBtn" class="crow-music-btn-secondary">🔀 Вперемешку</button>
                            <button id="cmEditAlbumTagsBtn" class="crow-music-btn-secondary" title="Редактировать теги всех треков альбома">
                                ⚙️ Редактировать теги
                            </button>
                            <button id="cmFetchOnlineBtn" class="crow-music-btn-secondary" title="Автопоиск недостающей обложки и жанра в онлайн-базах iTunes / MusicBrainz">
                                🌐 Найти инфо в сети
                            </button>
                            <button id="cmAlbumFavBtn" class="crow-music-btn-secondary" style="color:${isFav ? '#eab308' : '#9ca3af'};">
                                ${isFav ? '★ В избранном' : '☆ В избранное'}
                            </button>
                        </div>
                    </div>
                </div>

                <div class="crow-music-table-box">
                    <table class="crow-music-table">
                        <thead>
                            <tr>
                                <th style="width: 28px;"><input type="checkbox" id="cmSelectAllAlbumTracks" title="Выбрать все"></th>
                                <th style="width: 32px;">★</th>
                                <th style="width: 40px;">#</th>
                                <th>Название</th>
                                <th>Исполнитель</th>
                                <th>Формат</th>
                                <th>Размер</th>
                                <th style="width: 32px;">⋯</th>
                            </tr>
                        </thead>
                        <tbody id="cmAlbumTracksTbody">
                            ${displayTracks.length ? displayTracks.map((t, idx) => {
                                const fileId = t.file_id || t.id;
                                const isTrackFav = this.favoriteTracks.has(String(fileId));
                                const isChecked = this.selectedTrackIds.has(String(fileId));
                                return `
                                    <tr data-idx="${idx}" data-file-id="${fileId}">
                                        <td style="text-align:center; width:28px;" onclick="event.stopPropagation();">
                                            <input type="checkbox" class="cm-track-chk" data-file-id="${fileId}" ${isChecked ? 'checked' : ''} />
                                        </td>
                                        <td style="text-align:center;"><button class="crow-music-fav-btn ${isTrackFav ? 'active' : ''}">${isTrackFav ? '★' : '☆'}</button></td>
                                        <td style="text-align:center;">${t.track_no || idx + 1}</td>
                                        <td style="font-weight:600; color:#ffffff;">${this.escapeHtml(t.title || t.filename || t.name)}</td>
                                        <td>${this.escapeHtml(t.artist || album.artist || 'Unknown Artist')}</td>
                                        <td><span class="crow-music-fmt-badge">${t.format || 'AUDIO'}</span></td>
                                        <td style="font-family:monospace;">${this.formatBytes(t.file_size || t.size || 0)}</td>
                                        <td style="text-align:center;">
                                            <button class="cm-track-options-btn crow-music-ctl-btn" title="Действия">⋯</button>
                                        </td>
                                    </tr>
                                `;
                            }).join('') : `<tr><td colspan="8" style="text-align:center; padding:30px; color:#64748b;">Треки не найдены</td></tr>`}
                        </tbody>
                    </table>
                </div>
            `;

            document.getElementById('cmBackToAlbumsBtn')?.addEventListener('click', () => this.switchTab('albums'));
            document.getElementById('cmPlayAlbumBtn')?.addEventListener('click', () => {
                if (tracks.length) this.playTrack(tracks[0], tracks, 0);
            });
            document.getElementById('cmShuffleAlbumBtn')?.addEventListener('click', () => {
                if (tracks.length) {
                    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
                    this.playTrack(shuffled[0], shuffled, 0);
                }
            });
            document.getElementById('cmAlbumFavBtn')?.addEventListener('click', () => {
                this.toggleFav('album', album.id);
            });

            // Open Batch Editor for Album
            document.getElementById('cmEditAlbumTagsBtn')?.addEventListener('click', () => {
                this.openTagEditorModal({
                    tracks: tracks,
                    isAlbumMode: true,
                    albumId: album.id,
                    albumTitle: album.title,
                    albumArtist: album.artist,
                    albumGenre: album.genre,
                    albumYear: album.year,
                    albumCover: coverUrl
                });
            });

            // Online Metadata Fetch
            const onlineBtn = document.getElementById('cmFetchOnlineBtn');
            if (onlineBtn) {
                onlineBtn.addEventListener('click', async () => {
                    onlineBtn.innerHTML = '⏳ <span class="crow-music-spin">🔄</span> Поиск в сети...';
                    onlineBtn.disabled = true;
                    try {
                        const res = await fetch('/api/plugins/crow-music/fetch-metadata', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ album_id: album.id, force: true })
                        });
                        if (res.ok) {
                            const data = await res.json();
                            if (data.status === 'ok' && data.album) {
                                const idx = this.albums.findIndex(a => a.id === album.id);
                                if (idx !== -1) this.albums[idx] = data.album;
                                
                                const coverWrapper = container.querySelector('.crow-music-cover-wrapper');
                                if (coverWrapper && data.album.cover_url) {
                                    const ts = Date.now();
                                    const cleanUrl = data.album.cover_url.includes('?') ? `${data.album.cover_url}&t=${ts}` : `${data.album.cover_url}?t=${ts}`;
                                    coverWrapper.innerHTML = this.renderCoverHtml(cleanUrl, 'crow-music-hero-cover');
                                }

                                const heroMeta = container.querySelector('.crow-music-hero-meta');
                                if (heroMeta) {
                                    heroMeta.innerHTML = `
                                        <span>📅 ${data.album.year || 'Music'}</span>
                                        <span>🎵 ${tracks.length} треков</span>
                                        <span>🏷️ ${data.album.genre || 'Разное'}</span>
                                    `;
                                }

                                this.showToast('✓ Обложка и жанр успешно обновлены!');
                                this.fetchLibrary();
                            } else if (data.status === 'skipped') {
                                this.showToast('Поиск заблокирован для общей папки');
                            } else {
                                this.showToast('Метаданные в сети не найдены', false);
                            }
                        } else {
                            this.showToast('Ошибка сетевого запроса к серверу', false);
                        }
                    } catch (e) {
                        this.showToast('Сетевая ошибка при поиске метаданных', false);
                    } finally {
                        onlineBtn.innerHTML = '🌐 Найти инфо в сети';
                        onlineBtn.disabled = false;
                    }
                });
            }

            // Album Tracklist rows
            const tbody = document.getElementById('cmAlbumTracksTbody');
            if (tbody) {
                tbody.querySelectorAll('tr').forEach(row => {
                    const idx = parseInt(row.dataset.idx);
                    const fileId = row.dataset.fileId;
                    const track = displayTracks[idx];

                    row.querySelector('.cm-track-chk')?.addEventListener('change', (e) => {
                        if (e.target.checked) this.selectedTrackIds.add(fileId);
                        else this.selectedTrackIds.delete(fileId);
                        this.updateBatchBar();
                    });

                    row.querySelector('.crow-music-fav-btn')?.addEventListener('click', (e) => {
                        this.toggleFav('track', fileId, e);
                    });

                    row.querySelector('.cm-track-options-btn')?.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.showContextMenu(e, track, displayTracks);
                    });

                    row.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        this.showContextMenu(e, track, displayTracks);
                    });

                    row.addEventListener('click', (e) => {
                        if (e.target.closest('.crow-music-fav-btn') || e.target.closest('.cm-track-chk') || e.target.closest('.cm-track-options-btn')) return;
                        this.playTrack(displayTracks[idx], displayTracks, idx);
                    });
                });
            }

            document.getElementById('cmSelectAllAlbumTracks')?.addEventListener('change', (e) => {
                const checked = e.target.checked;
                tbody.querySelectorAll('.cm-track-chk').forEach(chk => {
                    chk.checked = checked;
                    const fid = chk.dataset.fileId;
                    if (checked) this.selectedTrackIds.add(fid);
                    else this.selectedTrackIds.delete(fid);
                });
                this.updateBatchBar();
            });

            this.switchTab('albumDetail');
        }

        async openGenreDetail(genreName) {
            this.activeGenreName = genreName;
            const container = document.getElementById('cmGenreDetailBox');
            if (!container) return;

            const genreTracks = this.allTracks.filter(t => (t.genre || '').toLowerCase() === genreName.toLowerCase());

            container.innerHTML = `
                <div style="margin-bottom: 16px;">
                    <button id="cmBackToGenresBtn" class="crow-music-btn-secondary">⬅ Назад к жанрам</button>
                </div>
                <div class="crow-music-hero" style="background: linear-gradient(180deg, rgba(192, 132, 252, 0.15) 0%, #161b26 100%);">
                    <div style="font-size: 64px;">🎵</div>
                    <div>
                        <div style="font-size:11px; text-transform:uppercase; color:#c084fc; font-weight:700;">Жанр</div>
                        <h1 class="crow-music-hero-title">${this.escapeHtml(genreName)}</h1>
                        <div class="crow-music-hero-meta">
                            <span>🎵 ${genreTracks.length} треков</span>
                        </div>
                    </div>
                </div>
                <div class="crow-music-table-box">
                    <table class="crow-music-table">
                        <thead>
                            <tr>
                                <th style="width:38px;">▶</th>
                                <th>Название</th>
                                <th>Исполнитель</th>
                                <th>Альбом</th>
                                <th>Формат</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${genreTracks.length ? genreTracks.map((t, idx) => `
                                <tr data-idx="${idx}">
                                    <td style="text-align:center;">▶</td>
                                    <td style="font-weight:600; color:#fff;">${this.escapeHtml(t.title || t.filename)}</td>
                                    <td>${this.escapeHtml(t.artist)}</td>
                                    <td>${this.escapeHtml(t.album)}</td>
                                    <td><span class="crow-music-fmt-badge">${t.format}</span></td>
                                </tr>
                            `).join('') : '<tr><td colspan="5" style="text-align:center; padding:30px;">Треки не найдены</td></tr>'}
                        </tbody>
                    </table>
                </div>
            `;

            document.getElementById('cmBackToGenresBtn')?.addEventListener('click', () => this.switchTab('genres'));
            container.querySelectorAll('tbody tr').forEach(r => {
                const idx = parseInt(r.dataset.idx);
                r.addEventListener('click', () => this.playTrack(genreTracks[idx], genreTracks, idx));
            });

            this.switchTab('genreDetail');
        }

        showContextMenu(event, track, allTracks = []) {
            let ctx = document.getElementById('cmContextMenu');
            if (!ctx) return;

            const fileId = track.file_id || track.id;
            const isFav = this.favoriteTracks.has(String(fileId));

            ctx.innerHTML = `
                <div class="cm-context-item" id="cmCtxPlay">▶ Воспроизвести</div>
                <div class="cm-context-item" id="cmCtxEdit">⚙️ Редактировать теги</div>
                <div class="cm-context-item" id="cmCtxAutofix">⚡ Автоисправление имени</div>
                <div class="cm-context-item" id="cmCtxFav">${isFav ? '★ Удалить из избранного' : '☆ Добавить в избранное'}</div>
            `;

            ctx.style.display = 'block';
            ctx.style.left = `${Math.min(event.clientX, window.innerWidth - 200)}px`;
            ctx.style.top = `${Math.min(event.clientY, window.innerHeight - 180)}px`;

            document.getElementById('cmCtxPlay')?.addEventListener('click', () => {
                this.playTrack(track, allTracks.length ? allTracks : [track], allTracks.indexOf(track) >= 0 ? allTracks.indexOf(track) : 0);
                ctx.style.display = 'none';
            });

            document.getElementById('cmCtxEdit')?.addEventListener('click', () => {
                this.openTagEditorModal({ tracks: [track], isAlbumMode: false });
                ctx.style.display = 'none';
            });

            document.getElementById('cmCtxAutofix')?.addEventListener('click', async () => {
                ctx.style.display = 'none';
                await this.autofixTracks([fileId]);
            });

            document.getElementById('cmCtxFav')?.addEventListener('click', () => {
                this.toggleFav('track', fileId);
                ctx.style.display = 'none';
            });
        }

        async autofixTracks(fileIds) {
            try {
                this.showToast('⏳ Автоисправление тегов...');
                const res = await fetch('/api/plugins/crow-music/tags/autofix', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ file_ids: fileIds })
                });
                if (res.ok) {
                    const data = await res.json();
                    this.showToast(`✓ Автоисправлено ${data.autofixed_count || fileIds.length} треков!`);
                    await this.fetchLibrary();
                    if (this.activeAlbumId) this.openAlbumDetail(this.activeAlbumId);
                } else {
                    this.showToast('Ошибка автоисправления тегов', false);
                }
            } catch (e) {
                this.showToast('Сетевая ошибка при автоисправлении', false);
            }
        }

        openTagEditorModal(options = {}) {
            const {
                tracks = [],
                isAlbumMode = false,
                albumId = null,
                albumTitle = '',
                albumArtist = '',
                albumGenre = '',
                albumYear = '',
                albumCover = ''
            } = options;

            if (!tracks.length) return;

            const isSingle = tracks.length === 1 && !isAlbumMode;
            const singleTrack = isSingle ? tracks[0] : null;

            const modalId = 'cmTagModalOverlay';
            document.getElementById(modalId)?.remove();

            let initialCover = albumCover;
            if (isSingle && singleTrack) {
                initialCover = singleTrack.cover_url || '';
            } else if (!initialCover && tracks[0]) {
                initialCover = tracks[0].cover_url || '';
            }

            const initialArtist = isSingle ? singleTrack.artist : (albumArtist || tracks[0]?.album_artist || tracks[0]?.artist || '');
            const initialAlbumArtist = isSingle ? (singleTrack.album_artist || singleTrack.artist) : (albumArtist || tracks[0]?.album_artist || '');
            const initialAlbum = isSingle ? singleTrack.album : (albumTitle || tracks[0]?.album || '');
            const initialYear = isSingle ? singleTrack.year : (albumYear || tracks[0]?.year || '');
            const initialGenre = isSingle ? singleTrack.genre : (albumGenre || tracks[0]?.genre || 'Разное');

            let coverBase64 = null;

            const modalHtml = `
                <div id="${modalId}" class="cm-tag-modal-overlay">
                    <div class="cm-tag-modal-card">
                        <div class="cm-tag-modal-header">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span style="font-size:18px;">⚙️</span>
                                <span style="font-weight:700; font-size:15px; color:#ffffff;">
                                    ${isSingle ? 'Редактор тегов трека' : `Массовое редактирование (${tracks.length} треков)`}
                                </span>
                            </div>
                            <button id="cmCloseTagModalBtn" class="close-btn" style="font-size:20px; color:#94a3b8; background:none; border:none; cursor:pointer;">&times;</button>
                        </div>

                        <div class="cm-tag-modal-body">
                            <div class="cm-form-row">
                                <!-- Cover Art Dropzone -->
                                <div class="cm-form-group" style="flex:0 0 140px;">
                                    <div class="cm-form-label">
                                        <span>Обложка</span>
                                        ${!isSingle ? '<label style="font-size:10px; cursor:pointer;"><input type="checkbox" id="cmApplyCoverChk" checked> Все</label>' : ''}
                                    </div>
                                    <div id="cmTagDropzone" class="cm-dropzone" title="Нажмите или перетащите картинку для замены обложки">
                                        <div id="cmTagDropzoneContent" style="width:100%; height:100%; display:flex; align-items:center; justify-content:center;">
                                            ${this.renderCoverHtml(initialCover, 'cm-dropzone-img')}
                                        </div>
                                        <input type="file" id="cmTagCoverInput" accept="image/jpeg,image/png,image/webp" style="display:none;" />
                                    </div>
                                    <button id="cmUploadCoverBtn" class="crow-music-btn-secondary" style="margin-top:6px; font-size:11px; padding:4px 8px; justify-content:center;">
                                        📁 Выбрать файл
                                    </button>
                                </div>

                                <!-- Metadata Fields -->
                                <div style="flex:1; display:flex; flex-direction:column; gap:10px;">
                                    ${isSingle ? `
                                        <div class="cm-form-group">
                                            <label class="cm-form-label">Название трека</label>
                                            <input type="text" id="cmTagTitle" class="cm-input" value="${this.escapeHtml(singleTrack.title || singleTrack.filename)}" />
                                        </div>
                                    ` : ''}

                                    <div class="cm-form-row">
                                        <div class="cm-form-group">
                                            <label class="cm-form-label">
                                                <span>Исполнитель</span>
                                                ${!isSingle ? '<label style="font-size:10px; cursor:pointer;"><input type="checkbox" id="cmApplyArtistChk" checked> Все</label>' : ''}
                                            </label>
                                            <input type="text" id="cmTagArtist" class="cm-input" value="${this.escapeHtml(initialArtist)}" />
                                        </div>
                                        <div class="cm-form-group">
                                            <label class="cm-form-label">
                                                <span>Исполнитель альбома</span>
                                                ${!isSingle ? '<label style="font-size:10px; cursor:pointer;"><input type="checkbox" id="cmApplyAlbumArtistChk" checked> Все</label>' : ''}
                                            </label>
                                            <input type="text" id="cmTagAlbumArtist" class="cm-input" value="${this.escapeHtml(initialAlbumArtist)}" />
                                        </div>
                                    </div>

                                    <div class="cm-form-row">
                                        <div class="cm-form-group" style="flex:2;">
                                            <label class="cm-form-label">
                                                <span>Альбом</span>
                                                ${!isSingle ? '<label style="font-size:10px; cursor:pointer;"><input type="checkbox" id="cmApplyAlbumChk" checked> Все</label>' : ''}
                                            </label>
                                            <input type="text" id="cmTagAlbum" class="cm-input" value="${this.escapeHtml(initialAlbum)}" />
                                        </div>
                                        <div class="cm-form-group" style="flex:1;">
                                            <label class="cm-form-label">
                                                <span>Год</span>
                                                ${!isSingle ? '<label style="font-size:10px; cursor:pointer;"><input type="checkbox" id="cmApplyYearChk" checked> Все</label>' : ''}
                                            </label>
                                            <input type="text" id="cmTagYear" class="cm-input" placeholder="1999" value="${this.escapeHtml(initialYear)}" />
                                        </div>
                                    </div>

                                    ${isSingle ? `
                                        <div class="cm-form-row">
                                            <div class="cm-form-group">
                                                <label class="cm-form-label">Номер трека</label>
                                                <input type="number" id="cmTagTrackNo" class="cm-input" value="${singleTrack.track_no || 1}" min="1" />
                                            </div>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>

                            <!-- Genre Selection & Quick Pills -->
                            <div class="cm-form-group">
                                <label class="cm-form-label">
                                    <span>Жанр</span>
                                    ${!isSingle ? '<label style="font-size:10px; cursor:pointer;"><input type="checkbox" id="cmApplyGenreChk" checked> Все</label>' : ''}
                                </label>
                                <input type="text" id="cmTagGenre" class="cm-input" value="${this.escapeHtml(initialGenre)}" />
                                <div class="cm-quick-genres">
                                    ${['Рок', 'Панк', 'Поп', 'Метал', 'Электроника', 'Хип-хоп', 'Саундтрек', 'Шансон', 'Разное'].map(g => `
                                        <span class="cm-quick-genre-pill ${g === initialGenre ? 'active' : ''}" data-genre="${g}">${g}</span>
                                    `).join('')}
                                </div>
                            </div>

                            ${!isSingle ? `
                                <div style="display:flex; gap:10px; padding:10px; background:#0b0e14; border-radius:8px; border:1px solid #1e2433; align-items:center;">
                                    <span style="font-size:12px; font-weight:600; color:#38bdf8;">Инструменты:</span>
                                    <button id="cmAutoNumberBtn" class="crow-music-btn-secondary" style="font-size:11px; padding:4px 10px;">
                                        🔢 Автонумерация (1..${tracks.length})
                                    </button>
                                    <button id="cmModalAutofixBtn" class="crow-music-btn-secondary" style="font-size:11px; padding:4px 10px;">
                                        ⚡ Автоисправление из имён
                                    </button>
                                </div>
                            ` : ''}
                        </div>

                        <div class="cm-tag-modal-footer">
                            <button id="cmCancelTagModalBtn" class="crow-music-btn-secondary">Отмена</button>
                            <button id="cmSaveTagsBtn" class="crow-music-btn-primary">💾 Сохранить изменения</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);

            // Bind Modal Events
            const modalEl = document.getElementById(modalId);
            const closeBtn = document.getElementById('cmCloseTagModalBtn');
            const cancelBtn = document.getElementById('cmCancelTagModalBtn');
            const saveBtn = document.getElementById('cmSaveTagsBtn');
            const fileInput = document.getElementById('cmTagCoverInput');
            const dropzone = document.getElementById('cmTagDropzone');
            const uploadBtn = document.getElementById('cmUploadCoverBtn');

            const closeModal = () => modalEl.remove();
            closeBtn?.addEventListener('click', closeModal);
            cancelBtn?.addEventListener('click', closeModal);

            // Quick Genre Pills
            modalEl.querySelectorAll('.cm-quick-genre-pill').forEach(pill => {
                pill.addEventListener('click', () => {
                    const genreInput = document.getElementById('cmTagGenre');
                    if (genreInput) genreInput.value = pill.dataset.genre;
                    modalEl.querySelectorAll('.cm-quick-genre-pill').forEach(p => p.classList.remove('active'));
                    pill.classList.add('active');
                });
            });

            // Cover Image Selection & Drag-and-drop
            const handleFile = (file) => {
                if (file && file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        coverBase64 = e.target.result;
                        const dropContent = document.getElementById('cmTagDropzoneContent');
                        if (dropContent) {
                            dropContent.innerHTML = `<img src="${coverBase64}" class="cm-dropzone-img" />`;
                        }
                    };
                    reader.readAsDataURL(file);
                }
            };

            uploadBtn?.addEventListener('click', () => fileInput?.click());
            dropzone?.addEventListener('click', () => fileInput?.click());
            fileInput?.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
            });

            dropzone?.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropzone.classList.add('dragover');
            });
            dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
            dropzone?.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.classList.remove('dragover');
                if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
            });

            let autoNumberTracks = false;
            document.getElementById('cmAutoNumberBtn')?.addEventListener('click', () => {
                autoNumberTracks = true;
                this.showToast('✓ Включена автонумерация 1..N при сохранении');
            });

            document.getElementById('cmModalAutofixBtn')?.addEventListener('click', async () => {
                closeModal();
                await this.autofixTracks(tracks.map(t => t.file_id || t.id));
            });

            // Save Action
            saveBtn?.addEventListener('click', async () => {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '⏳ Сохранение...';

                const fileIds = tracks.map(t => t.file_id || t.id);
                const tagPayload = {};
                const trackUpdates = {};

                const applyCover = isSingle || document.getElementById('cmApplyCoverChk')?.checked;
                const applyArtist = isSingle || document.getElementById('cmApplyArtistChk')?.checked;
                const applyAlbumArtist = isSingle || document.getElementById('cmApplyAlbumArtistChk')?.checked;
                const applyAlbum = isSingle || document.getElementById('cmApplyAlbumChk')?.checked;
                const applyYear = isSingle || document.getElementById('cmApplyYearChk')?.checked;
                const applyGenre = isSingle || document.getElementById('cmApplyGenreChk')?.checked;

                if (applyArtist) tagPayload.artist = document.getElementById('cmTagArtist')?.value;
                if (applyAlbumArtist) tagPayload.album_artist = document.getElementById('cmTagAlbumArtist')?.value;
                if (applyAlbum) tagPayload.album = document.getElementById('cmTagAlbum')?.value;
                if (applyYear) tagPayload.year = document.getElementById('cmTagYear')?.value;
                if (applyGenre) tagPayload.genre = document.getElementById('cmTagGenre')?.value;
                if (applyCover && coverBase64) tagPayload.cover_base64 = coverBase64;

                if (isSingle && singleTrack) {
                    const titleVal = document.getElementById('cmTagTitle')?.value;
                    const trackNoVal = parseInt(document.getElementById('cmTagTrackNo')?.value || '1');
                    trackUpdates[String(singleTrack.file_id || singleTrack.id)] = {
                        title: titleVal,
                        track_no: trackNoVal
                    };
                }

                try {
                    const res = await fetch('/api/plugins/crow-music/tags/update', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            file_ids: fileIds,
                            tags: tagPayload,
                            track_updates: trackUpdates,
                            auto_number: autoNumberTracks
                        })
                    });

                    if (res.ok) {
                        const data = await res.json();
                        closeModal();
                        this.showToast('✓ Теги успешно обновлены!');
                        await this.fetchLibrary();
                        if (this.activeAlbumId) this.openAlbumDetail(this.activeAlbumId);
                    } else {
                        this.showToast('Ошибка сохранения тегов', false);
                    }
                } catch (e) {
                    this.showToast('Сетевая ошибка при обновлении тегов', false);
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = '💾 Сохранить изменения';
                }
            });
        }

        closeTagEditorModal() {
            document.getElementById('cmTagModalOverlay')?.remove();
        }

        async toggleFav(type, id, event) {
            if (event) event.stopPropagation();
            const set = type === 'track' ? this.favoriteTracks : this.favoriteAlbums;
            const strId = String(id);
            const isNowFav = !set.has(strId);
            if (isNowFav) set.add(strId);
            else set.delete(strId);

            localStorage.setItem(type === 'track' ? 'crowmusic_fav_tracks' : 'crowmusic_fav_albums', JSON.stringify(Array.from(set)));

            try {
                await fetch('/api/plugins/crow-music/favorite/toggle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type, id: strId })
                });
            } catch (e) {}

            this.renderCurrentView();
        }

        initAudioGraph() {
            if (this.audioCtx) {
                if (this.audioCtx.state === 'suspended') {
                    this.audioCtx.resume().catch(() => {});
                }
                return;
            }
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (!AudioCtx) return;
                this.audioCtx = new AudioCtx();
                this.audioSourceNode = this.audioCtx.createMediaElementSource(this.audio);
                
                this.analyser = this.audioCtx.createAnalyser();
                this.analyser.fftSize = 256;
                this.analyser.smoothingTimeConstant = 0.82;

                // 10-band Equalizer Filters (32Hz to 16kHz)
                this.eqFilters = this.eqFrequencies.map((freq, idx) => {
                    const filter = this.audioCtx.createBiquadFilter();
                    if (idx === 0) {
                        filter.type = 'lowshelf';
                    } else if (idx === this.eqFrequencies.length - 1) {
                        filter.type = 'highshelf';
                    } else {
                        filter.type = 'peaking';
                        filter.Q.value = 1.4;
                    }
                    filter.frequency.value = freq;
                    const savedGain = this.eqGains[idx] || 0;
                    filter.gain.value = this.eqEnabled ? savedGain : 0;
                    return filter;
                });

                this.gainNode = this.audioCtx.createGain();
                this.gainNode.gain.value = this.audio.muted ? 0 : (this.audio.volume ?? 0.85);

                // Connect Chain: Source -> Analyser -> Filter[0] -> ... -> Filter[9] -> GainNode -> Destination
                let prevNode = this.audioSourceNode;
                prevNode.connect(this.analyser);
                prevNode = this.analyser;

                for (let i = 0; i < this.eqFilters.length; i++) {
                    prevNode.connect(this.eqFilters[i]);
                    prevNode = this.eqFilters[i];
                }

                prevNode.connect(this.gainNode);
                this.gainNode.connect(this.audioCtx.destination);
            } catch (e) {
                console.warn('Web Audio Graph initialization notice:', e);
            }
        }

        initAudioEngine() {
            this.audio.addEventListener('timeupdate', () => {
                if (this.audio.duration) {
                    const cur = this.audio.currentTime;
                    const dur = this.audio.duration;
                    const pct = (cur / dur) * 100;

                    // Update main player bar
                    const seekBar = document.getElementById('cmSeekBar');
                    if (seekBar) seekBar.value = pct;
                    const curTime = document.getElementById('cmCurrentTime');
                    if (curTime) curTime.textContent = this.formatTime(cur);

                    // Update Now Playing overlay
                    const npSeekBar = document.getElementById('cmNpSeekBar');
                    if (npSeekBar) npSeekBar.value = pct;
                    const npCurTime = document.getElementById('cmNpCurTime');
                    if (npCurTime) npCurTime.textContent = this.formatTime(cur);

                    // Karaoke lyrics synchronization
                    this.syncLyricsWithTime(cur);

                    // Crossfade auto-transition
                    if (this.crossfadeSec > 0 && dur > 12 && (dur - cur) <= this.crossfadeSec && !this.isFadingOut) {
                        this.isFadingOut = true;
                        if (this.gainNode && this.audioCtx) {
                            const now = this.audioCtx.currentTime;
                            const curVol = this.gainNode.gain.value;
                            this.gainNode.gain.setValueAtTime(curVol, now);
                            this.gainNode.gain.linearRampToValueAtTime(0.001, now + this.crossfadeSec);
                        }
                        setTimeout(() => {
                            this.playNext();
                        }, this.crossfadeSec * 1000);
                    }
                }
            });

            this.audio.addEventListener('loadedmetadata', () => {
                const totalTime = document.getElementById('cmTotalTime');
                if (totalTime) totalTime.textContent = this.formatTime(this.audio.duration);
                const npTotTime = document.getElementById('cmNpTotTime');
                if (npTotTime) npTotTime.textContent = this.formatTime(this.audio.duration);
            });

            this.audio.addEventListener('play', () => {
                this.updatePlayBtn(true);
                this.initAudioGraph();
                if (this.nowPlayingOpen) {
                    this.startVisualizer();
                    document.getElementById('cmNpCoverContainer')?.classList.add('spinning');
                }
            });

            this.audio.addEventListener('pause', () => {
                this.updatePlayBtn(false);
                this.stopVisualizer();
                document.getElementById('cmNpCoverContainer')?.classList.remove('spinning');
            });

            this.audio.addEventListener('ended', () => {
                if (!this.isFadingOut) {
                    this.playNext();
                }
            });

            // Media Session API integration
            if ('mediaSession' in navigator) {
                try {
                    navigator.mediaSession.setActionHandler('play', () => this.togglePlayPause());
                    navigator.mediaSession.setActionHandler('pause', () => this.togglePlayPause());
                    navigator.mediaSession.setActionHandler('previoustrack', () => this.playPrev());
                    navigator.mediaSession.setActionHandler('nexttrack', () => this.playNext());
                    navigator.mediaSession.setActionHandler('seekto', (details) => {
                        if (details.seekTime != null && this.audio.duration) {
                            this.audio.currentTime = details.seekTime;
                        }
                    });
                    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
                        this.audio.currentTime = Math.max(0, this.audio.currentTime - (details.seekOffset || 10));
                    });
                    navigator.mediaSession.setActionHandler('seekforward', (details) => {
                        this.audio.currentTime = Math.min(this.audio.duration || 0, this.audio.currentTime + (details.seekOffset || 10));
                    });
                } catch (e) {
                    console.warn('MediaSession action handlers setup notice:', e);
                }
            }
        }

        updateMediaSession(track) {
            if (!('mediaSession' in navigator) || !track) return;
            try {
                const coverUrl = track.cover_url || track.coverUrl;
                const fullCoverUrl = coverUrl ? (coverUrl.startsWith('http') ? coverUrl : window.location.origin + coverUrl) : '';
                const artwork = fullCoverUrl ? [
                    { src: fullCoverUrl, sizes: '512x512', type: 'image/jpeg' },
                    { src: fullCoverUrl, sizes: '256x256', type: 'image/jpeg' },
                    { src: fullCoverUrl, sizes: '96x96', type: 'image/jpeg' }
                ] : [];

                navigator.mediaSession.metadata = new MediaMetadata({
                    title: track.title || track.name || track.filename,
                    artist: track.artist || 'Unknown Artist',
                    album: track.album || '',
                    artwork: artwork
                });
            } catch (e) {}
        }

        playTrack(track, queue = [], index = 0) {
            if (!track) return;
            this.currentTrack = track;
            this.queue = queue.length ? queue : [track];
            this.currentIndex = index;

            this.initAudioGraph();

            const fileId = track.file_id || track.id;
            this.audio.src = `/api/stream/${fileId}`;

            // Crossfade fade-in on start
            if (this.gainNode && this.audioCtx && this.crossfadeSec > 0) {
                const now = this.audioCtx.currentTime;
                const targetVol = this.audio.muted ? 0 : (this.audio.volume ?? 0.85);
                this.gainNode.gain.setValueAtTime(0.001, now);
                this.gainNode.gain.linearRampToValueAtTime(targetVol, now + Math.min(this.crossfadeSec, 1.5));
            }
            this.isFadingOut = false;

            this.audio.play().catch(e => console.error('Audio playback error:', e));

            // Main player bar elements
            const titleEl = document.getElementById('cmPlayerTitle');
            const artistEl = document.getElementById('cmPlayerArtist');
            const fmtEl = document.getElementById('cmPlayerFormat');
            const thumbEl = document.getElementById('cmPlayerThumbWrapper');

            const title = track.title || track.name || track.filename;
            const artist = track.artist || 'Unknown Artist';
            const album = track.album || '';
            const coverUrl = track.cover_url || track.coverUrl || '';

            if (titleEl) titleEl.textContent = title;
            if (artistEl) artistEl.textContent = artist;
            if (fmtEl) fmtEl.textContent = track.format || 'AUDIO';
            if (thumbEl) thumbEl.innerHTML = this.renderCoverHtml(coverUrl, 'crow-music-cover-img');

            // Now Playing overlay elements
            const npTitle = document.getElementById('cmNpTitle');
            const npArtist = document.getElementById('cmNpArtist');
            const npAlbum = document.getElementById('cmNpAlbum');
            const npCoverImg = document.getElementById('cmNpCoverImg');
            const npBackdrop = document.getElementById('cmNpBackdrop');

            if (npTitle) npTitle.textContent = title;
            if (npArtist) npArtist.textContent = artist;
            if (npAlbum) npAlbum.textContent = album;
            if (npCoverImg) {
                npCoverImg.src = coverUrl || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" fill="%231e2433"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="%2338bdf8" font-size="72" font-family="sans-serif">🎵</text></svg>';
            }
            if (npBackdrop) {
                if (coverUrl) {
                    npBackdrop.style.backgroundImage = `url("${coverUrl}")`;
                } else {
                    npBackdrop.style.backgroundImage = 'radial-gradient(circle at center, #0088cc 0%, #080a0f 70%)';
                }
            }

            // Load Lyrics & Media Session
            this.loadTrackLyrics(track);
            this.updateMediaSession(track);

            this.renderCurrentView();
        }

        openAndPlayFile(fileId, fileName, ext) {
            this.open();
            const track = {
                id: fileId,
                file_id: fileId,
                name: fileName,
                filename: fileName,
                title: fileName.replace(/\.[a-zA-Z0-9]+$/, ''),
                artist: 'Direct File',
                album: 'Streaming',
                format: (ext || 'MP3').toUpperCase(),
                cover_url: '',
                coverUrl: '',
                size: 0
            };
            this.playTrack(track, [track], 0);
        }

        togglePlayPause() {
            if (!this.currentTrack && this.allTracks.length) {
                this.playTrack(this.allTracks[0], this.allTracks, 0);
                return;
            }
            this.initAudioGraph();
            if (this.audio.paused) {
                this.audio.play().catch(e => {});
            } else {
                this.audio.pause();
            }
        }

        playNext() {
            if (!this.queue.length) return;
            let nextIdx = this.currentIndex + 1;
            if (this.isShuffle) nextIdx = Math.floor(Math.random() * this.queue.length);
            if (nextIdx >= this.queue.length) {
                if (this.repeatMode === 1) nextIdx = 0;
                else return;
            }
            this.playTrack(this.queue[nextIdx], this.queue, nextIdx);
        }

        playPrev() {
            if (!this.queue.length) return;
            if (this.audio.currentTime > 3) {
                this.audio.currentTime = 0;
                return;
            }
            let prevIdx = this.currentIndex - 1;
            if (prevIdx < 0) prevIdx = this.queue.length - 1;
            this.playTrack(this.queue[prevIdx], this.queue, prevIdx);
        }

        toggleShuffle() {
            this.isShuffle = !this.isShuffle;
            document.getElementById('cmShuffleBtn')?.classList.toggle('active', this.isShuffle);
            document.getElementById('cmNpShuffleBtn')?.classList.toggle('active', this.isShuffle);
        }

        toggleRepeat() {
            this.repeatMode = (this.repeatMode + 1) % 3;
            const icons = ['➡️', '🔁', '🔂'];
            const btn = document.getElementById('cmRepeatBtn');
            const npBtn = document.getElementById('cmNpRepeatBtn');
            if (btn) {
                btn.textContent = icons[this.repeatMode];
                btn.classList.toggle('active', this.repeatMode > 0);
            }
            if (npBtn) {
                npBtn.textContent = icons[this.repeatMode];
                npBtn.classList.toggle('active', this.repeatMode > 0);
            }
        }

        toggleMute() {
            this.audio.muted = !this.audio.muted;
            const btn = document.getElementById('cmVolumeBtn');
            const npBtn = document.getElementById('cmNpVolBtn');
            const icon = this.audio.muted ? '🔇' : '🔊';
            if (btn) btn.textContent = icon;
            if (npBtn) npBtn.textContent = icon;
            if (this.gainNode && this.audioCtx) {
                this.gainNode.gain.value = this.audio.muted ? 0 : (this.audio.volume ?? 0.85);
            }
        }

        updatePlayBtn(isPlaying) {
            this.isPlaying = isPlaying;
            const icon = isPlaying ? '⏸' : '▶';
            const btn = document.getElementById('cmPlayBtn');
            const npBtn = document.getElementById('cmNpPlayBtn');
            if (btn) btn.textContent = icon;
            if (npBtn) npBtn.textContent = icon;
        }

        // ==========================================
        // NOW PLAYING OVERLAY & CANVAS VISUALIZER
        // ==========================================
        toggleNowPlaying() {
            const modal = document.getElementById('cmNowPlayingModal');
            if (this.nowPlayingOpen || (modal && (modal.classList.contains('active') || modal.style.display === 'flex'))) {
                this.closeNowPlaying();
            } else {
                this.openNowPlaying();
            }
        }

        openNowPlaying(showLyrics = false) {
            this.initAudioGraph();
            this.nowPlayingOpen = true;
            const modal = document.getElementById('cmNowPlayingModal');
            if (modal) {
                modal.style.display = 'flex';
                modal.classList.add('active', 'open');
            }

            if (this.currentTrack) {
                const track = this.currentTrack;
                const title = track.title || track.name || 'Выберите трек';
                const artist = track.artist || track.album_artist || 'CrowMusic Player';
                const album = track.album || '';
                const coverUrl = track.cover_url || track.coverUrl || '';

                const npTitle = document.getElementById('cmNpTitle');
                const npArtist = document.getElementById('cmNpArtist');
                const npAlbum = document.getElementById('cmNpAlbum');
                const npCoverImg = document.getElementById('cmNpCoverImg');
                const npBackdrop = document.getElementById('cmNpBackdrop');

                if (npTitle) npTitle.textContent = title;
                if (npArtist) npArtist.textContent = artist;
                if (npAlbum) npAlbum.textContent = album;
                if (npCoverImg) {
                    npCoverImg.src = coverUrl || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" fill="%231e2433"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="%2338bdf8" font-size="72" font-family="sans-serif">🎵</text></svg>';
                }
                if (npBackdrop) {
                    if (coverUrl) {
                        npBackdrop.style.backgroundImage = `url("${coverUrl}")`;
                    } else {
                        npBackdrop.style.backgroundImage = 'radial-gradient(circle at center, #0088cc 0%, #080a0f 70%)';
                    }
                }

                if (showLyrics || this.lyricsOpen) {
                    if (!this.parsedLyrics.length || this.currentLyricsTrackId !== String(track.file_id || track.id)) {
                        this.loadTrackLyrics(track);
                    }
                }
            } else if (this.allTracks.length) {
                // If nothing playing, show preview of first track
                const first = this.allTracks[0];
                const npTitle = document.getElementById('cmNpTitle');
                const npArtist = document.getElementById('cmNpArtist');
                if (npTitle) npTitle.textContent = first.title || first.filename;
                if (npArtist) npArtist.textContent = first.artist || 'CrowMusic';
                this.loadTrackLyrics(first);
            }

            if (showLyrics) {
                const lyricsPane = document.getElementById('cmNpLyricsPane');
                if (lyricsPane) lyricsPane.style.display = 'flex';
                document.getElementById('cmNpLyricsToggle')?.classList.add('active');
            }

            this.resizeCanvas();
            window.addEventListener('resize', this._onCanvasResize = () => this.resizeCanvas());

            if (!this.audio.paused) {
                this.startVisualizer();
                document.getElementById('cmNpCoverContainer')?.classList.add('spinning');
            }
        }

        closeNowPlaying() {
            this.nowPlayingOpen = false;
            const modal = document.getElementById('cmNowPlayingModal');
            if (modal) {
                modal.style.display = 'none';
                modal.classList.remove('active', 'open');
            }
            this.stopVisualizer();
            document.getElementById('cmNpCoverContainer')?.classList.remove('spinning');
            if (this._onCanvasResize) {
                window.removeEventListener('resize', this._onCanvasResize);
                this._onCanvasResize = null;
            }
        }

        setVisualizerMode(mode) {
            this.visualizerMode = mode;
            localStorage.setItem('crowmusic_vis_mode', mode);
            document.querySelectorAll('.cm-np-mode-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.mode === mode);
            });
        }

        resizeCanvas() {
            const canvas = document.getElementById('cmVisualizerCanvas');
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
        }

        startVisualizer() {
            this.initAudioGraph();
            if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
            this.renderVisualizerFrame();
        }

        stopVisualizer() {
            if (this.animFrameId) {
                cancelAnimationFrame(this.animFrameId);
                this.animFrameId = null;
            }
            const canvas = document.getElementById('cmVisualizerCanvas');
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }

        renderVisualizerFrame() {
            if (!this.nowPlayingOpen || !this.analyser) return;

            const canvas = document.getElementById('cmVisualizerCanvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const width = canvas.width;
            const height = canvas.height;
            ctx.clearRect(0, 0, width, height);

            if (this.visualizerMode === 'bars') {
                const bufferLength = 64;
                const dataArray = new Uint8Array(bufferLength);
                this.analyser.getByteFrequencyData(dataArray);

                const barWidth = (width / bufferLength) * 0.8;
                const gap = (width / bufferLength) * 0.2;
                let x = gap / 2;

                for (let i = 0; i < bufferLength; i++) {
                    const rawVal = dataArray[i] / 255.0;
                    const barHeight = rawVal * (height * 0.65);

                    // Peak caps logic with smooth gravity fall
                    if (barHeight > this.peakBars[i]) {
                        this.peakBars[i] = barHeight;
                    } else {
                        this.peakBars[i] = Math.max(0, this.peakBars[i] - 1.8 * (window.devicePixelRatio || 1));
                    }

                    // Gradient for bar
                    const grad = ctx.createLinearGradient(0, height, 0, height - barHeight);
                    grad.addColorStop(0, 'rgba(0, 136, 204, 0.2)');
                    grad.addColorStop(0.5, '#0088cc');
                    grad.addColorStop(1, '#00f0ff');

                    ctx.fillStyle = grad;
                    ctx.shadowBlur = 8;
                    ctx.shadowColor = '#00f0ff';
                    ctx.fillRect(x, height - barHeight, barWidth, barHeight);

                    // Draw peak dot
                    if (this.peakBars[i] > 2) {
                        ctx.fillStyle = '#ffffff';
                        ctx.shadowBlur = 12;
                        ctx.shadowColor = '#ffffff';
                        ctx.fillRect(x, height - this.peakBars[i] - 3, barWidth, 3);
                    }

                    ctx.shadowBlur = 0;
                    x += barWidth + gap;
                }
            } else if (this.visualizerMode === 'radial') {
                const bufferLength = 80;
                const dataArray = new Uint8Array(bufferLength);
                this.analyser.getByteFrequencyData(dataArray);

                const cx = width / 2;
                const cy = height / 2;
                const baseRadius = Math.min(width, height) * 0.27;

                ctx.save();
                ctx.translate(cx, cy);

                for (let i = 0; i < bufferLength; i++) {
                    const angle = (i / bufferLength) * Math.PI * 2;
                    const val = dataArray[i] / 255.0;
                    const barLen = val * (Math.min(width, height) * 0.22);

                    const x1 = Math.cos(angle) * baseRadius;
                    const y1 = Math.sin(angle) * baseRadius;
                    const x2 = Math.cos(angle) * (baseRadius + barLen);
                    const y2 = Math.sin(angle) * (baseRadius + barLen);

                    ctx.strokeStyle = `hsl(${185 + val * 45}, 100%, ${50 + val * 25}%)`;
                    ctx.lineWidth = 3.5 * (window.devicePixelRatio || 1);
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = '#00f0ff';

                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                }
                ctx.restore();
                ctx.shadowBlur = 0;
            } else if (this.visualizerMode === 'waveform') {
                const bufferLength = 256;
                const dataArray = new Uint8Array(bufferLength);
                this.analyser.getByteTimeDomainData(dataArray);

                ctx.lineWidth = 3.5 * (window.devicePixelRatio || 1);
                ctx.strokeStyle = '#00f0ff';
                ctx.shadowBlur = 12;
                ctx.shadowColor = '#00f0ff';
                ctx.beginPath();

                const sliceWidth = width / bufferLength;
                let x = 0;

                for (let i = 0; i < bufferLength; i++) {
                    const v = dataArray[i] / 128.0;
                    const y = (v * height) / 2;

                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);

                    x += sliceWidth;
                }
                ctx.lineTo(width, height / 2);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            this.animFrameId = requestAnimationFrame(() => this.renderVisualizerFrame());
        }

        // ==========================================
        // SYNCHRONIZED LYRICS & KARAOKE ENGINE
        // ==========================================
        toggleLyricsModal() {
            const modal = document.getElementById('cmLyricsModal');
            if (this.lyricsModalOpen || (modal && (modal.classList.contains('active') || modal.style.display === 'flex'))) {
                this.closeLyricsModal();
            } else {
                this.openLyricsModal();
            }
        }

        openLyricsModal() {
            const modal = document.getElementById('cmLyricsModal');
            if (modal) {
                modal.style.display = 'flex';
                modal.classList.add('active', 'open');
            }
            this.lyricsModalOpen = true;

            const current = this.currentTrack || (this.allTracks.length ? this.allTracks[0] : null);
            if (current) {
                const titleEl = document.getElementById('cmLyricsModalTitle');
                const artistEl = document.getElementById('cmLyricsModalArtist');
                if (titleEl) titleEl.textContent = current.title || current.name || 'Трек';
                if (artistEl) artistEl.textContent = current.artist || current.album_artist || '';

                if (!this.parsedLyrics.length || this.currentLyricsTrackId !== String(current.file_id || current.id)) {
                    this.loadTrackLyrics(current);
                } else {
                    this.renderLyricsUI(this.parsedLyrics[0]?.time !== -1);
                }
            } else {
                this.renderEmptyLyricsUI();
            }
        }

        closeLyricsModal() {
            const modal = document.getElementById('cmLyricsModal');
            if (modal) {
                modal.style.display = 'none';
                modal.classList.remove('active', 'open');
            }
            this.lyricsModalOpen = false;
        }

        toggleLyricsPane() {
            const pane = document.getElementById('cmNpLyricsPane');
            const btn = document.getElementById('cmNpLyricsToggle');
            if (!pane) return;
            const isVisible = pane.style.display !== 'none';
            pane.style.display = isVisible ? 'none' : 'flex';
            if (btn) btn.classList.toggle('active', !isVisible);
        }

        renderEmptyLyricsUI() {
            const emptyHtml = `
                <div class="cm-lyrics-empty">
                    <div style="font-size:32px; margin-bottom:10px;">💬</div>
                    <div style="font-size:16px; font-weight:700; color:#e2e8f0; margin-bottom:6px;">Текст песни не найден</div>
                    <div style="font-size:13px; color:#94a3b8; margin-bottom:18px; max-width:320px; margin-left:auto; margin-right:auto; text-align:center;">Вы можете добавить слова песни вручную или загрузить текст с таймкодами LRC</div>
                    <button class="cm-insert-custom-lyrics-btn crow-music-btn-secondary" style="padding:8px 18px; font-size:13px; border-radius:8px; display:inline-flex; align-items:center; gap:6px; cursor:pointer;">
                        <span>✏️</span> Вставить свой текст
                    </button>
                </div>
            `;
            const listEl1 = document.getElementById('cmNpLyricsList');
            const listEl2 = document.getElementById('cmLyricsModalContent');
            if (listEl1) listEl1.innerHTML = emptyHtml;
            if (listEl2) listEl2.innerHTML = emptyHtml;

            document.querySelectorAll('.cm-insert-custom-lyrics-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openCustomLyricsModal();
                });
            });
        }

        openCustomLyricsModal() {
            if (!this.currentTrack) {
                this.showToast('Сначала выберите или запустите трек', false);
                return;
            }
            const track = this.currentTrack;
            const existing = document.getElementById('cmCustomLyricsModal');
            if (existing) existing.remove();

            const trackTitle = this.escapeHtml(track.title || track.name || 'Трек');

            const html = `
                <div id="cmCustomLyricsModal" class="cm-modal-overlay active open" style="z-index:10070;">
                    <div class="cm-eq-panel" style="max-width:600px; z-index:10075;">
                        <div class="cm-eq-header">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span>✏️</span>
                                <span style="font-size:15px; font-weight:700; color:#f3f4f6;">Текст песни: ${trackTitle}</span>
                            </div>
                            <button id="cmCloseCustomLyricsBtn" class="close-btn" style="font-size:22px; line-height:1; padding:2px 8px; z-index:10080; cursor:pointer;">&times;</button>
                        </div>
                        <div style="padding:20px; display:flex; flex-direction:column; gap:14px;">
                            <div style="font-size:13px; color:#94a3b8;">Вставьте текст песни (обычные строки или LRC с таймкодами вида <code>[01:23.45] Текст</code>):</div>
                            <textarea id="cmCustomLyricsInput" class="crow-music-input" placeholder="[00:15.00] Пример строки текста песни...&#10;[00:18.50] Вторая строка..." style="height:240px; resize:vertical; font-family:monospace; font-size:13px; line-height:1.6; padding:14px; border-radius:10px;"></textarea>
                            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:8px;">
                                <button id="cmCancelCustomLyricsBtn" class="crow-music-btn-secondary" style="padding:8px 18px; cursor:pointer;">Отмена</button>
                                <button id="cmSaveCustomLyricsBtn" class="crow-music-btn-primary" style="padding:8px 22px; cursor:pointer;">Сохранить текст</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);

            document.getElementById('cmCloseCustomLyricsBtn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeCustomLyricsModal();
            });
            document.getElementById('cmCancelCustomLyricsBtn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeCustomLyricsModal();
            });
            document.getElementById('cmCustomLyricsModal')?.addEventListener('mousedown', (e) => {
                if (e.target.id === 'cmCustomLyricsModal') this.closeCustomLyricsModal();
            });

            document.getElementById('cmSaveCustomLyricsBtn')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                const text = (document.getElementById('cmCustomLyricsInput')?.value || '').trim();
                if (!text) {
                    this.showToast('Введите текст песни', false);
                    return;
                }
                const hasLrc = /\[\d{1,2}:\d{2}/.test(text);
                try {
                    const res = await fetch('/api/plugins/crow-music/lyrics', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            track_id: String(track.file_id || track.id),
                            artist: track.artist || '',
                            title: track.title || track.name || '',
                            album: track.album || '',
                            plain_lyrics: hasLrc ? '' : text,
                            synced_lyrics: hasLrc ? text : ''
                        })
                    });
                    if (res.ok) {
                        this.showToast('✓ Текст песни успешно сохранен!');
                        this.closeCustomLyricsModal();
                        const badge1 = document.getElementById('cmNpLyricsSourceBadge');
                        const badge2 = document.getElementById('cmLyricsModalBadge');
                        if (badge1) badge1.textContent = 'CUSTOM';
                        if (badge2) badge2.textContent = 'CUSTOM';
                        if (hasLrc) {
                            this.parsedLyrics = this.parseLRC(text);
                            this.renderLyricsUI(true);
                        } else {
                            this.parsedLyrics = text.split('\n').map(l => ({ time: -1, text: l.trim() })).filter(l => l.text);
                            this.renderLyricsUI(false);
                        }
                    } else {
                        this.showToast('Ошибка сохранения текста', false);
                    }
                } catch (err) {
                    this.showToast('Ошибка сети при сохранении текста', false);
                }
            });
        }

        closeCustomLyricsModal() {
            const modal = document.getElementById('cmCustomLyricsModal');
            if (modal) modal.remove();
        }

        async loadTrackLyrics(track) {
            if (!track) return;
            const trackId = String(track.file_id || track.id);
            this.currentLyricsTrackId = trackId;
            this.parsedLyrics = [];
            this.currentLyricIdx = -1;

            const listEl1 = document.getElementById('cmNpLyricsList');
            const listEl2 = document.getElementById('cmLyricsModalContent');
            const badge1 = document.getElementById('cmNpLyricsSourceBadge');
            const badge2 = document.getElementById('cmLyricsModalBadge');

            const loadingHtml = '<div class="cm-lyrics-empty">Загрузка текста песни... ⏳</div>';
            if (listEl1) listEl1.innerHTML = loadingHtml;
            if (listEl2) listEl2.innerHTML = loadingHtml;

            const titleEl = document.getElementById('cmLyricsModalTitle');
            const artistEl = document.getElementById('cmLyricsModalArtist');
            if (titleEl) titleEl.textContent = track.title || track.name || 'Трек';
            if (artistEl) artistEl.textContent = track.artist || track.album_artist || '';

            try {
                const artist = encodeURIComponent(track.artist || '');
                const title = encodeURIComponent(track.title || track.name || '');
                const album = encodeURIComponent(track.album || '');
                const dur = track.duration || 0;
                const path = encodeURIComponent(track.path || '');

                const res = await fetch(`/api/plugins/crow-music/lyrics?track_id=${trackId}&artist=${artist}&title=${title}&album=${album}&duration=${dur}&path=${path}`);
                if (res.ok) {
                    const data = await res.json();
                    if (this.currentLyricsTrackId !== trackId) return; // Stale track

                    const sourceLabel = data.source ? data.source.toUpperCase() : 'LRCLIB';
                    if (badge1) badge1.textContent = sourceLabel;
                    if (badge2) badge2.textContent = sourceLabel;

                    if (data.synced && data.synced_lyrics) {
                        this.parsedLyrics = this.parseLRC(data.synced_lyrics);
                        this.renderLyricsUI(true);
                    } else if (data.plain_lyrics) {
                        this.parsedLyrics = data.plain_lyrics.split('\n').map(l => ({ time: -1, text: l.trim() })).filter(l => l.text);
                        this.renderLyricsUI(false);
                    } else {
                        this.renderEmptyLyricsUI();
                    }
                } else {
                    this.renderEmptyLyricsUI();
                }
            } catch (e) {
                this.renderEmptyLyricsUI();
            }
        }

        parseLRC(lrcText) {
            if (!lrcText) return [];
            const lines = lrcText.split('\n');
            const result = [];
            const timeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

            for (const line of lines) {
                const matches = [...line.matchAll(timeRegex)];
                if (matches.length) {
                    const text = line.replace(timeRegex, '').trim();
                    for (const match of matches) {
                        const min = parseInt(match[1], 10);
                        const sec = parseInt(match[2], 10);
                        const msStr = match[3] || '0';
                        const ms = parseInt(msStr.padEnd(3, '0').slice(0, 3), 10);
                        const totalSeconds = min * 60 + sec + ms / 1000;
                        result.push({ time: totalSeconds, text: text || '♪' });
                    }
                }
            }
            return result.sort((a, b) => a.time - b.time);
        }

        renderLyricsUI(isSynced) {
            const listEl1 = document.getElementById('cmNpLyricsList');
            const listEl2 = document.getElementById('cmLyricsModalContent');

            if (!this.parsedLyrics.length) {
                this.renderEmptyLyricsUI();
                return;
            }

            const html = this.parsedLyrics.map((item, idx) => {
                return `<div class="cm-lyrics-line" id="cmLyricLine_${idx}" data-idx="${idx}" data-time="${item.time}">${this.escapeHtml(item.text)}</div>`;
            }).join('');

            const htmlModal = this.parsedLyrics.map((item, idx) => {
                return `<div class="cm-lyrics-line cm-lyrics-modal-line" id="cmModalLyricLine_${idx}" data-idx="${idx}" data-time="${item.time}">${this.escapeHtml(item.text)}</div>`;
            }).join('');

            if (listEl1) listEl1.innerHTML = html;
            if (listEl2) listEl2.innerHTML = htmlModal;

            // Click on lyric line to seek
            if (isSynced) {
                document.querySelectorAll('.cm-lyrics-line').forEach(lineEl => {
                    lineEl.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const time = parseFloat(lineEl.dataset.time);
                        if (!isNaN(time) && time >= 0 && this.audio.duration) {
                            this.audio.currentTime = time;
                        }
                    });
                });
            }
        }

        syncLyricsWithTime(currentTime) {
            if (!this.parsedLyrics.length || this.parsedLyrics[0].time === -1) return;

            // Find current active lyric line
            let activeIdx = -1;
            for (let i = 0; i < this.parsedLyrics.length; i++) {
                if (currentTime >= this.parsedLyrics[i].time) {
                    activeIdx = i;
                } else {
                    break;
                }
            }

            if (activeIdx !== this.currentLyricIdx) {
                this.currentLyricIdx = activeIdx;
                document.querySelectorAll('.cm-lyrics-line').forEach((el) => {
                    const idx = parseInt(el.dataset.idx, 10);
                    el.classList.toggle('cm-lyrics-active', idx === activeIdx);
                    el.classList.toggle('cm-lyrics-passed', idx < activeIdx);
                });

                if (activeIdx >= 0) {
                    const activeEl1 = document.getElementById(`cmLyricLine_${activeIdx}`);
                    if (activeEl1 && this.nowPlayingOpen) {
                        activeEl1.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                    const activeEl2 = document.getElementById(`cmModalLyricLine_${activeIdx}`);
                    if (activeEl2 && this.lyricsModalOpen) {
                        activeEl2.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            }
        }

        // ==========================================
        // 10-BAND EQUALIZER & CROSSFADE ENGINE
        // ==========================================
        toggleEqualizer() {
            const modal = document.getElementById('cmEqualizerModal');
            if (this.eqModalOpen || (modal && (modal.classList.contains('active') || modal.style.display === 'flex'))) {
                this.closeEqualizer();
            } else {
                this.openEqualizer();
            }
        }

        openEqualizer() {
            this.initAudioGraph();
            const modal = document.getElementById('cmEqualizerModal');
            if (modal) {
                modal.style.display = 'flex';
                modal.classList.add('active', 'open');
            }
            this.eqModalOpen = true;
            this.renderEqSliders();

            const toggle = document.getElementById('cmEqEnableToggle');
            const toggleText = document.getElementById('cmEqToggleText');
            if (toggle) toggle.checked = this.eqEnabled;
            if (toggleText) toggleText.textContent = this.eqEnabled ? 'ВКЛ' : 'ВЫКЛ';

            const cfSelect = document.getElementById('cmCrossfadeSelect');
            if (cfSelect) cfSelect.value = String(this.crossfadeSec);

            // Active preset pill
            document.querySelectorAll('.cm-eq-pill').forEach(p => {
                p.classList.toggle('active', p.dataset.preset === this.eqPreset);
            });
        }

        closeEqualizer() {
            const modal = document.getElementById('cmEqualizerModal');
            if (modal) {
                modal.style.display = 'none';
                modal.classList.remove('active', 'open');
            }
            this.eqModalOpen = false;
        }

        renderEqSliders() {
            const grid = document.getElementById('cmEqSlidersGrid');
            if (!grid) return;

            grid.innerHTML = this.eqFrequencies.map((freq, idx) => {
                const gain = this.eqGains[idx] || 0;
                const freqLabel = freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
                const sign = gain > 0 ? '+' : '';
                return `
                    <div class="cm-eq-col">
                        <span class="cm-eq-db-badge" id="cmEqDb_${idx}">${sign}${gain}dB</span>
                        <div class="cm-eq-slider-wrapper">
                            <input type="range" class="cm-eq-slider" id="cmEqSlider_${idx}" data-idx="${idx}" min="-12" max="12" step="0.5" value="${gain}" />
                        </div>
                        <span class="cm-eq-freq-label">${freqLabel}</span>
                    </div>
                `;
            }).join('');

            // Bind slider change events
            this.eqFrequencies.forEach((_, idx) => {
                const slider = document.getElementById(`cmEqSlider_${idx}`);
                slider?.addEventListener('input', (e) => {
                    const val = parseFloat(e.target.value);
                    this.setEqBandGain(idx, val);
                });
            });
        }

        setEqBandGain(bandIdx, gainDb) {
            this.eqGains[bandIdx] = gainDb;
            localStorage.setItem('crowmusic_eq_gains', JSON.stringify(this.eqGains));

            const badge = document.getElementById(`cmEqDb_${bandIdx}`);
            if (badge) {
                badge.textContent = `${gainDb > 0 ? '+' : ''}${gainDb}dB`;
            }

            if (this.eqFilters[bandIdx] && this.audioCtx) {
                const targetVal = this.eqEnabled ? gainDb : 0;
                this.eqFilters[bandIdx].gain.setTargetAtTime(targetVal, this.audioCtx.currentTime, 0.05);
            }

            // Set preset to Custom
            this.eqPreset = 'Custom';
            document.querySelectorAll('.cm-eq-pill').forEach(p => p.classList.remove('active'));
        }

        setEqPreset(presetName) {
            const gains = this.eqPresets[presetName];
            if (!gains) return;
            this.eqPreset = presetName;
            localStorage.setItem('crowmusic_eq_preset', presetName);
            this.eqGains = [...gains];
            localStorage.setItem('crowmusic_eq_gains', JSON.stringify(this.eqGains));

            // Update UI sliders and filter gains
            this.eqFrequencies.forEach((_, idx) => {
                const val = gains[idx] || 0;
                const slider = document.getElementById(`cmEqSlider_${idx}`);
                if (slider) slider.value = val;
                const badge = document.getElementById(`cmEqDb_${idx}`);
                if (badge) badge.textContent = `${val > 0 ? '+' : ''}${val}dB`;

                if (this.eqFilters[idx] && this.audioCtx) {
                    const targetVal = this.eqEnabled ? val : 0;
                    this.eqFilters[idx].gain.setTargetAtTime(targetVal, this.audioCtx.currentTime, 0.05);
                }
            });

            document.querySelectorAll('.cm-eq-pill').forEach(p => {
                p.classList.toggle('active', p.dataset.preset === presetName);
            });
        }

        toggleEqBypass(enabled) {
            this.eqEnabled = enabled;
            localStorage.setItem('crowmusic_eq_enabled', String(enabled));

            const toggleText = document.getElementById('cmEqToggleText');
            if (toggleText) toggleText.textContent = enabled ? 'ВКЛ' : 'ВЫКЛ';

            if (this.audioCtx && this.eqFilters.length) {
                this.eqFrequencies.forEach((_, idx) => {
                    const targetVal = enabled ? (this.eqGains[idx] || 0) : 0;
                    this.eqFilters[idx].gain.setTargetAtTime(targetVal, this.audioCtx.currentTime, 0.05);
                });
            }
        }

        resetEq() {
            this.setEqPreset('Flat');
        }

        setCrossfadeSec(sec) {
            this.crossfadeSec = sec;
            localStorage.setItem('crowmusic_crossfade', String(sec));
        }

        formatTime(seconds) {
            if (!seconds || isNaN(seconds)) return '0:00';
            const m = Math.floor(seconds / 60);
            const s = Math.floor(seconds % 60);
            return `${m}:${s < 10 ? '0' : ''}${s}`;
        }

        formatBytes(bytes) {
            if (!bytes || bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        }

        escapeHtml(str) {
            return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
        }

        open() {
            this.isModalOpen = true;
            const modal = document.getElementById('musicModal');
            if (modal) {
                modal.style.display = 'flex';
                document.querySelectorAll('.sidebar-nav .nav-link').forEach(l => l.classList.remove('active'));
                document.getElementById('navMusicBtn')?.classList.add('active');
            }
            // Instant SWR: render from SQLite cache, then silently sync in background
            this.fetchLibrary().then(() => {
                this.backgroundSync();
            });
        }

        close() {
            this.isModalOpen = false;
            const modal = document.getElementById('musicModal');
            if (modal) {
                modal.style.display = 'none';
                document.querySelectorAll('.sidebar-nav .nav-link').forEach(l => l.classList.remove('active'));
                document.getElementById('navDriveBtn')?.classList.add('active');
            }
        }
    }

    const CrowMusic = {
        name: PLUGIN_NAME,
        manifest: {
            id: 'crow-music',
            name: 'CrowMusic Hub',
            version: '1.0.0',
            author: 'SlowCrow',
            description: 'Персональный стриминговый медиахаб с пакетным редактором тегов'
        },
        init: function(api) {
            const engine = new CrowMusicEngine();
            engine.init(api);
            window.CrowMusicInstance = engine;
        }
    };

    if (window.CrowAPI) {
        window.CrowAPI.registerPlugin(PLUGIN_NAME, CrowMusic);
    }
})();
