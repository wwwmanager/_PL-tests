@echo off
setlocal
set PGPASSWORD=1234
set PAGER=
psql -U postgres -d waybills -A -t -c "SELECT id, number, date, status FROM waybills WHERE number = 'ЧБ 000001' ORDER BY date DESC LIMIT 1;"
