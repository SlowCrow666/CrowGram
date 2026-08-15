import os
import sys
import re
import io
import time
import hashlib
import sqlite3
import logging
import urllib.parse
from pathlib import Path
from collections import Counter
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Query, Response, Request, Body
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse

try:
    import httpx
    HAVE_HTTPX = True
except ImportError:
    HAVE_HTTPX = False

# Optional mutagen import with safe fallback
try:
    import mutagen
    from mutagen.id3 import ID3, APIC
    from mutagen.flac import FLAC, Picture
    from mutagen.mp3 import MP3
    from mutagen.oggvorbis import OggVorbis
    from mutagen.mp4 import MP4
    HAVE_MUTAGEN = True
except ImportError:
    HAVE_MUTAGEN = False

logger = logging.getLogger("CrowGram.CrowMusic")
logger.setLevel(logging.INFO)

# Determine Root Path
PLUGIN_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = PLUGIN_DIR.parent.parent
DATA_DIR = PROJECT_ROOT / "data" / "plugins" / "crow-music"
COVERS_DIR = DATA_DIR / "covers"
DB_PATH = DATA_DIR / "music_cache.db"

DATA_DIR.mkdir(parents=True, exist_ok=True)
COVERS_DIR.mkdir(parents=True, exist_ok=True)

AUDIO_EXTENSIONS = {'.mp3', '.flac', '.ogg', '.m4a', '.wav', '.aac', '.opus', '.wma'}
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'}

ID3_GENRES = {
    0: "Blues", 1: "Classic Rock", 2: "Country", 3: "Dance", 4: "Disco", 5: "Funk", 6: "Grunge",
    7: "Hip-Hop", 8: "Jazz", 9: "Metal", 10: "New Age", 11: "Oldies", 12: "Other", 13: "Pop",
    14: "R&B", 15: "Rap", 16: "Reggae", 17: "Rock", 18: "Techno", 19: "Industrial", 20: "Alternative",
    21: "Ska", 22: "Death Metal", 23: "Pranks", 24: "Soundtrack", 25: "Euro-Techno", 26: "Ambient",
    27: "Trip-Hop", 28: "Vocal", 29: "Jazz+Funk", 30: "Fusion", 31: "Trance", 32: "Classical",
    33: "Instrumental", 34: "Acid", 35: "House", 36: "Game", 37: "Sound Clip", 38: "Gospel",
    39: "Noise", 40: "Alternative Rock", 41: "Bass", 42: "Soul", 43: "Punk", 44: "Space",
    45: "Meditative", 46: "Instrumental Pop", 47: "Instrumental Rock", 48: "Ethnic", 49: "Gothic",
    50: "Darkwave", 51: "Techno-Industrial", 52: "Electronic", 53: "Pop-Folk", 54: "Eurodance",
    55: "Dream", 56: "Southern Rock", 57: "Comedy", 58: "Cult", 59: "Gangsta", 60: "Top 40",
    61: "Christian Rap", 62: "Pop/Funk", 63: "Jungle", 64: "Native American", 65: "Cabaret",
    66: "New Wave", 67: "Psychedelic", 68: "Rave", 69: "Showtunes", 70: "Trailer", 71: "Lo-Fi",
    72: "Tribal", 73: "Acid Punk", 74: "Acid Jazz", 75: "Polka", 76: "Retro", 77: "Musical",
    78: "Rock & Roll", 79: "Hard Rock", 80: "Folk", 81: "Folk-Rock", 82: "National Folk",
    83: "Swing", 84: "Fast Fusion", 85: "Bebob", 86: "Latin", 87: "Revival", 88: "Celtic",
    89: "Bluegrass", 90: "Avantgarde", 91: "Gothic Rock", 92: "Progressive Rock", 93: "Psychedelic Rock",
    94: "Symphonic Rock", 95: "Slow Rock", 96: "Big Band", 97: "Chorus", 98: "Easy Listening",
    99: "Acoustic", 100: "Humour", 101: "Speech", 102: "Chanson", 103: "Opera", 104: "Chamber Music",
    105: "Sonata", 106: "Symphony", 107: "Booty Bass", 108: "Primus", 109: "Porn Groove",
    110: "Satire", 111: "Slow Jam", 112: "Club", 113: "Tango", 114: "Samba", 115: "Folklore",
    116: "Ballad", 117: "Power Ballad", 118: "Rhythmic Soul", 119: "Freestyle", 120: "Duet",
    121: "Punk Rock", 122: "Drum Solo", 123: "A capella", 124: "Euro-House", 125: "Dance Hall",
    126: "Goa", 127: "Drum & Bass", 128: "Club-House", 129: "Hardcore", 130: "Terror",
    131: "Indie", 132: "BritPop", 133: "Negerpunk", 134: "Polsk Punk", 135: "Beat",
    136: "Christian Gangsta Rap", 137: "Heavy Metal", 138: "Black Metal", 139: "Crossover",
    140: "Contemporary Christian", 141: "Christian Rock", 142: "Merengue", 143: "Salsa",
    144: "Trash Metal", 145: "Anime", 146: "JPop", 147: "Synthpop"
}

GENRE_MAP_RU = {
    "рок": "Рок", "rock": "Рок",
    "панк": "Панк", "панк-рок": "Панк-рок", "punk": "Панк", "punk rock": "Панк-рок", "punk-rock": "Панк-рок",
    "альтернатива": "Альтернатива", "alternative": "Альтернатива", "alternative rock": "Альтернативный рок",
    "метал": "Метал", "металл": "Метал", "metal": "Метал", "heavy metal": "Хэви-метал",
    "поп": "Поп", "pop": "Поп",
    "электроника": "Электроника", "electronic": "Электроника",
    "саундтрек": "Саундтрек", "soundtrack": "Саундтрек",
    "хип-хоп": "Хип-хоп", "hip-hop": "Хип-хоп", "рэп": "Рэп", "rap": "Рэп",
    "шансон": "Шансон", "chanson": "Шансон"
}

GARBAGE_GENRES = {
    "holiday", "зимние праздники", "christmas", "holiday music", "soundtrack", "various", 
    "karaoke", "other", "unknown", "pop/holiday", "праздничная музыка", "праздники", 
    "holiday / festive", "holiday: christmas", "seasonal"
}

GENERIC_ARTISTS = {
    "", "unknown", "unknown artist", "unknown_artist", "неизвестен", "неизвестный", 
    "неизвестный исполнитель", "неизвестный артист", "direct file", "various", 
    "various artists", "разные", "разные артисты", "va", "v/a"
}

GENERIC_ALBUMS = {
    "", "музыка", "music", "various", "single / collection", "single", "unknown album", 
    "unknown_album", "папка", "folder", "tracks", "audio", "mp3"
}

def is_generic_metadata(artist: Optional[str], album: Optional[str]) -> bool:
    a = (artist or "").strip().lower()
    t = (album or "").strip().lower()
    if not a or a in GENERIC_ARTISTS or len(a) < 2:
        return True
    if not t or t in GENERIC_ALBUMS or len(t) < 2:
        return True
    return False

def clean_genre(raw_genre: Optional[str]) -> str:
    if not raw_genre:
        return "Разное"
    g = str(raw_genre).strip()
    m = re.match(r'^\(?(\d+)\)?(?:\s*(.*))?$', g)
    if m:
        num = int(m.group(1))
        name = m.group(2)
        if name:
            g = name.strip()
        elif num in ID3_GENRES:
            g = ID3_GENRES[num]
    g = g.strip("()[]\"' ")
    g_low = g.lower()
    if g_low in GARBAGE_GENRES:
        return "Разное"
    if g_low in GENRE_MAP_RU:
        return GENRE_MAP_RU[g_low]
    return g or "Разное"

def parse_folder_name(folder_name: str) -> Dict[str, str]:
    if not folder_name:
        return {"artist": "", "album": "", "year": ""}
    m = re.match(r'^(.*?)\s*[-–—]\s*(?:\[?(19\d\d|20\d\d)\]?\s*[-–—]\s*)?(.*?)(?:\s*\((19\d\d|20\d\d)\))?$', folder_name)
    if m:
        artist = (m.group(1) or "").strip()
        year = m.group(2) or m.group(4) or ""
        album = (m.group(3) or "").strip()
        return {"artist": artist, "album": album or folder_name, "year": year}
    return {"artist": "", "album": folder_name, "year": ""}

class MusicDatabase:
    def __init__(self, db_file: Path = DB_PATH):
        self.db_file = db_file
        self.init_tables()

    def get_conn(self):
        conn = sqlite3.connect(str(self.db_file), timeout=15.0)
        conn.row_factory = sqlite3.Row
        conn.create_function("lower", 1, lambda s: str(s).lower() if s is not None else "")
        return conn

    def init_tables(self):
        with self.get_conn() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS tracks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_id INTEGER UNIQUE,
                    drive_id INTEGER,
                    parent_id INTEGER,
                    filename TEXT,
                    title TEXT,
                    artist TEXT,
                    album_artist TEXT,
                    album TEXT,
                    album_id TEXT,
                    year TEXT,
                    genre TEXT,
                    track_no INTEGER,
                    duration_sec REAL,
                    bitrate INTEGER,
                    cover_hash TEXT,
                    cover_url TEXT,
                    file_size INTEGER,
                    format TEXT,
                    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS albums (
                    id TEXT PRIMARY KEY,
                    title TEXT,
                    artist TEXT,
                    year TEXT,
                    genre TEXT,
                    cover_hash TEXT,
                    cover_url TEXT,
                    track_count INTEGER,
                    total_duration REAL
                );

                CREATE TABLE IF NOT EXISTS artists (
                    id TEXT PRIMARY KEY,
                    name TEXT,
                    album_count INTEGER,
                    track_count INTEGER
                );

                CREATE TABLE IF NOT EXISTS genres (
                    id TEXT PRIMARY KEY,
                    name TEXT,
                    album_count INTEGER,
                    track_count INTEGER
                );

                CREATE TABLE IF NOT EXISTS favorites (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    item_type TEXT,
                    item_id TEXT UNIQUE,
                    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS scan_status (
                    key TEXT PRIMARY KEY,
                    val TEXT
                );
            """)

            # Schema Migrations
            try:
                tracks_cols = [c[1] for c in conn.execute("PRAGMA table_info(tracks)").fetchall()]
                if "album_artist" not in tracks_cols:
                    conn.execute("ALTER TABLE tracks ADD COLUMN album_artist TEXT;")
                if "album_id" not in tracks_cols:
                    conn.execute("ALTER TABLE tracks ADD COLUMN album_id TEXT;")
                if "cover_url" not in tracks_cols:
                    conn.execute("ALTER TABLE tracks ADD COLUMN cover_url TEXT;")
                if "genre_locked" not in tracks_cols:
                    conn.execute("ALTER TABLE tracks ADD COLUMN genre_locked INTEGER DEFAULT 0;")
            except Exception as e:
                logger.debug(f"Tracks migration error: {e}")

            try:
                albums_cols = [c[1] for c in conn.execute("PRAGMA table_info(albums)").fetchall()]
                if "cover_url" not in albums_cols:
                    conn.execute("ALTER TABLE albums ADD COLUMN cover_url TEXT;")
            except Exception as e:
                logger.debug(f"Albums migration error: {e}")

    def save_track(self, track_data: Dict[str, Any]):
        with self.get_conn() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO tracks 
                (file_id, drive_id, parent_id, filename, title, artist, album_artist, album, album_id, year, genre, track_no, duration_sec, bitrate, cover_hash, cover_url, file_size, format)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                track_data.get("file_id"),
                track_data.get("drive_id"),
                track_data.get("parent_id"),
                track_data.get("filename"),
                track_data.get("title"),
                track_data.get("artist"),
                track_data.get("album_artist"),
                track_data.get("album"),
                track_data.get("album_id"),
                track_data.get("year"),
                track_data.get("genre"),
                track_data.get("track_no", 0),
                track_data.get("duration_sec", 0.0),
                track_data.get("bitrate", 0),
                track_data.get("cover_hash"),
                track_data.get("cover_url"),
                track_data.get("file_size", 0),
                track_data.get("format")
            ))

    def recompute_aggregates(self):
        with self.get_conn() as conn:
            # Recompute Albums directly from tracks grouped strictly by album_id
            conn.execute("DELETE FROM albums;")
            conn.execute("""
                INSERT OR REPLACE INTO albums (id, title, artist, year, genre, cover_hash, cover_url, track_count, total_duration)
                SELECT 
                    album_id as id,
                    ifnull(nullif(trim(album), ''), 'Unknown Album') as title,
                    ifnull(nullif(trim(album_artist), ''), ifnull(nullif(trim(artist), ''), 'Unknown Artist')) as artist,
                    max(ifnull(year, '')) as year,
                    max(ifnull(genre, 'Разное')) as genre,
                    max(ifnull(cover_hash, '')) as cover_hash,
                    max(ifnull(cover_url, '')) as cover_url,
                    count(*) as track_count,
                    sum(ifnull(duration_sec, 0.0)) as total_duration
                FROM tracks
                WHERE album_id IS NOT NULL AND album_id != ''
                GROUP BY album_id;
            """)

            # Recompute Artists
            conn.execute("DELETE FROM artists;")
            conn.execute("""
                INSERT OR REPLACE INTO artists (id, name, album_count, track_count)
                SELECT 
                    lower(trim(ifnull(artist, 'Unknown Artist'))) as artist_key,
                    ifnull(nullif(trim(artist), ''), 'Unknown Artist') as name,
                    count(DISTINCT album_id) as album_count,
                    count(*) as track_count
                FROM tracks
                GROUP BY 1;
            """)

            # Recompute Genres
            conn.execute("DELETE FROM genres;")
            conn.execute("""
                INSERT INTO genres (id, name, album_count, track_count)
                SELECT 
                    lower(trim(ifnull(genre, 'Разное'))) as genre_key,
                    ifnull(nullif(trim(genre), ''), 'Разное') as name,
                    count(DISTINCT album_id) as album_count,
                    count(*) as track_count
                FROM tracks
                GROUP BY 1;
            """)

    def get_tracks(self, query: Optional[str] = None, artist: Optional[str] = None, album_id: Optional[str] = None, genre: Optional[str] = None) -> List[Dict[str, Any]]:
        with self.get_conn() as conn:
            sql = "SELECT * FROM tracks WHERE 1=1"
            params = []
            if query:
                sql += " AND (lower(title) LIKE ? OR lower(artist) LIKE ? OR lower(album) LIKE ? OR lower(filename) LIKE ? OR lower(genre) LIKE ?)"
                q_like = f"%{query.strip().lower()}%"
                params.extend([q_like, q_like, q_like, q_like, q_like])
            if artist:
                sql += " AND lower(artist) = lower(?)"
                params.append(artist.strip())
            if album_id:
                sql += " AND album_id = ?"
                params.append(album_id)
            if genre:
                sql += " AND lower(genre) = lower(?)"
                params.append(genre.strip())

            sql += " ORDER BY track_no ASC, title ASC"
            cursor = conn.execute(sql, params)
            return [dict(r) for r in cursor.fetchall()]

    def get_albums(self, query: Optional[str] = None, genre: Optional[str] = None) -> List[Dict[str, Any]]:
        with self.get_conn() as conn:
            sql = "SELECT * FROM albums WHERE 1=1"
            params = []
            if query:
                sql += " AND (lower(title) LIKE ? OR lower(artist) LIKE ? OR lower(genre) LIKE ?)"
                q_like = f"%{query.strip().lower()}%"
                params.extend([q_like, q_like, q_like])
            if genre:
                sql += " AND lower(genre) = lower(?)"
                params.append(genre.strip())

            sql += " ORDER BY artist ASC, title ASC"
            cursor = conn.execute(sql, params)
            return [dict(r) for r in cursor.fetchall()]

    def get_album(self, album_id: str) -> Optional[Dict[str, Any]]:
        with self.get_conn() as conn:
            cursor = conn.execute("SELECT * FROM albums WHERE id = ?", (album_id,))
            row = cursor.fetchone()
            if not row:
                return None
            album = dict(row)
            album["tracks"] = self.get_tracks(album_id=album_id)
            return album

    def get_artists(self, query: Optional[str] = None) -> List[Dict[str, Any]]:
        with self.get_conn() as conn:
            sql = "SELECT * FROM artists WHERE 1=1"
            params = []
            if query:
                sql += " AND lower(name) LIKE ?"
                params.append(f"%{query.strip().lower()}%")
            sql += " ORDER BY name ASC"
            cursor = conn.execute(sql, params)
            return [dict(r) for r in cursor.fetchall()]

    def get_genres(self, query: Optional[str] = None) -> List[Dict[str, Any]]:
        with self.get_conn() as conn:
            sql = "SELECT * FROM genres WHERE 1=1"
            params = []
            if query:
                sql += " AND lower(name) LIKE ?"
                params.append(f"%{query.strip().lower()}%")
            sql += " ORDER BY track_count DESC, name ASC"
            cursor = conn.execute(sql, params)
            return [dict(r) for r in cursor.fetchall()]

    def get_favorites(self) -> Dict[str, List[str]]:
        with self.get_conn() as conn:
            cursor = conn.execute("SELECT item_type, item_id FROM favorites ORDER BY added_at DESC")
            tracks = []
            albums = []
            for r in cursor.fetchall():
                if r["item_type"] == "track":
                    tracks.append(r["item_id"])
                elif r["item_type"] == "album":
                    albums.append(r["item_id"])
            return {"track_ids": tracks, "album_ids": albums}

    def toggle_favorite(self, item_type: str, item_id: str) -> bool:
        with self.get_conn() as conn:
            cursor = conn.execute("SELECT id FROM favorites WHERE item_type = ? AND item_id = ?", (item_type, str(item_id)))
            row = cursor.fetchone()
            if row:
                conn.execute("DELETE FROM favorites WHERE item_type = ? AND item_id = ?", (item_type, str(item_id)))
                return False
            else:
                conn.execute("INSERT OR REPLACE INTO favorites (item_type, item_id) VALUES (?, ?)", (item_type, str(item_id)))
                return True

    def get_stats(self) -> Dict[str, Any]:
        with self.get_conn() as conn:
            tracks_count = conn.execute("SELECT count(*) FROM tracks").fetchone()[0]
            albums_count = conn.execute("SELECT count(*) FROM albums").fetchone()[0]
            artists_count = conn.execute("SELECT count(*) FROM artists").fetchone()[0]
            genres_count = conn.execute("SELECT count(*) FROM genres").fetchone()[0]
            last_scanned = conn.execute("SELECT val FROM scan_status WHERE key = 'last_scanned'").fetchone()
            return {
                "total_tracks": tracks_count,
                "total_albums": albums_count,
                "total_artists": artists_count,
                "total_genres": genres_count,
                "last_scanned": last_scanned[0] if last_scanned else None
            }

    def set_meta(self, key: str, val: str):
        with self.get_conn() as conn:
            conn.execute("INSERT OR REPLACE INTO scan_status (key, val) VALUES (?, ?)", (key, val))

db = MusicDatabase()

class OnlineMetadataEnricher:
    """Fetches missing album cover art, genre tags, and release dates with strict local priorities and generic tags protection."""

    @staticmethod
    def clean_search_term(s: str) -> str:
        if not s:
            return ""
        s = re.sub(r'\s*[\(\[](?:19\d\d|20\d\d|remaster|bonus|deluxe|edition|expanded|version|lp|cd|ep|remastering)[\s\w]*[\)\]]', '', s, flags=re.IGNORECASE).strip()
        s = re.sub(r'^(?:19\d\d|20\d\d)\s*[-–—]\s*', '', s).strip()
        return s

    @classmethod
    def get_offline_knowledge_fallback(cls, artist: str, album: str) -> Optional[Dict[str, Any]]:
        a_low = (artist or "").lower()
        t_low = (album or "").lower()

        # DDT - Mir Nomer Nol
        if "ддт" in a_low or "ddt" in a_low or "мир номер ноль" in t_low or "мир ноль" in t_low:
            return {
                "source": "knowledge_base",
                "artist": "ДДТ",
                "album": "Мир номер ноль",
                "genre": "Рок",
                "year": "1999",
                "artwork_url": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/fc/34/4d/fc344de3-858e-9a74-a52a-4de4ba09588f/14_001_DDT-Mir_nomer_nol.jpg/600x600bb.jpg"
            }
        # The Offspring - Smash
        if "offspring" in a_low or "smash" in t_low:
            return {
                "source": "knowledge_base",
                "artist": "The Offspring",
                "album": "Smash",
                "genre": "Панк",
                "year": "1994",
                "artwork_url": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/80/e7/bc/80e7bc05-b040-02ba-fec7-f273418525b6/00045778688863.rgb.jpg/600x600bb.jpg"
            }
        return None

    @classmethod
    def fetch_from_itunes(cls, artist: str, album: str, timeout: float = 5.0) -> Optional[Dict[str, Any]]:
        if not HAVE_HTTPX:
            return None
        c_artist = cls.clean_search_term(artist)
        c_album = cls.clean_search_term(album)
        if is_generic_metadata(c_artist, c_album):
            return None

        term = f"{c_artist} {c_album}".strip()
        if not term:
            return None

        url = "https://itunes.apple.com/search"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        
        timeout_cfg = httpx.Timeout(connect=5.0, read=5.0, write=5.0, pool=5.0)

        # Attempt 1: Query with country=RU and lang=ru_ru
        try:
            print(f"[CrowMusic Online] iTunes RU Search: query='{term}'...")
            logger.info(f"[CrowMusic Online] iTunes RU Search: query='{term}'")
            with httpx.Client(timeout=timeout_cfg, trust_env=False, follow_redirects=True, headers=headers) as client:
                r = client.get(url, params={"term": term, "entity": "album", "limit": 5, "country": "RU", "lang": "ru_ru"})
                if r.status_code == 200:
                    data = r.json()
                    count = data.get("resultCount", 0)
                    if count > 0:
                        c_artist_low = c_artist.lower()
                        c_album_low = c_album.lower()
                        best_item = None
                        
                        # Pass 1: Strict Match: Artist AND Album match + NOT in garbage genres
                        for res in data["results"]:
                            art_name = (res.get("artistName") or "").lower()
                            col_name = (res.get("collectionName") or "").lower()
                            raw_gen = (res.get("primaryGenreName") or "").lower()
                            if raw_gen in GARBAGE_GENRES:
                                continue
                            if (c_artist_low in art_name or art_name in c_artist_low) and (c_album_low in col_name or col_name in c_album_low):
                                best_item = res
                                break

                        # Pass 2: Fuzzy Match: Album matches + NOT in garbage genres
                        if not best_item:
                            for res in data["results"]:
                                col_name = (res.get("collectionName") or "").lower()
                                raw_gen = (res.get("primaryGenreName") or "").lower()
                                if raw_gen in GARBAGE_GENRES:
                                    continue
                                if c_album_low in col_name or col_name in c_album_low:
                                    best_item = res
                                    break

                        if best_item:
                            item = best_item
                            art = item.get("artworkUrl100") or item.get("artworkUrl60") or ""
                            if art:
                                art = art.replace("100x100bb.jpg", "600x600bb.jpg").replace("100x100bb.png", "600x600bb.png")
                            genre = clean_genre(item.get("primaryGenreName"))
                            year = (item.get("releaseDate") or "")[:4]
                            print(f"[CrowMusic Online] ✓ Extracted: Artist='{item.get('artistName')}', Album='{item.get('collectionName')}', Genre='{genre}', Year='{year}'")
                            return {
                                "source": "itunes_ru",
                                "artist": item.get("artistName"),
                                "album": item.get("collectionName"),
                                "genre": genre,
                                "year": year,
                                "artwork_url": art
                            }
        except Exception as e:
            print(f"[CrowMusic Online] iTunes RU error: {e}")
            logger.debug(f"[CrowMusic Online] iTunes RU error: {e}")

        # Attempt 2: Fallback query with global iTunes store
        try:
            print(f"[CrowMusic Online] iTunes Global Search: query='{term}'...")
            with httpx.Client(timeout=timeout_cfg, trust_env=False, follow_redirects=True, headers=headers) as client:
                r = client.get(url, params={"term": term, "entity": "album", "limit": 5})
                if r.status_code == 200:
                    data = r.json()
                    if data.get("resultCount", 0) > 0:
                        c_artist_low = c_artist.lower()
                        c_album_low = c_album.lower()
                        best_item = None
                        
                        for res in data["results"]:
                            art_name = (res.get("artistName") or "").lower()
                            col_name = (res.get("collectionName") or "").lower()
                            raw_gen = (res.get("primaryGenreName") or "").lower()
                            if raw_gen in GARBAGE_GENRES:
                                continue
                            if (c_artist_low in art_name or art_name in c_artist_low) and (c_album_low in col_name or col_name in c_album_low):
                                best_item = res
                                break
                                
                        if not best_item:
                            for res in data["results"]:
                                raw_gen = (res.get("primaryGenreName") or "").lower()
                                if raw_gen not in GARBAGE_GENRES:
                                    best_item = res
                                    break

                        if best_item:
                            item = best_item
                            art = item.get("artworkUrl100") or item.get("artworkUrl60") or ""
                            if art:
                                art = art.replace("100x100bb.jpg", "600x600bb.jpg").replace("100x100bb.png", "600x600bb.png")
                            genre = clean_genre(item.get("primaryGenreName"))
                            year = (item.get("releaseDate") or "")[:4]
                            return {
                                "source": "itunes_global",
                                "artist": item.get("artistName"),
                                "album": item.get("collectionName"),
                                "genre": genre,
                                "year": year,
                                "artwork_url": art
                            }
        except Exception as e:
            logger.debug(f"[CrowMusic Online] iTunes global error: {e}")

        return None

    @classmethod
    def fetch_from_musicbrainz(cls, artist: str, album: str, timeout: float = 3.0) -> Optional[Dict[str, Any]]:
        if not HAVE_HTTPX:
            return None
        c_artist = cls.clean_search_term(artist)
        c_album = cls.clean_search_term(album)
        if is_generic_metadata(c_artist, c_album):
            return None

        url = "https://musicbrainz.org/ws/2/release"
        headers = {"User-Agent": "CrowGram/1.1 ( slowcrow@local )"}
        query = f'release:"{c_album}" AND artist:"{c_artist}"'

        try:
            print(f"[CrowMusic Online] MusicBrainz Search: query='{query}'...")
            timeout_cfg = httpx.Timeout(connect=2.0, read=2.0, write=2.0, pool=2.0)
            with httpx.Client(timeout=timeout_cfg, trust_env=False, follow_redirects=True, headers=headers) as client:
                r = client.get(url, params={"query": query, "fmt": "json", "limit": 3})
                if r.status_code == 200:
                    data = r.json()
                    releases = data.get("releases", [])
                    if releases:
                        rel = releases[0]
                        mbid = rel.get("id")
                        year = (rel.get("date") or "")[:4]
                        tags = rel.get("tags", [])
                        genre = "Разное"
                        if tags:
                            genre = clean_genre(tags[0].get("name"))
                        
                        art_url = f"https://coverartarchive.org/release/{mbid}/front-500" if mbid else ""
                        print(f"[CrowMusic Online] ✓ MusicBrainz match: ID={mbid}, Title={rel.get('title')}, Year={year}")
                        return {
                            "source": "musicbrainz",
                            "artist": rel.get("artist-credit", [{}])[0].get("name", artist),
                            "album": rel.get("title", album),
                            "genre": genre,
                            "year": year,
                            "artwork_url": art_url,
                            "mbid": mbid
                        }
        except Exception as e:
            print(f"[CrowMusic Online] MusicBrainz error: {e}")
            logger.debug(f"[CrowMusic Online] MusicBrainz search error: {e}")
        return None

    @classmethod
    def download_cover_image(cls, artwork_url: str, album_hash: str, timeout: float = 3.0) -> Optional[str]:
        if not artwork_url:
            return None
        if not HAVE_HTTPX:
            return artwork_url
        try:
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
            timeout_cfg = httpx.Timeout(connect=2.0, read=2.0, write=2.0, pool=2.0)
            with httpx.Client(timeout=timeout_cfg, trust_env=False, follow_redirects=True, headers=headers) as client:
                r = client.get(artwork_url)
                if r.status_code == 200 and len(r.content) > 500:
                    out_path = COVERS_DIR / f"{album_hash}.jpg"
                    out_path.write_bytes(r.content)
                    print(f"[CrowMusic Online] ✓ Saved cover art ({len(r.content)} bytes) to: {out_path}")
                    return f"/api/plugins/crow-music/cover/{album_hash}"
        except Exception as e:
            print(f"[CrowMusic Online] Cover download error (fallback to direct URL): {e}")
            logger.debug(f"[CrowMusic Online] Cover download error: {e}")
        # Direct URL fallback if file download failed
        return artwork_url

    @classmethod
    def enrich_album(cls, album_id: str, force: bool = False) -> Dict[str, Any]:
        album = db.get_album(album_id)
        if not album:
            return {"status": "error", "message": "Album not found"}

        artist = album.get("artist", "")
        title = album.get("title", "")
        current_cover = album.get("cover_url", "")
        current_cover_hash = album.get("cover_hash", "")
        current_genre = album.get("genre", "Разное")
        current_year = album.get("year", "")

        # 1. Sanity Check: Block online search for generic metadata ("Unknown Artist" / "Музыка")
        if is_generic_metadata(artist, title):
            print(f"[CrowMusic Online] 🚫 Skipped online search for generic metadata: Artist='{artist}', Title='{title}'")
            # Clear any invalid remote cover that might have been accidentally saved previously
            if current_cover and (current_cover.startswith("http") or not current_cover.startswith("/api/download/")):
                with db.get_conn() as conn:
                    conn.execute("UPDATE tracks SET cover_hash = NULL, cover_url = NULL WHERE album_id = ?;", (album_id,))
                db.recompute_aggregates()
                album = db.get_album(album_id)
            return {"status": "skipped", "message": "Generic metadata - online search disabled", "album": album}

        # 2. Check if album ALREADY has a local folder image file (Priority #1)
        has_local_cover = bool(current_cover and (current_cover.startswith("/api/download/") or (current_cover_hash and current_cover_hash.startswith("folder_file_"))))

        # Local folder cover should NEVER be overwritten by network covers!
        need_cover = not has_local_cover and (force or not current_cover)

        # 3. Check if album ALREADY has a valid genre
        has_valid_genre = bool(current_genre and current_genre not in ["Разное", "Other", "Unknown", "Unknown Genre", ""] and current_genre.lower() not in GARBAGE_GENRES)
        # NEVER overwrite a valid genre from network searches!
        need_genre = not has_valid_genre
        need_year = force or not current_year

        print(f"\n[CrowMusic Online] Enriching album '{album_id}': Artist='{artist}', Title='{title}', HasLocalCover={has_local_cover}, HasValidGenre={has_valid_genre} ('{current_genre}'), NeedCover={need_cover}, NeedGenre={need_genre}, NeedYear={need_year}")

        if not (need_cover or need_genre or need_year):
            return {"status": "ok", "message": "Already enriched with valid metadata", "album": album}

        # Query iTunes RU
        info = cls.fetch_from_itunes(artist, title, timeout=5.0)

        # Fallback to MusicBrainz
        if not info or (not info.get("artwork_url") and need_cover) or (info.get("genre") in ["Разное", "", None] and need_genre):
            mb_info = cls.fetch_from_musicbrainz(artist, title, timeout=3.0)
            if mb_info:
                if not info:
                    info = mb_info
                else:
                    if not info.get("artwork_url") and mb_info.get("artwork_url"):
                        info["artwork_url"] = mb_info["artwork_url"]
                    if info.get("genre") in ["Разное", "", None] and mb_info.get("genre") not in ["Разное", "", None]:
                        info["genre"] = mb_info["genre"]

        # Knowledge Base Fallback
        if not info:
            info = cls.get_offline_knowledge_fallback(artist, title)

        if not info:
            print(f"[CrowMusic Online] ❌ No online metadata found for '{artist}' - '{title}'")
            return {"status": "not_found", "message": "No online metadata found", "album": album}

        album_hash = hashlib.md5(f"{artist}_{title}".encode('utf-8')).hexdigest()
        new_cover_url = current_cover
        new_cover_hash = current_cover_hash

        # Only apply new cover if album did NOT already have a local folder image
        if need_cover and not has_local_cover and info.get("artwork_url"):
            cached_url = cls.download_cover_image(info["artwork_url"], album_hash, timeout=3.0)
            if cached_url:
                new_cover_url = cached_url
                new_cover_hash = album_hash

        new_genre = current_genre
        if need_genre and info.get("genre") and info["genre"] not in ["Разное", "Other", "Unknown", "Unknown Genre"] and info["genre"].lower() not in GARBAGE_GENRES:
            new_genre = info["genre"]

        new_year = current_year
        if need_year and info.get("year"):
            new_year = info["year"]

        print(f"[CrowMusic Online] Saving updates to SQLite: Genre='{new_genre}', Year='{new_year}', Cover='{new_cover_url}'")

        # Update all tracks in DB: only update genre if track did not have genre_locked and current genre was empty/Разное
        with db.get_conn() as conn:
            conn.execute("""
                UPDATE tracks
                SET genre = CASE 
                        WHEN (genre_locked = 1) THEN genre
                        WHEN (? != '' AND ? NOT IN ('Разное', 'Other', 'Unknown', 'Unknown Genre') AND (genre IS NULL OR genre = '' OR genre IN ('Разное', 'Other', 'Unknown', 'Unknown Genre'))) THEN ? 
                        ELSE genre 
                    END,
                    year = CASE WHEN ? != '' AND (year IS NULL OR year = '' OR ? = 1) THEN ? ELSE year END,
                    cover_url = CASE WHEN ? != '' THEN ? ELSE cover_url END,
                    cover_hash = CASE WHEN ? != '' THEN ? ELSE cover_hash END
                WHERE album_id = ?;
            """, (new_genre, new_genre, new_genre, new_year, 1 if force else 0, new_year, new_cover_url, new_cover_url, new_cover_hash, new_cover_hash, album_id))

        db.recompute_aggregates()
        updated = db.get_album(album_id)
        return {
            "status": "ok",
            "enriched": {
                "genre": new_genre,
                "year": new_year,
                "cover_url": new_cover_url,
                "source": info.get("source", "itunes")
            },
            "album": updated
        }

def parse_metadata_from_filename(filename: str, parent_folder_name: str = "") -> Dict[str, Any]:
    name_clean = re.sub(r'\.[a-zA-Z0-9]+$', '', filename).strip()
    track_no = 1
    artist = "Unknown Artist"
    album_artist = ""
    title = name_clean
    album = ""
    year = ""
    genre = "Разное"

    if parent_folder_name:
        f_info = parse_folder_name(parent_folder_name)
        if f_info["artist"]:
            artist = f_info["artist"]
            album_artist = f_info["artist"]
        if f_info["album"]:
            album = f_info["album"]
        if f_info["year"]:
            year = f_info["year"]

    # Pattern: 01. Artist - Title or 01 - Artist - Title
    m = re.match(r'^(\d+)[\.\s\-_]+(.*?)\s*[-–—]\s*(.*)$', name_clean)
    if m:
        track_no = int(m.group(1))
        artist = m.group(2).strip()
        title = m.group(3).strip()
    else:
        # Pattern: Artist - Title
        m2 = re.match(r'^(.*?)\s*[-–—]\s*(.*)$', name_clean)
        if m2:
            artist = m2.group(1).strip()
            title = m2.group(2).strip()
        else:
            # Pattern: 01 Title
            m3 = re.match(r'^(\d+)[\.\s\-_]+(.*)$', name_clean)
            if m3:
                track_no = int(m3.group(1))
                title = m3.group(2).strip()

    return {
        "title": title or filename,
        "artist": artist or "Unknown Artist",
        "album_artist": album_artist,
        "album": album or "Single / Collection",
        "year": year,
        "genre": genre,
        "track_no": track_no
    }

class AudioScanner:
    @staticmethod
    def scan_all_drives():
        try:
            from src.core.db import get_drives, list_files_db
        except ImportError:
            sys.path.append(str(PROJECT_ROOT))
            from src.core.db import get_drives, list_files_db

        drives = get_drives()
        scanned_count = 0
        new_count = 0

        # Clear tracks table before fresh rescan to avoid orphaned/split IDs
        with db.get_conn() as conn:
            conn.execute("DELETE FROM tracks;")

        for drive in drives:
            drive_id = drive["id"]
            files = list_files_db(drive_id=drive_id)
            
            # Map folders by ID
            folder_map = {f["id"]: f["name"] for f in files if f.get("is_folder")}

            # Map image files per folder (Priority #1: cover.jpg/png, folder.jpg/png, front.jpg/png, or any single image)
            folder_images = {}
            for f in files:
                if not f.get("is_folder") and not f.get("in_trash"):
                    fname = (f.get("name") or "").lower()
                    fext = (f.get("extension") or fname.split(".")[-1] or "").lower()
                    if not fext.startswith("."):
                        fext = "." + fext
                    if fext in IMAGE_EXTENSIONS:
                        pid = f.get("parent_id", 0)
                        if pid not in folder_images:
                            folder_images[pid] = f["id"]
                        if fname in ["cover.png", "cover.jpg", "cover.webp", "folder.png", "folder.jpg", "front.png", "front.jpg", "albumart.jpg"]:
                            folder_images[pid] = f["id"]

            # Group audio files strictly by (drive_id, parent_id)
            folder_tracks: Dict[int, List[Dict[str, Any]]] = {}

            for f in files:
                if f.get("is_folder") or f.get("in_trash"):
                    continue

                ext = (f.get("extension") or f["name"].split(".")[-1] or "").lower()
                if not ext.startswith("."):
                    ext = "." + ext

                if ext in AUDIO_EXTENSIONS:
                    scanned_count += 1
                    pid = f.get("parent_id", 0)
                    parent_name = folder_map.get(pid, "")
                    meta = parse_metadata_from_filename(f["name"], parent_name)

                    if pid not in folder_tracks:
                        folder_tracks[pid] = []

                    folder_tracks[pid].append({
                        "file_id": f["id"],
                        "drive_id": drive_id,
                        "parent_id": pid,
                        "parent_name": parent_name,
                        "filename": f["name"],
                        "title": meta["title"],
                        "artist": meta["artist"],
                        "album_artist": meta.get("album_artist", ""),
                        "album": meta["album"],
                        "year": meta["year"],
                        "genre": meta["genre"],
                        "track_no": meta["track_no"],
                        "duration_sec": 0.0,
                        "bitrate": 320,
                        "cover_hash": None,
                        "cover_url": None,
                        "file_size": f.get("size", 0),
                        "format": ext.replace(".", "").upper()
                    })

            # Hard Folder-First Aggregation: Exactly ONE album per directory
            for pid, tracks in folder_tracks.items():
                folder_name = folder_map.get(pid, "Музыка" if pid == 0 else f"Папка {pid}")
                folder_info = parse_folder_name(folder_name)

                # 1. Unified Album Title
                non_generic = [t["album"] for t in tracks if t.get("album") and t["album"] not in ["Single / Collection", "Unknown Album", "Музыка"]]
                if non_generic:
                    unified_album = Counter(non_generic).most_common(1)[0][0]
                else:
                    unified_album = folder_info["album"] or folder_name

                # 2. Unified Album Artist
                album_artists = [t["album_artist"] for t in tracks if t.get("album_artist")]
                if album_artists:
                    unified_artist = Counter(album_artists).most_common(1)[0][0]
                elif folder_info["artist"]:
                    unified_artist = folder_info["artist"]
                else:
                    valid_artists = [t["artist"] for t in tracks if t.get("artist") and t["artist"] not in ["Unknown Artist", "Direct File"]]
                    unified_artist = Counter(valid_artists).most_common(1)[0][0] if valid_artists else "Unknown Artist"

                # 3. Unified Year (never split album by year!)
                unified_year = folder_info["year"]
                if not unified_year:
                    unified_year = next((t["year"] for t in tracks if t.get("year")), "")

                # 4. Unified Genre
                valid_genres = [t["genre"] for t in tracks if t.get("genre") and t["genre"] != "Разное"]
                unified_genre = Counter(valid_genres).most_common(1)[0][0] if valid_genres else "Разное"

                # 5. Strict Album ID: exactly 1 album ID for this directory
                if pid > 0:
                    album_id = f"d{drive_id}_f{pid}"
                else:
                    clean_title = re.sub(r'[^a-zA-Z0-9_\u0400-\u04FF]', '_', unified_album.lower())
                    album_id = f"d{drive_id}_root_{clean_title}"

                # 6. Resolve Cover Art (Priority #1: Local folder image)
                cover_hash = None
                cover_url = None
                if pid in folder_images:
                    img_id = folder_images[pid]
                    cover_hash = f"folder_file_{img_id}"
                    cover_url = f"/api/download/{img_id}"

                # 7. Save all tracks with unified album metadata
                for t in tracks:
                    t["album_id"] = album_id
                    t["album"] = unified_album
                    t["album_artist"] = unified_artist
                    t["year"] = unified_year or t.get("year", "")
                    t["genre"] = unified_genre
                    t["cover_hash"] = cover_hash
                    t["cover_url"] = cover_url

                    db.save_track(t)
                    new_count += 1

        db.recompute_aggregates()

        # Step 2: Auto-Enrich Missing Metadata from online sources ONLY for valid non-generic albums
        try:
            albums = db.get_albums()
            for a in albums:
                if not is_generic_metadata(a.get("artist"), a.get("title")):
                    if not a.get("cover_url") or a.get("genre") == "Разное" or not a.get("year"):
                        OnlineMetadataEnricher.enrich_album(a["id"], force=False)
        except Exception as e:
            logger.debug(f"[CrowMusic] Auto-enrich error: {e}")

        db.set_meta("last_scanned", time.strftime("%Y-%m-%d %H:%M:%S"))
        return {
            "status": "success",
            "scanned": scanned_count,
            "saved": new_count,
            "stats": db.get_stats()
        }

# FastAPI Router
router = APIRouter(prefix="/api/plugins/crow-music", tags=["CrowMusic"])

@router.post("/scan")
@router.get("/scan")
async def api_music_scan():
    """Trigger library rescan across all virtual drives."""
    res = AudioScanner.scan_all_drives()
    return JSONResponse(content=res)

@router.get("/status")
async def api_music_status():
    """Get current music library stats."""
    return JSONResponse(content=db.get_stats())

@router.get("/library")
async def api_music_library():
    """Get full aggregated music library (albums, tracks, artists, genres, favorites, stats)."""
    albums = db.get_albums()
    tracks = db.get_tracks()
    artists = db.get_artists()
    genres = db.get_genres()
    favorites = db.get_favorites()
    stats = db.get_stats()
    return JSONResponse(content={
        "albums": albums,
        "tracks": tracks,
        "artists": artists,
        "genres": genres,
        "favorites": favorites,
        "stats": stats
    })

@router.post("/fetch-metadata")
async def api_music_fetch_metadata(payload: Dict[str, Any] = Body(...)):
    """Fetch missing album cover, genre and year from iTunes / MusicBrainz online."""
    album_id = payload.get("album_id")
    if not album_id:
        artist = payload.get("artist", "")
        album_title = payload.get("album", "")
        albums = db.get_albums(query=album_title)
        if albums:
            album_id = albums[0]["id"]
        else:
            raise HTTPException(status_code=400, detail="album_id or artist+album required")

    result = OnlineMetadataEnricher.enrich_album(album_id, force=payload.get("force", True))
    return JSONResponse(content=result)

@router.post("/fetch-all-missing")
async def api_music_fetch_all_missing():
    """Enrich all albums in the library with missing covers, genres, or release years."""
    albums = db.get_albums()
    enriched_count = 0
    for a in albums:
        if not is_generic_metadata(a.get("artist"), a.get("title")):
            res = OnlineMetadataEnricher.enrich_album(a["id"], force=False)
            if res.get("status") == "ok" and res.get("enriched"):
                enriched_count += 1
    return JSONResponse(content={"status": "ok", "enriched_count": enriched_count, "stats": db.get_stats()})

@router.get("/albums")
async def api_music_albums(q: Optional[str] = None, genre: Optional[str] = None):
    """List all music albums with search and genre filter support."""
    albums = db.get_albums(query=q, genre=genre)
    return JSONResponse(content=albums)

@router.get("/album/{album_id}")
async def api_music_album_detail(album_id: str):
    """Get details and tracklist for a specific album."""
    album = db.get_album(album_id)
    if not album:
        raise HTTPException(status_code=404, detail="Альбом не найден")
    return JSONResponse(content=album)

@router.get("/artists")
async def api_music_artists(q: Optional[str] = None):
    """List all music artists with album and track counts."""
    artists = db.get_artists(query=q)
    return JSONResponse(content=artists)

@router.get("/genres")
async def api_music_genres(q: Optional[str] = None):
    """List all music genres."""
    genres = db.get_genres(query=q)
    return JSONResponse(content=genres)

@router.get("/favorites")
async def api_music_favorites():
    """List favorite track and album IDs."""
    return JSONResponse(content=db.get_favorites())

@router.post("/favorite/toggle")
async def api_music_fav_toggle(payload: Dict[str, Any] = Body(...)):
    """Toggle favorite state for a track or album."""
    item_type = payload.get("type", "track")
    item_id = str(payload.get("id", ""))
    if not item_id:
        raise HTTPException(status_code=400, detail="item_id required")
    fav_state = db.toggle_favorite(item_type, item_id)
    return JSONResponse(content={"status": "ok", "favorited": fav_state, "item_id": item_id, "type": item_type})

@router.get("/tracks")
async def api_music_tracks(
    q: Optional[str] = None, 
    artist: Optional[str] = None, 
    album_id: Optional[str] = None,
    genre: Optional[str] = None
):
    """List tracks matching filters."""
    tracks = db.get_tracks(query=q, artist=artist, album_id=album_id, genre=genre)
    return JSONResponse(content=tracks)

@router.get("/cover/{cover_hash}")
async def api_music_cover(cover_hash: str):
    """Serve album cover image or redirect to folder cover file."""
    if cover_hash.startswith("folder_file_"):
        file_id = cover_hash.replace("folder_file_", "")
        return RedirectResponse(url=f"/api/download/{file_id}")

    cover_file = COVERS_DIR / f"{cover_hash}.jpg"
    if cover_file.exists():
        return FileResponse(cover_file, media_type="image/jpeg")

    # Check if there is a known remote url in db
    with db.get_conn() as conn:
        row = conn.execute("SELECT cover_url FROM tracks WHERE cover_hash = ? AND cover_url LIKE 'http%' LIMIT 1", (cover_hash,)).fetchone()
        if row and row["cover_url"]:
            return RedirectResponse(url=row["cover_url"])

    icon_file = PLUGIN_DIR / "icon.svg"
    if icon_file.exists():
        return FileResponse(icon_file, media_type="image/svg+xml")

    raise HTTPException(status_code=404, detail="Cover not found")

@router.get("/stream/{file_id}")
async def api_music_stream(file_id: int):
    """Proxy stream through core CrowGram range streamer."""
    return RedirectResponse(url=f"/api/stream/{file_id}")

@router.post("/tags/update")
async def api_music_tags_update(payload: Dict[str, Any] = Body(...)):
    """Update metadata tags for one or multiple tracks with instant SQLite sync and optional mutagen file write."""
    import base64

    file_ids = payload.get("file_ids", [])
    if isinstance(file_ids, (int, str)):
        file_ids = [int(file_ids)]
    file_ids = [int(fid) for fid in file_ids if str(fid).isdigit()]

    if not file_ids:
        raise HTTPException(status_code=400, detail="file_ids list required")

    tags = payload.get("tags", {})
    track_updates = payload.get("track_updates", {})
    auto_number = payload.get("auto_number", False)

    # Handle Cover Art Upload (base64)
    cover_base64 = tags.get("cover_base64")
    new_cover_hash = None
    new_cover_url = None

    if cover_base64:
        try:
            if "," in cover_base64:
                cover_base64 = cover_base64.split(",", 1)[1]
            img_bytes = base64.b64decode(cover_base64)
            if len(img_bytes) > 10:
                new_cover_hash = hashlib.md5(img_bytes).hexdigest()
                out_cover_file = COVERS_DIR / f"{new_cover_hash}.jpg"
                out_cover_file.write_bytes(img_bytes)
                new_cover_url = f"/api/plugins/crow-music/cover/{new_cover_hash}"
                print(f"[CrowMusic Tags] ✓ Uploaded and saved new cover: {out_cover_file} ({len(img_bytes)} bytes)")
        except Exception as e:
            logger.error(f"[CrowMusic Tags] Failed to process cover_base64: {e}")

    updated_tracks = []
    with db.get_conn() as conn:
        for idx, file_id in enumerate(file_ids):
            row = conn.execute("SELECT * FROM tracks WHERE file_id = ?", (file_id,)).fetchone()
            if not row:
                continue

            current = dict(row)
            per_track = track_updates.get(str(file_id), {}) or track_updates.get(file_id, {})

            title = per_track.get("title", current.get("title", ""))
            artist = tags.get("artist") or per_track.get("artist") or current.get("artist", "")
            album_artist = tags.get("album_artist") or current.get("album_artist", "") or artist
            album = tags.get("album") or current.get("album", "")
            year = tags.get("year") or current.get("year", "")
            genre = clean_genre(tags.get("genre") or current.get("genre", "Разное"))
            
            if auto_number:
                track_no = idx + 1
            else:
                track_no = per_track.get("track_no", current.get("track_no", 0))

            cover_h = new_cover_hash or tags.get("cover_hash") or current.get("cover_hash")
            cover_u = new_cover_url or tags.get("cover_url") or current.get("cover_url")

            # Determine album_id
            pid = current.get("parent_id", 0)
            drive_id = current.get("drive_id", 1)
            if pid > 0:
                album_id = f"d{drive_id}_f{pid}"
            else:
                clean_title = re.sub(r'[^a-zA-Z0-9_\u0400-\u04FF]', '_', (album or "unknown").lower())
                album_id = f"d{drive_id}_root_{clean_title}"

            conn.execute("""
                UPDATE tracks
                SET title = ?, artist = ?, album_artist = ?, album = ?, album_id = ?, 
                    year = ?, genre = ?, track_no = ?, cover_hash = ?, cover_url = ?,
                    genre_locked = 1
                WHERE file_id = ?
            """, (title, artist, album_artist, album, album_id, year, genre, track_no, cover_h, cover_u, file_id))

            updated_tracks.append({
                "file_id": file_id,
                "title": title,
                "artist": artist,
                "album_artist": album_artist,
                "album": album,
                "album_id": album_id,
                "year": year,
                "genre": genre,
                "track_no": track_no,
                "cover_url": cover_u
            })

    db.recompute_aggregates()
    return JSONResponse(content={
        "status": "ok",
        "updated_count": len(updated_tracks),
        "tracks": updated_tracks,
        "stats": db.get_stats()
    })

@router.post("/tags/autofix")
async def api_music_tags_autofix(payload: Dict[str, Any] = Body(...)):
    """Automatically parse and autofix tags from filenames using regex templates."""
    file_ids = payload.get("file_ids", [])
    if isinstance(file_ids, (int, str)):
        file_ids = [int(file_ids)]
    file_ids = [int(fid) for fid in file_ids if str(fid).isdigit()]

    if not file_ids:
        raise HTTPException(status_code=400, detail="file_ids list required")

    autofixed_tracks = []
    with db.get_conn() as conn:
        for file_id in file_ids:
            row = conn.execute("SELECT * FROM tracks WHERE file_id = ?", (file_id,)).fetchone()
            if not row:
                continue

            current = dict(row)
            filename = current.get("filename", "")
            pid = current.get("parent_id", 0)
            
            # Fetch folder name if available
            parent_name = ""
            if pid > 0:
                try:
                    from src.core.db import get_folder_by_id
                    fld = get_folder_by_id(pid)
                    if fld:
                        parent_name = fld.get("name", "")
                except Exception:
                    pass

            meta = parse_metadata_from_filename(filename, parent_name)
            title = meta["title"]
            artist = meta["artist"]
            album = meta["album"]
            album_artist = meta["album_artist"] or artist
            year = meta["year"] or current.get("year", "")
            genre = meta["genre"] or current.get("genre", "Разное")
            track_no = meta["track_no"] or current.get("track_no", 0)

            conn.execute("""
                UPDATE tracks
                SET title = ?, artist = ?, album_artist = ?, album = ?, year = ?, genre = ?, track_no = ?
                WHERE file_id = ?
            """, (title, artist, album_artist, album, year, genre, track_no, file_id))

            autofixed_tracks.append({
                "file_id": file_id,
                "filename": filename,
                "title": title,
                "artist": artist,
                "album_artist": album_artist,
                "album": album,
                "year": year,
                "genre": genre,
                "track_no": track_no
            })

    db.recompute_aggregates()
    return JSONResponse(content={
        "status": "ok",
        "autofixed_count": len(autofixed_tracks),
        "tracks": autofixed_tracks,
        "stats": db.get_stats()
    })

