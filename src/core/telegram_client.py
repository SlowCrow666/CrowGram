import os
import asyncio
from pyrogram import Client
from pyrogram.enums import ChatType, ChatMemberStatus
from pyrogram.errors import SessionPasswordNeeded, FloodWait, PeerIdInvalid

class TelegramManager:
    def __init__(self):
        self.app = None
        self.session_name = "crowgram_session"
        self.api_id = None
        self.api_hash = None
        self._chat_cache = {}
        self._upload_semaphore = asyncio.Semaphore(3)

    async def init_client(self):
        from src.core.db import get_all_config
        cfg = get_all_config()
        self.api_id = cfg.get("api_id")
        self.api_hash = cfg.get("api_hash")
        
        if self.api_id and self.api_hash:
            if not self.app:
                self.app = Client(self.session_name, api_id=int(self.api_id), api_hash=self.api_hash)
            if not self.app.is_connected:
                await self.app.connect()
            try:
                self.app.me = await self.app.get_me()
            except Exception as e:
                print(f"[WARN] Ошибка получения me: {e}")
                self.app.me = None

    def is_authorized(self):
        return self.app and self.app.is_connected and getattr(self.app, "me", None) is not None

    async def send_code(self, phone):
        if not self.app: await self.init_client()
        self.phone = phone
        self.sent_code_info = await self.app.send_code(phone)

    async def sign_in(self, phone, code):
        await self.app.sign_in(phone, self.sent_code_info.phone_code_hash, code)
        self.app.me = await self.app.get_me()

    async def check_password(self, password):
        await self.app.check_password(password)
        self.app.me = await self.app.get_me()

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
