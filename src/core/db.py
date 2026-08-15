import sqlite3
import json
import hashlib
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
from src.config import DB_PATH

def get_db_connection():
    conn = sqlite3.connect(DB_PATH, timeout=30.0, check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout = 30000;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(password: str) -> str:
    if not password:
        return ""
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

def init_db():
    with get_db_connection() as conn:
        c = conn.cursor()
        
        c.execute('''CREATE TABLE IF NOT EXISTS config (
                        key TEXT PRIMARY KEY, value TEXT)''')
        
        c.execute('''CREATE TABLE IF NOT EXISTS drives (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        letter TEXT NOT NULL,
                        label TEXT,
                        tg_chat_id TEXT NOT NULL,
                        icon TEXT DEFAULT '💽',
                        is_default INTEGER DEFAULT 0
                    )''')
        
        c.execute('''CREATE TABLE IF NOT EXISTS files (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        size INTEGER NOT NULL,
                        parent_id INTEGER DEFAULT 0,
                        thumbnail TEXT,
                        in_trash INTEGER DEFAULT 0,
                        is_favorite INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        drive_id INTEGER DEFAULT 1
                    )''')
                    
        c.execute('''CREATE TABLE IF NOT EXISTS folders (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        parent_id INTEGER DEFAULT 0,
                        in_trash INTEGER DEFAULT 0,
                        is_favorite INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        drive_id INTEGER DEFAULT 1
                    )''')
                    
        c.execute('''CREATE TABLE IF NOT EXISTS chunks (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        file_id INTEGER,
                        chunk_index INTEGER,
                        message_id INTEGER,
                        chunk_size INTEGER,
                        sha256 TEXT,
                        FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
                    )''')

        c.execute('''CREATE TABLE IF NOT EXISTS plugin_defaults (
                        category TEXT PRIMARY KEY,
                        plugin_name TEXT NOT NULL
                    )''')

        c.execute("PRAGMA table_info(drives)")
        drive_cols = [col['name'] for col in c.fetchall()]
        if 'icon' not in drive_cols:
            c.execute("ALTER TABLE drives ADD COLUMN icon TEXT DEFAULT '💽'")

        c.execute("PRAGMA table_info(files)")
        file_cols = [col['name'] for col in c.fetchall()]
        if 'drive_id' not in file_cols:
            c.execute("ALTER TABLE files ADD COLUMN drive_id INTEGER DEFAULT 1")
        if 'in_trash' not in file_cols:
            c.execute("ALTER TABLE files ADD COLUMN in_trash INTEGER DEFAULT 0")
        if 'is_favorite' not in file_cols:
            c.execute("ALTER TABLE files ADD COLUMN is_favorite INTEGER DEFAULT 0")
        if 'thumbnail' not in file_cols:
            c.execute("ALTER TABLE files ADD COLUMN thumbnail TEXT DEFAULT ''")

        c.execute("PRAGMA table_info(folders)")
        folder_cols = [col['name'] for col in c.fetchall()]
        if 'drive_id' not in folder_cols:
            c.execute("ALTER TABLE folders ADD COLUMN drive_id INTEGER DEFAULT 1")
        if 'in_trash' not in folder_cols:
            c.execute("ALTER TABLE folders ADD COLUMN in_trash INTEGER DEFAULT 0")
        if 'is_favorite' not in folder_cols:
            c.execute("ALTER TABLE folders ADD COLUMN is_favorite INTEGER DEFAULT 0")

        c.execute("SELECT COUNT(*) FROM drives")
        if c.fetchone()[0] == 0:
            c.execute("SELECT value FROM config WHERE key = 'target_chat'")
            row = c.fetchone()
            if row and row['value']:
                c.execute("INSERT INTO drives (letter, label, tg_chat_id, icon, is_default) VALUES (?, ?, ?, ?, ?)", ('C', 'Основной', row['value'], '💽', 1))

        conn.commit()

def set_config(key, value):
    with get_db_connection() as conn:
        conn.cursor().execute("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)", (key, value))
        conn.commit()

def get_config(key):
    with get_db_connection() as conn:
        c = conn.cursor()
        c.execute("SELECT value FROM config WHERE key = ?", (key,))
        row = c.fetchone()
        return row['value'] if row else None

def get_all_config():
    with get_db_connection() as conn:
        c = conn.cursor()
        c.execute("SELECT key, value FROM config")
        return {row['key']: row['value'] for row in c.fetchall()}

def get_plugin_defaults():
    with get_db_connection() as conn:
        c = conn.cursor()
        c.execute("SELECT category, plugin_name FROM plugin_defaults")
        return {row['category']: row['plugin_name'] for row in c.fetchall()}

def set_plugin_default(category: str, plugin_name: str):
    with get_db_connection() as conn:
        c = conn.cursor()
        c.execute("INSERT OR REPLACE INTO plugin_defaults (category, plugin_name) VALUES (?, ?)", (category, plugin_name))
        conn.commit()

def remove_plugin_defaults_for_plugin(plugin_name: str):
    with get_db_connection() as conn:
        c = conn.cursor()
        c.execute("DELETE FROM plugin_defaults WHERE plugin_name = ?", (plugin_name,))
        conn.commit()

def set_app_password(password: str, hint: str = "", email: str = "", enabled: bool = True):
    set_config("app_password_enabled", "1" if enabled and password else "0")
    if password:
        set_config("app_password_hash", hash_password(password))
        set_config("app_password_raw", password)
    set_config("app_password_hint", hint.strip())
    set_config("app_password_email", email.strip())

def verify_app_password_db(password: str) -> bool:
    enabled = get_config("app_password_enabled") == "1"
    if not enabled:
        return True
    stored_hash = get_config("app_password_hash")
    return stored_hash == hash_password(password)

def get_password_recovery_info():
    return {
        "enabled": get_config("app_password_enabled") == "1",
        "hint": get_config("app_password_hint") or "",
        "email": get_config("app_password_email") or "",
        "raw_password": get_config("app_password_raw") or ""
    }

def get_drives():
    with get_db_connection() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM drives ORDER BY letter")
        return [dict(row) for row in c.fetchall()]

def get_drive_info(drive_id):
    with get_db_connection() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM drives WHERE id = ?", (drive_id,))
        row = c.fetchone()
        return dict(row) if row else None

def add_drive(letter, label, tg_chat_id, icon='💽', is_default=0):
    with get_db_connection() as conn:
        c = conn.cursor()
        if is_default:
            c.execute("UPDATE drives SET is_default = 0")
        c.execute("INSERT INTO drives (letter, label, tg_chat_id, icon, is_default) VALUES (?, ?, ?, ?, ?)", (letter, label, tg_chat_id, icon, is_default))
        conn.commit()
        return c.lastrowid

def update_drive_db(drive_id, letter, label, icon='💽'):
    with get_db_connection() as conn:
        c = conn.cursor()
        c.execute("UPDATE drives SET letter = ?, label = ?, icon = ? WHERE id = ?", (letter, label, icon, drive_id))
        conn.commit()

def delete_drive_db(drive_id):
    with get_db_connection() as conn:
        c = conn.cursor()
        c.execute("DELETE FROM drives WHERE id = ?", (drive_id,))
        conn.commit()

def add_file_record(name, size, parent_id, thumbnail, drive_id=1):
    with get_db_connection() as conn:
        c = conn.cursor()
        c.execute("INSERT INTO files (name, size, parent_id, thumbnail, drive_id) VALUES (?, ?, ?, ?, ?)", (name, size, parent_id, thumbnail, drive_id))
        conn.commit()
        return c.lastrowid

def add_folder_record(name, parent_id, drive_id=1):
    with get_db_connection() as conn:
        c = conn.cursor()
        c.execute("INSERT INTO folders (name, parent_id, drive_id) VALUES (?, ?, ?)", (name, parent_id, drive_id))
        conn.commit()
        return c.lastrowid

def get_or_create_folder_path(rel_path: str, root_parent_id: int = 0, drive_id: int = 1) -> int:
    """Resolve or create nested folder hierarchy given a relative directory path.
    e.g. 'LTSC-Add-MicrosoftStore-master/subfolder' -> returns ID of 'subfolder'.
    """
    if not rel_path:
        return root_parent_id
        
    clean_path = str(rel_path).replace("\\", "/").strip("/")
    if not clean_path:
        return root_parent_id
        
    parts = [p.strip() for p in clean_path.split("/") if p.strip() and p.strip() != "."]
    current_parent_id = int(root_parent_id) if root_parent_id else 0
    
    with get_db_connection() as conn:
        c = conn.cursor()
        for part in parts:
            c.execute(
                "SELECT id FROM folders WHERE name = ? AND parent_id = ? AND drive_id = ? AND in_trash = 0",
                (part, current_parent_id, drive_id)
            )
            row = c.fetchone()
            if row:
                current_parent_id = row["id"]
            else:
                c.execute(
                    "INSERT INTO folders (name, parent_id, drive_id) VALUES (?, ?, ?)",
                    (part, current_parent_id, drive_id)
                )
                conn.commit()
                current_parent_id = c.lastrowid
                
    return current_parent_id

def add_chunk_record(file_id, chunk_index, message_id, chunk_size, sha256):
    with get_db_connection() as conn:
        c = conn.cursor()
        c.execute("INSERT INTO chunks (file_id, chunk_index, message_id, chunk_size, sha256) VALUES (?, ?, ?, ?, ?)", (file_id, chunk_index, message_id, chunk_size, sha256))
        conn.commit()

def list_files_db(drive_id=1):
    with get_db_connection() as conn:
        c = conn.cursor()
        items = []
        
        c.execute("SELECT id, name, parent_id, in_trash, is_favorite, drive_id, created_at FROM folders WHERE drive_id = ? AND in_trash = 0", (drive_id,))
        for row in c.fetchall():
            items.append({**dict(row), "is_folder": True, "size": 0})
            
        c.execute("SELECT id, name, size, parent_id, thumbnail, in_trash, is_favorite, drive_id, created_at FROM files WHERE drive_id = ? AND in_trash = 0", (drive_id,))
        for row in c.fetchall():
            items.append({**dict(row), "is_folder": False})
            
        return items

def list_trash_db():
    with get_db_connection() as conn:
        c = conn.cursor()
        items = []
        
        c.execute("SELECT id, name, parent_id, in_trash, is_favorite, drive_id, created_at FROM folders WHERE in_trash = 1")
        for row in c.fetchall():
            items.append({**dict(row), "is_folder": True, "size": 0})
            
        c.execute("SELECT id, name, size, parent_id, thumbnail, in_trash, is_favorite, drive_id, created_at FROM files WHERE in_trash = 1")
        for row in c.fetchall():
            items.append({**dict(row), "is_folder": False})
            
        return items

def get_file_info(file_id, is_folder=None):
    with get_db_connection() as conn:
        c = conn.cursor()
        if is_folder is True:
            c.execute("SELECT * FROM folders WHERE id = ?", (file_id,))
            row = c.fetchone()
            return {**dict(row), "is_folder": True, "size": 0} if row else None
            
        c.execute("SELECT * FROM files WHERE id = ?", (file_id,))
        row = c.fetchone()
        if not row and is_folder is not False:
            c.execute("SELECT * FROM folders WHERE id = ?", (file_id,))
            row = c.fetchone()
            if row:
                return {**dict(row), "is_folder": True, "size": 0}
            return None
        return {**dict(row), "is_folder": False} if row else None

def get_file_chunks(file_id):
    with get_db_connection() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM chunks WHERE file_id = ? ORDER BY chunk_index", (file_id,))
        return [dict(row) for row in c.fetchall()]

def move_to_trash_db(file_id, is_folder=False):
    with get_db_connection() as conn:
        c = conn.cursor()
        if not is_folder:
            c.execute("SELECT id FROM folders WHERE id = ?", (file_id,))
            if c.fetchone(): is_folder = True
        
        table = "folders" if is_folder else "files"
        c.execute(f"UPDATE {table} SET in_trash = 1 WHERE id = ?", (file_id,))
        conn.commit()

def restore_from_trash_db(file_id, is_folder=False):
    with get_db_connection() as conn:
        c = conn.cursor()
        if not is_folder:
            c.execute("SELECT id FROM folders WHERE id = ?", (file_id,))
            if c.fetchone(): is_folder = True

        table = "folders" if is_folder else "files"
        c.execute(f"UPDATE {table} SET in_trash = 0 WHERE id = ?", (file_id,))
        conn.commit()

def delete_file_permanently_db(file_id):
    with get_db_connection() as conn:
        c = conn.cursor()
        c.execute("SELECT id FROM folders WHERE id = ?", (file_id,))
        if c.fetchone():
            c.execute("DELETE FROM folders WHERE id = ?", (file_id,))
            conn.commit()
            return None

        c.execute("SELECT c.message_id, f.drive_id FROM chunks c JOIN files f ON c.file_id = f.id WHERE c.file_id = ?", (file_id,))
        rows = c.fetchall()
        
        if not rows:
            c.execute("DELETE FROM files WHERE id = ?", (file_id,))
            conn.commit()
            return None

        drive_id = rows[0]['drive_id']
        msg_ids = [r['message_id'] for r in rows]
        
        c.execute("SELECT tg_chat_id FROM drives WHERE id = ?", (drive_id,))
        d_row = c.fetchone()
        tg_chat_id = d_row['tg_chat_id'] if d_row else None
        
        c.execute("DELETE FROM files WHERE id = ?", (file_id,))
        c.execute("DELETE FROM chunks WHERE file_id = ?", (file_id,))
        conn.commit()
        return {"msg_ids": msg_ids, "chat_id": tg_chat_id}

def empty_trash_db():
    with get_db_connection() as conn:
        c = conn.cursor()
        
        c.execute("SELECT id, drive_id FROM files WHERE in_trash = 1")
        files_to_del = c.fetchall()
        
        tasks = {}
        for f in files_to_del:
            drive_id = f['drive_id']
            c.execute("SELECT message_id FROM chunks WHERE file_id = ?", (f['id'],))
            msg_ids = [r['message_id'] for r in c.fetchall()]
            if msg_ids:
                c.execute("SELECT tg_chat_id FROM drives WHERE id = ?", (drive_id,))
                d_row = c.fetchone()
                if d_row:
                    tg_chat_id = d_row['tg_chat_id']
                    if tg_chat_id not in tasks:
                        tasks[tg_chat_id] = []
                    tasks[tg_chat_id].extend(msg_ids)
            
        c.execute("DELETE FROM files WHERE in_trash = 1")
        c.execute("DELETE FROM folders WHERE in_trash = 1")
        c.execute("DELETE FROM chunks WHERE file_id NOT IN (SELECT id FROM files)")
        
        conn.commit()
        return tasks

def toggle_favorite_db(file_id, state, is_folder=False):
    with get_db_connection() as conn:
        c = conn.cursor()
        if not is_folder:
            c.execute("SELECT id FROM folders WHERE id = ?", (file_id,))
            if c.fetchone(): is_folder = True
            
        table = "folders" if is_folder else "files"
        c.execute(f"UPDATE {table} SET is_favorite = ? WHERE id = ?", (state, file_id))
        conn.commit()

def move_item_db(file_id, new_parent_id, new_drive_id=None, is_folder=False):
    with get_db_connection() as conn:
        c = conn.cursor()
        if not is_folder:
            c.execute("SELECT id FROM folders WHERE id = ?", (file_id,))
            if c.fetchone(): is_folder = True

        table = "folders" if is_folder else "files"
        if new_drive_id is not None:
            c.execute(f"UPDATE {table} SET parent_id = ?, drive_id = ? WHERE id = ?", (new_parent_id, new_drive_id, file_id))
        else:
            c.execute(f"UPDATE {table} SET parent_id = ? WHERE id = ?", (new_parent_id, file_id))
        conn.commit()

def copy_item_db(file_id, new_parent_id, new_drive_id=None, is_folder=False):
    with get_db_connection() as conn:
        c = conn.cursor()
        
        # Check files table first unless explicitly a folder
        if not is_folder:
            c.execute("SELECT name, size, thumbnail, drive_id FROM files WHERE id = ?", (file_id,))
            f_row = c.fetchone()
            if f_row:
                target_drive = new_drive_id if new_drive_id is not None else f_row['drive_id']
                c.execute("INSERT INTO files (name, size, parent_id, thumbnail, drive_id) VALUES (?, ?, ?, ?, ?)",
                          (f_row['name'], f_row['size'], new_parent_id, f_row['thumbnail'], target_drive))
                new_file_id = c.lastrowid
                
                c.execute("SELECT chunk_index, message_id, chunk_size, sha256 FROM chunks WHERE file_id = ? ORDER BY chunk_index", (file_id,))
                chunks = c.fetchall()
                for chunk in chunks:
                    c.execute("INSERT INTO chunks (file_id, chunk_index, message_id, chunk_size, sha256) VALUES (?, ?, ?, ?, ?)",
                              (new_file_id, chunk['chunk_index'], chunk['message_id'], chunk['chunk_size'], chunk['sha256']))
                
                conn.commit()
                return new_file_id

        # Check folders table
        c.execute("SELECT name, drive_id FROM folders WHERE id = ?", (file_id,))
        folder = c.fetchone()
        if folder:
            target_drive = new_drive_id if new_drive_id is not None else folder['drive_id']
            c.execute("INSERT INTO folders (name, parent_id, drive_id) VALUES (?, ?, ?)",
                      (folder['name'], new_parent_id, target_drive))
            new_folder_id = c.lastrowid
            conn.commit()
            return new_folder_id

        return None

def get_storage_stats():
    with get_db_connection() as conn:
        c = conn.cursor()
        c.execute("SELECT SUM(size) as total_size, COUNT(id) as total_files FROM files WHERE in_trash = 0")
        row = c.fetchone()
        return {"total_size": row['total_size'] or 0, "total_files": row['total_files'] or 0}

def export_db_to_json():
    with get_db_connection() as conn:
        c = conn.cursor()
        res = {}
        for table in ['drives', 'files', 'folders', 'chunks', 'plugin_defaults']:
            try:
                c.execute(f"SELECT * FROM {table}")
                res[table] = [dict(row) for row in c.fetchall()]
            except sqlite3.OperationalError:
                pass
        return json.dumps(res)

def import_db_from_json(json_str):
    data = json.loads(json_str)
    with get_db_connection() as conn:
        c = conn.cursor()
        try:
            for table in ['drives', 'files', 'folders', 'chunks', 'plugin_defaults']:
                c.execute(f"DELETE FROM {table}")
                if data.get(table):
                    c.execute(f"PRAGMA table_info({table})")
                    real_table_cols = set(col['name'] for col in c.fetchall())
                    
                    for row in data[table]:
                        valid_keys = [k for k in row.keys() if k in real_table_cols]
                        if not valid_keys:
                            continue
                        
                        placeholders = ",".join(["?"] * len(valid_keys))
                        vals = [row[k] for k in valid_keys]
                        c.execute(f"INSERT INTO {table} ({','.join(valid_keys)}) VALUES ({placeholders})", vals)
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
