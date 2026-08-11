import logging
from fastapi import APIRouter, Form, HTTPException
from src.core.telegram_client import tg_manager

logger = logging.getLogger("CrowGram_AuthAPI")
router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/send-code")
async def send_code(phone: str = Form(...)):
    phone_clean = phone.strip().replace(" ", "").replace("-", "")
    logger.info(f"API /send-code вызвана для номера {phone_clean}")
    try:
        result = await tg_manager.send_code(phone_clean)
        return result
    except Exception as e:
        logger.error(f"API /send-code сбой: {str(e)}")
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
