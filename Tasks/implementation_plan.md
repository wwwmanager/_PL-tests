# Enhancing Dashboard with New Widgets

## Goal
Implement a comprehensive set of analytical widgets for the Dashboard, focusing on "Posted" waybills for accuracy. Add usability features: persistence for filters and auto-refresh.

## Proposed Changes

### Database Schema (`schema.prisma`)
- [ ] **Modify `Vehicle`**: Add columns for maintenance tracking.
    - `lastMaintenanceMileage` (Int, default 0)
    - `maintenanceIntervalKm` (Int, default 10000)

### Backend (`dashboardService.ts`)
Update `getDashboardStats` logic:
1.  **Fuel Consumption Dynamics**: Posted Waybills -> Group by YYYY-MM -> Sum Fuel Used.
2.  **Medical Exams Dynamics**: Posted Waybills -> Group by YYYY-MM -> Sum Days/Exams.
3.  **Top 10 Fuel Consumers**: Posted Waybills -> Group by Vehicle -> Sum Fuel -> Sort Desc.
4.  **Driver Exams Stats**: Posted Waybills -> Group by Driver -> Sum Exams.
5.  **Upcoming Maintenance**: Active Vehicles -> Calc `remaining` -> Filter `< 2000` -> Color code.
6.  **Birthdays**: Active Employees -> Filter Month -> Sort Day -> Flag `isToday`.
7.  **Issues**: Aggregate counts of expired docs and overdue maintenance.

### Frontend (`Dashboard.tsx`)
- **Usability**:
    - [ ] **Persistence**: Save `dashboard_dateFrom` and `dashboard_dateTo` to `localStorage`.
    - [ ] **Auto-refresh**: Trigger `fetchData` immediately when `vehicleId` changes (remove reliance on "Generate" button for this filter).
- **Layout & Widgets**:
    - **Row 1**: Status Cards (`Draft`, `InReview`, `Posted`, `Issues`).
    - **Row 2**: KPI Cards (`Odometer`, `FuelTank`, `FuelCards`, `YearExpense`).
    - **Row 3**: `FuelConsumptionDynamics` (Chart), `MedicalExamsDynamics` (Chart).
    - **Row 4**: `TopFuelVehicles` (Bar), `DriverExams` (Horiz Bar).
    - **Row 5**: `MaintenanceList` (Widget), `BirthdayList` (Widget).

## Verification Plan
1.  **Schema**: Check `npx prisma migrate dev` success.
2.  **Backend**: Verify aggregation returns correct JSON structure.
3.  **Frontend**:
    - Reload page -> Dates and Vehicle should remain selected.
    - Change Vehicle -> Charts should update instantly.
    - Check new widgets against test data.