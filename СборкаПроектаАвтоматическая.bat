@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title Авто установка и запуск Node.js + Vite

:: Определение файла лога в корне проекта
set "LOGFILE=%CD%\install_log.txt"
echo [%DATE% %TIME%] Начало выполнения скрипта > "%LOGFILE%"

call :Log "=============================================="
call :Log "  Автоматическая установка Node.js + Vite"
call :Log "=============================================="

:: ---------- Шаг 0. Поиск и распаковка архива проекта ----------
call :Log ""
call :Log "[0/6] Поиск архива проекта..."

:: Считаем количество найденных архивов
set "ARCHIVE_COUNT=0"
for %%F in (*.zip) do (
    set /a ARCHIVE_COUNT+=1
    set "ARCHIVE_!ARCHIVE_COUNT!=%%F"
)

if !ARCHIVE_COUNT! gtr 1 (
    call :Log "Найдено несколько архивов проекта:"
    for /l %%i in (1,1,!ARCHIVE_COUNT!) do (
        call :Log "  %%i. !ARCHIVE_%%i!"
    )
    set /p "USER_CHOICE=Выберите номер архива (1-!ARCHIVE_COUNT!): "
    call set "ARCHIVE_PATH=%%ARCHIVE_!USER_CHOICE!%%"
) else if !ARCHIVE_COUNT!==1 (
    set "ARCHIVE_PATH=!ARCHIVE_1!"
    call :Log "[OK] Найден архив: !ARCHIVE_PATH!"
) else (
    call :Log "[!] Архив не найден по маске *copy-of-ai-waybill-management-system*.zip"
    call :Log "Продолжаю работу в текущей папке..."
    goto :SkipUnzip
)

call :Log "Выбран архив: !ARCHIVE_PATH!"

:: Проверка существования архива
if not exist "!ARCHIVE_PATH!" (
    call :Log "[ОШИБКА] Файл архива не найден: !ARCHIVE_PATH!"
    pause
    goto :END
)

:: Создаем временную папку для распаковки
set "EXTRACT_FOLDER=%CD%\temp_extract_%RANDOM%"
call :Log "Создание временной папки: !EXTRACT_FOLDER!"

call :Log "Распаковка архива..."

:: Распаковываем через PowerShell с детальным логированием
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$zipPath = '%CD%\!ARCHIVE_PATH!';" ^
  "$destPath = '!EXTRACT_FOLDER!';" ^
  "Write-Host ('Архив: ' + $zipPath);" ^
  "Write-Host ('Назначение: ' + $destPath);" ^
  "try {" ^
  "  if (-not (Test-Path $zipPath)) {" ^
  "    throw 'Файл архива не найден: ' + $zipPath;" ^
  "  }" ^
  "  New-Item -ItemType Directory -Force -Path $destPath | Out-Null;" ^
  "  Add-Type -AssemblyName System.IO.Compression.FileSystem;" ^
  "  [System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $destPath);" ^
  "  Write-Host '[OK] Архив распакован успешно';" ^
  "  exit 0;" ^
  "} catch {" ^
  "  Write-Host ('[ОШИБКА] ' + $_.Exception.Message);" ^
  "  exit 1;" ^
  "}"

if !errorlevel! neq 0 (
    call :Log "[ОШИБКА] Не удалось распаковать архив."
    call :Log "Попытка альтернативного метода через tar..."
    
    :: Пробуем через tar (доступен в Windows 10+)
    where tar >nul 2>&1
    if !errorlevel!==0 (
        tar -xf "!ARCHIVE_PATH!" -C "!EXTRACT_FOLDER!" >> "%LOGFILE%" 2>&1
        if !errorlevel! neq 0 (
            call :Log "[ОШИБКА] Tar также не смог распаковать архив."
            if exist "!EXTRACT_FOLDER!" rmdir /s /q "!EXTRACT_FOLDER!"
            pause
            goto :END
        )
        call :Log "[OK] Архив распакован через tar"
    ) else (
        call :Log "[ОШИБКА] Все методы распаковки не сработали."
        call :Log "Попробуйте распаковать архив вручную и запустите скрипт снова."
        if exist "!EXTRACT_FOLDER!" rmdir /s /q "!EXTRACT_FOLDER!"
        pause
        goto :END
    )
)

:: Ищем папку проекта внутри распакованного
call :Log "Поиск папки проекта..."
set "PROJECT_FOLDER="

:: Сначала проверяем, есть ли package.json прямо в temp_extract
if exist "!EXTRACT_FOLDER!\package.json" (
    set "PROJECT_FOLDER=!EXTRACT_FOLDER!"
    call :Log "Проект найден в корне архива"
) else (
    :: Ищем первую подпапку с package.json
    for /d %%D in ("!EXTRACT_FOLDER!\*") do (
        if exist "%%D\package.json" (
            set "PROJECT_FOLDER=%%D"
            call :Log "Проект найден в подпапке: %%D"
            goto :FoundProject
        )
    )
)

:FoundProject
if not defined PROJECT_FOLDER (
    call :Log "[ОШИБКА] Не найден package.json в распакованном архиве."
    call :Log "Содержимое архива:"
    dir /b "!EXTRACT_FOLDER!" >> "%LOGFILE%"
    if exist "!EXTRACT_FOLDER!" rmdir /s /q "!EXTRACT_FOLDER!"
    pause
    goto :END
)

:: Перемещаем содержимое в текущую папку
call :Log "Перемещение файлов проекта в текущую папку..."

:: Копируем файлы в текущую папку
xcopy "!PROJECT_FOLDER!\*" "%CD%\" /E /I /H /Y >> "%LOGFILE%" 2>&1

if !errorlevel! neq 0 (
    call :Log "[ОШИБКА] Не удалось скопировать файлы проекта."
    if exist "!EXTRACT_FOLDER!" rmdir /s /q "!EXTRACT_FOLDER!"
    pause
    goto :END
)

:: Удаляем временную папку
if exist "!EXTRACT_FOLDER!" (
    rmdir /s /q "!EXTRACT_FOLDER!" 2>nul
)

call :Log "[OK] Архив успешно распакован в текущую папку"

 

:SkipUnzip



:: ---------- Шаг 1. Проверка и установка Node.js ----------
call :Log ""
call :Log "[1/6] Проверка Node.js..."
set "NODE_VER="
for /f %%i in ('node -v 2^>nul') do set "NODE_VER=%%i"
if defined NODE_VER (
    call :Log "[OK] Найден Node.js !NODE_VER!"
    goto :SkipNodeInstall
)

call :Log "[!] Node.js не найден. Поиск локальных дистрибутивов..."
set "NODE_MSI_COUNT=0"
for %%F in (node-v*-x64.msi node-v*-win-x64.zip) do (
    set /a NODE_MSI_COUNT+=1
    set "NODE_MSI_!NODE_MSI_COUNT!=%%F"
)

if !NODE_MSI_COUNT! gtr 1 (
    call :Log "Найдено несколько дистрибутивов Node.js:"
    for /l %%i in (1,1,!NODE_MSI_COUNT!) do (
        call :Log "  %%i. !NODE_MSI_%%i!"
    )
    set /p "USER_CHOICE=Выберите номер дистрибутива (1-!NODE_MSI_COUNT!): "
    call set "NODE_MSI=%%NODE_MSI_!USER_CHOICE!%%"
    call :InstallNodeFromFile
    goto :AfterNodeInstall
) else if !NODE_MSI_COUNT!==1 (
    set "NODE_MSI=!NODE_MSI_1!"
    call :InstallNodeFromFile
    goto :AfterNodeInstall
) else (
    call :DownloadAndInstallNode
    goto :AfterNodeInstall
)

:SkipNodeInstall
goto :CheckNPM

:InstallNodeFromFile
call :Log "Установка из файла: !NODE_MSI!"
if "!NODE_MSI:~-4!"==".msi" (
    call :Log "Запуск установщика MSI..."
    msiexec /i "!NODE_MSI!" /qn /norestart >> "%LOGFILE%" 2>&1
) else (
    call :Log "Установка из ZIP не поддерживается, скачиваю MSI."
    call :DownloadAndInstallNode
)
exit /b 0

:DownloadAndInstallNode
where winget >nul 2>&1
if !errorlevel!==0 (
    call :Log "Использую winget для установки Node.js LTS..."
    winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements >> "%LOGFILE%" 2>&1
) else (
    call :Log "winget не найден. Устанавливаю через официальный MSI..."
    call :InstallNodeViaMSI
)
call :RefreshPath
exit /b 0

:AfterNodeInstall
call :RefreshPath
set "NODE_VER="
for /f %%i in ('node -v 2^>nul') do set "NODE_VER=%%i"
if defined NODE_VER (
    call :Log "[OK] Установлен Node.js !NODE_VER!"
) else (
    call :Log "[ОШИБКА] Node.js не распознан. Откройте новый терминал и запустите скрипт снова."
    pause
    goto :END
)

:: ---------- Шаг 2. Проверка npm ----------
:CheckNPM
call :Log ""
call :Log "[2/6] Проверка npm..."
where npm >nul 2>&1
if !errorlevel! neq 0 (
    call :Log "[ОШИБКА] npm не найден. npm устанавливается вместе с Node.js."
    call :Log "Попытка переустановки Node.js..."
    goto :DownloadAndInstallNode
)

for /f %%i in ('npm -v 2^>nul') do set "NPM_VER=%%i"
call :Log "[OK] npm версия !NPM_VER!"

:: ---------- Шаг 3. Установка зависимостей ----------
call :Log ""
call :Log "[3/6] Установка зависимостей проекта..."
if exist package.json (
    call :Log "[OK] Найден package.json, устанавливаю зависимости..."
    call npm install >> "%LOGFILE%" 2>&1
    if !errorlevel! neq 0 (
        call :Log "[ОШИБКА] Не удалось установить зависимости."
        pause
        goto :END
    )
    call :Log "[OK] Зависимости установлены"
) else (
    call :Log "[!] package.json не найден. Создаю через npm init -y..."
    call npm init -y >> "%LOGFILE%" 2>&1
    call :Log "[!] Vite не найден. Устанавливаю..."
    call npm install vite --save-dev >> "%LOGFILE%" 2>&1
    call :Log "[OK] Vite установлен"
)

:: ---------- Шаг 4. Проверка Vite ----------
call :Log ""
call :Log "[4/6] Проверка Vite..."
set "VITE_INSTALLED="
for /f "tokens=*" %%i in ('npm list vite 2^>nul ^| findstr /C:"vite@"') do set "VITE_INSTALLED=1"
if defined VITE_INSTALLED (
    call :Log "[OK] Vite установлен"
) else (
    call :Log "[!] Vite не найден. Поиск локальных дистрибутивов..."
    set "VITE_TGZ_COUNT=0"
    for %%F in (vite-*.tgz) do (
        set /a VITE_TGZ_COUNT+=1
        set "VITE_TGZ_!VITE_TGZ_COUNT!=%%F"
    )

    if !VITE_TGZ_COUNT! gtr 1 (
        call :Log "Найдено несколько дистрибутивов Vite:"
        for /l %%i in (1,1,!VITE_TGZ_COUNT!) do (
            call :Log "  %%i. !VITE_TGZ_%%i!"
        )
        set /p "USER_CHOICE=Выберите номер дистрибутива (1-!VITE_TGZ_COUNT!): "
        call set "VITE_TGZ=%%VITE_TGZ_!USER_CHOICE!%%"
        call :InstallViteFromFile
    ) else if !VITE_TGZ_COUNT!==1 (
        set "VITE_TGZ=!VITE_TGZ_1!"
        call :InstallViteFromFile
    ) else (
        call :Log "Локальные дистрибутивы не найдены. Устанавливаю через npm..."
        call npm install vite --save-dev >> "%LOGFILE%" 2>&1
        call :Log "[OK] Vite установлен"
    )
)
goto :UpdateScripts

:InstallViteFromFile
call :Log "Установка из файла: !VITE_TGZ!"
call npm install "!VITE_TGZ!" --save-dev >> "%LOGFILE%" 2>&1
call :Log "[OK] Vite установлен из локального файла"
exit /b 0

:: ---------- Шаг 5. Обновление скриптов в package.json ----------
:UpdateScripts
call :Log ""
call :Log "[5/6] Обновление скриптов в package.json..."
call npm pkg set scripts.dev="vite --open" >> "%LOGFILE%" 2>&1
call npm pkg set scripts.build="vite build" >> "%LOGFILE%" 2>&1
call npm pkg set scripts.start="vite preview --open" >> "%LOGFILE%" 2>&1
call :Log "[OK] Скрипты обновлены"

:: ---------- Шаг 6. Сборка проекта ----------
call :Log ""
call :Log "[6/6] Выполнение сборки (npm run build)..."
call npm run build >> "%LOGFILE%" 2>&1
if !errorlevel! neq 0 (
    call :Log "[ВНИМАНИЕ] Сборка завершилась с ошибкой, но продолжаю запуск dev-сервера..."
)
call :Log "[OK] Готово к запуску"

:: ---------- Запуск dev-сервера ----------
call :Log ""
call :Log "=============================================="
call :Log "  Запуск dev-сервера Vite"
call :Log "=============================================="
call :Log ""
echo Браузер откроется автоматически...
echo Для остановки сервера нажмите Ctrl+C
call :Log "Запуск npm run dev..."
echo.

npm run dev

goto :END

:: ---------- Подпрограммы ----------
:Log
set "MSG=%~1"
echo %MSG%
echo [%DATE% %TIME%] %MSG% >> "%LOGFILE%"
exit /b 0

:InstallNodeViaMSI
call :Log "Загрузка и установка Node.js LTS через MSI..."
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
  "Write-Host 'Готово.'" >> "%LOGFILE%" 2>&1
exit /b 0

:RefreshPath
for /f "usebackq delims=" %%p in (`powershell -NoProfile -Command "[Console]::Out.Write(([Environment]::GetEnvironmentVariable('Path','User') + ';' + [Environment]::GetEnvironmentVariable('Path','Machine')))"`) do set "PATH=%%p"
exit /b 0
 

:END
call :Log "Завершение скрипта."
endlocal
pause
exit /b 0