@echo off
REM ============================================================================
REM WB-FUELCARD-MIG-020: Backfill FuelCardId Migration Script
REM ============================================================================
REM Purpose: Execute SQL backfill migration with backup and reporting
REM Date: 2025-12-23
REM ============================================================================

setlocal enabledelayedexpansion

REM Configuration
set DB_NAME=waybills
set DB_USER=postgres
set BACKUP_DIR=.\backups
set REPORT_DIR=.\reports
set SQL_FILE=.\docs\migration-backfill-fuelcard.sql
set TIMESTAMP=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%

echo ============================================================================
echo WB-FUELCARD-MIG-020: Backfill Migration
echo ============================================================================
echo.

REM Create directories
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
if not exist "%REPORT_DIR%" mkdir "%REPORT_DIR%"

echo [1/6] Creating database backup...
set BACKUP_FILE=%BACKUP_DIR%\backup_pre_fuelcard_migration_%TIMESTAMP%.sql
pg_dump -U %DB_USER% -d %DB_NAME% > "%BACKUP_FILE%"
if %errorlevel% neq 0 (
    echo ❌ Backup failed!
    pause
    exit /b 1
)
echo ✅ Backup created: %BACKUP_FILE%
echo.

echo [2/6] Step 1: Previewing affected waybills...
set PREVIEW_FILE=%REPORT_DIR%\step1_preview_%TIMESTAMP%.txt
psql -U %DB_USER% -d %DB_NAME% -t -A -F "|" -f "%SQL_FILE%" -v ON_ERROR_STOP=1 --pset=footer=off -o "%PREVIEW_FILE%" 2>&1 | findstr /V "^$"
echo ✅ Preview saved: %PREVIEW_FILE%
echo.

echo [3/6] ⚠️  CONFIRMATION REQUIRED ⚠️
echo.
type "%PREVIEW_FILE%"
echo.
set /p CONFIRM="Do you want to proceed with UPDATE? (yes/no): "
if /i not "%CONFIRM%"=="yes" (
    echo ❌ Migration cancelled by user
    pause
    exit /b 0
)
echo.

echo [4/6] Step 2: Executing UPDATE...
REM Extract UPDATE block from SQL file and execute
psql -U %DB_USER% -d %DB_NAME% -c "BEGIN; UPDATE waybills w SET \"fuelCardId\" = (SELECT fc.id FROM fuel_cards fc WHERE fc.\"assignedToDriverId\" = w.\"driverId\" AND fc.\"isActive\" = true AND fc.\"organizationId\" = w.\"organizationId\" ORDER BY fc.\"cardNumber\" ASC LIMIT 1) WHERE w.id IN (SELECT DISTINCT wf.\"waybillId\" FROM waybill_fuel wf WHERE wf.\"sourceType\" = 'FUEL_CARD') AND w.\"fuelCardId\" IS NULL; COMMIT;"
if %errorlevel% neq 0 (
    echo ❌ Update failed! Database rolled back.
    pause
    exit /b 1
)
echo ✅ Update completed
echo.

echo [5/6] Step 3: Verifying updates...
set VERIFY_FILE=%REPORT_DIR%\step3_verify_%TIMESTAMP%.txt
psql -U %DB_USER% -d %DB_NAME% -t -A -F "|" -c "SELECT w.id, w.number, w.\"fuelCardId\", fc.\"cardNumber\" FROM waybills w JOIN waybill_fuel wf ON wf.\"waybillId\" = w.id LEFT JOIN fuel_cards fc ON fc.id = w.\"fuelCardId\" WHERE wf.\"sourceType\" = 'FUEL_CARD' ORDER BY w.date DESC LIMIT 20;" -o "%VERIFY_FILE%"
echo ✅ Verification saved: %VERIFY_FILE%
echo.

echo [6/6] Step 4: Finding orphans (drivers without cards)...
set ORPHANS_FILE=%REPORT_DIR%\step4_orphans_%TIMESTAMP%.txt
psql -U %DB_USER% -d %DB_NAME% -t -A -F "|" -c "SELECT w.id, w.number, w.date, w.\"driverId\", d.\"employeeId\", 'Driver has no assigned fuel card' as issue FROM waybills w JOIN waybill_fuel wf ON wf.\"waybillId\" = w.id JOIN drivers d ON d.id = w.\"driverId\" LEFT JOIN fuel_cards fc ON fc.\"assignedToDriverId\" = w.\"driverId\" AND fc.\"isActive\" = true WHERE wf.\"sourceType\" = 'FUEL_CARD' AND w.\"fuelCardId\" IS NULL AND fc.id IS NULL;" -o "%ORPHANS_FILE%"
echo ✅ Orphans report saved: %ORPHANS_FILE%
echo.

REM Generate summary
echo ============================================================================
echo MIGRATION SUMMARY
echo ============================================================================
echo.
echo Backup: %BACKUP_FILE%
echo Preview: %PREVIEW_FILE%
echo Verification: %VERIFY_FILE%
echo Orphans: %ORPHANS_FILE%
echo.

REM Count results
for /f %%i in ('type "%ORPHANS_FILE%" ^| find /c /v ""') do set ORPHAN_COUNT=%%i
echo Orphans found: %ORPHAN_COUNT%

if %ORPHAN_COUNT% gtr 0 (
    echo.
    echo ⚠️  WARNING: Found %ORPHAN_COUNT% orphan waybills
    echo These waybills will FAIL to POST until:
    echo   1. Fuel card is assigned to driver, OR
    echo   2. sourceType is changed from FUEL_CARD
    echo.
    echo See %ORPHANS_FILE% for details
)

echo.
echo ✅ Migration completed successfully!
echo.
pause
