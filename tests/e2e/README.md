# E2E Tests for Waybill Management System

This directory contains end-to-end tests using Playwright.

## Prerequisites

1. **Backend** must be running:
   ```bash
   cd backend && npm run dev
   ```
   Backend should be accessible at `http://localhost:3001`

2. **Frontend** is auto-started by Playwright via webServer config.
   If you prefer manual startup:
   ```bash
   npm run dev -- --port 3000 --host
   ```
   Frontend will be accessible at `http://localhost:3000/_PL-tests`

3. **Database Seeded**
   ```bash
   cd backend
   npm run prisma:seed
   ```
   Ensure test data exists (organizations, users, vehicles, drivers, stock items)

## Running Tests

### All E2E Tests
```bash
npm run test:e2e
```

### Waybill-Stock Integration Test Only
```bash
npm run test:e2e:integration
```

### UI Mode (Interactive)
```bash
npm run test:e2e:ui
```

### Debug Mode
```bash
npm run test:e2e:debug
```

## Test Coverage

### waybill-stock-integration.e2e.spec.ts

**Full lifecycle test:**
1. ✅ Login as admin via UI
2. ✅ Get stock item (fuel) via API
3. ✅ Get vehicle and driver via API
4. ✅ Create waybill with fuelLines via API
5. ✅ Verify waybill visible in UI
6. ✅ Change status DRAFT → SUBMITTED via API
7. ✅ Change status SUBMITTED → POSTED via API
8. ✅ Verify StockMovement created (EXPENSE, 25л)
9. ✅ Verify movement linked to waybill
10. ✅ Test pagination API
11. ✅ Verify waybill still visible in UI after reload

**What it validates:**
- JWT authentication works
- Stock items API returns data
- Vehicles and Drivers APIs accessible
- Waybill creation saves fuelLines to database
- Status state machine transitions correctly
- StockMovement automatically created on POSTED
- Movement has correct documentType, documentId, quantity
- Pagination format `{data[], pagination{}}` works
- UI displays backend data correctly

## Troubleshooting

### "Backend недоступен"
- Check backend is running: `cd backend && npm run dev`
- Verify `http://localhost:3001/api/health` returns 200

### "Login failed"
- Check database is seeded: `cd backend && npm run prisma:seed`
- Default credentials: email=`admin`, password=`123`

### "Stock items not found"
- Run seed: `cd backend && npm run prisma:seed`
- Verify organizationId matches in database

### "StockMovement not created"
- Check `fuelLines` are saved to `waybill_fuel` table
- Verify `changeWaybillStatus` calls `createExpenseMovement`
- Check backend logs for errors

## CI/CD Integration

To run in CI pipeline, add to `.github/workflows/test.yml`:

```yaml
- name: Run E2E Tests
  run: |
    # Start backend
    cd backend && npm run dev &
    sleep 5
    
    # Start frontend
    npm run dev &
    sleep 5
    
    # Run tests
    npm run test:e2e:integration
```

## Test Data

Each test run creates a unique waybill:
- Number: `E2E-TEST-{timestamp}`
- Date: Current date
- FuelLines: 25л consumed (автоматически создает EXPENSE movement)

Tests clean up after themselves by design - no manual cleanup needed.
