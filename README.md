<div align="center">

<img src="src/web/static/img/icon.png" alt="CrowGram Logo" width="130" style="border-radius: 24px; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);" />

# CrowGram

### *Infinite, Private & Structured Cloud Storage Powered by Telegram*

[![Release](https://img.shields.io/github/v/release/SlowCrow666/CrowGram?color=0088cc&style=for-the-badge&logo=telegram&logoColor=white)](https://github.com/SlowCrow666/CrowGram/releases/latest)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776ab?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-4c1?style=for-the-badge)](https://github.com/SlowCrow666/CrowGram/releases)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

---

[🇷🇺 **Русская версия**](README_RU.md) • [✨ **Key Features**](#-key-features) • [⚡ **Architecture**](#-why-crowgram) • [🚀 **Quick Start**](#-quick-start) • [🧭 **Setup Wizard**](#-first-run-walkthrough) • [🔌 **Plugins SDK**](#-plugin-development)

---

</div>

<br>

## ⚡ Why CrowGram?

Telegram provides essentially unlimited cloud attachment storage, but natively lacks a traditional file manager abstraction — no virtual drives, nested folders, live chunk reassembly, or dual-pane commander interfaces.

**CrowGram bridges this gap** by converting your Telegram account or private channels into a lightning-fast, structured virtual filesystem with client-side indexing and streaming playback.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                             CrowGram Core                              │
│   [Virtual Drives] ⇄ [AES Chunk Streamer] ⇄ [Local SQLite Metadata]   │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
            ┌───────▼────────┐              ┌────────▼────────┐
            │ Saved Messages │              │ Private Channel │
            │ (Metadata Sync)│              │ (Drive Storage) │
            └────────────────┘              └─────────────────┘
```

<br>

---

## ✨ Key Features

<table>
  <tr>
    <td width="50%">
      <h3>🗂️ Virtual Multi-Drive</h3>
      <p>Organize your files across isolated virtual drive letters (<code>Drive C:</code>, <code>Drive D:</code>, etc.) mapped directly to Telegram channels or Saved Messages.</p>
    </td>
    <td width="50%">
      <h3>🧩 Transparent Parallel Chunking</h3>
      <p>Upload files of any size (up to multi-gigabyte ISOs and raw video). Files are automatically split into 49MB chunks, hashed, and parallel-streamed.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>🔄 1-Click Telegram Cloud Sync</h3>
      <p>Push and pull full SQLite metadata backups directly to Telegram Saved Messages. Recover your entire drive hierarchy instantly on any fresh computer.</p>
    </td>
    <td width="50%">
      <h3>📝 Built-in Rich Editor</h3>
      <p>Integrated code editor with full syntax highlighting, JSON formatting, and Markdown live visualizer without spawning duplicate modal windows.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>⚔️ CrowCommander Dual-Pane</h3>
      <p>Built-in Norton/Total Commander style two-panel file manager with classic hotkeys (<code>F5</code> copy, <code>F6</code> move, <code>F8</code> delete) for power users.</p>
    </td>
    <td width="50%">
      <h3>🎨 6 Cyberpunk & Retro Themes</h3>
      <p>Instantly switch between Gemini Dark, Yandex Disk Light, Retro Green Terminal, Amber CRT, ZX Spectrum, and 8-bit Dendy NES themes.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>🔐 Native 2FA & Desktop Emulation</h3>
      <p>Full support for Telegram Cloud 2FA passwords. The client emulates the official Telegram Desktop (5.4.1 x64) handshake to eliminate anti-spam blocks.</p>
    </td>
    <td width="50%">
      <h3>🌐 Zero External Trackers</h3>
      <p>100% private, self-contained architecture. All data travels strictly between your machine and official Telegram MTProto endpoints.</p>
    </td>
  </tr>
</table>

<br>

---

## 🚀 Quick Start

### 📦 Option 1: Standalone Binaries (Release 1.1)

Download the ready-to-run desktop application without needing Python installed:

| Operating System | Package Format | Direct Download |
| :--- | :--- | :--- |
| 🪟 **Windows 10 / 11** (x64) | Portable `.zip` | [📥 **Download CrowGram-Windows-x64.zip**](https://github.com/SlowCrow666/CrowGram/releases/download/1.1/CrowGram-Windows-x64.zip) |
| 🍏 **macOS** (Intel / Apple Silicon) | Portable `.tar.gz` | [📥 **Download CrowGram-macOS-x64.tar.gz.zip**](https://github.com/SlowCrow666/CrowGram/releases/download/1.1/CrowGram-macOS-x64.tar.gz.zip) |
| 🐧 **Linux** (Ubuntu / Debian / Arch) | Portable `.tar.gz` | [📥 **Download CrowGram-Linux-x64.tar.gz.zip**](https://github.com/SlowCrow666/CrowGram/releases/download/1.1/CrowGram-Linux-x64.tar.gz.zip) |

<br>

### 🛠️ Option 2: Run from Source Code

```bash
# 1. Clone the repository
git clone https://github.com/SlowCrow666/CrowGram.git
cd CrowGram

# 2. Install required Python packages
pip install -r requirements.txt

# 3. Launch the desktop GUI
python desktop_app.py
```

*For web browser access only:*
```bash
python app.py
# Open http://127.0.0.1:8000 in your browser
```

<br>

---

## 🧭 First Run Walkthrough

When launching CrowGram for the first time, the interactive **Setup Wizard** guides you in 4 simple steps:

```
[ Step 1: Language ] ➔ [ Step 2: Telegram API ] ➔ [ Step 3: Auth & 2FA ] ➔ [ Step 4: Mount / Restore ]
```

1. **Language Selection:** Pick your preferred interface language (**Русский** or **English**).
2. **API Credentials:** Enter your `api_id` and `api_hash` from [my.telegram.org](https://my.telegram.org).
3. **Authorization:** Enter your phone number and the 5-digit verification code. If 2FA is active, input your Cloud Password.
4. **Drive Setup OR Instant Restore:**
   - **New Users:** Create your first virtual drive (e.g., `C: Main Drive`) linked to Saved Messages.
   - **Existing Users:** Click **"📥 Restore from Telegram"** or select a `.json` backup file to recover all drives and folders in 1 click!

<br>

---

## 🔌 Plugin Development

CrowGram provides a modular JavaScript SDK (`window.CrowAPI`) allowing anyone to build custom extensions, viewers, commanders, and tools.

### Example Plugin:

Save as `plugins/MyCustomTool.js` (or place in `src/web/static/plugins/`):

```javascript
window.CrowAPI.registerPlugin({
    id: 'my-custom-tool',
    name: 'Custom Storage Insight',
    version: '1.0.0',
    init: function(api) {
        console.log('✓ Custom Tool initialized');

        // Hook file clicks for .log files
        api.on('onFileClick', (id, name, ext) => {
            if (ext === 'log') {
                api.ui.createModal({
                    title: `Log Viewer: ${name}`,
                    body: `<p>Opening log stream for file ID: ${id}</p>`
                });
                return true; // Intercept default preview
            }
            return false;
        });
    }
});
```

<br>

---

## 📁 Project Structure

```text
CrowGram/
├── app.py                     # FastAPI backend & streaming server
├── desktop_app.py             # Native PyWebView desktop wrapper
├── src/
│   ├── config.py              # Path resolution & environment config
│   ├── core/
│   │   ├── db.py              # SQLite metadata engine & transactional sync
│   │   └── telegram_client.py # MTProto client (Desktop 5.4.1 x64 emulation)
│   └── web/                   # Web frontend assets
│       ├── index.html         # HUD interface & Setup Wizard
│       └── static/
│           ├── css/           # Design system & themes
│           ├── js/            # Client logic, i18n & SDK
│           └── plugins/       # Extensible plugin bundle
├── plugins/                   # Standalone developer plugins & docs
├── locales/                   # i18n translation dictionaries
└── .github/workflows/         # CI/CD multiplatform automated build pipeline
```

<br>

---

## 🛡️ Security & Privacy

- 🔒 **Zero Telemetry:** No analytical trackers, third-party analytics, or background telemetry.
- 📡 **Direct MTProto:** Client connects directly to official Telegram DC servers.
- 🔑 **Encrypted Credentials:** Session tokens and database keys are kept strictly on your local disk.

<br>

---

## 📜 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

<div align="center">

*Developed with passion for decentralized privacy and open data autonomy.*

**[⭐ Star on GitHub](https://github.com/SlowCrow666/CrowGram)** • **[🐛 Report Bug](https://github.com/SlowCrow666/CrowGram/issues)**

</div>