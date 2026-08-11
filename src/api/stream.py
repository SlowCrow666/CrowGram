from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse, JSONResponse
from typing import Optional
import sys
import re
import time
import mimetypes
import io
import zipfile
import asyncio
from pathlib import Path
from urllib.parse import quote

sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
from src.config import DEFAULT_HOST, DEFAULT_PORT, CHUNK_SIZE_BYTES
from src.core.db import get_file_info, get_drive_info, get_file_chunks, get_config
from src.core.telegram_client import tg_manager

router = APIRouter(prefix="/api", tags=["Streaming"])

chunk_cache = {}
stream_semaphore = asyncio.Semaphore(3)
stream_progress = {}

def parse_peer_id(chat_id: str):
    cid_str = str(chat_id).strip()
    if cid_str.lower() == "me": return "me"
    if cid_str.startswith("-100") or cid_str.startswith("-"): return int(cid_str)
    if cid_str.isdigit(): return int(f"-100{cid_str}")
    return cid_str

async def get_cached_chunk_data(msg_id: int, chat_target, file_id: Optional[int] = None):
    cache_key = f"{chat_target}_{msg_id}"
    if cache_key in chunk_cache:
        data = chunk_cache[cache_key]
        if file_id and file_id in stream_progress:
            stream_progress[file_id]["downloaded_bytes"] += len(data)
        return data
        
    async with stream_semaphore:
        start_t = time.time()
        buffer = bytearray()
        
        try:
            async for chunk_bytes in tg_manager.download_chunk_stream(msg_id, chat_target):
                buffer.extend(chunk_bytes)
                if file_id and file_id in stream_progress:
                    elapsed = max(0.1, time.time() - start_t)
                    stream_progress[file_id]["downloaded_bytes"] += len(chunk_bytes)
                    stream_progress[file_id]["speed_mbps"] = round((len(chunk_bytes) / (1024 * 1024)) / elapsed, 2)
                    start_t = time.time()
        except Exception as e:
            print(f"[WARN] Ошибка потока, переподключение... {e}")
            await asyncio.sleep(1)
            await tg_manager.init_client()
            async for chunk_bytes in tg_manager.download_chunk_stream(msg_id, chat_target):
                buffer.extend(chunk_bytes)

        data = bytes(buffer)
        chunk_cache[cache_key] = data
            
        if len(chunk_cache) > 30:
            first_key = next(iter(chunk_cache))
            del chunk_cache[first_key]
            
        return data

@router.get("/stream/status/{file_id}")
async def get_stream_status(file_id: int):
    info = stream_progress.get(file_id, {"downloaded_bytes": 0, "total_bytes": 0, "speed_mbps": 0.0})
    percent = 0
    if info["total_bytes"] > 0:
        percent = min(100, int((info["downloaded_bytes"] / info["total_bytes"]) * 100))
    return JSONResponse(content={
        "downloaded_mb": round(info["downloaded_bytes"] / (1024 * 1024), 1),
        "total_mb": round(info["total_bytes"] / (1024 * 1024), 1),
        "percent": percent,
        "speed_mbps": info["speed_mbps"]
    })

@router.get("/stream/playlist/{file_id}.m3u")
async def get_vlc_playlist(file_id: int, request: Request):
    file_info = get_file_info(file_id)
    if not file_info: raise HTTPException(status_code=404, detail="Файл не найден")
    
    host = request.headers.get("host", f"{DEFAULT_HOST}:{DEFAULT_PORT}")
    stream_link = f"http://{host}/api/stream/{file_id}"
    
    content = f"#EXTM3U\n#EXTINF:-1,{file_info['name']}\n{stream_link}\n"
    headers = {"Content-Disposition": f"attachment; filename=\"stream.m3u\""}
    return Response(content=content, media_type="audio/x-mpegurl", headers=headers)

@router.get("/download/{file_id}")
async def download_file(file_id: int):
    file_info = get_file_info(file_id)
    if not file_info or file_info["is_folder"]: raise HTTPException(status_code=404, detail="Файл не найден")
    drive = get_drive_info(file_info["drive_id"])
    file_size = file_info["size"]
    if file_size == 0: return Response(content=b"", media_type="application/octet-stream")

    chunks = get_file_chunks(file_id)
    chat_target = parse_peer_id(drive["tg_chat_id"])
    
    async def full_streamer():
        for chunk_info in chunks:
            chunk_data = await get_cached_chunk_data(chunk_info["message_id"], chat_target, file_id)
            yield chunk_data
                
    raw_name = re.sub(r'[\\/*?:"<>|]', '_', file_info["name"])
    ascii_fallback = raw_name.encode('ascii', 'ignore').decode('ascii').strip() or "file"
    encoded_utf8_name = quote(raw_name)
    headers = {"Content-Length": str(file_size), "Content-Disposition": f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{encoded_utf8_name}"}
    return StreamingResponse(full_streamer(), status_code=200, headers=headers, media_type="application/octet-stream")

@router.get("/stream/{file_id}")
async def stream_file(file_id: int, request: Request):
    file_info = get_file_info(file_id)
    if not file_info or file_info["is_folder"]: raise HTTPException(status_code=404, detail="Файл не найден")
    drive = get_drive_info(file_info["drive_id"])
    file_size = file_info["size"]
    mime_type, _ = mimetypes.guess_type(file_info["name"])
    media_type = mime_type or "video/mp4"

    if file_size == 0: return Response(content=b"", media_type=media_type)
    chunks = get_file_chunks(file_id)
    chat_target = parse_peer_id(drive["tg_chat_id"])
    
    stream_progress[file_id] = {"downloaded_bytes": 0, "total_bytes": file_size, "speed_mbps": 0.0}

    range_header = request.headers.get("Range")
    start = 0
    end = file_size - 1
    if range_header:
        match = re.match(r"bytes=(\d+)-(\d*)", range_header)
        if match:
            start = int(match.group(1))
            if match.group(2): end = int(match.group(2))

    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(end - start + 1),
        "Content-Type": media_type,
    }
    status_code = 206 if range_header else 200

    async def range_streamer():
        current_pos = 0
        for chunk_info in chunks:
            chunk_size = chunk_info.get("size") or chunk_info.get("chunk_size") or CHUNK_SIZE_BYTES
            if current_pos + chunk_size <= start:
                current_pos += chunk_size
                continue
            if current_pos > end: break
            data = await get_cached_chunk_data(chunk_info["message_id"], chat_target, file_id)
            data_len = len(data)
            yield_start = max(current_pos, start)
            yield_end = min(current_pos + data_len - 1, end)
            if yield_start <= yield_end:
                slice_start = yield_start - current_pos
                slice_end = yield_end - current_pos + 1
                yield data[slice_start:slice_end]
            current_pos += data_len
            if current_pos > end: break

    return StreamingResponse(range_streamer(), status_code=status_code, headers=headers, media_type=media_type)

@router.get("/transcode/{file_id}")
async def transcode_file(file_id: int, request: Request):
    return await stream_file(file_id, request)

@router.get("/download-zip")
async def download_zip(ids: str = Query(...), name: Optional[str] = Query("archive")):
    file_ids = [int(i) for i in ids.split(",") if i.isdigit()]
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for fid in file_ids:
            file_info = get_file_info(fid)
            if not file_info or file_info["is_folder"]: continue
            drive = get_drive_info(file_info["drive_id"])
            chat_target = parse_peer_id(drive["tg_chat_id"])
            chunks = get_file_chunks(fid)
            file_data = bytearray()
            for chunk_info in chunks:
                chunk_bytes = await get_cached_chunk_data(chunk_info["message_id"], chat_target, fid)
                file_data.extend(chunk_bytes)
            zip_file.writestr(file_info["name"], bytes(file_data))
    zip_buffer.seek(0)
    raw_name = re.sub(r'[\\/*?:"<>|]', '_', name.strip()) or "archive"
    ascii_fallback = raw_name.encode('ascii', 'ignore').decode('ascii').strip() or "archive"
    encoded_utf8_name = quote(f"{raw_name}.zip")
    headers = {"Content-Disposition": f"attachment; filename=\"{ascii_fallback}.zip\"; filename*=UTF-8''{encoded_utf8_name}"}
    return StreamingResponse(zip_buffer, media_type="application/zip", headers=headers)
