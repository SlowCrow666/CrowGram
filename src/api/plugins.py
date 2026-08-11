from fastapi import APIRouter, Form, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from pathlib import Path
import json
import zipfile
import uuid
import shutil
import re
import sys

sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
from src.config import BASE_DIR, TEMP_DIR
from src.core.db import (
    get_plugin_defaults, set_plugin_default, remove_plugin_defaults_for_plugin
)

router = APIRouter(prefix="/api/plugins", tags=["Plugins"])

PLUGINS_DIR = BASE_DIR / "plugins"
PLUGINS_DIR.mkdir(parents=True, exist_ok=True)

def parse_plugin_info(plugin_path: Path):
    rel_file = plugin_path.name
    plugin_id = plugin_path.stem
    manifest_file = plugin_path.parent / f"{plugin_id}.json"
    
    info = {
        "file": rel_file, "name": plugin_id, "title": plugin_id,
        "version": "1.0.0", "description": "Плагин CrowGram",
        "category": "general", "author": "Разработчик"
    }
    
    if manifest_file.exists():
        try:
            data = json.loads(manifest_file.read_text(encoding="utf-8"))
            info.update({
                "title": data.get("title", plugin_id),
                "version": data.get("version", "1.0.0"),
                "description": data.get("description", "Плагин CrowGram"),
                "category": data.get("category", "general"),
                "author": data.get("author", "Разработчик")
            })
        except Exception:
            pass
    return info

@router.get("")
async def get_plugins():
    if not PLUGINS_DIR.exists():
        return JSONResponse(content={"plugins": [], "defaults": {}})
    js_files = [f for f in PLUGINS_DIR.glob("*.js")]
    plugins_data = [parse_plugin_info(f) for f in js_files]
    defaults = get_plugin_defaults()
    for category in ["video", "audio", "text"]:
        if category not in defaults:
            cat_plugins = [p for p in plugins_data if p["category"] == category]
            if cat_plugins:
                set_plugin_default(category, cat_plugins[0]["name"])
                defaults[category] = cat_plugins[0]["name"]
    return JSONResponse(content={"plugins": plugins_data, "defaults": defaults})

@router.post("/upload")
async def upload_plugin(file: UploadFile = File(...)):
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Плагин должен быть запакован в .zip архив")
    temp_zip = TEMP_DIR / f"plugin_{uuid.uuid4()}.zip"
    with open(temp_zip, "wb") as f:
        f.write(await file.read())
    try:
        with zipfile.ZipFile(temp_zip, "r") as zip_ref:
            filenames = zip_ref.namelist()
            js_files = [f for f in filenames if f.endswith(".js") and not f.startswith("__MACOSX")]
            if not js_files:
                raise HTTPException(status_code=400, detail="Архив не содержит .js файла плагина")
            for member in zip_ref.infolist():
                if member.filename.startswith("/") or ".." in member.filename:
                    raise HTTPException(status_code=400, detail="Недопустимая структура архива (Path Traversal)")
            for member in zip_ref.infolist():
                if member.filename.endswith(".js") or member.filename.endswith(".json"):
                    filename = Path(member.filename).name
                    if filename:
                        target_path = PLUGINS_DIR / filename
                        with zip_ref.open(member) as source, open(target_path, "wb") as target:
                            shutil.copyfileobj(source, target)
    except Exception as e:
        if temp_zip.exists(): temp_zip.unlink()
        raise HTTPException(status_code=400, detail=f"Ошибка распаковки архива: {str(e)}")
    finally:
        if temp_zip.exists(): temp_zip.unlink()
    return {"status": "success", "message": "Плагин успешно установлен"}

@router.delete("/{plugin_name}")
async def delete_plugin(plugin_name: str):
    safe_name = re.sub(r'[^a-zA-Z0-9_-]', '', plugin_name)
    if not safe_name:
        raise HTTPException(status_code=400, detail="Неверное имя плагина")
    js_file = PLUGINS_DIR / f"{safe_name}.js"
    json_file = PLUGINS_DIR / f"{safe_name}.json"
    if js_file.exists(): js_file.unlink()
    if json_file.exists(): json_file.unlink()
    remove_plugin_defaults_for_plugin(safe_name)
    return {"status": "success", "message": "Плагин удален"}

@router.post("/default")
async def set_default_plugin_api(category: str = Form(...), plugin_name: str = Form(...)):
    set_plugin_default(category, plugin_name)
    return {"status": "success"}
