import logging
from pyrogram import Client
from src.core.db import get_config

logger = logging.getLogger("CrowGram_TG")

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

        clean_id = int(str(api_id_val).strip().replace('"', '').replace("'", ""))
        clean_hash = str(api_hash_val).strip().replace('"', '').replace("'", "")

        if self.app and getattr(self, "_current_id", None) == clean_id:
            if not self.app.is_connected:
                await self.app.connect()
            return

        if self.app:
            try:
                if self.app.is_connected:
                    await self.app.disconnect()
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
        await self.init_client()
        if not self.app:
            raise Exception("Не удалось инициализировать Telegram клиент")

        self.phone = phone
        res = await self.app.send_code(phone)
        self.phone_code_hash = res.phone_code_hash
        
        # Логируем тип доставки кода, который вернул Telegram
        code_type = getattr(res, "type", "Unknown")
        print(f"\n[TG RESPONSE] Код отправлен! Тип доставки Telegram: {code_type}\n")
        
        return {"status": "code_sent", "type": str(code_type)}

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
