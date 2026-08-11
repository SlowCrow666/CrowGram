from fastapi import APIRouter, Form, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
from src.core.db import (
    verify_app_password_db, get_password_recovery_info, set_app_password,
    get_all_config, set_config
)
from src.core.telegram_client import tg_manager

router = APIRouter(prefix="/api", tags=["Auth"])

@router.get("/app-auth/status")
async def api_app_auth_status():
    recovery_info = get_password_recovery_info()
    return JSONResponse(content={
        "has_password": recovery_info["enabled"],
        "has_hint": bool(recovery_info["hint"]),
        "has_email": bool(recovery_info["email"])
    })

@router.post("/app-auth/verify")
async def api_app_auth_verify(password: str = Form(...)):
    if verify_app_password_db(password):
        return {"status": "success"}
    raise HTTPException(status_code=401, detail="Неверный пароль")

@router.post("/app-auth/recover")
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

@router.post("/app-auth/setup")
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

@router.post("/auth/send-code")
async def api_send_code(phone: str = Form(...)):
    try:
        await tg_manager.send_code(phone.strip())
        return {"status": "code_sent"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/auth/sign-in")
async def api_sign_in(code: str = Form(...)):
    try:
        await tg_manager.sign_in(tg_manager.phone, code.strip())
        return {"status": "success"}
    except Exception as e:
        if "SESSION_PASSWORD_NEEDED" in str(e) or "PasswordNeeded" in str(type(e)):
            return {"status": "password_required"}
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/auth/password")
async def api_check_password(password: str = Form(...)):
    try:
        await tg_manager.check_password(password)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
