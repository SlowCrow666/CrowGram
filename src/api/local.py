from fastapi import APIRouter, Form, HTTPException, Query
from fastapi.responses import JSONResponse
from pathlib import Path
import os
import string
import sys
import hashlib
import uuid

sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
from src.config import TEMP_DIR, CHUNK_SIZE_BYTES
from src.core.db import (
    get_file_info, get_drive_info, get_file_chunks, get_config,
    add_file_record, add_chunk_record
)
from src.core.telegram_client import tg_manager

router = APIRouter(prefix="/api/local", tags=["Local FS"])

def parse_peer_id(chat_id: str):
    cid_str = str(chat_id).strip()
    if cid_str.lower() == "me": return "me"
    if cid_str.startswith("-100") or cid_str.startswith("-"): return int(cid_str)
    if cid_str.isdigit(): return int(f"-100{cid_str}")
    return cid_str

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

@router.get("/drives")
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

@router.get("/list")
async def list_local_directory(path: str = Query(...)):
    target_path = Path(path).resolve()
    if not target_path.exists() or not target_path.is_dir():
        raise HTTPException(status_code=404, detail="Директория не найдена")

    import asyncio
    items = await asyncio.to_thread(_scan_dir_safe, target_path)
    return JSONResponse(content={
        "current_path": str(target_path),
        "parent_path": str(target_path.parent) if target_path != target_path.parent else None,
        "items": items
    })

@router.post("/mkdir")
async def create_local_folder(path: str = Form(...), name: str = Form(...)):
    target_path = Path(path).resolve() / name
    try:
        target_path.mkdir(parents=True, exist_ok=True)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload-to-cloud")
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
    chunk_size = int(get_config("chunk_size") or CHUNK_SIZE_BYTES)
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

    return {"status": "success", "file_id": file_id}

@router.post("/download-from-cloud")
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
            buffer = bytearray()
            async for chunk_bytes in tg_manager.download_chunk_stream(chunk_info["message_id"], chat_target):
                buffer.extend(chunk_bytes)
            out_f.write(bytes(buffer))

    return {"status": "success", "dest_path": str(dest_file_path)}
