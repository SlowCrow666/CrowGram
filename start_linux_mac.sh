#!/usr/bin/env bash

sed -i '' 's/\r$//' "$0" 2>/dev/null || sed -i 's/\r$//' "$0" 2>/dev/null

echo "Запуск CrowGram..."
python3 app.py
