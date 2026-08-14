import os
import asyncio
import sqlite3
from pathlib import Path
from pyrogram import Client
from pyrogram.enums import ChatType, ChatMemberStatus
from pyrogram.errors import SessionPasswordNeeded, FloodWait, PeerIdInvalid
from src.config import BASE_DIR

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
                return

            clean_id = int(str(self.api_id).strip().replace('"', '').replace("'", ""))
            clean_hash = str(self.api_hash).strip().replace('"', '').replace("'", "")
            
            if not force and self.app and self.app.is_connected and getattr(self, "_current_id", None) == clean_id:
                if not getattr(self.app, "me", None):
                    try: self.app.me = await self.app.get_me()
                    except Exception: pass
                return

            if self.app:
                try:
                    if self.app.is_connected:
                        await self.app.disconnect()
                except Exception:
                    pass
                self.app = None

            self.app = Client(self.session_name, api_id=clean_id, api_hash=clean_hash, workdir=str(BASE_DIR))
            self._current_id = clean_id

            for attempt in range(5):
                try:
                    if not self.app.is_connected:
                        await self.app.connect()
                    self.app.me = await self.app.get_me()
                    break
                except (sqlite3.OperationalError, Exception) as e:
                    if "locked" in str(e).lower() and attempt < 4:
                        await asyncio.sleep(0.5 * (attempt + 1))
                        continue
                    if not getattr(self.app, "is_connected", False):
                        print(f"[WARN] init_client error: {e}")
                    self.app.me = None
                    break

    def is_authorized(self):
        return bool(self.app and self.app.is_connected and getattr(self.app, "me", None) is not None)

    async def send_code(self, phone):
        await self.init_client()
        clean_phone = phone.strip().replace(" ", "").replace("-", "")
        self.phone = clean_phone
        
        async with self._auth_lock:
            if not self.app or not self.app.is_connected:
                await self.app.connect()
                
            for attempt in range(4):
                try:
                    self.sent_code_info = await self.app.send_code(clean_phone)
                    break
                except Exception as e:
                    if "locked" in str(e).lower() and attempt < 3:
                        await asyncio.sleep(0.5 * (attempt + 1))
                        continue
                    raise e

        from src.core.db import set_config
        set_config("phone", clean_phone)
        set_config("phone_code_hash", self.sent_code_info.phone_code_hash)
        return {"status": "code_sent"}

    async def sign_in(self, phone, code):
        from src.core.db import get_config
        phone_code_hash = getattr(self.sent_code_info, "phone_code_hash", None) or get_config("phone_code_hash")
        if not phone_code_hash:
            raise Exception("Сначала запросите код на номер телефона")
        target_phone = (phone or self.phone or get_config("phone") or "").strip().replace(" ", "").replace("-", "")
        
        async with self._auth_lock:
            for attempt in range(4):
                try:
                    await self.app.sign_in(target_phone, phone_code_hash, code.strip())
                    self.app.me = await self.app.get_me()
                    break
                except SessionPasswordNeeded:
                    raise
                except Exception as e:
                    if "locked" in str(e).lower() and attempt < 3:
                        await asyncio.sleep(0.5 * (attempt + 1))
                        continue
                    raise e

    async def check_password(self, password):
        async with self._auth_lock:
            for attempt in range(4):
                try:
                    await self.app.check_password(password)
                    self.app.me = await self.app.get_me()
                    break
                except Exception as e:
                    if "locked" in str(e).lower() and attempt < 3:
                        await asyncio.sleep(0.5 * (attempt + 1))
                        continue
                    raise e

    async def log_out(self):
        async with self._auth_lock:
            if self.app:
                try:
                    if self.app.is_connected:
                        await self.app.log_out()
                except Exception:
                    pass
                self.app = None
                
            session_file = BASE_DIR / f"{self.session_name}.session"
            if session_file.exists():
                try: session_file.unlink()
                except: pass

    async def get_admin_channels(self):
        if not self.is_authorized(): return []
        channels = []
        async for dialog in self.app.get_dialogs():
            chat = dialog.chat
            if chat.type in [ChatType.CHANNEL, ChatType.SUPERGROUP, ChatType.GROUP]:
                try:
                    member = await self.app.get_chat_member(chat.id, "me")
                    if member.status in [ChatMemberStatus.ADMINISTRATOR, ChatMemberStatus.OWNER]:
                        channels.append({"id": str(chat.id), "title": chat.title or "Без названия"})
                except:
                    pass
        return channels

    async def create_new_channel(self, title):
        if not self.is_authorized(): return None
        chat = await self.app.create_channel(title, "Создано через CrowGram")
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
            raise Exception("Сессия Telegram не инициализирована")

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

    async def push_sync(self, json_data):
        if not self.is_authorized(): return
        file_path = "crowgram_sync.json"
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(json_data)
        
        msg = await self.app.send_document("me", document=file_path, file_name="crowgram_sync.json", caption="#crowgram_sync")
        os.remove(file_path)
        
        async for m in self.app.search_messages("me", query="#crowgram_sync"):
            if m.id != msg.id:
                try: await m.delete()
                except: pass

    async def pull_sync(self):
        if not self.is_authorized(): return None
        async for m in self.app.search_messages("me", query="#crowgram_sync"):
            if m.document and m.document.file_name == "crowgram_sync.json":
                file_path = await self.app.download_media(m.document)
                if not file_path: continue
                with open(file_path, "r", encoding="utf-8") as f:
                    data = f.read()
                os.remove(file_path)
                return data
        return None

tg_manager = TelegramManager()
