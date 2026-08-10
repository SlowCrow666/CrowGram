@echo off
chcp 65001 > nul
echo ==========================================
echo   CrowGram — Установка зависимостей (Windows)
echo ==========================================

echo [1/2] Обновление pip...
python -m pip install --upgrade pip

echo [2/2] Установка необходимых библиотек...
python -m pip install -r requirements.txt

echo ==========================================
echo   Установка успешно завершена!
echo   Для запуска используйте: start_windows.bat
echo ==========================================
pause
