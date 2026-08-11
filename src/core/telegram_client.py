import os
from pathlib import Path
from pyrogram import Client
from src.core.db import get_config

class TelegramManager:
    def __init__(self):
        self.app = None
        self.phone = None
        self.phone_code_hash = None

    def is_authorized(self):
        return self.app is not None and self.app.is_connected

    async def init_client(self):
        api_id_val = get_config("api_id")
        api_hash_val = get_config("api_hash")

        if not api_id_val or not api_hash_val:
            return

        try:
            clean_id = int(str(api_id_val).strip().replace('"', '').replace("'", ""))
            clean_hash = str(api_hash_val).strip().replace('"', '').replace("'", "")
        except ValueError:
            return

        # Если клиент уже запущен с этими ключами — ничего не пересоздаем
        if self.app and getattr(self, "_current_id", None) == clean_id:
            if not self.app.is_connected:
                await self.app.connect()
            return

        # Если клиент был — останавливаем
        if self.app:
            try:
                if self.app.is_connected:
                    await self.app.disconnect()
            except Exception:
                pass

        # Принудительно удаляем файл старой сессии, если ключи изменились
        session_file = Path("crowgram_session.session")
        if session_file.exists():
            try:
                session_file.unlink()
            except Exception:
                pass

        self.app = Client(
            "crowgram_session",
            api_id=clean_id,
            api_hash=clean_hash,
            in_memory=False
        )
        self._current_id = clean_id
        await self.app.connect()

    async def send_code(self, phone: str):
        # Перед отправкой кода ВСЕГДА подтягиваем свежие API_ID и API_HASH из БД
        await self.init_client()
        
        if not self.app:
            raise Exception("Не удалось инициализировать Telegram клиент. Проверьте API ID и API Hash!")

        self.phone = phone
        res = await self.app.send_code(phone)
        self.phone_code_hash = res.phone_code_hash
        return {"status": "code_sent"}

    async def sign_in(self, code: str):
        if not self.app or not self.phone or not self.phone_code_hash:
            raise Exception("Сессия не активна. Запросите код заново.")
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
