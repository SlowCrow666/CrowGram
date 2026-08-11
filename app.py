import socket
import mimetypes
import webbrowser
import threading
import asyncio
from pathlib import Path
from contextlib import asynccontextmanager
import uvicorn
from fastapi import FastAPI, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

import sys
sys.path.append(str(Path(__file__).resolve().parent))
from src.config import WEB_DIR, TEMP_DIR, LOCALES_DIR, DEFAULT_HOST, DEFAULT_PORT
from src.core.db import init_db, get_all_config, set_config
from src.core.telegram_client import tg_manager

from src.api.auth import router as auth_router
from src.api.drives import router as drives_router
from src.api.files import router as files_router
from src.api.stream import router as stream_router
from src.api.local import router as local_router
from src.api.plugins import router as plugins_router

mimetypes.add_type('video/mp4', '.mp4')
mimetypes.add_type('video/webm', '.webm')
mimetypes.add_type('video/x-matroska', '.mkv')
mimetypes.add_type('audio/mpeg', '.mp3')
mimetypes.add_type('audio/flac', '.flac')
mimetypes.add_type('audio/ogg', '.ogg')

BASE_DIR = Path(__file__).resolve().parent
PLUGINS_DIR = BASE_DIR / "plugins"
THEMES_DIR = BASE_DIR / "themes"

PLUGINS_DIR.mkdir(parents=True, exist_ok=True)
THEMES_DIR.mkdir(parents=True, exist_ok=True)

def find_free_port(start_port: int) -> int:
    port = start_port
    while True:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex((DEFAULT_HOST, port)) != 0:
                return port
        port += 1

def open_browser(port: int):
    webbrowser.open(f"http://{DEFAULT_HOST}:{port}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    for temp_file in TEMP_DIR.glob("*.tmp"):
        try: temp_file.unlink()
        except OSError: pass

    async def init_tg_background():
        try:
            await tg_manager.init_client()
            if tg_manager.app and tg_manager.app.is_connected:
                async for _ in tg_manager.app.get_dialogs(limit=100):
                    pass
        except Exception:
            pass
            
    asyncio.create_task(init_tg_background())
    yield
    if tg_manager.app and tg_manager.app.is_connected:
        await tg_manager.app.stop()

app = FastAPI(title="CrowGram Cloud Storage", lifespan=lifespan)

# Подключение базовых роутов API
app.include_router(auth_router)
app.include_router(drives_router)
app.include_router(files_router)
app.include_router(stream_router)
app.include_router(local_router)
app.include_router(plugins_router)

# Статические директории
app.mount("/static", StaticFiles(directory=WEB_DIR / "static"), name="static")
app.mount("/locales", StaticFiles(directory=LOCALES_DIR), name="locales")
app.mount("/plugins", StaticFiles(directory=PLUGINS_DIR), name="plugins")
app.mount("/themes", StaticFiles(directory=THEMES_DIR), name="themes")

@app.get("/")
async def root():
    return FileResponse(WEB_DIR / "index.html")

@app.get("/api/config")
async def api_get_config():
    cfg = get_all_config()
    cfg["is_authorized"] = tg_manager.is_authorized()
    cfg["has_ffmpeg"] = True
    cfg["version"] = "2.1.0"
    cfg["api_version"] = "1.0"
    return JSONResponse(content=cfg)

@app.post("/api/config")
async def api_set_config(
    api_id: str = Form(...), 
    api_hash: str = Form(...), 
    chunk_size: str = Form(None), 
    max_concurrent_uploads: str = Form(None)
):
    set_config("api_id", api_id.strip())
    set_config("api_hash", api_hash.strip())
    if chunk_size: set_config("chunk_size", chunk_size.strip())
    if max_concurrent_uploads: set_config("max_concurrent_uploads", max_concurrent_uploads.strip())
    await tg_manager.init_client()
    return {"status": "success"}

if __name__ == "__main__":
    port = find_free_port(DEFAULT_PORT)
    threading.Timer(1.2, open_browser, args=[port]).start()
    uvicorn.run("app:app", host=DEFAULT_HOST, port=port, reload=False)
