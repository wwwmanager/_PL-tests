@echo off
setlocal
set PGPASSWORD=1234
psql -U postgres -d waybills -c "SELECT id, \"cardNumber\", \"organizationId\" FROM fuel_cards WHERE \"cardNumber\" = '1111-2222-3333-4444' LIMIT 1;"
