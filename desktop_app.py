import sys
import os
import threading
import time
from pathlib import Path

# Добавляем корень проекта в пути импорта
BASE_DIR = Path(__file__).resolve().parent
sys.path.append(str(BASE_DIR))

import uvicorn
import webview
from app import app, find_free_port, DEFAULT_PORT, DEFAULT_HOST

def run_server(port: int):
    """Запуск FastAPI сервера в отдельном фоновом потоке"""
    uvicorn.run(app, host=DEFAULT_HOST, port=port, log_level="warning")

def main():
    # Находим свободный порт для фонового сервера
    port = find_free_port(DEFAULT_PORT)
    
    # Запускаем FastAPI бэкенд параллельно
    server_thread = threading.Thread(target=run_server, args=(port,), daemon=True)
    server_thread.start()
    
    # Небольшая пауза для инициализации бэкенда
    time.sleep(1.0)
    
    app_url = f"http://{DEFAULT_HOST}:{port}"
    
    # Создаем нативное оконное приложение без элементов управления браузера
    window = webview.create_window(
        title="CrowGram Desktop",
        url=app_url,
        width=1280,
        height=800,
        min_size=(900, 600),
        resizable=True,
        text_select=True
    )
    
    # Запускаем графическое окно с полным сбросом кэша и изоляцией сессии
    webview.start(
        private_mode=True,
        storage_path=None,
        debug=False
    )

if __name__ == "__main__":
    main()