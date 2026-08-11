from fastapi import APIRouter, Form, HTTPException, Query, UploadFile, File
from fastapi.responses import JSONResponse, StreamingResponse
from typing import Optional, List
import sys
import uuid
import time
import hashlib
import traceback
import re
from pathlib import Path
from urllib.parse import quote

sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
from src.config import TEMP_DIR, CHUNK_SIZE_BYTES
from src.core.db import (
    get_storage_stats, list_files_db, list_trash_db, add_folder_record,
    get_drive_info, get_config, add_file_record, add_chunk_record,
    get_file_info, get_file_chunks, move_to_trash_db, restore_from_trash_db,
    toggle_favorite_db, move_item_db, delete_file_permanently_db, empty_trash_db,
    export_db_to_json, import_db_from_json
)
from src.core.telegram_client import tg_manager

router = APIRouter(prefix="/api", tags=["Files"])

upload_tasks = {}

def parse_peer_id(chat_id: str):
    cid_str = str(chat_id).strip()
    if cid_str.lower() == "me": return "me"
    if cid_str.startswith("-100") or cid_str.startswith("-"): return int(cid_str)
    if cid_str.isdigit(): return int(f"-100{cid_str}")
    return cid_str

@router.get("/stats")
async def api_stats():
    stats = get_storage_stats()
    items = list_files_db(1)
    files_cnt = sum(1 for i in items if not i.get("is_folder") and not i.get("in_trash"))
    folders_cnt = sum(1 for i in items if i.get("is_folder") and not i.get("in_trash"))
    return JSONResponse(content={"total_size": stats["total_size"], "files_count": files_cnt, "folders_count": folders_cnt})

@router.get("/files")
async def list_files(drive_id: int = Query(1)):
    return JSONResponse(content=list_files_db(drive_id))

@router.get("/trash/files")
async def list_trash_files():
    return JSONResponse(content=list_trash_db())

@router.post("/folders")
async def create_folder(name: str = Form(...), parent_id: Optional[str] = Form(0), drive_id: int = Form(1)):
    p_id = int(parent_id) if parent_id and str(parent_id).isdigit() else 0
    folder_id = add_folder_record(name.strip(), p_id, drive_id)
    return {"status": "success", "id": folder_id}

@router.get("/upload/status")
async def api_upload_status():
    return JSONResponse(content=upload_tasks)

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...), 
    parent_id: Optional[str] = Form(0), 
    drive_id: int = Form(1), 
    thumbnail: Optional[str] = Form("")
):
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
    chunk_size = int(get_config("chunk_size") or CHUNK_SIZE_BYTES)
    
    upload_tasks[task_id] = {
        "status": "processing", "completed_bytes": 0, "current_chunk_bytes": 0, 
        "total_size": file_size, "start_time": time.time(), "is_paused": False, "is_cancelled": False
    }
    
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
        except Exception as e: 
            upload_tasks[task_id]["status"] = "error"
            upload_tasks[task_id]["error"] = str(e)
        finally:
            if temp_path.exists(): temp_path.unlink()

    import asyncio
    asyncio.create_task(background_upload())
    return {"status": "success", "task_id": task_id}

@router.post("/upload/cancel/{task_id}")
async def cancel_upload(task_id: str):
    if task_id in upload_tasks:
        upload_tasks[task_id]["is_cancelled"] = True
        upload_tasks[task_id]["status"] = "cancelled"
    return {"status": "success"}

@router.post("/files/{file_id}/trash")
async def move_to_trash(file_id: int):
    move_to_trash_db(file_id)
    return {"status": "success"}

@router.post("/files/{file_id}/restore")
async def restore_from_trash(file_id: int):
    restore_from_trash_db(file_id)
    return {"status": "success"}

@router.post("/files/{file_id}/favorite")
async def toggle_favorite(file_id: int, state: int = Form(...)):
    toggle_favorite_db(file_id, state)
    return {"status": "success"}

@router.post("/files/{file_id}/move")
async def move_item(file_id: int, new_parent_id: int = Form(...), new_drive_id: Optional[int] = Form(None)):
    move_item_db(file_id, new_parent_id, new_drive_id)
    return {"status": "success"}

@router.post("/files/batch-trash")
async def batch_trash(ids: List[int] = Form(...)):
    for fid in ids: move_to_trash_db(fid)
    return {"status": "success"}

@router.delete("/files/{file_id}/permanent")
async def delete_permanently(file_id: int):
    result = delete_file_permanently_db(file_id)
    if result and result["msg_ids"] and result["chat_id"]: 
        chat_target = parse_peer_id(result["chat_id"])
        await tg_manager.delete_messages(result["msg_ids"], chat_target)
    return {"status": "success"}

@router.delete("/trash/empty")
async def empty_trash():
    tasks = empty_trash_db()
    for chat_id, msg_ids in tasks.items():
        if msg_ids: 
            chat_target = parse_peer_id(chat_id)
            await tg_manager.delete_messages(msg_ids, chat_target)
    return {"status": "success"}

@router.post("/sync/push")
async def api_sync_push():
    if tg_manager.is_authorized():
        data = export_db_to_json()
        await tg_manager.push_sync(data)
    return {"status": "success"}

@router.post("/sync/pull")
async def api_sync_pull():
    data = await tg_manager.pull_sync()
    if data:
        try:
            import_db_from_json(data)
            return {"status": "success", "message": "Синхронизировано"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Ошибка импорта базы данных: {str(e)}")
    return {"status": "error", "message": "Файл синхронизации не найден"}
