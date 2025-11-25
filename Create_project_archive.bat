@echo off
rem ------------------------------------------------------------
rem Batch script – creates a zip archive containing **all**
rem files and folders required to deploy the project to GitHub.
rem Excludes node_modules, build output, temporary folders and
rem the following files (they are NOT added to the archive):
rem   PERFORMANCE_OPTIMIZATION.md
rem   PROJECT_STRUCTURE.md
rem   README.md
rem   ROUTE_AUTOCOMPLETE_REPORT.md
rem   setupTests.ts
rem   test_data_full_driver_vehicle.json
rem   TESTING_GUIDE.md
rem ------------------------------------------------------------

rem ---------- 1. Настройки ----------
set "PROJECT_ROOT=%~dp0"
set "ARCHIVE_NAME=project_archive.zip"
set "TEMP_DIR=%PROJECT_ROOT%temp_archive"

rem ---------- 2. Очистка старых артефактов ----------
if exist "%TEMP_DIR%" rd /s /q "%TEMP_DIR%"
if exist "%PROJECT_ROOT%%ARCHIVE_NAME%" del "%PROJECT_ROOT%%ARCHIVE_NAME%"

rem ---------- 3. Создаём временную папку ----------
mkdir "%TEMP_DIR%"

rem ---------- 4. Копируем каталоги ----------
xcopy "%PROJECT_ROOT%src"          "%TEMP_DIR%src"          /E /I /Y >nul
xcopy "%PROJECT_ROOT%public"       "%TEMP_DIR%public"       /E /I /Y >nul
xcopy "%PROJECT_ROOT%components"   "%TEMP_DIR%components"   /E /I /Y >nul
xcopy "%PROJECT_ROOT%contexts"     "%TEMP_DIR%contexts"     /E /I /Y >nul
xcopy "%PROJECT_ROOT%docs"         "%TEMP_DIR%docs"         /E /I /Y >nul
xcopy "%PROJECT_ROOT%hooks"        "%TEMP_DIR%hooks"        /E /I /Y >nul
xcopy "%PROJECT_ROOT%services"     "%TEMP_DIR%services"     /E /I /Y >nul
xcopy "%PROJECT_ROOT%utils"        "%TEMP_DIR%utils"        /E /I /Y >nul
xcopy "%PROJECT_ROOT%styles"       "%TEMP_DIR%styles"       /E /I /Y >nul

rem ---------- 5. Копируем отдельные файлы ----------
copy "%PROJECT_ROOT%App.tsx"                     "%TEMP_DIR%" >nul
copy "%PROJECT_ROOT%constants.ts"                "%TEMP_DIR%" >nul
copy "%PROJECT_ROOT%context-pack.skeleton.json"  "%TEMP_DIR%" >nul
copy "%PROJECT_ROOT%DEPLOYMENT.md"               "%TEMP_DIR%" >nul
copy "%PROJECT_ROOT%index.html"                  "%TEMP_DIR%" >nul
copy "%PROJECT_ROOT%index.css"                   "%TEMP_DIR%" >nul
copy "%PROJECT_ROOT%index.tsx"                   "%TEMP_DIR%" >nul

rem ---------- 6. Копируем корневые конфигурационные файлы ----------
copy "%PROJECT_ROOT%package.json"            "%TEMP_DIR%" >nul
copy "%PROJECT_ROOT%package-lock.json"       "%TEMP_DIR%" >nul
copy "%PROJECT_ROOT%vite.config.ts"          "%TEMP_DIR%" >nul
copy "%PROJECT_ROOT%tsconfig.json"           "%TEMP_DIR%" >nul
copy "%PROJECT_ROOT%vitest.config.ts"        "%TEMP_DIR%" >nul
copy "%PROJECT_ROOT%LICENSE"                 "%TEMP_DIR%" >nul
copy "%PROJECT_ROOT%.gitignore"              "%TEMP_DIR%" >nul

rem (если есть .env.example – тоже копируем, но реальный .env.local НЕ включаем)
if exist "%PROJECT_ROOT%.env.example" copy "%PROJECT_ROOT%.env.example" "%TEMP_DIR%" >nul

rem ---------- 7. Сжимаем в zip ----------
powershell -Command "Compress-Archive -Path '%TEMP_DIR%\*' -DestinationPath '%PROJECT_ROOT%%ARCHIVE_NAME%' -Force"

rem ---------- 8. Удаляем временную папку ----------
rd /s /q "%TEMP_DIR%"

echo ------------------------------------------------------------
echo Archive created: %PROJECT_ROOT%%ARCHIVE_NAME%
echo ------------------------------------------------------------
pause