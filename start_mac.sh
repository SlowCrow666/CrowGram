#!/bin/bash
cd "$(dirname "$0")"

if [ ! -d "venv" ]; then
    echo "[ERROR] Виртуальное окружение не найдено! Запустите install_mac.sh"
    read -p "Нажмите Enter для выхода..."
    exit 1
fi

source venv/bin/activate

echo "=========================================="
echo "  CrowGram — Запуск приложения (macOS)"
echo "=========================================="
echo "[INFO] Доступно по адресу: http://127.0.0.1:8000"

python3 app.py

read -p "Нажмите Enter для закрытия..."
