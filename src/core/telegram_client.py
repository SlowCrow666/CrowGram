import os
import asyncio
import sqlite3
import logging
from pathlib import Path
from pyrogram import Client
from pyrogram.enums import ChatType, ChatMemberStatus
try:
    from pyrogram.errors import SessionPasswordNeeded, FloodWait, PeerIdInvalid
except ImportError:
    SessionPasswordNeeded = Exception
    FloodWait = Exception
    PeerIdInvalid = Exception

from src.config import BASE_DIR

logger = logging.getLogger("CrowGram.Telegram")

def format_tg_error(e: Exception) -> str:
    err_str = str(e)
    err_type = type(e).__name__

    if "PHONE_NUMBER_INVALID" in err_str or err_type == "PhoneNumberInvalid":
        return "Неверный формат номера телефона. Введите номер в международном формате (+7...)."
    if "PHONE_CODE_INVALID" in err_str or err_type == "PhoneCodeInvalid":
        return "Неверный код подтверждения. Проверьте сообщение в Telegram и повторите ввод."
    if "PHONE_CODE_EXPIRED" in err_str or err_type == "PhoneCodeExpired":
        return "Срок действия кода подтверждения истёк. Запросите новый код."
    if "PASSWORD_HASH_INVALID" in err_str or err_type == "PasswordHashInvalid":
        return "Неверный облачный пароль (2FA). Пожалуйста, проверьте пароль."
    if "FLOOD_WAIT" in err_str or err_type == "FloodWait":
        seconds = getattr(e, "value", None) or getattr(e, "x", None) or 60
        return f"Слишком много попыток (FloodWait). Пожалуйста, подождите {seconds} сек."
    if "API_ID_INVALID" in err_str or "API_ID_PUBLISHED_FLOOD" in err_str or err_type == "ApiIdInvalid":
        return "Неверный API ID или API Hash. Проверьте данные на my.telegram.org."
    if "PHONE_NUMBER_UNREGISTERED" in err_str or err_type == "PhoneNumberUnregistered":
        return "Этот номер телефона не зарегистрирован в Telegram."
    if "SESSION_PASSWORD_NEEDED" in err_str or err_type == "SessionPasswordNeeded":
        return "Требуется ввод пароля двухфакторной аутентификации (2FA)."
    if "AUTH_KEY_UNREGISTERED" in err_str or err_type == "AuthKeyUnregistered":
        return "Сессия сброшена или недействительна. Пожалуйста, выполните вход заново."
    
    return err_str

class TelegramManager:
    def __init__(self):
        self.app = None
        self.session_name = "crowgram_session"
        self.api_id = None
        self.api_hash = None
        self.phone = None
        self.sent_code_info = None
        self._chat_cache = {}
        self._upload_semaphore = asyncio.Semaphore(3)
        self._auth_lock = asyncio.Lock()

    async def init_client(self, force: bool = False):
        async with self._auth_lock:
            from src.core.db import get_all_config
            cfg = get_all_config()
            self.api_id = cfg.get("api_id")
            self.api_hash = cfg.get("api_hash")
            
            if not self.api_id or not self.api_hash:
                logger.debug("init_client: API ID or API Hash not set in database")
                return

            try:
                clean_id = int(str(self.api_id).strip().replace('"', '').replace("'", ""))
                clean_hash = str(self.api_hash).strip().replace('"', '').replace("'", "")
            except ValueError:
                logger.error(f"Invalid API ID format: {self.api_id}")
                return
            
            if not force and self.app and self.app.is_connected and getattr(self, "_current_id", None) == clean_id:
                if not getattr(self.app, "me", None):
                    try: 
                        self.app.me = await self.app.get_me()
                    except Exception: 
                        pass
                return

            if self.app:
                try:
                    if self.app.is_connected:
                        await self.app.disconnect()
                except Exception as e:
                    logger.debug(f"Disconnect error on cleanup: {e}")
                self.app = None

            # Clean up stale temp or journal files
            for stale_f in BASE_DIR.glob("*temp*.session*"):
                try: stale_f.unlink()
                except Exception: pass
            for stale_f in BASE_DIR.glob("*.session-journal"):
                try: stale_f.unlink()
                except Exception: pass

            logger.info(f"Initializing Pyrogram client with api_id={clean_id} (Telegram Desktop 5.4.1 x64 emulation)")
            self.app = Client(
                name=self.session_name,
                api_id=clean_id,
                api_hash=clean_hash,
                device_model="Desktop",
                app_version="5.4.1 x64",
                system_version="Windows 10",
                lang_code="ru",
                workdir=str(BASE_DIR)
            )
            self._current_id = clean_id

            for attempt in range(5):
                try:
                    if not self.app.is_connected:
                        await self.app.connect()
                    self.app.me = await self.app.get_me()
                    logger.info(f"Telegram connected as: {self.app.me.first_name} (@{self.app.me.username})")
                    break
                except (sqlite3.OperationalError, Exception) as e:
                    if "locked" in str(e).lower() and attempt < 4:
                        await asyncio.sleep(0.5 * (attempt + 1))
                        continue
                    if not getattr(self.app, "is_connected", False):
                        logger.warning(f"init_client connection notice: {e}")
                    self.app.me = None
                    break

    def is_authorized(self):
        return bool(self.app and self.app.is_connected and getattr(self.app, "me", None) is not None)

    async def send_code(self, phone: str):
        await self.init_client()
        clean_phone = phone.strip().replace(" ", "").replace("-", "")
        self.phone = clean_phone
        
        async with self._auth_lock:
            if not self.app:
                raise Exception("Сначала укажите и сохраните API ID и API Hash")
            if not self.app.is_connected:
                await self.app.connect()
                
            for attempt in range(4):
                try:
                    logger.info(f"Sending authorization code to {clean_phone}...")
                    self.sent_code_info = await self.app.send_code(clean_phone)
                    logger.info(f"Code successfully sent to {clean_phone} (hash: {self.sent_code_info.phone_code_hash})")
                    break
                except Exception as e:
                    if "locked" in str(e).lower() and attempt < 3:
                        await asyncio.sleep(0.5 * (attempt + 1))
                        continue
                    logger.error(f"Error in send_code: {e}", exc_info=True)
                    raise e

        from src.core.db import set_config
        set_config("phone", clean_phone)
        set_config("phone_code_hash", self.sent_code_info.phone_code_hash)
        return {
            "status": "code_sent",
            "phone": clean_phone,
            "phone_code_hash": self.sent_code_info.phone_code_hash
        }

    async def sign_in(self, phone: str, code: str, phone_code_hash: str = None):
        from src.core.db import get_config
        target_hash = (phone_code_hash or getattr(self.sent_code_info, "phone_code_hash", None) or get_config("phone_code_hash") or "").strip()
        if not target_hash:
            raise Exception("Сначала запросите код на номер телефона (отсутствует phone_code_hash)")
        
        target_phone = (phone or self.phone or get_config("phone") or "").strip().replace(" ", "").replace("-", "")
        clean_code = str(code).strip().replace(" ", "").replace("-", "")

        logger.info(f"Attempting sign_in with phone={target_phone}, hash={target_hash}, code_length={len(clean_code)}")
        
        async with self._auth_lock:
            if not self.app:
                await self.init_client()
            if self.app and not self.app.is_connected:
                await self.app.connect()

            for attempt in range(4):
                try:
                    await self.app.sign_in(
                        phone_number=target_phone,
                        phone_code_hash=target_hash,
                        phone_code=clean_code
                    )
                    self.app.me = await self.app.get_me()
                    logger.info(f"Successfully signed in as {self.app.me.first_name} (ID: {self.app.me.id})")
                    return self.app.me
                except SessionPasswordNeeded:
                    logger.info("2FA Cloud Password required for account")
                    raise
                except Exception as e:
                    if "locked" in str(e).lower() and attempt < 3:
                        await asyncio.sleep(0.5 * (attempt + 1))
                        continue
                    logger.error(f"Error in sign_in: {e}", exc_info=True)
                    raise e

    async def check_password(self, password: str):
        async with self._auth_lock:
            if not self.app:
                await self.init_client()
            if self.app and not self.app.is_connected:
                await self.app.connect()

            for attempt in range(4):
                try:
                    logger.info("Submitting 2FA Cloud Password...")
                    await self.app.check_password(password)
                    self.app.me = await self.app.get_me()
                    logger.info(f"2FA verified! Logged in as {self.app.me.first_name}")
                    return self.app.me
                except Exception as e:
                    if "locked" in str(e).lower() and attempt < 3:
                        await asyncio.sleep(0.5 * (attempt + 1))
                        continue
                    logger.error(f"Error in check_password: {e}", exc_info=True)
                    raise e

    async def log_out(self):
        async with self._auth_lock:
            if self.app:
                try:
                    if self.app.is_connected:
                        await self.app.log_out()
                except Exception as e:
                    logger.warning(f"Error during log_out: {e}")
                self.app = None
                
            session_file = BASE_DIR / f"{self.session_name}.session"
            if session_file.exists():
                try: 
                    session_file.unlink()
                except Exception: 
                    pass
            logger.info("Telegram session cleared.")

    async def get_admin_channels(self):
        if not self.is_authorized(): return []
        channels = []
        try:
            async for dialog in self.app.get_dialogs():
                chat = dialog.chat
                if chat.type in [ChatType.CHANNEL, ChatType.SUPERGROUP, ChatType.GROUP]:
                    try:
                        member = await self.app.get_chat_member(chat.id, "me")
                        if member.status in [ChatMemberStatus.ADMINISTRATOR, ChatMemberStatus.OWNER]:
                            channels.append({"id": str(chat.id), "title": chat.title or "Без названия"})
                    except Exception:
                        pass
        except Exception as e:
            logger.warning(f"Error fetching admin channels: {e}")
        return channels

    async def create_new_channel(self, title: str):
        if not self.is_authorized(): return None
        chat = await self.app.create_channel(title, "Создано через CrowGram Cloud Storage")
        return str(chat.id)

    async def _resolve_chat(self, chat_id):
        target_key = str(chat_id).strip()
        if target_key in self._chat_cache:
            return self._chat_cache[target_key]

        target = int(target_key) if target_key.replace("-", "").isdigit() else target_key
        try:
            chat = await self.app.get_chat(target)
            self._chat_cache[target_key] = chat
            return chat
        except Exception:
            async for dialog in self.app.get_dialogs():
                if dialog.chat.id == target or str(dialog.chat.id) == target_key:
                    self._chat_cache[target_key] = dialog.chat
                    return dialog.chat
            raise

    async def upload_chunk(self, file_path, chat_id=None, progress_callback=None):
        if not getattr(self.app, "me", None):
            self.app.me = await self.app.get_me()
            
        if not self.app or not self.app.me:
            raise Exception("Сессия Telegram не авторизована")

        if chat_id is None:
            from src.core.db import get_config
            chat_id = get_config("target_chat")
            
        if not chat_id:
            raise Exception("Не указан целевой канал для загрузки")

        chat_entity = await self._resolve_chat(chat_id)

        async with self._upload_semaphore:
            msg = await self.app.send_document(
                chat_id=chat_entity.id, 
                document=str(file_path), 
                force_document=True, 
                disable_notification=True,
                progress=progress_callback
            )
            return msg.id

    async def download_chunk_stream(self, message_id, chat_id=None):
        if chat_id is None:
            from src.core.db import get_config
            chat_id = get_config("target_chat")
            
        chat_entity = await self._resolve_chat(chat_id)
        msg = await self.app.get_messages(chat_entity.id, message_id)
        if not msg or not msg.document: return
        async for chunk in self.app.stream_media(msg.document):
            yield chunk

    async def delete_messages(self, msg_ids, chat_id=None):
        if chat_id is None:
            from src.core.db import get_config
            chat_id = get_config("target_chat")
            
        if msg_ids and chat_id:
            chat_entity = await self._resolve_chat(chat_id)
            try:
                await self.app.delete_messages(chat_entity.id, msg_ids)
            except FloodWait as e:
                await asyncio.sleep(e.value)
                await self.app.delete_messages(chat_entity.id, msg_ids)

    async def push_sync(self, json_data: str):
        if not self.is_authorized(): 
            raise Exception("Сессия Telegram не авторизована для синхронизации")
        
        file_path = BASE_DIR / "crowgram_sync.json"
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(json_data)
        
        try:
            msg = await self.app.send_document(
                "me", 
                document=str(file_path), 
                file_name="crowgram_sync.json", 
                caption="#crowgram_sync"
            )
            logger.info("Sync snapshot successfully pushed to Telegram (Saved Messages)")
        finally:
            if file_path.exists():
                try: file_path.unlink()
                except Exception: pass
        
        try:
            async for m in self.app.search_messages("me", query="#crowgram_sync", limit=10):
                if m.id != msg.id:
                    try: await m.delete()
                    except Exception: pass
        except Exception:
            pass

    async def pull_sync(self):
        if not self.is_authorized(): 
            raise Exception("Сессия Telegram не авторизована для синхронизации")
            
        logger.info("Searching for #crowgram_sync in Saved Messages...")
        try:
            async for m in self.app.search_messages("me", query="#crowgram_sync", limit=20):
                if m.document and ("crowgram_sync" in (m.document.file_name or "")):
                    file_path = await self.app.download_media(m.document)
                    if not file_path: continue
                    try:
                        with open(file_path, "r", encoding="utf-8") as f:
                            data = f.read()
                        logger.info("Sync snapshot downloaded and read from Telegram")
                        return data
                    finally:
                        if os.path.exists(file_path):
                            try: os.remove(file_path)
                            except Exception: pass
        except Exception as e:
            logger.warning(f"search_messages failed: {e}, attempting get_chat_history fallback...")

        try:
            async for m in self.app.get_chat_history("me", limit=30):
                if m.document and ("crowgram_sync" in (m.document.file_name or "")):
                    file_path = await self.app.download_media(m.document)
                    if not file_path: continue
                    try:
                        with open(file_path, "r", encoding="utf-8") as f:
                            data = f.read()
                        logger.info("Sync snapshot downloaded via history fallback")
                        return data
                    finally:
                        if os.path.exists(file_path):
                            try: os.remove(file_path)
                            except Exception: pass
        except Exception as e:
            logger.error(f"get_chat_history fallback failed: {e}")

        return None

tg_manager = TelegramManager()

