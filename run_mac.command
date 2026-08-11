#!/usr/bin/env bash

cd "$(dirname "$0")"

echo "=========================================="
echo "  CrowGram Desktop — Запуск приложения (macOS)"
echo "=========================================="
echo ""

if ! command -v python3 &> /dev/null; then
    echo "[ОШИБКА] Python3 не найден в системе!"
    echo "Пожалуйста, установите Python 3.10+."
    exit 1
fi

if [ -f "requirements.txt" ]; then
    python3 -c "import webview" &> /dev/null
    if [ $? -ne 0 ]; then
        echo "Установка pywebview..."
        pip3 install pywebview
    fi
fi

echo "Запуск нативного окна CrowGram..."
python3 desktop_app.py
