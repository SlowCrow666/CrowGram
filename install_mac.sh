#!/bin/bash
echo "=========================================="
echo "  CrowGram — Установка окружения (macOS)"
echo "=========================================="

cd "$(dirname "$0")"

if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 не найден! Установите Python 3 через brew или python.org"
    read -p "Нажмите Enter для выхода..."
    exit 1
fi

if [ ! -d "venv" ]; then
    echo "[INFO] Создание виртуального окружения (venv)..."
    python3 -m venv venv
fi

echo "[INFO] Активация виртуального окружения..."
source venv/bin/activate

echo "[INFO] Обновление pip..."
pip install --upgrade pip

if [ -f "requirements.txt" ]; then
    echo "[INFO] Установка зависимостей из requirements.txt..."
    pip install -r requirements.txt
else
    echo "[WARN] Файл requirements.txt не найден!"
fi

echo ""
echo "[SUCCESS] Установка успешно завершена!"
read -p "Нажмите Enter для закрытия..."
