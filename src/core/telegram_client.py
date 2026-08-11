import os
import asyncio
import logging
from pathlib import Path
from pyrogram import Client
from src.core.db import get_config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("CrowGram_TG")

SESSION_NAME = "crowgram_session"
SESSION_FILE = Path(f"{SESSION_NAME}.session")

class TelegramManager:
    def __init__(self):
        self.app = None
        self.phone = None
        self.phone_code_hash = None
        self._current_api_id = None
        self._current_api_hash = None

    def is_authorized(self):
        return self.app is not None and self.app.is_connected

    async def ensure_client_initialized(self):
        api_id_val = get_config("api_id")
        api_hash_val = get_config("api_hash")

        if not api_id_val or not api_hash_val:
            logger.error("API ID или API Hash отсутствуют в SQLite базе данных!")
            raise Exception("API ID и API Hash не заданы! Вернитесь на Шаг 1.")

        try:
            clean_id = int(str(api_id_val).strip().replace('"', '').replace("'", ""))
            clean_hash = str(api_hash_val).strip().replace('"', '').replace("'", "")
        except ValueError:
            logger.error(f"Не удалось преобразовать API ID в число: {api_id_val}")
            raise Exception("API ID должен содержать только цифры!")

        logger.info(f"Инициализация Pyrogram с API_ID: {clean_id}")

        # Если ключи изменились или клиент не был инициализирован — сбрасываем старую сессию
        keys_changed = (self._current_api_id != clean_id) or (self._current_api_hash != clean_hash)
        
        if keys_changed and self.app:
            logger.info("Ключи API изменились, завершаем текущее подключение...")
            try:
                if self.app.is_connected:
                    await self.app.disconnect()
            except Exception as e:
                logger.warning(f"Ошибка при отключении старого клиента: {e}")
            self.app = None

        # Если изменились ключи и файл сессии существует — сносим его, чтобы Pyrogram не брал кэш
        if keys_changed and SESSION_FILE.exists():
            logger.info("Удаляем старый файл сессии для применения новых API ключей...")
            try:
                SESSION_FILE.unlink()
            except Exception as e:
                logger.warning(f"Не удалось удалить файл сессии: {e}")

        if not self.app:
            self.app = Client(
                SESSION_NAME,
                api_id=clean_id,
                api_hash=clean_hash,
                in_memory=False
            )
            self._current_api_id = clean_id
            self._current_api_hash = clean_hash

        if not self.app.is_connected:
            logger.info("Подключение к серверам Telegram...")
            await self.app.connect()

    async def init_client(self):
        try:
            await self.ensure_client_initialized()
        except Exception as e:
            logger.warning(f"Не удалось инициализировать клиент при старте: {e}")

    async def send_code(self, phone: str):
        logger.info(f"Запрос отправки SMS кода на номер: {phone}")
        await self.ensure_client_initialized()
        self.phone = phone
        
        try:
            res = await self.app.send_code(phone)
            self.phone_code_hash = res.phone_code_hash
            logger.info("Код успешно отправлен через Telegram API!")
            return {"status": "code_sent"}
        except Exception as e:
            logger.error(f"Ошибка вызова send_code в Pyrogram: {e}", exc_info=True)
            raise e

    async def sign_in(self, code: str):
        if not self.app or not self.phone or not self.phone_code_hash:
            raise Exception("Сессия авторизации не активна. Запросите код заново.")
        try:
            logger.info("Подтверждение кода авторизации...")
            await self.app.sign_in(self.phone, self.phone_code_hash, code)
            logger.info("Успешный вход в аккаунт!")
            return {"status": "success"}
        except Exception as e:
            if "SESSION_PASSWORD_NEEDED" in str(e):
                logger.info("Требуется облачный пароль (2FA)")
                return {"status": "password_required"}
            logger.error(f"Ошибка входа: {e}")
            raise e

    async def check_password(self, password: str):
        if not self.app:
            raise Exception("Сессия не инициализирована")
        logger.info("Проверка 2FA пароля...")
        await self.app.check_password(password)
        logger.info("2FA пароль подтвержден!")
        return {"status": "success"}

tg_manager = TelegramManager()
