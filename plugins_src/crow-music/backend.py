import os
import sys
import re
import io
import time
import hashlib
import sqlite3
import logging
import json
import urllib.parse
import urllib.request
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
LYRICS_CACHE_DIR = PROJECT_ROOT / ".cache" / "crow-music" / "lyrics"
DB_PATH = DATA_DIR / "music_cache.db"

DATA_DIR.mkdir(parents=True, exist_ok=True)
COVERS_DIR.mkdir(parents=True, exist_ok=True)
LYRICS_CACHE_DIR.mkdir(parents=True, exist_ok=True)

AUDIO_EXTENSIONS = {'.mp3', '.flac', '.ogg', '.m4a', '.wav', '.aac', '.opus', '.wma', '.ape'}
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

def clean_title(title: Optional[str]) -> str:
    if not title:
        return ""
    t = str(title).strip()
    # Strip leading track numbers: e.g. "01. ", "01 - ", "01_ ", "1. ", "01 "
    t = re.sub(r'^\d{1,3}[\.\-_\s]+\s*', '', t)
    # Strip keywords in brackets or parentheses
    pattern = r'[\(\[\{].*?(remaster|deluxe|bonus|live|edit|feat|ft\.|version|mono|stereo|re-recorded|anniversary|expanded|original|mix|explicit|edition|single|cut|lp|ep).*?[\)\]\}]'
    t = re.sub(pattern, '', t, flags=re.IGNORECASE)
    t = re.sub(r'\[.*?\]', '', t)
    t = re.sub(r'\s*[\(\[\{]\s*[\)\]\}]', '', t)
    t = re.sub(r'\s*-\s*.*?(remaster|deluxe|bonus|live|edit|feat|version|anniversary|expanded|edition).*$', '', t, flags=re.IGNORECASE)
    t = t.strip(' -_')
    return t if t else str(title).strip()

def clean_album(album: Optional[str]) -> str:
    if not album:
        return ""
    a = str(album).strip()
    pattern = r'[\(\[\{].*?(remaster|deluxe|bonus|anniversary|expanded|edition|version|mono|stereo|re-recorded|special).*?[\)\]\}]'
    a = re.sub(pattern, '', a, flags=re.IGNORECASE)
    a = re.sub(r'\[.*?\]', '', a)
    a = re.sub(r'\s*[\(\[\{]\s*[\)\]\}]', '', a)
    a = re.sub(r'\s*-\s*.*?(remaster|deluxe|bonus|anniversary|expanded|edition).*$', '', a, flags=re.IGNORECASE)
    a = a.strip(' -_')
    return a if a else str(album).strip()

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

def parse_cue_time(time_str: str) -> float:
    """Convert mm:ss:ff (75 frames per second) to float seconds."""
    parts = time_str.strip().split(":")
    if len(parts) == 3:
        try:
            mm, ss, ff = int(parts[0]), int(parts[1]), int(parts[2])
            return mm * 60.0 + ss + (ff / 75.0)
        except Exception:
            return 0.0
    elif len(parts) == 2:
        try:
            mm, ss = int(parts[0]), int(parts[1])
            return mm * 60.0 + ss
        except Exception:
            return 0.0
    return 0.0

def decode_cue_bytes(raw: bytes) -> str:
    """Decode raw CUE bytes with fallback across common rip encodings (UTF-8, CP1251, Latin-1)."""
    for enc in ["utf-8-sig", "utf-8", "cp1251", "windows-1251", "latin1"]:
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="ignore")

def parse_cue_content(cue_text: str) -> Dict[str, Any]:
    """Parse CUE sheet text into album metadata and sliced track definitions."""
    album_artist = ""
    album_title = ""
    genre = ""
    year = ""
    target_file = ""
    tracks: List[Dict[str, Any]] = []
    current_track = None

    def unquote(val: str) -> str:
        val = val.strip()
        if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
            return val[1:-1].strip()
        return val

    for line in cue_text.splitlines():
        line = line.strip()
        if not line:
            continue

        if line.upper().startswith("REM GENRE"):
            genre = unquote(line[9:].strip())
        elif line.upper().startswith("REM DATE") or line.upper().startswith("REM YEAR"):
            year = unquote(re.sub(r"^REM\s+(DATE|YEAR)\s+", "", line, flags=re.IGNORECASE).strip())
        elif line.upper().startswith("GENRE"):
            genre = unquote(line[5:].strip())
        elif line.upper().startswith("DATE") or line.upper().startswith("YEAR"):
            year = unquote(re.sub(r"^(DATE|YEAR)\s+", "", line, flags=re.IGNORECASE).strip())
        elif line.upper().startswith("FILE"):
            m = re.match(r'^FILE\s+["\']?(.*?)["\']?\s+\w+$', line, re.IGNORECASE)
            if m:
                target_file = m.group(1).strip()
            else:
                parts = line.split()
                if len(parts) >= 2:
                    target_file = unquote(parts[1])
        elif line.upper().startswith("PERFORMER"):
            p_val = unquote(line[9:].strip())
            if current_track is None:
                album_artist = p_val
            else:
                current_track["artist"] = p_val
        elif line.upper().startswith("TITLE"):
            t_val = unquote(line[5:].strip())
            if current_track is None:
                album_title = t_val
            else:
                current_track["title"] = t_val
        elif re.match(r'^TRACK\s+(\d+)\s+AUDIO', line, re.IGNORECASE):
            m = re.match(r'^TRACK\s+(\d+)\s+AUDIO', line, re.IGNORECASE)
            if current_track:
                tracks.append(current_track)
            track_num = int(m.group(1))
            current_track = {
                "track_no": track_num,
                "title": f"Track {track_num}",
                "artist": "",
                "start_time": 0.0,
                "index00": None
            }
        elif current_track is not None:
            if line.upper().startswith("INDEX 01"):
                time_str = line[8:].strip()
                current_track["start_time"] = parse_cue_time(time_str)
            elif line.upper().startswith("INDEX 00"):
                time_str = line[8:].strip()
                current_track["index00"] = parse_cue_time(time_str)

    if current_track:
        tracks.append(current_track)

    for idx, tr in enumerate(tracks):
        if not tr["artist"]:
            tr["artist"] = album_artist or "Unknown Artist"
        if idx < len(tracks) - 1:
            next_start = tracks[idx + 1]["start_time"]
            tr["duration_sec"] = max(0.0, round(next_start - tr["start_time"], 2))
            tr["end_time"] = next_start
        else:
            tr["duration_sec"] = 0.0
            tr["end_time"] = 0.0

    return {
        "album_artist": album_artist,
        "album_title": album_title,
        "genre": genre,
        "year": year,
        "target_file": target_file,
        "tracks": tracks
    }

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
                    is_cue INTEGER DEFAULT 0,
                    parent_file_id INTEGER DEFAULT 0,
                    cue_start_time REAL DEFAULT 0.0,
                    cue_end_time REAL DEFAULT 0.0,
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
                    total_duration REAL,
                    metadata_status TEXT DEFAULT 'cached'
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

                CREATE TABLE IF NOT EXISTS track_lyrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    track_id INTEGER UNIQUE,
                    artist TEXT,
                    title TEXT,
                    album TEXT,
                    synced INTEGER DEFAULT 0,
                    plain_lyrics TEXT,
                    synced_lyrics TEXT,
                    source TEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_lyrics_artist_title ON track_lyrics(artist, title);
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
                if "is_manual_genre" not in tracks_cols:
                    conn.execute("ALTER TABLE tracks ADD COLUMN is_manual_genre INTEGER DEFAULT 0;")
                if "metadata_status" not in tracks_cols:
                    conn.execute("ALTER TABLE tracks ADD COLUMN metadata_status TEXT DEFAULT 'cached';")
                if "is_cue" not in tracks_cols:
                    conn.execute("ALTER TABLE tracks ADD COLUMN is_cue INTEGER DEFAULT 0;")
                if "parent_file_id" not in tracks_cols:
                    conn.execute("ALTER TABLE tracks ADD COLUMN parent_file_id INTEGER DEFAULT 0;")
                if "cue_start_time" not in tracks_cols:
                    conn.execute("ALTER TABLE tracks ADD COLUMN cue_start_time REAL DEFAULT 0.0;")
                if "cue_end_time" not in tracks_cols:
                    conn.execute("ALTER TABLE tracks ADD COLUMN cue_end_time REAL DEFAULT 0.0;")
            except Exception as e:
                logger.debug(f"Tracks migration error: {e}")

            try:
                albums_cols = [c[1] for c in conn.execute("PRAGMA table_info(albums)").fetchall()]
                if "cover_url" not in albums_cols:
                    conn.execute("ALTER TABLE albums ADD COLUMN cover_url TEXT;")
                if "genre_locked" not in albums_cols:
                    conn.execute("ALTER TABLE albums ADD COLUMN genre_locked INTEGER DEFAULT 0;")
                if "is_manual_genre" not in albums_cols:
                    conn.execute("ALTER TABLE albums ADD COLUMN is_manual_genre INTEGER DEFAULT 0;")
                if "metadata_status" not in albums_cols:
                    conn.execute("ALTER TABLE albums ADD COLUMN metadata_status TEXT DEFAULT 'cached';")
            except Exception as e:
                logger.debug(f"Albums migration error: {e}")

    def save_track(self, track_data: Dict[str, Any]):
        with self.get_conn() as conn:
            fid = track_data.get("file_id")
            existing = conn.execute("SELECT genre, is_manual_genre, genre_locked, cover_hash, cover_url FROM tracks WHERE file_id = ?", (fid,)).fetchone()
            
            raw_genre = track_data.get("genre")
            incoming_genre = clean_genre(raw_genre)
            
            final_genre = incoming_genre
            is_manual = track_data.get("is_manual_genre", 0)
            genre_locked = track_data.get("genre_locked", 0)
            
            if existing:
                ex_genre, ex_manual, ex_locked, ex_cov_h, ex_cov_u = existing
                is_manual = max(is_manual, ex_manual or 0)
                genre_locked = max(genre_locked, ex_locked or 0)
                
                # Protect valid or manually set genre
                if is_manual or genre_locked or (ex_genre and ex_genre not in ('Разное', 'Other', 'Unknown', '')):
                    if incoming_genre in ('Разное', 'Other', 'Unknown', '', None):
                        final_genre = ex_genre
                    elif is_manual or genre_locked:
                        final_genre = ex_genre
                    else:
                        final_genre = incoming_genre

            conn.execute("""
                INSERT INTO tracks 
                (file_id, drive_id, parent_id, filename, title, artist, album_artist, album, album_id, year, genre, track_no, duration_sec, bitrate, cover_hash, cover_url, file_size, format, is_manual_genre, genre_locked, is_cue, parent_file_id, cue_start_time, cue_end_time)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(file_id) DO UPDATE SET
                    drive_id=excluded.drive_id,
                    parent_id=excluded.parent_id,
                    filename=excluded.filename,
                    title=excluded.title,
                    artist=excluded.artist,
                    album_artist=excluded.album_artist,
                    album=excluded.album,
                    album_id=excluded.album_id,
                    year=excluded.year,
                    genre=CASE 
                        WHEN tracks.is_manual_genre = 1 OR tracks.genre_locked = 1 THEN tracks.genre
                        WHEN tracks.genre IS NOT NULL AND tracks.genre NOT IN ('Разное', 'Other', 'Unknown', '') AND (excluded.genre IS NULL OR excluded.genre IN ('Разное', 'Other', 'Unknown', '')) THEN tracks.genre
                        ELSE COALESCE(NULLIF(excluded.genre, 'Разное'), tracks.genre, 'Разное')
                    END,
                    is_manual_genre=MAX(tracks.is_manual_genre, excluded.is_manual_genre),
                    genre_locked=MAX(tracks.genre_locked, excluded.genre_locked),
                    track_no=excluded.track_no,
                    duration_sec=excluded.duration_sec,
                    bitrate=excluded.bitrate,
                    cover_hash=COALESCE(NULLIF(excluded.cover_hash, ''), tracks.cover_hash),
                    cover_url=COALESCE(NULLIF(excluded.cover_url, ''), tracks.cover_url),
                    file_size=excluded.file_size,
                    format=excluded.format,
                    is_cue=excluded.is_cue,
                    parent_file_id=excluded.parent_file_id,
                    cue_start_time=excluded.cue_start_time,
                    cue_end_time=excluded.cue_end_time
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
                final_genre or 'Разное',
                track_data.get("track_no", 0),
                track_data.get("duration_sec", 0.0),
                track_data.get("bitrate", 0),
                track_data.get("cover_hash"),
                track_data.get("cover_url"),
                track_data.get("file_size", 0),
                track_data.get("format"),
                is_manual,
                genre_locked,
                1 if track_data.get("is_cue") else 0,
                track_data.get("parent_file_id", 0),
                track_data.get("cue_start_time", 0.0),
                track_data.get("cue_end_time", 0.0)
            ))

    def recompute_aggregates(self):
        with self.get_conn() as conn:
            # Recompute Albums directly from tracks grouped strictly by album_id
            conn.execute("DELETE FROM albums;")
            conn.execute("""
                INSERT OR REPLACE INTO albums (id, title, artist, year, genre, cover_hash, cover_url, track_count, total_duration, metadata_status, is_manual_genre, genre_locked)
                SELECT 
                    album_id as id,
                    ifnull(nullif(trim(album), ''), 'Unknown Album') as title,
                    ifnull(nullif(trim(album_artist), ''), ifnull(nullif(trim(artist), ''), 'Unknown Artist')) as artist,
                    max(ifnull(year, '')) as year,
                    COALESCE(
                        max(CASE WHEN genre NOT IN ('Разное', 'Other', 'Unknown', '') THEN genre ELSE NULL END),
                        max(ifnull(genre, 'Разное')),
                        'Разное'
                    ) as genre,
                    max(ifnull(cover_hash, '')) as cover_hash,
                    max(ifnull(cover_url, '')) as cover_url,
                    count(*) as track_count,
                    sum(ifnull(duration_sec, 0.0)) as total_duration,
                    case 
                        when max(ifnull(cover_url, '')) != '' and max(ifnull(genre, 'Разное')) not in ('Разное', 'Other', 'Unknown', '') then 'cached'
                        else 'pending'
                    end as metadata_status,
                    max(ifnull(is_manual_genre, 0)) as is_manual_genre,
                    max(ifnull(genre_locked, 0)) as genre_locked
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

    def get_track(self, file_id: Any) -> Optional[Dict[str, Any]]:
        with self.get_conn() as conn:
            row = conn.execute("SELECT * FROM tracks WHERE file_id = ? OR CAST(file_id AS TEXT) = ?", (file_id, str(file_id))).fetchone()
            return dict(row) if row else None

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
    def fetch_from_itunes(cls, artist: str, album: str, timeout: float = 2.0) -> Optional[Dict[str, Any]]:
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
        
        timeout_cfg = httpx.Timeout(connect=2.0, read=2.0, write=2.0, pool=2.0)

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
    def fetch_from_musicbrainz(cls, artist: str, album: str, timeout: float = 2.0) -> Optional[Dict[str, Any]]:
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
    def download_cover_image(cls, artwork_url: str, album_hash: str, timeout: float = 2.0) -> Optional[str]:
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
                    print(f"[CrowMusic Online] ✓ Saved cover art ({len(r.content)} bytes) to disk: {out_path}")
                    return f"/api/plugins/crow-music/cover/{album_hash}"
        except Exception as e:
            print(f"[CrowMusic Online] Cover download error (fallback to direct URL): {e}")
            logger.debug(f"[CrowMusic Online] Cover download error: {e}")
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
        metadata_status = album.get("metadata_status", "cached")

        # 1. Sanity Check: Block online search for generic metadata ("Unknown Artist" / "Музыка")
        if is_generic_metadata(artist, title):
            print(f"[CrowMusic Online] 🚫 Skipped online search for generic metadata: Artist='{artist}', Title='{title}'")
            if current_cover and (current_cover.startswith("http") or not current_cover.startswith("/api/download/")):
                with db.get_conn() as conn:
                    conn.execute("UPDATE tracks SET cover_hash = NULL, cover_url = NULL, metadata_status = 'cached' WHERE album_id = ?;", (album_id,))
                db.recompute_aggregates()
                album = db.get_album(album_id)
            return {"status": "skipped", "message": "Generic metadata - online search disabled", "album": album}

        # 2. Check if album ALREADY has a local folder image file (Priority #1)
        has_local_cover = bool(current_cover and (current_cover.startswith("/api/download/") or (current_cover_hash and current_cover_hash.startswith("folder_file_"))))

        # 3. Check if album ALREADY has a valid genre
        has_valid_genre = bool(current_genre and current_genre not in ["Разное", "Other", "Unknown", "Unknown Genre", ""] and current_genre.lower() not in GARBAGE_GENRES)

        # 4. If album is already cached/enriched and not forced: SKIP NETWORK SEARCH COMPLETELY
        if not force and (has_local_cover or current_cover) and has_valid_genre:
            return {"status": "cached", "message": "Album already has cached cover and genre", "album": album}

        # Local folder cover should NEVER be overwritten by network covers!
        need_cover = not has_local_cover and (force or not current_cover)
        need_genre = not has_valid_genre
        need_year = force or not current_year

        print(f"\n[CrowMusic Online] Enriching album '{album_id}': Artist='{artist}', Title='{title}', HasLocalCover={has_local_cover}, HasValidGenre={has_valid_genre} ('{current_genre}'), NeedCover={need_cover}, NeedGenre={need_genre}, NeedYear={need_year}")

        if not (need_cover or need_genre or need_year):
            return {"status": "ok", "message": "Already enriched with valid metadata", "album": album}

        # Query iTunes RU (timeout 2.0s)
        info = cls.fetch_from_itunes(artist, title, timeout=2.0)

        # Fallback to MusicBrainz (timeout 2.0s)
        if not info or (not info.get("artwork_url") and need_cover) or (info.get("genre") in ["Разное", "", None] and need_genre):
            mb_info = cls.fetch_from_musicbrainz(artist, title, timeout=2.0)
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
            cached_url = cls.download_cover_image(info["artwork_url"], album_hash, timeout=2.0)
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
                    cover_hash = CASE WHEN ? != '' THEN ? ELSE cover_hash END,
                    metadata_status = 'enriched'
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
        all_scanned_file_ids = set()

        for drive in drives:
            drive_id = drive["id"]
            files = list_files_db(drive_id=drive_id)
            
            # Map folders by ID
            folder_map = {f["id"]: f["name"] for f in files if f.get("is_folder")}

            # Map image files and CUE sheet files per folder
            folder_images = {}
            folder_cues: Dict[int, List[Dict[str, Any]]] = {}
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
                    elif fext == ".cue" or fname.endswith(".cue"):
                        pid = f.get("parent_id", 0)
                        folder_cues.setdefault(pid, []).append(f)

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
                    all_scanned_file_ids.add(f["id"])
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
                        "format": ext.replace(".", "").upper(),
                        "is_cue": 0,
                        "parent_file_id": 0,
                        "cue_start_time": 0.0,
                        "cue_end_time": 0.0
                    })

            # Hard Folder-First Aggregation: Exactly ONE album per directory
            for pid, tracks in folder_tracks.items():
                folder_name = folder_map.get(pid, "Музыка" if pid == 0 else f"Папка {pid}")
                folder_info = parse_folder_name(folder_name)
                parent_name = folder_map.get(pid, "")

                # CUE Virtual Track Slicing
                if pid in folder_cues:
                    for cue_f in folder_cues[pid]:
                        cue_text = ""
                        loc_path = cue_f.get("local_path")
                        if loc_path and os.path.exists(loc_path):
                            try:
                                with open(loc_path, "rb") as cf:
                                    cue_text = decode_cue_bytes(cf.read())
                            except Exception as e:
                                logger.debug(f"Error reading CUE file {loc_path}: {e}")
                        elif cue_f.get("content"):
                            cue_text = cue_f["content"]
                        elif "id" in cue_f:
                            try:
                                from src.core.db import get_file_info
                                fi = get_file_info(cue_f["id"])
                                if fi and fi.get("local_path") and os.path.exists(fi["local_path"]):
                                    with open(fi["local_path"], "rb") as cf:
                                        cue_text = decode_cue_bytes(cf.read())
                            except Exception:
                                pass

                        if cue_text:
                            cue_meta = parse_cue_content(cue_text)
                            if cue_meta["tracks"]:
                                target_fn = (cue_meta["target_file"] or "").strip().lower()
                                target_audio = None
                                if target_fn:
                                    target_audio = next((t for t in tracks if t["filename"].lower() == target_fn or Path(t["filename"]).stem.lower() == Path(target_fn).stem.lower()), None)
                                if not target_audio:
                                    cue_stem = Path(cue_f.get("name", "")).stem.lower()
                                    target_audio = next((t for t in tracks if Path(t["filename"]).stem.lower() == cue_stem), None)
                                if not target_audio and len(tracks) == 1:
                                    target_audio = tracks[0]
                                elif not target_audio and tracks:
                                    target_audio = max(tracks, key=lambda t: t.get("file_size", 0))

                                if target_audio:
                                    parent_fid = target_audio["file_id"]
                                    # Remove target_audio from tracks to prevent duplicate display of raw un-split image
                                    tracks = [t for t in tracks if t["file_id"] != parent_fid]
                                    all_scanned_file_ids.discard(parent_fid)

                                    parent_dur = target_audio.get("duration_sec", 0.0)

                                    for tr in cue_meta["tracks"]:
                                        track_num = tr["track_no"]
                                        virtual_fid = int(f"{parent_fid}0{track_num:03d}")
                                        all_scanned_file_ids.add(virtual_fid)

                                        dur = tr["duration_sec"]
                                        if dur <= 0 and parent_dur > tr["start_time"]:
                                            dur = max(0.0, round(parent_dur - tr["start_time"], 2))

                                        tracks.append({
                                            "file_id": virtual_fid,
                                            "drive_id": drive_id,
                                            "parent_id": pid,
                                            "parent_name": parent_name,
                                            "filename": f"{track_num:02d}. {tr['title']}.cue_track",
                                            "title": tr["title"],
                                            "artist": tr["artist"] or cue_meta["album_artist"] or "Unknown Artist",
                                            "album_artist": cue_meta["album_artist"] or target_audio.get("album_artist", ""),
                                            "album": cue_meta["album_title"] or target_audio.get("album", folder_name),
                                            "year": cue_meta["year"] or target_audio.get("year", folder_info["year"]),
                                            "genre": clean_genre(cue_meta["genre"]) if cue_meta["genre"] else target_audio.get("genre", "Разное"),
                                            "track_no": track_num,
                                            "duration_sec": dur,
                                            "bitrate": target_audio.get("bitrate", 320),
                                            "cover_hash": None,
                                            "cover_url": None,
                                            "file_size": target_audio.get("file_size", 0),
                                            "format": target_audio.get("format", "FLAC"),
                                            "is_cue": 1,
                                            "parent_file_id": parent_fid,
                                            "cue_start_time": tr["start_time"],
                                            "cue_end_time": tr.get("end_time", 0.0)
                                        })

                # Fetch existing tracks in DB for this folder to preserve manual tags, custom genre & cover
                existing_genres = []
                existing_covers = []
                with db.get_conn() as conn:
                    if pid > 0:
                        rows = conn.execute("SELECT genre, is_manual_genre, genre_locked, cover_url, cover_hash FROM tracks WHERE parent_id = ?", (pid,)).fetchall()
                    else:
                        rows = conn.execute("SELECT genre, is_manual_genre, genre_locked, cover_url, cover_hash FROM tracks WHERE drive_id = ? AND parent_id = 0", (drive_id,)).fetchall()
                    for r in rows:
                        g, man, lk, cu, ch = r[0], r[1], r[2], r[3], r[4]
                        if man or lk or (g and g not in ('Разное', 'Other', 'Unknown', '')):
                            existing_genres.append(g)
                        if cu:
                            existing_covers.append((cu, ch))

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

                # 4. Unified Genre: prefer manually set or existing valid genre in DB
                if existing_genres:
                    unified_genre = Counter(existing_genres).most_common(1)[0][0]
                else:
                    valid_genres = [t["genre"] for t in tracks if t.get("genre") and t["genre"] not in ["Разное", "Other", "Unknown", ""]]
                    unified_genre = Counter(valid_genres).most_common(1)[0][0] if valid_genres else "Разное"

                # 5. Strict Album ID: exactly 1 album ID for this directory
                if pid > 0:
                    album_id = f"d{drive_id}_f{pid}"
                else:
                    clean_title_str = re.sub(r'[^a-zA-Z0-9_\u0400-\u04FF]', '_', unified_album.lower())
                    album_id = f"d{drive_id}_root_{clean_title_str}"

                # 6. Resolve Cover Art (Priority #1: Local folder image)
                cover_hash = None
                cover_url = None
                if pid in folder_images:
                    img_id = folder_images[pid]
                    cover_hash = f"folder_file_{img_id}"
                    cover_url = f"/api/download/{img_id}"
                elif existing_covers:
                    cover_url, cover_hash = existing_covers[0]

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

        # Delete only orphaned tracks physically removed from drives
        if all_scanned_file_ids:
            with db.get_conn() as conn:
                placeholders = ",".join("?" for _ in all_scanned_file_ids)
                conn.execute(f"DELETE FROM tracks WHERE file_id NOT IN ({placeholders});", list(all_scanned_file_ids))

        db.recompute_aggregates()
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
    """Return database statistics and scanning status."""
    return JSONResponse(content={
        "status": "ready",
        "stats": db.get_stats(),
        "last_scanned": db.get_meta("last_scanned")
    })

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
            remote_url = row["cover_url"]
            try:
                if HAVE_HTTPX:
                    timeout_cfg = httpx.Timeout(connect=2.0, read=2.0, write=2.0, pool=2.0)
                    with httpx.Client(timeout=timeout_cfg, trust_env=False, follow_redirects=True) as client:
                        r = client.get(remote_url)
                        if r.status_code == 200 and len(r.content) > 500:
                            cover_file.write_bytes(r.content)
                            return FileResponse(cover_file, media_type="image/jpeg")
            except Exception as e:
                logger.debug(f"Cover download on-demand error: {e}")
            return RedirectResponse(url=remote_url)

    icon_file = PLUGIN_DIR / "icon.svg"
    if icon_file.exists():
        return FileResponse(icon_file, media_type="image/svg+xml")

    raise HTTPException(status_code=404, detail="Cover not found")

@router.get("/stream/{file_id}")
async def api_music_stream(file_id: int):
    """Proxy stream through core CrowGram range streamer (transparently resolving CUE parent file)."""
    with db.get_conn() as conn:
        row = conn.execute("SELECT is_cue, parent_file_id FROM tracks WHERE file_id = ? OR CAST(file_id AS TEXT) = ?", (file_id, str(file_id))).fetchone()
        if row and row["is_cue"] and row["parent_file_id"]:
            return RedirectResponse(url=f"/api/stream/{row['parent_file_id']}")
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
                    genre_locked = 1, is_manual_genre = 1
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

def fetch_lyrics_from_lrclib(artist: str, title: str, album: str = "", duration: float = 0.0) -> Optional[Dict[str, Any]]:
    """Fetch synced (LRC) or plain lyrics from open LRCLIB API using 3-stage cascaded search."""
    if not artist or not title:
        return None
        
    clean_art = re.sub(r"\s*[\(\[\{].*?[\)\]\}]", "", artist).strip() or artist.strip()
    clean_tit = clean_title(title)
    clean_alb = clean_album(album)
    
    headers = {
        "User-Agent": "CrowGram-Music/2.0 (CrowGram Cloud Desktop; https://github.com/SlowCrow666/CrowGram)",
        "Accept": "application/json"
    }

    # ==========================================================
    # Stage 1: Strict Match (artist + clean_title + clean_album + duration)
    # ==========================================================
    try:
        params = {
            "artist_name": clean_art,
            "track_name": clean_tit,
        }
        if clean_alb:
            params["album_name"] = clean_alb
        if duration and duration > 10:
            params["duration"] = int(duration)
            
        url = f"https://lrclib.net/api/get?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=4.0) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                synced = data.get("syncedLyrics") or ""
                plain = data.get("plainLyrics") or ""
                if synced or plain:
                    return {
                        "synced": bool(synced),
                        "plain_lyrics": plain,
                        "synced_lyrics": synced,
                        "source": "lrclib"
                    }
    except Exception as e:
        logger.debug(f"LRCLIB Stage 1 (Strict) failed: {e}")

    # ==========================================================
    # Stage 2: Fallback Exact Match (artist + clean_title only)
    # ==========================================================
    try:
        params2 = {
            "artist_name": clean_art,
            "track_name": clean_tit,
        }
        url2 = f"https://lrclib.net/api/get?{urllib.parse.urlencode(params2)}"
        req2 = urllib.request.Request(url2, headers=headers)
        with urllib.request.urlopen(req2, timeout=4.0) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                synced = data.get("syncedLyrics") or ""
                plain = data.get("plainLyrics") or ""
                if synced or plain:
                    return {
                        "synced": bool(synced),
                        "plain_lyrics": plain,
                        "synced_lyrics": synced,
                        "source": "lrclib"
                    }
    except Exception as e:
        logger.debug(f"LRCLIB Stage 2 (Fallback) failed: {e}")

    # ==========================================================
    # Stage 3: Fuzzy Search Query (search?q=artist+clean_title)
    # ==========================================================
    try:
        q_str = f"{clean_art} {clean_tit}".strip()
        url3 = f"https://lrclib.net/api/search?q={urllib.parse.quote(q_str)}"
        req3 = urllib.request.Request(url3, headers=headers)
        with urllib.request.urlopen(req3, timeout=4.0) as resp:
            if resp.status == 200:
                results = json.loads(resp.read().decode("utf-8"))
                if isinstance(results, list) and results:
                    # Prioritize item with synced lyrics
                    best = None
                    for r in results:
                        if r.get("syncedLyrics"):
                            best = r
                            break
                    if not best:
                        best = results[0]
                    synced = best.get("syncedLyrics") or ""
                    plain = best.get("plainLyrics") or ""
                    if synced or plain:
                        return {
                            "synced": bool(synced),
                            "plain_lyrics": plain,
                            "synced_lyrics": synced,
                            "source": "lrclib"
                        }
    except Exception as e:
        logger.debug(f"LRCLIB Stage 3 (Fuzzy Search) failed: {e}")

    return None

@router.get("/lyrics")
async def api_music_get_lyrics(
    track_id: Optional[str] = None,
    artist: Optional[str] = None,
    title: Optional[str] = None,
    album: Optional[str] = None,
    duration: Optional[float] = None
):
    """Retrieve synchronized (LRC) or plain lyrics for a track with multi-tier caching (Disk -> SQLite -> Local File -> LRCLIB)."""
    cur_artist = (artist or "").strip()
    cur_title = (title or "").strip()
    cur_album = (album or "").strip()
    cur_duration = duration or 0.0
    parent_id = 0
    filename = ""

    if track_id:
        with db.get_conn() as conn:
            row = conn.execute("SELECT * FROM tracks WHERE file_id = ? OR CAST(file_id AS TEXT) = ?", (track_id, track_id)).fetchone()
            if row:
                t = dict(row)
                if not cur_artist: cur_artist = t.get("artist", "")
                if not cur_title: cur_title = t.get("title", "")
                if not cur_album: cur_album = t.get("album", "")
                if not cur_duration: cur_duration = t.get("duration_sec", 0.0)
                parent_id = t.get("parent_id", 0)
                filename = t.get("filename", "")

    clean_art = re.sub(r"\s*[\(\[\{].*?[\)\]\}]", "", cur_artist).strip() or cur_artist.strip()
    clean_tit = clean_title(cur_title)
    clean_alb = clean_album(cur_album)
    track_hash = hashlib.md5(f"{clean_art.lower()}_{clean_tit.lower()}".encode("utf-8")).hexdigest()
    disk_cache_file = LYRICS_CACHE_DIR / f"{track_hash}.json"

    # 1. Tier 1: Check SQLite Cache
    with db.get_conn() as conn:
        cached = conn.execute(
            "SELECT * FROM track_lyrics WHERE track_id = ? OR (artist = ? AND title = ?) OR (artist = ? AND title = ?)", 
            (track_id, cur_artist, cur_title, clean_art, clean_tit)
        ).fetchone()
        if cached:
            c = dict(cached)
            return JSONResponse(content={
                "status": "ok",
                "synced": bool(c.get("synced")),
                "plain_lyrics": c.get("plain_lyrics") or "",
                "synced_lyrics": c.get("synced_lyrics") or "",
                "source": c.get("source") or "cache"
            })

    # 2. Tier 2: Check Disk Cache File (.cache/crow-music/lyrics/{track_hash}.json)
    if disk_cache_file.is_file():
        try:
            cached_disk = json.loads(disk_cache_file.read_text(encoding="utf-8"))
            if cached_disk and (cached_disk.get("plain_lyrics") or cached_disk.get("synced_lyrics")):
                # Mirror to SQLite for fast query next time
                with db.get_conn() as conn:
                    conn.execute("""
                        INSERT OR REPLACE INTO track_lyrics (track_id, artist, title, album, synced, plain_lyrics, synced_lyrics, source)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        track_id, 
                        cur_artist, 
                        cur_title, 
                        cur_album, 
                        1 if cached_disk.get("synced") else 0, 
                        cached_disk.get("plain_lyrics", ""), 
                        cached_disk.get("synced_lyrics", ""), 
                        cached_disk.get("source", "disk_cache")
                    ))
                return JSONResponse(content={
                    "status": "ok",
                    "synced": bool(cached_disk.get("synced")),
                    "plain_lyrics": cached_disk.get("plain_lyrics") or "",
                    "synced_lyrics": cached_disk.get("synced_lyrics") or "",
                    "source": cached_disk.get("source") or "disk_cache"
                })
        except Exception as e:
            logger.debug(f"Disk lyrics cache read error: {e}")

    # 3. Tier 3: Check local directory for .lrc or .txt files
    if track_id and (parent_id or filename):
        try:
            from src.core.db import get_files_in_folder
            files = get_files_in_folder(parent_id) if parent_id else []
            base_name = Path(filename).stem.lower() if filename else ""
            
            for f in files:
                fname = f.get("name", "")
                f_stem = Path(fname).stem.lower()
                f_ext = Path(fname).suffix.lower()
                if f_ext in [".lrc", ".txt"] and (f_stem == base_name or "lyrics" in f_stem or (cur_title and f_stem == cur_title.lower()) or (clean_tit and f_stem == clean_tit.lower())):
                    fid = f.get("id")
                    if fid:
                        from src.core.db import get_file_by_id
                        f_info = get_file_by_id(fid)
                        local_path = f_info.get("local_path") if f_info else None
                        if local_path and os.path.exists(local_path):
                            with open(local_path, "r", encoding="utf-8", errors="ignore") as lf:
                                content = lf.read()
                                is_synced = bool(re.search(r"\[\d{1,2}:\d{2}", content))
                                res_payload = {
                                    "status": "ok",
                                    "synced": is_synced,
                                    "plain_lyrics": content if not is_synced else "",
                                    "synced_lyrics": content if is_synced else "",
                                    "source": "local"
                                }
                                # Save to Disk Cache & SQLite
                                disk_cache_file.write_text(json.dumps(res_payload), encoding="utf-8")
                                with db.get_conn() as conn:
                                    conn.execute("""
                                        INSERT OR REPLACE INTO track_lyrics (track_id, artist, title, album, synced, plain_lyrics, synced_lyrics, source)
                                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                                    """, (track_id, cur_artist, cur_title, cur_album, 1 if is_synced else 0, content if not is_synced else "", content if is_synced else "", "local"))
                                return JSONResponse(content=res_payload)
        except Exception as e:
            logger.debug(f"Local lyrics search error: {e}")

    # 4. Tier 4: Online Search via LRCLIB 3-Stage Cascaded API
    if cur_artist and cur_title:
        lrclib_res = fetch_lyrics_from_lrclib(cur_artist, cur_title, cur_album, cur_duration)
        if lrclib_res:
            res_payload = {
                "status": "ok",
                "synced": lrclib_res.get("synced", False),
                "plain_lyrics": lrclib_res.get("plain_lyrics", ""),
                "synced_lyrics": lrclib_res.get("synced_lyrics", ""),
                "source": "lrclib"
            }
            # Save to Disk Cache
            try:
                disk_cache_file.write_text(json.dumps(res_payload), encoding="utf-8")
            except Exception as e:
                logger.debug(f"Disk lyrics cache write error: {e}")

            # Save to SQLite
            with db.get_conn() as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO track_lyrics (track_id, artist, title, album, synced, plain_lyrics, synced_lyrics, source)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    track_id, 
                    cur_artist, 
                    cur_title, 
                    cur_album, 
                    1 if lrclib_res.get("synced") else 0, 
                    lrclib_res.get("plain_lyrics", ""), 
                    lrclib_res.get("synced_lyrics", ""), 
                    "lrclib"
                ))
            return JSONResponse(content=res_payload)

    return JSONResponse(content={
        "status": "ok",
        "synced": False,
        "plain_lyrics": "",
        "synced_lyrics": "",
        "source": "none"
    })

@router.post("/lyrics")
async def api_music_save_lyrics(payload: Dict[str, Any] = Body(...)):
    """Save user-provided plain or synced LRC lyrics into Disk Cache and SQLite."""
    track_id = payload.get("track_id")
    artist = (payload.get("artist") or "").strip()
    title = (payload.get("title") or "").strip()
    album = (payload.get("album") or "").strip()
    plain_lyrics = (payload.get("plain_lyrics") or "").strip()
    synced_lyrics = (payload.get("synced_lyrics") or "").strip()
    is_synced = bool(synced_lyrics)

    clean_art = re.sub(r"\s*[\(\[\{].*?[\)\]\}]", "", artist).strip() or artist.strip()
    clean_tit = clean_title(title)
    track_hash = hashlib.md5(f"{clean_art.lower()}_{clean_tit.lower()}".encode("utf-8")).hexdigest()
    disk_cache_file = LYRICS_CACHE_DIR / f"{track_hash}.json"

    res_payload = {
        "status": "ok",
        "synced": is_synced,
        "plain_lyrics": plain_lyrics,
        "synced_lyrics": synced_lyrics,
        "source": "custom"
    }

    try:
        disk_cache_file.write_text(json.dumps(res_payload), encoding="utf-8")
    except Exception as e:
        logger.debug(f"Disk lyrics cache write error: {e}")

    with db.get_conn() as conn:
        conn.execute("""
            INSERT OR REPLACE INTO track_lyrics (track_id, artist, title, album, synced, plain_lyrics, synced_lyrics, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'custom')
        """, (track_id, artist, title, album, 1 if is_synced else 0, plain_lyrics, synced_lyrics))

    return JSONResponse(content={
        "status": "ok",
        "saved": True,
        "synced": is_synced,
        "source": "custom"
    })


