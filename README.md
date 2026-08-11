=== FILE: README.md ===
# 🐦‍⬛ CrowGram Cloud Storage

**CrowGram** is an open-source decentralized virtual drive system that transforms unlimited Telegram cloud storage into a structured, high-performance personal media hub.

[Русская версия (README_RU.md)](README_RU.md)

---

## ✨ Key Features

* 💽 **Virtual Drives**: Organize files into virtual drive letters (C:, D:, etc.) mapped directly to private Telegram channels.
* ⚡ **Chunking & Media Streaming**: Fast multi-threaded chunk uploads with instant, seekable video and audio streaming in native formats.
* 🖥️ **Cross-Platform Desktop App**: Built-in `pywebview` client providing smooth MKV/AVI playback, multi-audio track support, and custom system-level video decoding.
* ⚔️ **CrowCommander**: Built-in dual-panel file manager for seamless local-to-cloud and cloud-to-local file transfers.
* 🔐 **App Lock & Recovery**: Optional passcode lock for the Web UI with instant Telegram (*Saved Messages*) automated database and key backups.
* 🧩 **Extensible Plugin Engine**: Flexible JavaScript SDK for custom viewers, external media players, and custom extensions.

---

## 🚀 Quick Start

### Requirements

* Python 3.10+
* Telegram API ID & API Hash (Get them in 1 minute at https://my.telegram.org)

### Running Locally (Desktop Mode)

1. Clone the repository:
git clone https://github.com/SlowCrow666/CrowGram.git
cd CrowGram

2. Install dependencies:
pip install -r requirements.txt

3. Launch Desktop App:
* On Windows: Double-click run.bat or run:
python desktop_app.py
* On Linux / macOS:
python3 desktop_app.py

---

## 🛠️ Tech Stack

* **Backend**: Python 3.11, FastAPI, Uvicorn, Pyrogram, SQLite.
* **Frontend**: HTML5, Modern CSS Variables, Vanilla JS, ArtPlayer.
* **Desktop Wrapper**: PyWebView.
* **CI/CD**: GitHub Actions (Automated multiplatform Windows, Linux, macOS releases).

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.
=== END FILE ===