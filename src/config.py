import sys
import os
from pathlib import Path

if getattr(sys, 'frozen', False):
    BUNDLE_DIR = Path(getattr(sys, '_MEIPASS', Path(sys.executable).resolve().parent))
    BASE_DIR = Path(sys.executable).resolve().parent
else:
    BUNDLE_DIR = Path(__file__).resolve().parent.parent
    BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = BASE_DIR / "data"
TEMP_DIR = BASE_DIR / "temp"

# Search for web assets in BUNDLE_DIR first (from PyInstaller _MEIPASS), fallback to BASE_DIR
if (BUNDLE_DIR / "src" / "web").exists():
    WEB_DIR = BUNDLE_DIR / "src" / "web"
elif (BASE_DIR / "src" / "web").exists():
    WEB_DIR = BASE_DIR / "src" / "web"
else:
    WEB_DIR = BASE_DIR / "web"

LOCALES_DIR = (BUNDLE_DIR / "src" / "locales") if (BUNDLE_DIR / "src" / "locales").exists() else (BASE_DIR / "src" / "locales")

DATA_DIR.mkdir(parents=True, exist_ok=True)
TEMP_DIR.mkdir(parents=True, exist_ok=True)
WEB_DIR.mkdir(parents=True, exist_ok=True)
LOCALES_DIR.mkdir(parents=True, exist_ok=True)
(WEB_DIR / "static").mkdir(parents=True, exist_ok=True)

DB_PATH = DATA_DIR / "crowgram.db"

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8000
CHUNK_SIZE_BYTES = 49 * 1024 * 1024
