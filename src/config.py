import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = BASE_DIR / "data"
TEMP_DIR = BASE_DIR / "temp"
WEB_DIR = BASE_DIR / "src" / "web"
LOCALES_DIR = BASE_DIR / "src" / "locales"

DATA_DIR.mkdir(parents=True, exist_ok=True)
TEMP_DIR.mkdir(parents=True, exist_ok=True)
WEB_DIR.mkdir(parents=True, exist_ok=True)
LOCALES_DIR.mkdir(parents=True, exist_ok=True)
(WEB_DIR / "static").mkdir(parents=True, exist_ok=True)

DB_PATH = DATA_DIR / "crowgram.db"

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8000
CHUNK_SIZE_BYTES = 49 * 1024 * 1024
