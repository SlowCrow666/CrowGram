import os
import sys
import json
import zipfile
import shutil
from pathlib import Path

def build_crow_music_plugin():
    root_dir = Path(__file__).resolve().parent
    plugin_src = root_dir / "plugins_src" / "crow-music"
    dist_dir = root_dir / "dist" / "plugins"
    dist_dir.mkdir(parents=True, exist_ok=True)
    
    zip_output_path = dist_dir / "crow-music.zip"

    print("==================================================")
    print("   CrowGram - Plugin Builder: CrowMusic Hub       ")
    print("==================================================")

    if not plugin_src.exists():
        print(f"[ERROR] Source directory not found: {plugin_src}")
        sys.exit(1)

    # 1. Validate manifest.json
    manifest_path = plugin_src / "manifest.json"
    if not manifest_path.exists():
        print(f"[ERROR] manifest.json missing in {plugin_src}")
        sys.exit(1)

    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest_data = json.load(f)
        print(f"✓ Validated manifest.json (ID: {manifest_data.get('id')}, Version: {manifest_data.get('version')})")
    except Exception as e:
        print(f"[ERROR] Invalid JSON in manifest.json: {e}")
        sys.exit(1)

    # 2. Package ZIP archive
    print(f"\n[+] Compressing package into: {zip_output_path}")
    files_added = []
    
    with zipfile.ZipFile(zip_output_path, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for file_path in plugin_src.rglob("*"):
            if file_path.is_file() and not file_path.name.endswith(".pyc") and "__pycache__" not in str(file_path):
                rel_path = file_path.relative_to(plugin_src)
                zip_file.write(file_path, arcname=str(rel_path))
                files_added.append(str(rel_path))
                print(f"  • Added: {rel_path} ({file_path.stat().st_size:,} bytes)")

    # 3. Synchronize client plugin wrapper to CrowGram plugins folders
    client_js_src = plugin_src / "CrowMusic.js"
    if client_js_src.exists():
        static_plugins_dest = root_dir / "src" / "web" / "static" / "plugins" / "CrowMusic.js"
        root_plugins_dest = root_dir / "plugins" / "CrowMusic.js"
        
        static_plugins_dest.parent.mkdir(parents=True, exist_ok=True)
        root_plugins_dest.parent.mkdir(parents=True, exist_ok=True)

        shutil.copy(client_js_src, static_plugins_dest)
        shutil.copy(client_js_src, root_plugins_dest)
        print(f"\n✓ Installed CrowMusic.js to {static_plugins_dest.relative_to(root_dir)}")
        print(f"✓ Installed CrowMusic.js to {root_plugins_dest.relative_to(root_dir)}")

    print("\n==================================================")
    print(f"[SUCCESS] Plugin built successfully!")
    print(f"Archive: {zip_output_path}")
    print(f"Archive size: {zip_output_path.stat().st_size:,} bytes")
    print(f"Total files packaged: {len(files_added)}")
    print("==================================================")

if __name__ == "__main__":
    build_crow_music_plugin()
