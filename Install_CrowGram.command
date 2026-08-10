#!/bin/bash
cd "$(dirname "$0")"

echo "=========================================="
echo "  CrowGram — Автоустановка (macOS)"
echo "=========================================="

if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 не найден! Установите Python 3 с python.org"
    read -p "Нажмите Enter для выхода..."
    exit 1
fi

if [ ! -d "venv" ]; then
    echo "[INFO] Создаем виртуальное окружение (venv)..."
    python3 -m venv venv
fi

echo "[INFO] Активируем виртуальное окружение..."
source venv/bin/activate

echo "[INFO] Обновляем pip..."
pip install --upgrade pip

if [ -f "requirements.txt" ]; then
    echo "[INFO] Устанавливаем библиотеки из requirements.txt..."
    pip install -r requirements.txt
else
    echo "[WARN] Файл requirements.txt не найден!"
fi

echo ""
echo "[SUCCESS] Все зависимости успешно установлены!"
echo "[INFO] Теперь вы можете запускать проект через Start_CrowGram.command"
read -p "Нажмите Enter для закрытия..."
