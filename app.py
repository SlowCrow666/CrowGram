import socket
import mimetypes
import hashlib
import traceback
import io
import zipfile
import webbrowser
import threading
import re
import asyncio
import uuid
import time
import urllib.request
import os
import shutil
import subprocess
import string
import logging
from typing import Optional, List
from pathlib import Path
from urllib.parse import quote
from contextlib import asynccontextmanager
import uvicorn
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query, Request, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from pyrogram.errors import SessionPasswordNeeded

import sys
sys.path.append(str(Path(__file__).resolve().parent))
from src.config import WEB_DIR, TEMP_DIR, LOCALES_DIR, DEFAULT_HOST, DEFAULT_PORT, CHUNK_SIZE_BYTES
from src.core.db import (
    init_db, set_config, get_config, get_all_config, add_file_record, 
    add_folder_record, add_chunk_record, list_files_db, list_trash_db, get_file_chunks, get_file_info,
    move_to_trash_db, restore_from_trash_db, delete_file_permanently_db, empty_trash_db,
    get_drives, add_drive, update_drive_db, delete_drive_db, get_drive_info, toggle_favorite_db, move_item_db, copy_item_db, get_storage_stats,
    export_db_to_json, import_db_from_json, set_app_password, verify_app_password_db, get_password_recovery_info,
    get_plugin_defaults, set_plugin_default, remove_plugin_defaults_for_plugin
)
from src.core.telegram_client import tg_manager, format_tg_error

# Configure Root Logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("CrowGram")
logger.setLevel(logging.DEBUG)

mimetypes.add_type('video/mp4', '.mp4')
mimetypes.add_type('video/webm', '.webm')
mimetypes.add_type('video/x-matroska', '.mkv')
mimetypes.add_type('audio/mpeg', '.mp3')
mimetypes.add_type('audio/flac', '.flac')
mimetypes.add_type('audio/ogg', '.ogg')
mimetypes.add_type('image/webp', '.webp')
mimetypes.add_type('image/svg+xml', '.svg')
mimetypes.add_type('image/png', '.png')
mimetypes.add_type('image/jpeg', '.jpg')
mimetypes.add_type('image/jpeg', '.jpeg')
mimetypes.add_type('image/gif', '.gif')
mimetypes.add_type('image/bmp', '.bmp')
mimetypes.add_type('image/x-icon', '.ico')

BASE_DIR = Path(__file__).resolve().parent
PLUGINS_DIR = BASE_DIR / "src" / "web" / "static" / "plugins"
THEMES_DIR = BASE_DIR / "themes"

PLUGINS_DIR.mkdir(parents=True, exist_ok=True)
THEMES_DIR.mkdir(parents=True, exist_ok=True)

chunk_cache = {}
stream_semaphore = asyncio.Semaphore(3)
stream_progress = {}

def check_ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None or (BASE_DIR / "ffmpeg.exe").exists()

def find_free_port(start_port: int) -> int:
    port = start_port
    while True:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex((DEFAULT_HOST, port)) != 0:
                return port
        port += 1

def open_browser(port: int):
    webbrowser.open(f"http://{DEFAULT_HOST}:{port}")

def validate_chat_id(chat_id: str) -> bool:
    if not chat_id: return False
    chat_id = chat_id.strip()
    if chat_id.lower() == "me": return True
    if re.match(r"^-?\d+$", chat_id): return True
    if re.match(r"^@?[a-zA-Z0-9_]+$", chat_id): return True
    return False

def parse_peer_id(chat_id: str):
    cid_str = str(chat_id).strip()
    if cid_str.lower() == "me":
        return "me"
    if cid_str.startswith("-100") or cid_str.startswith("-"):
        return int(cid_str)
    if cid_str.isdigit():
        return int(f"-100{cid_str}")
    return cid_str

async def stream_chunk_range(msg_id: int, chat_target, chunk_global_start: int, req_start: int, req_end: int, file_id: Optional[int] = None):
    cache_key = f"{chat_target}_{msg_id}"
    
    # 1. If in cache, yield requested sub-slice immediately (0 ms latency)
    if cache_key in chunk_cache:
        data = chunk_cache[cache_key]
        c_len = len(data)
        c_start = chunk_global_start
        c_end = c_start + c_len - 1
        
        y_start = max(c_start, req_start)
        y_end = min(c_end, req_end)
        if y_start <= y_end:
            s_start = y_start - c_start
            s_end = y_end - c_start + 1
            yield data[s_start:s_end]
        return

    # 2. Live streaming from Telegram MTProto packet by packet
    async with stream_semaphore:
        buffer = bytearray()
        part_offset = 0
        last_time = [time.time()]
        last_bytes = [0]
        
        try:
            async for chunk_part in tg_manager.download_chunk_stream(msg_id, chat_target):
                part_len = len(chunk_part)
                buffer.extend(chunk_part)
                
                if file_id and file_id in stream_progress:
                    info = stream_progress[file_id]
                    info["downloaded_bytes"] += part_len
                    now = time.time()
                    dt = now - last_time[0]
                    if dt >= 0.3:
                        db = len(buffer) - last_bytes[0]
                        if db > 0 and dt > 0:
                            info["speed_mbps"] = round((db / (1024 * 1024)) / dt, 2)
                        last_time[0] = now
                        last_bytes[0] = len(buffer)

                p_start = chunk_global_start + part_offset
                p_end = p_start + part_len - 1
                
                y_start = max(p_start, req_start)
                y_end = min(p_end, req_end)
                
                if y_start <= y_end:
                    s_start = y_start - p_start
                    s_end = y_end - p_start + 1
                    yield chunk_part[s_start:s_end]
                    
                part_offset += part_len
                
        except Exception as e:
            print(f"[WARN] stream_chunk_range error: {e}")
            
        data = bytes(buffer)
        if len(data) > 0:
            chunk_cache[cache_key] = data
            if len(chunk_cache) > 50:
                first_key = next(iter(chunk_cache))
                del chunk_cache[first_key]

async def get_cached_chunk_data(msg_id: int, chat_target, file_id: Optional[int] = None):
    cache_key = f"{chat_target}_{msg_id}"
    if cache_key in chunk_cache:
        data = chunk_cache[cache_key]
        if file_id and file_id in stream_progress:
            info = stream_progress[file_id]
            t_b = info.get("total_bytes") or len(data)
            info["downloaded_bytes"] = min(t_b, info["downloaded_bytes"] + len(data))
        return data
        
    buf = bytearray()
    async for piece in stream_chunk_range(msg_id, chat_target, 0, 0, 10**12, file_id):
        buf.extend(piece)
    return bytes(buf)

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    for temp_file in TEMP_DIR.glob("*.tmp"):
        try: temp_file.unlink()
        except OSError: pass

    async def init_tg_background():
        try:
            await tg_manager.init_client()
        except Exception as e:
            pass
            
    asyncio.create_task(init_tg_background())
    yield
    
    if tg_manager.app and getattr(tg_manager.app, "is_connected", False):
        try: await tg_manager.app.disconnect()
        except Exception: pass

app = FastAPI(title="CrowGram Cloud Storage", lifespan=lifespan)

@app.middleware("http")
async def add_no_cache_headers(request: Request, call_next):
    response = await call_next(request)
    if request.url.path == "/" or request.url.path.startswith("/static/"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

app.mount("/static", StaticFiles(directory=str(WEB_DIR / "static")), name="static")
app.mount("/locales", StaticFiles(directory=str(LOCALES_DIR)), name="locales")
app.mount("/plugins", StaticFiles(directory=str(PLUGINS_DIR)), name="plugins")
app.mount("/themes", StaticFiles(directory=str(THEMES_DIR)), name="themes")

upload_tasks = {}

async def push_sync_background():
    if tg_manager.is_authorized():
        for _ in range(5):
            try:
                data = export_db_to_json()
                await tg_manager.push_sync(data)
                break
            except Exception:
                await asyncio.sleep(0.5)

@app.get("/api/stream/status/{file_id}")
async def get_stream_status(file_id: int):
    file_info = get_file_info(file_id)
    total_bytes = file_info["size"] if file_info else 0
    
    if file_id not in stream_progress:
        stream_progress[file_id] = {
            "downloaded_bytes": 0,
            "total_bytes": total_bytes,
            "speed_mbps": 0.0
        }
        
    info = stream_progress[file_id]
    if total_bytes > 0 and info.get("total_bytes", 0) == 0:
        info["total_bytes"] = total_bytes

    if file_info:
        chunks = get_file_chunks(file_id)
        drive = get_drive_info(file_info["drive_id"])
        if drive:
            chat_target = parse_peer_id(drive["tg_chat_id"])
            cached_bytes = 0
            for c in chunks:
                ck = f"{chat_target}_{c['message_id']}"
                if ck in chunk_cache:
                    cached_bytes += len(chunk_cache[ck])
            if cached_bytes > info["downloaded_bytes"]:
                info["downloaded_bytes"] = cached_bytes

    t_b = info.get("total_bytes") or total_bytes
    d_b = min(t_b, info.get("downloaded_bytes", 0)) if t_b > 0 else info.get("downloaded_bytes", 0)
    percent = min(100, int((d_b / t_b) * 100)) if t_b > 0 else 0
    
    return JSONResponse(content={
        "downloaded_mb": round(d_b / (1024 * 1024), 1),
        "total_mb": round(t_b / (1024 * 1024), 1),
        "percent": percent,
        "speed_mbps": info.get("speed_mbps", 0.0)
    })

@app.get("/api/local/drives")
async def get_local_drives():
    drives = []
    if os.name == 'nt':
        for drive_letter in string.ascii_uppercase:
            drive_path = f"{drive_letter}:\\"
            if os.path.exists(drive_path):
                drives.append({"path": drive_path, "label": f"Локальный диск ({drive_letter}:)"})
    else:
        drives.append({"path": "/", "label": "Корневой каталог (/)"})
        user_home = str(Path.home())
        drives.append({"path": user_home, "label": f"Домашняя папка (~)"})
    return JSONResponse(content=drives)

def _scan_dir_safe(target_path: Path):
    items = []
    try:
        with os.scandir(target_path) as scan:
            for entry in scan:
                try:
                    is_dir = entry.is_dir(follow_symlinks=False)
                    stat = entry.stat(follow_symlinks=False)
                    items.append({
                        "id": str(entry.path),
                        "name": entry.name,
                        "path": str(Path(entry.path).resolve()),
                        "is_folder": is_dir,
                        "size": stat.st_size if not is_dir else 0,
                        "created_at": stat.st_mtime * 1000
                    })
                except (PermissionError, OSError):
                    continue
    except Exception:
        pass
    return items

@app.get("/api/local/list")
async def list_local_directory(path: str = Query(...)):
    target_path = Path(path).resolve()
    if not target_path.exists() or not target_path.is_dir():
        raise HTTPException(status_code=404, detail="Директория не найдена")

    items = await asyncio.to_thread(_scan_dir_safe, target_path)
    return JSONResponse(content={
        "current_path": str(target_path),
        "parent_path": str(target_path.parent) if target_path != target_path.parent else None,
        "items": items
    })

@app.post("/api/local/mkdir")
async def create_local_folder(path: str = Form(...), name: str = Form(...)):
    target_path = Path(path).resolve() / name
    try:
        target_path.mkdir(parents=True, exist_ok=True)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/local/upload-to-cloud")
async def upload_local_file_to_cloud(
    local_path: str = Form(...),
    parent_id: int = Form(0),
    drive_id: int = Form(1)
):
    source_file = Path(local_path).resolve()
    if not source_file.exists() or not source_file.is_file():
        raise HTTPException(status_code=404, detail="Локальный файл не найден")

    drive = get_drive_info(drive_id)
    if not drive: raise HTTPException(status_code=400, detail="Диск не найден")

    file_size = source_file.stat().st_size
    chunk_size_setting = get_config("chunk_size")
    chunk_size = int(chunk_size_setting) if chunk_size_setting else CHUNK_SIZE_BYTES
    chat_target = parse_peer_id(drive["tg_chat_id"])

    chunks_data_to_save = []
    with open(source_file, "rb") as f:
        chunk_index = 0
        while True:
            chunk_data = f.read(chunk_size)
            if not chunk_data: break

            task_id = str(uuid.uuid4())
            chunk_file_path = TEMP_DIR / f"temp_{task_id}_{chunk_index}.tmp"
            sha256 = hashlib.sha256(chunk_data).hexdigest()

            with open(chunk_file_path, "wb") as cf:
                cf.write(chunk_data)

            msg_id = await tg_manager.upload_chunk(chunk_file_path, chat_target)
            chunks_data_to_save.append({"index": chunk_index, "msg_id": msg_id, "size": len(chunk_data), "sha256": sha256})

            if chunk_file_path.exists(): chunk_file_path.unlink()
            chunk_index += 1

    file_id = add_file_record(source_file.name, file_size, parent_id, "", drive_id)
    for c in chunks_data_to_save:
        add_chunk_record(file_id, c["index"], c["msg_id"], c["size"], c["sha256"])

    asyncio.create_task(push_sync_background())
    return {"status": "success", "file_id": file_id}

@app.post("/api/local/download-from-cloud")
async def download_cloud_file_to_local(
    file_id: int = Form(...),
    target_dir: str = Form(...)
):
    file_info = get_file_info(file_id)
    if not file_info or file_info["is_folder"]:
        raise HTTPException(status_code=404, detail="Файл не найден в облаке")

    drive = get_drive_info(file_info["drive_id"])
    if not drive: raise HTTPException(status_code=400, detail="Диск не найден")

    out_dir = Path(target_dir).resolve()
    if not out_dir.exists() or not out_dir.is_dir():
        raise HTTPException(status_code=400, detail="Целевая папка на ПК не существует")

    dest_file_path = out_dir / file_info["name"]
    chunks = get_file_chunks(file_id)
    chat_target = parse_peer_id(drive["tg_chat_id"])

    with open(dest_file_path, "wb") as out_f:
        for chunk_info in chunks:
            chunk_bytes = await get_cached_chunk_data(chunk_info["message_id"], chat_target, file_id)
            out_f.write(chunk_bytes)

    return {"status": "success", "dest_path": str(dest_file_path)}

@app.post("/api/local/delete")
async def delete_local_file_or_folder(path: str = Form(...)):
    target_path = Path(path).resolve()
    if not target_path.exists():
        raise HTTPException(status_code=404, detail="Файл не найден")
    try:
        if target_path.is_dir():
            shutil.rmtree(target_path)
        else:
            target_path.unlink()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/sync/push")
async def api_sync_push():
    if not tg_manager.is_authorized():
        logger.warning("api_sync_push: Telegram client is not authorized")
        raise HTTPException(status_code=401, detail="Не авторизован в Telegram. Сначала войдите в аккаунт.")
    try:
        data = export_db_to_json()
        await tg_manager.push_sync(data)
        logger.info("api_sync_push: sync successfully pushed to Telegram")
        return {"status": "success", "message": "Структура дисков и файлов сохранена в Избранном (Saved Messages)!"}
    except Exception as e:
        logger.error(f"api_sync_push failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Ошибка сохранения в Telegram: {str(e)}")

@app.post("/api/sync/pull")
async def api_sync_pull():
    if not tg_manager.is_authorized():
        logger.warning("api_sync_pull: Telegram client is not authorized")
        raise HTTPException(status_code=401, detail="Не авторизован в Telegram. Сначала войдите в аккаунт.")
    try:
        data = await tg_manager.pull_sync()
        if data:
            import_db_from_json(data)
            logger.info("api_sync_pull: sync successfully imported from Telegram")
            return {"status": "success", "message": "База данных успешно восстановлена из Telegram!"}
        else:
            logger.warning("api_sync_pull: sync file (#crowgram_sync) not found")
            raise HTTPException(status_code=404, detail="Файл синхронизации (#crowgram_sync) не найден в Избранном Telegram.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"api_sync_pull failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Ошибка восстановления базы данных: {str(e)}")

@app.get("/api/backup/export")
async def api_backup_export():
    try:
        json_data = export_db_to_json()
        return Response(
            content=json_data,
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=crowgram_backup.json"}
        )
    except Exception as e:
        logger.error(f"api_backup_export error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/backup/import")
async def api_backup_import(file: UploadFile = File(...)):
    try:
        content = await file.read()
        import_db_from_json(content.decode("utf-8"))
        asyncio.create_task(push_sync_background())
        logger.info("api_backup_import: backup restored successfully")
        return {"status": "success", "message": "База данных успешно восстановлена из резервной копии!"}
    except Exception as e:
        logger.error(f"api_backup_import error: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Ошибка импорта: {str(e)}")

@app.get("/")
async def root(): 
    return FileResponse(WEB_DIR / "index.html")

@app.get("/api/plugins")
async def get_plugins():
    if not PLUGINS_DIR.exists():
        return JSONResponse(content=[])
    plugins = [f.name for f in PLUGINS_DIR.glob("*.js")]
    return JSONResponse(content=plugins)

@app.get("/api/config")
async def api_get_config():
    cfg = get_all_config()
    is_auth = tg_manager.is_authorized()
    cfg["is_authorized"] = is_auth
    if is_auth and getattr(tg_manager.app, "me", None):
        me = tg_manager.app.me
        cfg["tg_user"] = {
            "id": me.id,
            "first_name": me.first_name or "",
            "last_name": me.last_name or "",
            "username": me.username or "",
            "phone": me.phone_number or ""
        }
    else:
        cfg["tg_user"] = None
    return JSONResponse(content=cfg)

@app.post("/api/config")
async def api_set_config(
    api_id: str = Form(...), 
    api_hash: str = Form(...), 
    chunk_size: Optional[str] = Form(None),
    max_concurrent_uploads: Optional[str] = Form(None)
):
    clean_id = str(api_id).strip().replace('"', '').replace("'", "")
    clean_hash = str(api_hash).strip().replace('"', '').replace("'", "")
    set_config("api_id", clean_id)
    set_config("api_hash", clean_hash)
    if chunk_size: set_config("chunk_size", chunk_size.strip())
    if max_concurrent_uploads: set_config("max_concurrent_uploads", max_concurrent_uploads.strip())
    await tg_manager.init_client(force=True)
    return {"status": "success"}

async def process_auth_verify(code: str, phone: Optional[str] = None, phone_code_hash: Optional[str] = None):
    clean_code = str(code).strip().replace(" ", "").replace("-", "")
    target_phone = (phone or tg_manager.phone or get_config("phone") or "").strip().replace(" ", "").replace("-", "")
    target_hash = (phone_code_hash or getattr(tg_manager.sent_code_info, "phone_code_hash", None) or get_config("phone_code_hash") or "").strip()

    logger.info(f"Attempting sign_in with phone={target_phone}, hash={target_hash[:8] if target_hash else 'NONE'}..., code_length={len(clean_code)}")
    try:
        me = await tg_manager.sign_in(phone=target_phone, code=clean_code, phone_code_hash=target_hash)
        user_info = {
            "id": me.id,
            "first_name": me.first_name or "",
            "last_name": me.last_name or "",
            "username": me.username or "",
            "phone": me.phone_number or ""
        } if me else None
        logger.info(f"User signed in successfully: {user_info}")
        return {"status": "ok", "user": user_info, "authorized": True}
    except SessionPasswordNeeded:
        logger.info("SessionPasswordNeeded: 2FA required for user")
        return {"status": "2fa_required", "password_required": True, "message": "Требуется ввод 2FA пароля"}
    except Exception as e:
        err_type = type(e).__name__
        err_str = str(e)
        if "SESSION_PASSWORD_NEEDED" in err_str or "PasswordNeeded" in err_type or isinstance(e, SessionPasswordNeeded):
            return {"status": "2fa_required", "password_required": True, "message": "Требуется ввод 2FA пароля"}
        
        if "PHONE_CODE_INVALID" in err_str or err_type == "PhoneCodeInvalid":
            raise HTTPException(status_code=400, detail="Введён неверный код подтверждения")
        if "PHONE_CODE_EXPIRED" in err_str or err_type == "PhoneCodeExpired":
            raise HTTPException(status_code=400, detail="Срок действия кода истёк, запросите новый")
        
        msg = format_tg_error(e)
        logger.error(f"process_auth_verify error: {msg} (raw: {e})")
        raise HTTPException(status_code=400, detail=msg)

@app.post("/api/auth/send-code")
@app.post("/api/auth/send_code")
async def api_send_code(request: Request):
    phone = None
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        body = await request.json()
        phone = body.get("phone")
    else:
        form = await request.form()
        phone = form.get("phone")

    if not phone:
        raise HTTPException(status_code=400, detail="Номер телефона не указан")

    try:
        res = await tg_manager.send_code(phone.strip())
        logger.info(f"Auth code sent to phone: {phone.strip()[:6]}***")
        return res
    except Exception as e:
        msg = format_tg_error(e)
        logger.error(f"api_send_code error: {msg} (raw: {e})")
        raise HTTPException(status_code=400, detail=msg)

@app.post("/api/auth/verify_code")
@app.post("/api/auth/sign-in")
async def api_verify_code(request: Request):
    phone = None
    code = None
    phone_code_hash = None

    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        body = await request.json()
        phone = body.get("phone")
        code = body.get("code")
        phone_code_hash = body.get("phone_code_hash")
    else:
        form = await request.form()
        phone = form.get("phone")
        code = form.get("code")
        phone_code_hash = form.get("phone_code_hash")

    if not code:
        raise HTTPException(status_code=400, detail="Код подтверждения не передан")

    return await process_auth_verify(code=code, phone=phone, phone_code_hash=phone_code_hash)

@app.post("/api/auth/verify_password")
@app.post("/api/auth/password")
@app.post("/api/auth/check-password")
async def api_check_password(request: Request):
    password = None
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        body = await request.json()
        password = body.get("password")
    else:
        form = await request.form()
        password = form.get("password")

    if not password:
        raise HTTPException(status_code=400, detail="Пароль не указан")

    try:
        me = await tg_manager.check_password(password)
        user_info = {
            "id": me.id,
            "first_name": me.first_name or "",
            "last_name": me.last_name or "",
            "username": me.username or "",
            "phone": me.phone_number or ""
        } if me else None
        logger.info(f"2FA Password accepted for user: {user_info}")
        return {"status": "ok", "user": user_info, "authorized": True}
    except Exception as e:
        err_type = type(e).__name__
        err_str = str(e)
        if "PASSWORD_HASH_INVALID" in err_str or err_type == "PasswordHashInvalid":
            raise HTTPException(status_code=400, detail="Неверный облачный пароль")
        msg = format_tg_error(e)
        logger.error(f"api_check_password error: {msg} (raw: {e})")
        raise HTTPException(status_code=400, detail=msg)

@app.post("/api/auth/logout")
async def api_logout():
    try:
        await tg_manager.log_out()
        logger.info("User logged out from Telegram")
        return {"status": "success"}
    except Exception as e:
        msg = format_tg_error(e)
        logger.error(f"api_logout error: {msg} (raw: {e})")
        raise HTTPException(status_code=400, detail=msg)

@app.get("/api/drives")
async def api_get_drives():
    return JSONResponse(content=get_drives())

@app.post("/api/drives")
async def api_create_drive(
    letter: str = Form(...), 
    label: str = Form(...), 
    action: str = Form(...), 
    title: Optional[str] = Form(None), 
    tg_chat_id: Optional[str] = Form(None),
    icon: Optional[str] = Form("💽")
):
    if action == "create_new":
        if not title: raise HTTPException(status_code=400, detail="Нужно название канала")
        new_chat_id = await tg_manager.create_new_channel(title)
        if not new_chat_id: raise HTTPException(status_code=500, detail="Ошибка создания канала")
        add_drive(letter, label, new_chat_id, icon=icon)
    else:
        if not tg_chat_id or not validate_chat_id(tg_chat_id): 
            raise HTTPException(status_code=400, detail="Неверный формат ID канала или канал не выбран")
        add_drive(letter, label, tg_chat_id.strip(), icon=icon)
    asyncio.create_task(push_sync_background())
    return {"status": "success"}

@app.get("/api/files")
async def list_files(drive_id: int = Query(1)):
    return JSONResponse(content=list_files_db(drive_id))

@app.get("/api/trash/files")
async def list_trash_files():
    return JSONResponse(content=list_trash_db())

@app.post("/api/trash/empty")
async def empty_trash():
    tasks = empty_trash_db()
    for tg_chat_id, msg_ids in tasks.items():
        asyncio.create_task(tg_manager.delete_messages_batch(tg_chat_id, msg_ids))
    asyncio.create_task(push_sync_background())
    return {"status": "success"}

@app.post("/api/folders")
async def create_folder(name: str = Form(...), parent_id: Optional[str] = Form(0), drive_id: int = Form(1)):
    p_id = int(parent_id) if parent_id and str(parent_id).isdigit() else 0
    folder_id = add_folder_record(name.strip(), p_id, drive_id)
    asyncio.create_task(push_sync_background())
    return {"status": "success", "id": folder_id}

@app.get("/api/upload/status/{task_id}")
async def get_upload_task_status(task_id: str):
    if task_id not in upload_tasks:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    return JSONResponse(content=upload_tasks[task_id])

@app.post("/api/upload")
async def upload_file(
    file: UploadFile = File(...), 
    parent_id: Optional[str] = Form(0), 
    drive_id: int = Form(1), 
    thumbnail: Optional[str] = Form("")
):
    if not tg_manager.is_authorized(): 
        raise HTTPException(status_code=401, detail="Не авторизован в Telegram")
        
    drive = get_drive_info(drive_id)
    if not drive: raise HTTPException(status_code=400, detail="Диск не найден")
    
    p_id = int(parent_id) if parent_id and str(parent_id).isdigit() else 0
    thumb = thumbnail if thumbnail and thumbnail != "null" else ""
    
    task_id = str(uuid.uuid4())
    temp_path = TEMP_DIR / f"full_temp_{task_id}.tmp"
    
    with open(temp_path, "wb") as f:
        while True:
            content = await file.read(1024 * 1024 * 5)
            if not content: break
            f.write(content)
            
    file_size = temp_path.stat().st_size
    chunk_size_setting = get_config("chunk_size")
    chunk_size = int(chunk_size_setting) if chunk_size_setting else CHUNK_SIZE_BYTES
    total_chunks = max(1, (file_size + chunk_size - 1) // chunk_size) if file_size > 0 else 1
    chat_target = parse_peer_id(drive["tg_chat_id"])

    upload_tasks[task_id] = {
        "task_id": task_id,
        "status": "uploading_to_tg",
        "filename": file.filename,
        "total_size": file_size,
        "chunk_size": chunk_size,
        "total_chunks": total_chunks,
        "current_chunk": 1,
        "completed_chunks": 0,
        "uploaded_bytes": 0,
        "percent": 0,
        "speed_mbps": 0.0,
        "speed_text": "0.0 MB/s",
        "error": None,
        "file_id": None
    }

    async def background_uploader():
        task = upload_tasks[task_id]
        try:
            chunks_data_to_save = []
            completed_bytes = 0
            
            with open(temp_path, "rb") as f:
                chunk_index = 0
                while True:
                    if task.get("is_cancelled"):
                        task["status"] = "cancelled"
                        return
                        
                    chunk_data = f.read(chunk_size)
                    if not chunk_data:
                        break
                    
                    chunk_len = len(chunk_data)
                    task["current_chunk"] = chunk_index + 1
                    chunk_file_path = TEMP_DIR / f"temp_{task_id}_{chunk_index}.tmp"
                    sha256 = hashlib.sha256(chunk_data).hexdigest()
                    
                    with open(chunk_file_path, "wb") as cf:
                        cf.write(chunk_data)
                    
                    last_progress_time = [time.time()]
                    last_progress_bytes = [0]
                    
                    def chunk_progress(current, total, *args):
                        task["uploaded_bytes"] = completed_bytes + current
                        if file_size > 0:
                            task["percent"] = min(99, int((task["uploaded_bytes"] / file_size) * 100))
                        now = time.time()
                        dt = now - last_progress_time[0]
                        if dt >= 0.3:
                            db = current - last_progress_bytes[0]
                            if db > 0:
                                speed = round((db / (1024 * 1024)) / dt, 2)
                                task["speed_mbps"] = speed
                                task["speed_text"] = f"{speed:.1f} MB/s" if speed >= 1.0 else f"{speed * 1024:.0f} KB/s"
                            last_progress_time[0] = now
                            last_progress_bytes[0] = current

                    msg_id = await tg_manager.upload_chunk(chunk_file_path, chat_target, progress_callback=chunk_progress)
                    chunks_data_to_save.append({
                        "index": chunk_index,
                        "msg_id": msg_id,
                        "size": chunk_len,
                        "sha256": sha256
                    })
                    
                    if chunk_file_path.exists():
                        chunk_file_path.unlink()
                        
                    completed_bytes += chunk_len
                    task["completed_chunks"] = chunk_index + 1
                    task["uploaded_bytes"] = completed_bytes
                    if file_size > 0:
                        task["percent"] = min(99, int((completed_bytes / file_size) * 100))
                    chunk_index += 1

            file_id = add_file_record(file.filename, file_size, p_id, thumb, drive_id)
            for c in chunks_data_to_save:
                add_chunk_record(file_id, c["index"], c["msg_id"], c["size"], c["sha256"])
                
            task["file_id"] = file_id
            task["status"] = "done"
            task["percent"] = 100
            task["uploaded_bytes"] = file_size
            task["completed_chunks"] = total_chunks
            task["speed_mbps"] = 0.0
            task["speed_text"] = ""
            asyncio.create_task(push_sync_background())
        except Exception as e:
            task["status"] = "error"
            task["error"] = str(e)
            print(f"[ERROR upload task {task_id}]: {traceback.format_exc()}")
        finally:
            if temp_path.exists():
                try: temp_path.unlink()
                except: pass

    asyncio.create_task(background_uploader())
    return {
        "status": "processing",
        "task_id": task_id,
        "total_chunks": total_chunks,
        "total_size": file_size,
        "chunk_size": chunk_size
    }

@app.get("/api/download/{file_id}")
async def download_file(file_id: int):
    file_info = get_file_info(file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="Файл не найден")
        
    if file_info.get("is_folder"):
        raise HTTPException(status_code=400, detail="Для скачивания папки используйте ZIP")

    drive = get_drive_info(file_info["drive_id"])
    if not drive: raise HTTPException(status_code=400, detail="Диск не найден")
        
    file_size = file_info["size"]
    mime_type, _ = mimetypes.guess_type(file_info["name"])
    media_type = mime_type or "application/octet-stream"

    if file_size == 0: return Response(content=b"", media_type=media_type)

    chunks = get_file_chunks(file_id)
    chat_target = parse_peer_id(drive["tg_chat_id"])
    
    async def full_streamer():
        current_pos = 0
        for chunk_info in chunks:
            chunk_size = chunk_info.get("size") or chunk_info.get("chunk_size") or CHUNK_SIZE_BYTES
            async for piece in stream_chunk_range(
                chunk_info["message_id"],
                chat_target,
                chunk_global_start=current_pos,
                req_start=0,
                req_end=file_size - 1,
                file_id=file_id
            ):
                yield piece
            current_pos += chunk_size
                
    encoded_name = quote(file_info["name"])
    headers = {
        "Content-Length": str(file_size),
        "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_name}"
    }
    return StreamingResponse(full_streamer(), status_code=200, headers=headers, media_type=media_type)

@app.get("/api/stream/{file_id}")
async def stream_file(file_id: int, request: Request):
    file_info = get_file_info(file_id)
    if not file_info or file_info["is_folder"]:
        raise HTTPException(status_code=404, detail="Файл не найден")
        
    drive = get_drive_info(file_info["drive_id"])
    if not drive: raise HTTPException(status_code=400, detail="Диск не найден")
        
    file_size = file_info["size"]
    mime_type, _ = mimetypes.guess_type(file_info["name"])
    media_type = mime_type or "application/octet-stream"

    if file_size == 0: return Response(content=b"", media_type=media_type)

    chunks = get_file_chunks(file_id)
    chat_target = parse_peer_id(drive["tg_chat_id"])
    
    range_header = request.headers.get("Range")
    start = 0
    end = file_size - 1
    
    if range_header:
        match = re.match(r"bytes=(\d+)-(\d*)", range_header)
        if match:
            start = int(match.group(1))
            if match.group(2):
                end = int(match.group(2))

    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(end - start + 1),
        "Content-Type": media_type,
        "Cache-Control": "public, max-age=86400",
    }
    status_code = 206 if range_header else 200

    async def range_streamer():
        current_pos = 0
        for chunk_info in chunks:
            chunk_size = chunk_info.get("size") or chunk_info.get("chunk_size") or CHUNK_SIZE_BYTES
            chunk_start = current_pos
            chunk_end = current_pos + chunk_size - 1
            
            if chunk_end < start:
                current_pos += chunk_size
                continue
            if chunk_start > end:
                break
                
            async for piece in stream_chunk_range(
                chunk_info["message_id"],
                chat_target,
                chunk_global_start=chunk_start,
                req_start=start,
                req_end=end,
                file_id=file_id
            ):
                yield piece
                
            current_pos += chunk_size

    return StreamingResponse(range_streamer(), status_code=status_code, headers=headers, media_type=media_type)

@app.get("/api/download-zip")
async def download_zip(ids: str = Query(...)):
    file_ids = [int(i) for i in ids.split(",") if i.isdigit()]
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for fid in file_ids:
            file_info = get_file_info(fid)
            if not file_info or file_info["is_folder"]: continue
            drive = get_drive_info(file_info["drive_id"])
            if not drive: continue
            
            chunks = get_file_chunks(fid)
            chat_target = parse_peer_id(drive["tg_chat_id"])
            file_data = bytearray()
            for chunk_info in chunks:
                chunk_bytes = await get_cached_chunk_data(chunk_info["message_id"], chat_target, fid)
                file_data.extend(chunk_bytes)
            zip_file.writestr(file_info["name"], bytes(file_data))
            
    zip_buffer.seek(0)
    headers = {"Content-Disposition": "attachment; filename=archive.zip"}
    return StreamingResponse(zip_buffer, media_type="application/zip", headers=headers)

@app.post("/api/files/{file_id}/trash")
async def move_to_trash(file_id: int, is_folder: bool = Query(False)):
    move_to_trash_db(file_id, is_folder=is_folder)
    asyncio.create_task(push_sync_background())
    return {"status": "success"}

# ВОССТАНОВЛЕННЫЙ ЭНДПОИНТ МАССОВОГО УДАЛЕНИЯ В КОРЗИНУ
@app.post("/api/files/batch-trash")
async def batch_trash(ids: List[int] = Form(...)):
    for fid in ids:
        move_to_trash_db(fid)
    asyncio.create_task(push_sync_background())
    return {"status": "success"}

@app.post("/api/files/{file_id}/favorite")
async def toggle_favorite(file_id: int, state: int = Form(...)):
    toggle_favorite_db(file_id, state)
    asyncio.create_task(push_sync_background())
    return {"status": "success"}

@app.post("/api/files/{file_id}/move")
async def move_item(
    file_id: int, 
    new_parent_id: int = Form(...), 
    new_drive_id: Optional[int] = Form(None)
):
    move_item_db(file_id, new_parent_id, new_drive_id)
    asyncio.create_task(push_sync_background())
    return {"status": "success"}

@app.post("/api/files/{file_id}/copy")
async def copy_item(
    file_id: int, 
    new_parent_id: int = Form(0), 
    new_drive_id: Optional[int] = Form(None),
    is_folder: bool = Form(False)
):
    new_id = copy_item_db(file_id, new_parent_id, new_drive_id, is_folder=is_folder)
    if new_id is None:
        raise HTTPException(status_code=404, detail="Файл не найден")
    asyncio.create_task(push_sync_background())
    return {"status": "success", "new_file_id": new_id}

if __name__ == "__main__":
    port = find_free_port(DEFAULT_PORT)
    threading.Timer(1.2, open_browser, args=[port]).start()
    uvicorn.run("app:app", host=DEFAULT_HOST, port=port, reload=False)
