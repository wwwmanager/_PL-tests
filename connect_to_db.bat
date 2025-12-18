@echo off
REM Quick connect to PostgreSQL waybills database
echo ========================================
echo Подключение к БД PostgreSQL "waybills"
echo ========================================
echo.
echo Host: localhost:5432
echo Database: waybills
echo User: postgres
echo.
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -p 5432 -U postgres -d waybills
pause
