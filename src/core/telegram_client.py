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
            raise Exception("API ID и API Hash не найдены в базе. Вернитесь на Шаг 1.")

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

        if not self.app or not self.app.is_connected:
            raise Exception("Не удалось установить соединение с Telegram")

        self.phone = phone
        print(f"\n[TG API] Отправка запроса на код для {phone}...")
        
        # Запрашиваем код
        res = await self.app.send_code(phone)
        self.phone_code_hash = res.phone_code_hash
        
        # Если Telegram отдаёт старый хэш и не шлёт код, запрашиваем повторную отправку
        try:
            res_repeat = await self.app.resend_code(phone, self.phone_code_hash)
            self.phone_code_hash = res_repeat.phone_code_hash
            print(f"[TG API] Принудительный повтор отправки выполнен! Hash: {self.phone_code_hash}\n")
        except Exception as e:
            print(f"[TG API] Первичный код зафиксирован (resend не потребовался): {e}\n")

        return {"status": "code_sent"}

    async def sign_in(self, code: str):
        if not self.app or not self.phone or not self.phone_code_hash:
            raise Exception("Сессия истекла. Запросите код заново.")
        try:
            print(f"\n[TG API] Попытка входа с кодом {code}...")
            await self.app.sign_in(self.phone, self.phone_code_hash, code)
            print("[TG API] Авторизация успешна!\n")
            return {"status": "success"}
        except Exception as e:
            err_msg = str(e)
            print(f"[TG API] Ошибка при авторизации: {err_msg}\n")
            if "SESSION_PASSWORD_NEEDED" in err_msg:
                return {"status": "password_required"}
            raise e

    async def check_password(self, password: str):
        if not self.app:
            raise Exception("Сессия не инициализирована")
        print("\n[TG API] Проверка 2FA пароля...")
        await self.app.check_password(password)
        print("[TG API] 2FA пароль верен!\n")
        return {"status": "success"}

tg_manager = TelegramManager()
