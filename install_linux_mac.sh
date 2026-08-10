#!/usr/bin/env bash

echo "=========================================="
echo "  CrowGram — Установка зависимостей (Mac/Linux)"
echo "=========================================="

sed -i '' 's/\r$//' start_linux_mac.sh 2>/dev/null || sed -i 's/\r$//' start_linux_mac.sh 2>/dev/null
sed -i '' 's/\r$//' install_linux_mac.sh 2>/dev/null || sed -i 's/\r$//' install_linux_mac.sh 2>/dev/null

python3 -m ensurepip --upgrade 2>/dev/null

echo "[1/2] Обновление pip..."
python3 -m pip install --upgrade pip

echo "[2/2] Установка необходимых библиотек..."
python3 -m pip install -r requirements.txt

echo "=========================================="
echo "  Установка успешно завершена!"
echo "  Для запуска используйте: ./start_linux_mac.sh"
echo "=========================================="
