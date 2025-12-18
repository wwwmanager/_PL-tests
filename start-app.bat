@echo off
chcp 65001 >nul
title Waybill App - Startup

echo =======================================
echo   Waybill App - Запуск приложения
echo =======================================
echo.

:: Проверка наличия Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ОШИБКА] Node.js не найден! Установите Node.js
    pause
    exit /b 1
)

:: Запуск Backend в новом окне
echo [1/2] Запуск Backend (порт 3001)...
start "Backend - Waybill App" cmd /k "cd /d %~dp0backend && npm run dev"

:: Небольшая пауза для инициализации backend
timeout /t 3 /nobreak >nul

:: Запуск Frontend в новом окне
echo [2/2] Запуск Frontend (порт 3000)...
start "Frontend - Waybill App" cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo =======================================
echo   Приложение запущено!
echo =======================================
echo.
echo   Backend:  http://localhost:3001
echo   Frontend: http://localhost:3000/_PL-tests
echo.
echo   Для остановки закройте оба окна терминала
echo =======================================

:: Открыть браузер через 5 секунд
timeout /t 5 /nobreak >nul
start http://localhost:3000/_PL-tests
