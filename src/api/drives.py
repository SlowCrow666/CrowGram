from fastapi import APIRouter, Form, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional
import sys
import re
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
from src.core.db import (
    get_drives, add_drive, update_drive_db, delete_drive_db
)
from src.core.telegram_client import tg_manager

router = APIRouter(prefix="/api", tags=["Drives"])

def validate_chat_id(chat_id: str) -> bool:
    if not chat_id: return False
    chat_id = chat_id.strip()
    if chat_id.lower() == "me": return True
    if re.match(r"^-?\d+$", chat_id): return True
    if re.match(r"^@?[a-zA-Z0-9_]+$", chat_id): return True
    return False

@router.get("/drives")
async def api_get_drives():
    return JSONResponse(content=get_drives())

@router.post("/drives")
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
    return {"status": "success"}

@router.put("/drives/{drive_id}")
async def api_update_drive(drive_id: int, letter: str = Form(...), label: str = Form(...), icon: Optional[str] = Form("💽")):
    update_drive_db(drive_id, letter, label, icon=icon)
    return {"status": "success"}

@router.delete("/drives/{drive_id}")
async def api_delete_drive(drive_id: int):
    delete_drive_db(drive_id)
    return {"status": "success"}

@router.get("/tg/channels")
async def api_get_channels():
    try:
        if not tg_manager.is_authorized():
            return JSONResponse(status_code=400, content={"detail": "Telegram еще не подключен"})
        channels = await tg_manager.get_admin_channels()
        return JSONResponse(content=channels)
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})
