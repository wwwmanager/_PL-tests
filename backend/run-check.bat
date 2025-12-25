@echo off
setlocal
set PGPASSWORD=1234
set PAGER=
psql -U postgres -d waybills -A -t -f check-driver-fuelcard.sql
