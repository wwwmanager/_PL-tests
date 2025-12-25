@echo off
setlocal
set PGPASSWORD=1234
set PAGER=

echo === Applying fix-waybill-000001.sql ===
psql -U postgres -d waybills -A -t -f docs\fix-waybill-000001.sql

echo.
echo === Verifying fuelCardId is set ===
psql -U postgres -d waybills -A -t -c "SELECT id, number, \"fuelCardId\" FROM waybills WHERE id = '859200fc-f5c7-4fb2-b1d9-bb103bac726b';"

echo.
echo === Verifying sourceType is set ===
psql -U postgres -d waybills -A -t -c "SELECT id, \"sourceType\", \"fuelReceived\" FROM waybill_fuel WHERE id = 'c36207ec-c29c-4ed6-b416-e275fbf0fd5f';"

pause
