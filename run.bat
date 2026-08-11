@echo off
chcp 65001 > nul
title CrowGram Desktop Launcher

echo ==========================================
echo   CrowGram Desktop — Запуск приложения
echo ==========================================
echo.

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ОШИБКА] Python не найден в системе!
    echo Пожалуйста, установите Python 3.10+ и добавьте его в PATH.
    pause
    exit /b
)

if exist "requirements.txt" (
    echo Проверка зависимостей...
    python -c "import webview" >nul 2>&1
    if %errorlevel% neq 0 (
        echo Установка pywebview...
        pip install pywebview
    )
)

echo Запуск приложения CrowGram...
python desktop_app.py

if %errorlevel% neq 0 (
    echo.
    echo [WARN] Произошел сбой при работе приложения.
    pause
)
