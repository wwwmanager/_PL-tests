@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title Установка Node.js + Vite (без изменения политик PowerShell)

echo ==============================================
echo   Помощник: Node.js + Vite (интерактивно)
echo ==============================================

:: ---------- Шаг 1. Node.js ----------
echo.
choice /C YN /M "1) Скачать и установить Node.js (LTS)?"
if errorlevel 2 goto STEP2
if errorlevel 1 goto INSTALL_NODE

:INSTALL_NODE
set "NODE_VER="
for /f %%i in ('node -v 2^>nul') do set "NODE_VER=%%i"
if defined NODE_VER (
  echo Найден Node.js !NODE_VER!. Пропускаю установку.
) else (
  where winget >nul 2>&1
  if %errorlevel%==0 (
    echo Использую winget для установки Node.js LTS...
    winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
  ) else (
    echo winget не найден. Попытаюсь установить через официальный установщик MSI...
    call :InstallNodeViaMSI
  )
)
call :RefreshPath

set "NODE_VER="
for /f %%i in ('node -v 2^>nul') do set "NODE_VER=%%i"
if defined NODE_VER (
  echo Установлен Node.js !NODE_VER!
) else (
  echo ВНИМАНИЕ: Node.js пока не распознан в этой сессии. Если вы только что установили Node.js,
  echo откройте новый терминал, чтобы PATH обновился.
)

:STEP2
:: ---------- Шаг 2. Установить Vite ----------
echo.
choice /C YN /M "2) Установить Vite (npm install vite --save-dev)?"
if errorlevel 2 goto STEP3
if errorlevel 1 goto INSTALL_VITE

:INSTALL_VITE
where npm >nul 2>&1
if %errorlevel% neq 0 (
  echo Не найден npm. Убедитесь, что Node.js установлен и PATH обновлён.
) else (
  if not exist package.json (
    echo package.json не найден. Выполняю "npm init -y"...
    call npm init -y
  )
  call npm install vite --save-dev
)

:STEP3
:: ---------- Шаг 3. Добавить/обновить скрипты Vite ----------
echo.
choice /C YN /M "3) Добавить/обновить скрипты Vite в package.json (dev/build/start)?"
if errorlevel 2 goto STEP4
if errorlevel 1 goto ADD_SCRIPTS

:ADD_SCRIPTS
where npm >nul 2>&1
if %errorlevel% neq 0 (
  echo Не найден npm.
) else (
  if not exist package.json (
    echo package.json не найден. Выполняю "npm init -y"...
    call npm init -y
  )
  echo Обновляю скрипты через npm pkg set...
  call npm pkg set scripts.dev="vite"
  call npm pkg set scripts.build="vite build"
  call npm pkg set scripts.start="vite preview"
)

:STEP4
:: ---------- Шаг 4. Сборка ----------
echo.
choice /C YN /M "4) Выполнить сборку (npm run build)?"
if errorlevel 2 goto STEP5
if errorlevel 1 goto RUN_BUILD

:RUN_BUILD
where npm >nul 2>&1
if %errorlevel% neq 0 (
  echo Не найден npm. Пропускаю сборку.
) else (
  call npm run build
)

:STEP5
:: ---------- Шаг 5. Запуск start/dev ----------
echo.
choice /C SDN /M "5) Запустить [S]tart (vite preview), [D]ev (vite), либо [N] — пропустить?"
if errorlevel 3 goto END
if errorlevel 2 goto RUN_DEV
if errorlevel 1 goto RUN_START

:RUN_START
where npm >nul 2>&1
if %errorlevel% neq 0 (
  echo Не найден npm.
) else (
  echo Запуск npm run start ^(vite preview^)...
  call npm run start
)
goto END

:RUN_DEV
where npm >nul 2>&1
if %errorlevel% neq 0 (
  echo Не найден npm.
) else (
  echo Запуск npm run dev ^(Vite dev server^). Для остановки нажмите Ctrl+C.
  call npm run dev
)
goto END

:: ---------- Подпрограммы ----------

:InstallNodeViaMSI
echo Пытаюсь обнаружить актуальную LTS-версию Node.js и установить её через MSI...
powershell -NoProfile -Command ^
  "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;" ^
  "$arch = if([Environment]::Is64BitOperatingSystem){'x64'} else {'x86'};" ^
  "$index = Invoke-RestMethod 'https://nodejs.org/dist/index.json';" ^
  "$lts = $index | Where-Object { $_.lts } | Select-Object -First 1;" ^
  "if(-not $lts){ throw 'Не удалось получить список версий Node.js.' }" ^
  "$ver = $lts.version;" ^
  "$msi = 'https://nodejs.org/dist/' + $ver + '/node-' + $ver + '-' + $arch + '.msi';" ^
  "$out = Join-Path $env:TEMP ('node-' + $ver + '-' + $arch + '.msi');" ^
  "Write-Host ('Скачиваю ' + $msi);" ^
  "Invoke-WebRequest -Uri $msi -OutFile $out;" ^
  "Write-Host ('Запуск установщика ' + $out);" ^
  "Start-Process msiexec.exe -ArgumentList @('/i', $out, '/qn', '/norestart') -Verb RunAs -Wait;" ^
  "Write-Host 'Готово.'"
exit /b 0

:RefreshPath
for /f "usebackq delims=" %%p in (`powershell -NoProfile -Command "[Console]::Out.Write(([Environment]::GetEnvironmentVariable('Path','User') + ';' + [Environment]::GetEnvironmentVariable('Path','Machine')))"`) do set "PATH=%%p"
exit /b 0

:END
echo.
echo Готово. Скрипт завершил работу.
endlocal
exit /b 0