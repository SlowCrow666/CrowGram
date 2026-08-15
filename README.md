CrowGram

    Your Personal, Infinite Cloud Storage Powered by Telegram.

    Turn Telegram's limitless cloud infrastructure into a structured, privacy-first virtual drive with chunking, live encryption, and cross-platform desktop integration.

📖 Language: English | 🇷🇺 Читать на русском
✨ Key Features

    🗂️ Multi-Drive Architecture — Map separate Telegram channels or Saved Messages into isolated virtual drives (e.g., Drive C:, Drive D:).

    🧩 Intelligent File Chunking — Seamlessly bypass file-size limits by streaming large files in secure chunks directly to Telegram.

    💾 Native Backup & Restore — Instant single-click SQLite metadata export/import (.json) or cloud sync directly via Telegram Saved Messages.

    📝 Built-in Rich Editor — View and edit .md, .txt, and code files directly within the storage interface.

    🔌 Extensible Plugin Engine (CrowAPI) — Build custom extensions, two-pane file managers (CrowCommander), and automation tools using the lightweight JS SDK.

    🎨 Modern Theming & i18n — 7 built-in themes with full Russian and English localization out of the box.

    🔒 Privacy by Design — Zero telemetry. Your files and database reside entirely on your local machine and your private Telegram chats.

🚀 Quick Start
Pre-built Binaries

Download the latest standalone executable for your operating system from the Releases page:

    🪟 Windows: CrowGram-Windows-x64.zip

    🍎 macOS: CrowGram-macOS-universal.zip

    🐧 Linux: CrowGram-Linux-x86_64.tar.gz

Running from Source

Prerequisites: Python 3.10+ installed.

git clone https://github.com/yourusername/CrowGram.git

cd CrowGram

pip install -r requirements.txt

python run_desktop.py
🛠️ Configuration & First Launch

    Launch CrowGram and follow the built-in Setup Wizard.

    Provide your Telegram API ID and API Hash (obtainable from my.telegram.org).

    Enter your phone number and confirm the authorization code (supports 2FA Cloud Passwords).

    Select your target storage channel or choose "Restore from Telegram" to instantly pull an existing cloud database.

🧩 Plugin Development

CrowGram includes an extensible SDK for UI/UX plugins:

    Check out the Plugins Guide for hooks, UI modals, toolbar widgets, and window.CrowAPI documentation.

📄 License

Distributed under the MIT License. See LICENSE for more information.