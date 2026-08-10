#!/bin/bash
cd "$(dirname "$0")"

if [ ! -d "venv" ]; then
    echo "[ERROR] Виртуальное окружение не найдено!"
    echo "[INFO] Запускаем автоматическую установку..."
    bash Install_CrowGram.command
fi

source venv/bin/activate

echo "=========================================="
echo "  CrowGram — Автозапуск (macOS)"
echo "=========================================="
echo "[INFO] Сервер запускается..."
echo "[INFO] Открываем браузер по адресу http://127.0.0.1:8000"

open "http://127.0.0.1:8000"

python3 app.py

read -p "Сервер остановлен. Нажмите Enter для закрытия..."
