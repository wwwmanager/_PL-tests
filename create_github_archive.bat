@echo off
rem ------------------------------------------------------------
rem Batch script to create a zip archive of the project files
rem needed for publishing to GitHub. It excludes build artefacts
rem and local dependencies such as node_modules.
rem ------------------------------------------------------------

set "PROJECT_ROOT=%~dp0"
set "ARCHIVE_NAME=project_archive.zip"
set "TEMP_DIR=%PROJECT_ROOT%temp_archive"

rem Clean previous temporary folder and archive if they exist
if exist "%TEMP_DIR%" rd /s /q "%TEMP_DIR%"
if exist "%PROJECT_ROOT%%ARCHIVE_NAME%" del "%PROJECT_ROOT%%ARCHIVE_NAME%"
copy "%PROJECT_ROOT%README.md" "%TEMP_DIR%" >nul
copy "%PROJECT_ROOT%LICENSE" "%TEMP_DIR%" >nul
copy "%PROJECT_ROOT%.gitignore" "%TEMP_DIR%" >nul
copy "%PROJECT_ROOT%OPTIMIZATION_REPORT.md" "%TEMP_DIR%" >nul

rem Use PowerShell to compress the temporary folder into a zip file
powershell -Command "Compress-Archive -Path '%TEMP_DIR%\*' -DestinationPath '%PROJECT_ROOT%%ARCHIVE_NAME%' -Force"

rem Clean up temporary folder
rd /s /q "%TEMP_DIR%"

echo Archive created: %PROJECT_ROOT%%ARCHIVE_NAME%
pause
