# CrowGram ### Infinite, Private & Structured Cloud Storage Powered by Telegram

🇷🇺 Русская версия • Overview • Features • Quick Start • Plugins SDK
Release Python Platform [License](LICENSE)

Transform Telegram into your personal decentralized cloud drive with zero limits, instant metadata sync, and local encryption.
--- ## ⚡ Why CrowGram? Telegram provides practically unlimited cloud attachment storage, but lacks hierarchical folders, unified multi-disk abstractions, and desktop filesystem convenience. **CrowGram bridges this gap.** ``` ┌─────────────────────────────────────────────────────────────┐ │ CrowGram Core │ │ [Virtual Drives] ⇄ [AES Chunk Streamer] ⇄ [SQLite DB] │ └──────────────┬───────────────────────────────┬──────────────┘ │ │ ┌───────▼────────┐ ┌────────▼────────┐ │ Saved Messages │ │ Private Channel │ │ (System Sync) │ │ (Drive Storage) │ └────────────────┘ └─────────────────┘ ``` --- ## 🌟 Key Highlights
🗂️ Virtual Multi-Drive
Map isolated Telegram channels or Saved Messages into dedicated virtual letters (Drive C:, Drive D:) with custom storage policies. 	
🧩 Transparent Chunking
Upload huge archives, raw video, and disc images smoothly — files are sliced into encrypted chunks and streamed in parallel.
🔄 Instant Cloud Sync
Backup and restore entire SQLite file metadata direct to Telegram Saved Messages in a single click without managing manual servers. 	
📝 Native Rich Editor
Integrated markdown visualizer, source code syntax highlighter, and live workspace editor built right into the app window.
🔌 Modular CrowAPI
Extend the UI with custom toolbars, dual-pane commanders (CrowCommander), auto-organizers, and batch processors. 	
🎨 Custom Themes & 2FA
7 tuned dark/light color schemes, full bi-directional localization (RU/EN), and seamless Pyrogram 2FA authorization.
--- ## 🚀 Quick Start ### 📦 Option A: Pre-compiled Binaries (Recommended) Grab the standalone executable for your OS directly: | Operating System | Direct Download Link | Status | | :--- | :--- | :---: | | **Windows 10 / 11** | 💾 `CrowGram-Windows-x64.zip` | Win | | **macOS (Intel / Apple Silicon)** | 💾 `CrowGram-macOS-x64.tar.gz.zip` | macOS | | **Linux (Ubuntu / Debian / Arch)** | 💾 `CrowGram-Linux-x64.tar.gz.zip` | Linux | ### 🛠️ Option B: Run from Source 1. **Clone the repository** ```bash git clone https://github.com/SlowCrow666/CrowGram.git cd CrowGram ``` 2. **Install dependencies** ```bash pip install -r requirements.txt ``` 3. **Launch the desktop engine** ```bash python run_desktop.py ``` --- ## 🧭 First Run Walkthrough 1. **Telegram API Setup:** Open the built-in Setup Wizard and input your `api_id` and `api_hash` from my.telegram.org. 2. **Authorize:** Enter your phone number and SMS/Telegram code (Cloud 2FA passwords fully supported). 3. **Mount or Restore:** * Pick an existing Telegram channel to mount your first drive, **OR** * Hit **"Restore from Telegram"** on Step 4 to immediately pull your existing cloud schema. --- ## 🔌 Plugins SDK CrowGram exposes a global client runtime interface `window.CrowAPI`: ```javascript // Register a custom button in CrowGram CrowAPI.registerPlugin({ id: 'quick-stats', name: 'Storage Insights', init() { CrowAPI.addToolbarButton({ icon: '📊', title: 'Drive Stats', onClick: () => CrowAPI.showModal('Total Drives: ' + CrowAPI.getDrives().length) }); } }); ``` --- ## 🛡️ Privacy Commitment * **Zero Tracking:** No telemetry, third-party analytical pings, or central servers. * **Direct Handshake:** Network traffic travels exclusively between your machine and official Telegram MTProto endpoints. ---
Released under the [MIT License](LICENSE). Developed with passion for open data autonomy.