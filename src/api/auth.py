from fastapi import APIRouter, Form, HTTPException
from src.core.telegram_client import tg_manager
from src.core.db import get_config

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/send-code")
async def send_code(phone: str = Form(...)):
    phone_clean = phone.strip().replace(" ", "").replace("-", "")
    
    api_id = get_config("api_id")
    api_hash = get_config("api_hash")
    
    if not api_id or not api_hash:
        raise HTTPException(status_code=400, detail="Сначала сохраните API ID и API Hash на Шаге 1!")
        
    try:
        # Принудительно перезапускаем клиента с новыми ключами из БД
        await tg_manager.reinit_client(api_id, api_hash)
        result = await tg_manager.send_code(phone_clean)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Telegram ошибка: {str(e)}")

@router.post("/sign-in")
async def sign_in(code: str = Form(...)):
    try:
        result = await tg_manager.sign_in(code.strip())
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/password")
async def check_password(password: str = Form(...)):
    try:
        result = await tg_manager.check_password(password)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
