@echo off
chcp 65001 >nul
echo ========================================
echo 🗄️  Настройка PostgreSQL для Waybills
echo ========================================
echo.

:: Проверка наличия PostgreSQL
where psql >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ psql не найден в PATH
    echo 📝 Попробуем найти PostgreSQL автоматически...
    
    :: Поиск PostgreSQL в стандартных путях
    set "PSQL_PATH="
    for /d %%G in ("C:\Program Files\PostgreSQL\*") do (
        if exist "%%G\bin\psql.exe" (
            set "PSQL_PATH=%%G\bin"
            goto :found
        )
    )
    
    :found
    if defined PSQL_PATH (
        echo ✅ Найден PostgreSQL: %PSQL_PATH%
        set "PATH=%PSQL_PATH%;%PATH%"
    ) else (
        echo ❌ PostgreSQL не найден!
        echo Установите PostgreSQL или добавьте его в PATH
        pause
        exit /b 1
    )
)

echo.
echo 📋 Введите данные для подключения:
echo.
set /p POSTGRES_USER="Имя пользователя PostgreSQL (по умолчанию: postgres): "
if "%POSTGRES_USER%"=="" set POSTGRES_USER=postgres

set /p POSTGRES_PASSWORD="Пароль PostgreSQL: "
if "%POSTGRES_PASSWORD%"=="" (
    echo ❌ Пароль обязателен!
    pause
    exit /b 1
)

set /p DB_NAME="Имя базы данных (по умолчанию: waybills): "
if "%DB_NAME%"=="" set DB_NAME=waybills

echo.
echo 🔄 Создание базы данных...
echo.

:: Создание SQL скрипта
echo CREATE DATABASE %DB_NAME%; > temp_setup.sql

:: Выполнение SQL
psql -U %POSTGRES_USER% -h localhost -c "CREATE DATABASE %DB_NAME%;" 2>nul
if %errorlevel% equ 0 (
    echo ✅ База данных '%DB_NAME%' успешно создана
) else (
    echo ⚠️  База данных уже существует или ошибка создания
)

echo.
echo 📝 Создание файла .env...

:: Создание .env файла
(
echo DATABASE_URL="postgresql://%POSTGRES_USER%:%POSTGRES_PASSWORD%@localhost:5432/%DB_NAME%"
echo JWT_SECRET="waybills_secret_key_2024_%RANDOM%"
echo PORT=3001
) > .env

echo ✅ Файл .env создан
echo.
echo 🔍 Проверка подключения...
echo.

npx prisma db pull --force 2>nul
if %errorlevel% equ 0 (
    echo ✅ Подключение к базе данных успешно!
) else (
    echo ⚠️  Не удалось подключиться к БД
    echo Проверьте правильность введенных данных
)

echo.
echo 📦 Генерация Prisma клиента...
call npm run prisma:generate

echo.
echo 🔄 Применение миграций...
call npm run prisma:migrate

echo.
echo 🌱 Заполнение тестовыми данными...
call npm run prisma:seed

echo.
echo ========================================
echo ✅ Настройка завершена!
echo ========================================
echo.
echo 📋 Данные для подключения:
echo    • База данных: %DB_NAME%
echo    • Пользователь: %POSTGRES_USER%
echo    • Сервер: localhost:5432
echo.
echo 🚀 Для запуска backend выполните:
echo    npm run dev
echo.
pause
