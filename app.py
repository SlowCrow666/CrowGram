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
from typing import Optional
from pathlib import Path
from urllib.parse import quote
from contextlib import asynccontextmanager
import uvicorn
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query, Request, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse

import sys
sys.path.append(str(Path(__file__).resolve().parent))
from src.config import WEB_DIR, TEMP_DIR, LOCALES_DIR, DEFAULT_HOST, DEFAULT_PORT, CHUNK_SIZE_BYTES
from src.core.db import (
    init_db, set_config, get_config, get_all_config, add_file_record, 
    add_folder_record, add_chunk_record, list_files_db, list_trash_db, get_file_chunks, get_file_info,
    move_to_trash_db, restore_from_trash_db, delete_file_permanently_db, empty_trash_db,
    get_drives, add_drive, update_drive_db, delete_drive_db, get_drive_info, toggle_favorite_db, move_item_db, get_storage_stats,
    export_db_to_json, import_db_from_json, set_app_password, verify_app_password_db, get_password_recovery_info,
    get_plugin_defaults, set_plugin_default, remove_plugin_defaults_for_plugin
)
from src.core.telegram_client import tg_manager

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

def parse_plugin_info(plugin_path: Path):
    rel_file = plugin_path.name
    plugin_id = plugin_path.stem
    manifest_file = plugin_path.parent / f"{plugin_id}.json"
    
    info = {
        "file": rel_file,
        "name": plugin_id,
        "title": plugin_id,
        "version": "1.0.0",
        "description": "Плагин CrowGram",
        "category": "general",
        "author": "Разработчик"
    }
    
    if manifest_file.exists():
        try:
            data = json.loads(manifest_file.read_text(encoding="utf-8"))
            info.update({
                "title": data.get("title", plugin_id),
                "version": data.get("version", "1.0.0"),
                "description": data.get("description", "Плагин CrowGram"),
                "category": data.get("category", "general"),
                "author": data.get("author", "Разработчик")
            })
        except Exception:
            pass
    return info

async def get_cached_chunk_data(msg_id: int, chat_target, file_id: Optional[int] = None):
    cache_key = f"{chat_target}_{msg_id}"
    if cache_key in chunk_cache:
        data = chunk_cache[cache_key]
        if file_id and file_id in stream_progress:
            stream_progress[file_id]["downloaded_bytes"] += len(data)
        return data
        
    async with stream_semaphore:
        start_t = time.time()
        buffer = bytearray()
        
        try:
            async for chunk_bytes in tg_manager.download_chunk_stream(msg_id, chat_target):
                buffer.extend(chunk_bytes)
                if file_id and file_id in stream_progress:
                    elapsed = max(0.1, time.time() - start_t)
                    stream_progress[file_id]["downloaded_bytes"] += len(chunk_bytes)
                    stream_progress[file_id]["speed_mbps"] = round((len(chunk_bytes) / (1024 * 1024)) / elapsed, 2)
                    start_t = time.time()
        except Exception as e:
            print(f"[WARN] Ошибка потока, переподключение... {e}")
            await asyncio.sleep(1)
            await tg_manager.init_client()
            async for chunk_bytes in tg_manager.download_chunk_stream(msg_id, chat_target):
                buffer.extend(chunk_bytes)

        data = bytes(buffer)
        chunk_cache[cache_key] = data
            
        if len(chunk_cache) > 30:
            first_key = next(iter(chunk_cache))
            del chunk_cache[first_key]
            
        return data

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
app.mount("/static", StaticFiles(directory=WEB_DIR / "static"), name="static")
app.mount("/locales", StaticFiles(directory=LOCALES_DIR), name="locales")
app.mount("/plugins", StaticFiles(directory=PLUGINS_DIR), name="plugins")
app.mount("/themes", StaticFiles(directory=THEMES_DIR), name="themes")

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
    info = stream_progress.get(file_id, {"downloaded_bytes": 0, "total_bytes": 0, "speed_mbps": 0.0})
    percent = 0
    if info["total_bytes"] > 0:
        percent = min(100, int((info["downloaded_bytes"] / info["total_bytes"]) * 100))
    return JSONResponse(content={
        "downloaded_mb": round(info["downloaded_bytes"] / (1024 * 1024), 1),
        "total_mb": round(info["total_bytes"] / (1024 * 1024), 1),
        "percent": percent,
        "speed_mbps": info["speed_mbps"]
    })

@app.get("/api/stream/playlist/{file_id}.m3u")
async def get_vlc_playlist(file_id: int, request: Request):
    file_info = get_file_info(file_id)
    if not file_info: raise HTTPException(status_code=404, detail="Файл не найден")
    
    host = request.headers.get("host", f"{DEFAULT_HOST}:{DEFAULT_PORT}")
    stream_link = f"http://{host}/api/stream/{file_id}"
    
    content = f"#EXTM3U\n#EXTINF:-1,{file_info['name']}\n{stream_link}\n"
    headers = {
        "Content-Disposition": f"attachment; filename=\"stream.m3u\""
    }
    return Response(content=content, media_type="audio/x-mpegurl", headers=headers)

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

@app.get("/api/app-auth/status")
async def api_app_auth_status():
    recovery_info = get_password_recovery_info()
    return JSONResponse(content={
        "has_password": recovery_info["enabled"],
        "has_hint": bool(recovery_info["hint"]),
        "has_email": bool(recovery_info["email"])
    })

@app.post("/api/app-auth/verify")
async def api_app_auth_verify(password: str = Form(...)):
    if verify_app_password_db(password):
        return {"status": "success"}
    raise HTTPException(status_code=401, detail="Неверный пароль")

@app.post("/api/app-auth/recover")
async def api_app_auth_recover():
    info = get_password_recovery_info()
    if not info["enabled"]:
        return {"status": "error", "message": "Пароль не установлен"}

    sent_tg = False
    if tg_manager.is_authorized() and info["raw_password"]:
        try:
            msg_text = f"🔑 ** CrowGram Backup Password **\nВаш пароль от приложения: `{info['raw_password']}`"
            await tg_manager.app.send_message("me", msg_text)
            sent_tg = True
        except Exception:
            pass

    return {"status": "success", "hint": info["hint"], "sent_telegram": sent_tg, "email": info["email"]}

@app.post("/api/app-auth/setup")
async def api_app_auth_setup(
    enabled: bool = Form(...),
    password: Optional[str] = Form(""),
    password_confirm: Optional[str] = Form(""),
    hint: Optional[str] = Form(""),
    email: Optional[str] = Form(""),
    send_to_tg: Optional[bool] = Form(True)
):
    if enabled:
        if not password:
            raise HTTPException(status_code=400, detail="Пароль не может быть пустым")
        if password != password_confirm:
            raise HTTPException(status_code=400, detail="Пароли не совпадают")
        set_app_password(password, hint or "", email or "", enabled=True)
        if send_to_tg and tg_manager.is_authorized():
            try:
                msg_text = f"🔐 ** Пароль сохранен в CrowGram **\nПароль доступа к приложению: `{password}`\nПодсказка: _{hint}_"
                await tg_manager.app.send_message("me", msg_text)
            except Exception:
                pass
    else:
        set_app_password("", "", "", enabled=False)
    return {"status": "success"}

@app.post("/api/sync/push")
async def api_sync_push():
    asyncio.create_task(push_sync_background())
    return {"status": "success"}

@app.post("/api/sync/pull")
async def api_sync_pull():
    data = await tg_manager.pull_sync()
    if data:
        try:
            import_db_from_json(data)
            return {"status": "success", "message": "Синхронизировано"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Ошибка импорта базы данных: {str(e)}")
    return {"status": "error", "message": "Файл синхронизации не найден"}

@app.get("/")
async def root(): 
    return FileResponse(WEB_DIR / "index.html")

@app.get("/api/plugins")
async def get_plugins():
    if not PLUGINS_DIR.exists():
        return JSONResponse(content={"plugins": [], "defaults": {}})
    js_files = [f for f in PLUGINS_DIR.glob("*.js")]
    plugins_data = [parse_plugin_info(f) for f in js_files]
    defaults = get_plugin_defaults()
    for category in ["video", "audio", "text"]:
        if category not in defaults:
            cat_plugins = [p for p in plugins_data if p["category"] == category]
            if cat_plugins:
                set_plugin_default(category, cat_plugins[0]["name"])
                defaults[category] = cat_plugins[0]["name"]
    return JSONResponse(content={"plugins": plugins_data, "defaults": defaults})

@app.post("/api/plugins/upload")
async def upload_plugin(file: UploadFile = File(...)):
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Плагин должен быть запакован в .zip архив")
    temp_zip = TEMP_DIR / f"plugin_{uuid.uuid4()}.zip"
    with open(temp_zip, "wb") as f:
        f.write(await file.read())
    try:
        with zipfile.ZipFile(temp_zip, "r") as zip_ref:
            filenames = zip_ref.namelist()
            js_files = [f for f in filenames if f.endswith(".js") and not f.startswith("__MACOSX")]
            if not js_files:
                raise HTTPException(status_code=400, detail="Архив не содержит .js файла плагина")
            for member in zip_ref.infolist():
                if member.filename.startswith("/") or ".." in member.filename:
                    raise HTTPException(status_code=400, detail="Недопустимая структура архива (Path Traversal)")
            for member in zip_ref.infolist():
                if member.filename.endswith(".js") or member.filename.endswith(".json"):
                    filename = Path(member.filename).name
                    if filename:
                        target_path = PLUGINS_DIR / filename
                        with zip_ref.open(member) as source, open(target_path, "wb") as target:
                            shutil.copyfileobj(source, target)
    except Exception as e:
        if temp_zip.exists(): temp_zip.unlink()
        raise HTTPException(status_code=400, detail=f"Ошибка распаковки архива: {str(e)}")
    finally:
        if temp_zip.exists(): temp_zip.unlink()
    return {"status": "success", "message": "Плагин успешно установлен"}

@app.delete("/api/plugins/{plugin_name}")
async def delete_plugin(plugin_name: str):
    safe_name = re.sub(r'[^a-zA-Z0-9_-]', '', plugin_name)
    if not safe_name:
        raise HTTPException(status_code=400, detail="Неверное имя плагина")
    js_file = PLUGINS_DIR / f"{safe_name}.js"
    json_file = PLUGINS_DIR / f"{safe_name}.json"
    if js_file.exists(): js_file.unlink()
    if json_file.exists(): json_file.unlink()
    remove_plugin_defaults_for_plugin(safe_name)
    return {"status": "success", "message": "Плагин удален"}

@app.post("/api/plugins/default")
async def set_default_plugin_api(category: str = Form(...), plugin_name: str = Form(...)):
    set_plugin_default(category, plugin_name)
    return {"status": "success"}

@app.get("/api/config")
async def api_get_config():
    cfg = get_all_config()
    cfg["is_authorized"] = tg_manager.is_authorized()
    cfg["has_ffmpeg"] = check_ffmpeg_available()
    cfg["has_app_password"] = get_password_recovery_info()["enabled"]
    cfg["version"] = "2.0.0"
    cfg["api_version"] = "1.0"
    return JSONResponse(content=cfg)

@app.post("/api/config")
async def api_set_config(api_id: str=Form(...), api_hash: str=Form(...), chunk_size: Optional[str]=Form(None), max_concurrent_uploads: Optional[str]=Form(None)):
    clean_api_id = str(api_id).strip().replace('"', '').replace("'", "").replace(" ", "")
    clean_api_hash = str(api_hash).strip().replace('"', '').replace("'", "").replace(" ", "")

    set_config("api_id", clean_api_id)
    set_config("api_hash", clean_api_hash)
    if chunk_size: set_config("chunk_size", chunk_size.strip())
    if max_concurrent_uploads: set_config("max_concurrent_uploads", max_concurrent_uploads.strip())
    await tg_manager.init_client()
    return {"status": "success"}

@app.post("/api/auth/send-code")
async def api_send_code(phone: str = Form(...)):
    try:
        await tg_manager.send_code(phone.strip())
        return {"status": "code_sent"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/auth/sign-in")
async def api_sign_in(code: str = Form(...)):
    try:
        await tg_manager.sign_in(tg_manager.phone, code.strip())
        return {"status": "success"}
    except Exception as e:
        if "SESSION_PASSWORD_NEEDED" in str(e) or "PasswordNeeded" in str(type(e)):
            return {"status": "password_required"}
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/auth/password")
async def api_check_password(password: str = Form(...)):
    try:
        await tg_manager.check_password(password)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/drives")
async def api_get_drives():
    return JSONResponse(content=get_drives())

@app.post("/api/drives")
async def api_create_drive(letter: str=Form(...), label: str=Form(...), action: str=Form(...), title: Optional[str]=Form(None), tg_chat_id: Optional[str]=Form(None), icon: Optional[str]=Form("💽")):
    if action == "create_new":
        new_chat_id = await tg_manager.create_new_channel(title)
        add_drive(letter, label, new_chat_id, icon=icon)
    else:
        add_drive(letter, label, tg_chat_id.strip(), icon=icon)
    asyncio.create_task(push_sync_background())
    return {"status": "success"}

@app.put("/api/drives/{drive_id}")
async def api_update_drive(drive_id: int, letter: str=Form(...), label: str=Form(...), icon: Optional[str]=Form("💽")):
    update_drive_db(drive_id, letter, label, icon=icon)
    asyncio.create_task(push_sync_background())
    return {"status": "success"}

@app.delete("/api/drives/{drive_id}")
async def api_delete_drive(drive_id: int):
    delete_drive_db(drive_id)
    asyncio.create_task(push_sync_background())
    return {"status": "success"}

@app.get("/api/tg/channels")
async def api_get_channels():
    try:
        channels = await tg_manager.get_admin_channels()
        return JSONResponse(content=channels)
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})

@app.get("/api/stats")
async def api_stats():
    stats = get_storage_stats()
    items = list_files_db(1)
    files_cnt = sum(1 for i in items if not i.get("is_folder") and not i.get("in_trash"))
    folders_cnt = sum(1 for i in items if i.get("is_folder") and not i.get("in_trash"))
    return JSONResponse(content={"total_size": stats["total_size"], "files_count": files_cnt, "folders_count": folders_cnt})

@app.get("/api/files")
async def list_files(drive_id: int = Query(1)):
    return JSONResponse(content=list_files_db(drive_id))

@app.get("/api/trash/files")
async def list_trash_files():
    return JSONResponse(content=list_trash_db())

@app.post("/api/folders")
async def create_folder(name: str=Form(...), parent_id: Optional[str]=Form(0), drive_id: int=Form(1)):
    p_id = int(parent_id) if parent_id and str(parent_id).isdigit() else 0
    folder_id = add_folder_record(name.strip(), p_id, drive_id)
    asyncio.create_task(push_sync_background())
    return {"status": "success", "id": folder_id}

@app.get("/api/upload/status")
async def api_upload_status():
    return JSONResponse(content=upload_tasks)

@app.post("/api/upload")
async def upload_file(file: UploadFile=File(...), parent_id: Optional[str]=Form(0), drive_id: int=Form(1), thumbnail: Optional[str]=Form("")):
    drive = get_drive_info(drive_id)
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
    chunk_size = int(get_config("chunk_size") or CHUNK_SIZE_BYTES)
    
    upload_tasks[task_id] = {"status": "processing", "completed_bytes": 0, "current_chunk_bytes": 0, "total_size": file_size, "start_time": time.time(), "is_paused": False, "is_cancelled": False}
    
    async def background_upload():
        try:
            chunks_data_to_save = []
            completed_bytes = 0
            chat_target = parse_peer_id(drive["tg_chat_id"])
            with open(temp_path, "rb") as f:
                chunk_index = 0
                while True:
                    if upload_tasks[task_id]["is_cancelled"]:
                        upload_tasks[task_id]["status"] = "cancelled"
                        return
                    chunk_data = f.read(chunk_size)
                    if not chunk_data: break
                    chunk_file_path = TEMP_DIR / f"temp_{task_id}_{chunk_index}.tmp"
                    sha256 = hashlib.sha256(chunk_data).hexdigest()
                    with open(chunk_file_path, "wb") as cf: cf.write(chunk_data)
                        
                    async def progress_tracker(current, total):
                        upload_tasks[task_id]["current_chunk_bytes"] = current
                        
                    msg_id = await tg_manager.upload_chunk(chunk_file_path, chat_target, progress_callback=progress_tracker)
                    chunks_data_to_save.append({"index": chunk_index, "msg_id": msg_id, "size": len(chunk_data), "sha256": sha256})
                    if chunk_file_path.exists(): chunk_file_path.unlink()
                    completed_bytes += len(chunk_data)
                    upload_tasks[task_id]["completed_bytes"] = completed_bytes
                    upload_tasks[task_id]["current_chunk_bytes"] = 0
                    chunk_index += 1
            
            file_id = add_file_record(file.filename, file_size, p_id, thumb, drive_id)
            for c in chunks_data_to_save:
                add_chunk_record(file_id, c["index"], c["msg_id"], c["size"], c["sha256"])
            upload_tasks[task_id]["status"] = "done"
            asyncio.create_task(push_sync_background())
        except Exception as e: 
            upload_tasks[task_id]["status"] = "error"
            upload_tasks[task_id]["error"] = str(e)
        finally:
            if temp_path.exists(): temp_path.unlink()
    asyncio.create_task(background_upload())
    return {"status": "success", "task_id": task_id}

@app.post("/api/upload/cancel/{task_id}")
async def cancel_upload(task_id: str):
    if task_id in upload_tasks:
        upload_tasks[task_id]["is_cancelled"] = True
        upload_tasks[task_id]["status"] = "cancelled"
    return {"status": "success"}

@app.get("/api/download/{file_id}")
async def download_file(file_id: int):
    file_info = get_file_info(file_id)
    if not file_info or file_info["is_folder"]: raise HTTPException(status_code=404, detail="Файл не найден")
    drive = get_drive_info(file_info["drive_id"])
    file_size = file_info["size"]
    if file_size == 0: return Response(content=b"", media_type="application/octet-stream")

    chunks = get_file_chunks(file_id)
    chat_target = parse_peer_id(drive["tg_chat_id"])
    
    async def full_streamer():
        for chunk_info in chunks:
            chunk_data = await get_cached_chunk_data(chunk_info["message_id"], chat_target, file_id)
            yield chunk_data
                
    raw_name = re.sub(r'[\\/*?:"<>|]', '_', file_info["name"])
    ascii_fallback = raw_name.encode('ascii', 'ignore').decode('ascii').strip() or "file"
    encoded_utf8_name = quote(raw_name)
    headers = {"Content-Length": str(file_size), "Content-Disposition": f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{encoded_utf8_name}"}
    return StreamingResponse(full_streamer(), status_code=200, headers=headers, media_type="application/octet-stream")

@app.get("/api/stream/{file_id}")
async def stream_file(file_id: int, request: Request):
    file_info = get_file_info(file_id)
    if not file_info or file_info["is_folder"]: raise HTTPException(status_code=404, detail="Файл не найден")
    drive = get_drive_info(file_info["drive_id"])
    file_size = file_info["size"]
    mime_type, _ = mimetypes.guess_type(file_info["name"])
    media_type = mime_type or "video/mp4"

    if file_size == 0: return Response(content=b"", media_type=media_type)
    chunks = get_file_chunks(file_id)
    chat_target = parse_peer_id(drive["tg_chat_id"])
    
    stream_progress[file_id] = {"downloaded_bytes": 0, "total_bytes": file_size, "speed_mbps": 0.0}

    range_header = request.headers.get("Range")
    start = 0
    end = file_size - 1
    if range_header:
        match = re.match(r"bytes=(\d+)-(\d*)", range_header)
        if match:
            start = int(match.group(1))
            if match.group(2): end = int(match.group(2))

    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(end - start + 1),
        "Content-Type": media_type,
    }
    status_code = 206 if range_header else 200

    async def range_streamer():
        current_pos = 0
        for chunk_info in chunks:
            chunk_size = chunk_info.get("size") or chunk_info.get("chunk_size") or CHUNK_SIZE_BYTES
            if current_pos + chunk_size <= start:
                current_pos += chunk_size
                continue
            if current_pos > end: break
            data = await get_cached_chunk_data(chunk_info["message_id"], chat_target, file_id)
            data_len = len(data)
            yield_start = max(current_pos, start)
            yield_end = min(current_pos + data_len - 1, end)
            if yield_start <= yield_end:
                slice_start = yield_start - current_pos
                slice_end = yield_end - current_pos + 1
                yield data[slice_start:slice_end]
            current_pos += data_len
            if current_pos > end: break

    return StreamingResponse(range_streamer(), status_code=status_code, headers=headers, media_type=media_type)

@app.get("/api/transcode/{file_id}")
async def transcode_file(file_id: int, request: Request):
    return await stream_file(file_id, request)

@app.get("/api/download-zip")
async def download_zip(ids: str = Query(...), name: Optional[str] = Query("archive")):
    file_ids = [int(i) for i in ids.split(",") if i.isdigit()]
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for fid in file_ids:
            file_info = get_file_info(fid)
            if not file_info or file_info["is_folder"]: continue
            drive = get_drive_info(file_info["drive_id"])
            chat_target = parse_peer_id(drive["tg_chat_id"])
            chunks = get_file_chunks(fid)
            file_data = bytearray()
            for chunk_info in chunks:
                chunk_bytes = await get_cached_chunk_data(chunk_info["message_id"], chat_target, fid)
                file_data.extend(chunk_bytes)
            zip_file.writestr(file_info["name"], bytes(file_data))
    zip_buffer.seek(0)
    raw_name = re.sub(r'[\\/*?:"<>|]', '_', name.strip()) or "archive"
    ascii_fallback = raw_name.encode('ascii', 'ignore').decode('ascii').strip() or "archive"
    encoded_utf8_name = quote(f"{raw_name}.zip")
    headers = {"Content-Disposition": f"attachment; filename=\"{ascii_fallback}.zip\"; filename*=UTF-8''{encoded_utf8_name}"}
    return StreamingResponse(zip_buffer, media_type="application/zip", headers=headers)

@app.post("/api/files/{file_id}/trash")
async def move_to_trash(file_id: int):
    move_to_trash_db(file_id)
    asyncio.create_task(push_sync_background())
    return {"status": "success"}

@app.post("/api/files/{file_id}/restore")
async def restore_from_trash(file_id: int):
    restore_from_trash_db(file_id)
    asyncio.create_task(push_sync_background())
    return {"status": "success"}

@app.post("/api/files/{file_id}/favorite")
async def toggle_favorite(file_id: int, state: int = Form(...)):
    toggle_favorite_db(file_id, state)
    asyncio.create_task(push_sync_background())
    return {"status": "success"}

@app.post("/api/files/{file_id}/move")
async def move_item(file_id: int, new_parent_id: int = Form(...), new_drive_id: Optional[int] = Form(None)):
    move_item_db(file_id, new_parent_id, new_drive_id)
    asyncio.create_task(push_sync_background())
    return {"status": "success"}

@app.post("/api/files/batch-trash")
async def batch_trash(ids: list[int] = Form(...)):
    for fid in ids: move_to_trash_db(fid)
    asyncio.create_task(push_sync_background())
    return {"status": "success"}

@app.delete("/api/files/{file_id}/permanent")
async def delete_permanently(file_id: int):
    result = delete_file_permanently_db(file_id)
    if result and result["msg_ids"] and result["chat_id"]: 
        chat_target = parse_peer_id(result["chat_id"])
        await tg_manager.delete_messages(result["msg_ids"], chat_target)
    asyncio.create_task(push_sync_background())
    return {"status": "success"}

@app.delete("/api/trash/empty")
async def empty_trash():
    tasks = empty_trash_db()
    for chat_id, msg_ids in tasks.items():
        if msg_ids: 
            chat_target = parse_peer_id(chat_id)
            await tg_manager.delete_messages(msg_ids, chat_target)
    asyncio.create_task(push_sync_background())
    return {"status": "success"}

if __name__ == "__main__":
    port = find_free_port(DEFAULT_PORT)
    threading.Timer(1.2, open_browser, args=[port]).start()
    uvicorn.run("app:app", host=DEFAULT_HOST, port=port, reload=False)
