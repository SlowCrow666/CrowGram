import asyncio
from pyrogram import Client
from src.core.db import get_config

class TelegramManager:
    def __init__(self):
        self.app = None
        self.phone = None
        self.phone_code_hash = None

    def is_authorized(self):
        return self.app is not None and self.app.is_connected

    async def reinit_client(self, api_id_str: str, api_hash_str: str):
        if self.app:
            try:
                await self.app.stop()
            except Exception:
                pass
        
        clean_id = int(str(api_id_str).strip().replace('"', '').replace("'", ""))
        clean_hash = str(api_hash_str).strip().replace('"', '').replace("'", "")
        
        self.app = Client(
            "crowgram_session",
            api_id=clean_id,
            api_hash=clean_hash,
            in_memory=False
        )
        await self.app.connect()

    async def init_client(self):
        api_id = get_config("api_id")
        api_hash = get_config("api_hash")
        if api_id and api_hash:
            try:
                await self.reinit_client(api_id, api_hash)
            except Exception:
                pass

    async def send_code(self, phone: str):
        if not self.app or not self.app.is_connected:
            await self.init_client()
        self.phone = phone
        res = await self.app.send_code(phone)
        self.phone_code_hash = res.phone_code_hash
        return {"status": "code_sent"}

    async def sign_in(self, code: str):
        if not self.app or not self.phone or not self.phone_code_hash:
            raise Exception("Сессия не инициализирована")
        try:
            await self.app.sign_in(self.phone, self.phone_code_hash, code)
            return {"status": "success"}
        except Exception as e:
            if "SESSION_PASSWORD_NEEDED" in str(e):
                return {"status": "password_required"}
            raise e

    async def check_password(self, password: str):
        if not self.app:
            raise Exception("Сессия не инициализирована")
        await self.app.check_password(password)
        return {"status": "success"}

tg_manager = TelegramManager()
