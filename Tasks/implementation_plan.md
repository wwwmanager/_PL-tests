# WB-PREFILL-010: Default References for Waybill Prefill

## Goal
Enable setting default personnel for Vehicles (Driver) and Departments (Dispatcher, Controller) to streamline Waybill creation via auto-fill.

## Proposed Changes

### Database Schema (`backend/prisma/schema.prisma`)
- **Vehicle**: Reuse `assignedDriverId` (FK to `Employee`). (Prefill resolves to Driver).
- **Department**: Add `defaultDispatcherEmployeeId` and `defaultControllerEmployeeId` (FKs to `Employee`).

### Backend
- **Services**: Update `vehicleService` and `departmentService` to support CRUD for new fields.
- **DTOs**: Add fields to DTOs.

## WB-PREFILL-020: Waybill Prefill Implementation Plan

### Backend
#### [NEW] [waybillPrefillController.ts](file:///c:/_PL-tests/backend/src/controllers/waybillPrefillController.ts)
- Implement `GET /prefill`.
- Logic:
    - Get Vehicle (with defaults).
    - Get Last Waybill (ODOMETER, TANK).
    - Get Tank Balance (if available).
    - Determine `driverId`, `dispatcherId`, `controllerId`:
        - Priority: Last Waybill -> Default (Vehicle/Dept) -> Current User?

#### [MODIFY] [waybillRoutes.ts](file:///c:/_PL-tests/backend/src/routes/waybillRoutes.ts)
- Register `/prefill` endpoint.

### Frontend
#### [MODIFY] [waybillApi.ts](file:///c:/_PL-tests/services/api/waybillApi.ts)
- Add `getWaybillPrefill(vehicleId, at)`.

## WB-PREFILL-030: Frontend Safe Prefill
### Frontend
#### [MODIFY] [WaybillDetail.tsx](file:///c:/_PL-tests/components/waybills/WaybillDetail.tsx)
- Trigger `getWaybillPrefill` when `vehicleId` changes.
- Implement conflict detection:
    - If fields are empty -> auto-fill.
    - If fields are filled -> show "Update fields?" modal.
- Modal options: "Update only empty" (default), "Overwrite all", "Cancel".

## WB-POST-010: Conflict Validation
### Backend
#### [MODIFY] [waybillService.ts](file:///c:/_PL-tests/backend/src/services/waybillService.ts)
- In `updateWaybill` (when status -> POSTED):
    - Fetch last `POSTED` waybill for the vehicle (ordered by date/odometer).
    - Validation 1: `newWaybill.odometerStart` >= `lastPosted.odometerEnd`.
    - Validation 2: `newWaybill.startAt` (or date) >= `lastPosted.endAt` (or date).
    - If conflict: Throw 409 Conflict with details.

## Verification Plan
### Automated Tests
- Integration: Create Vehicle with defaults. Create old waybill. Call prefill. Verify response contains defaults + last waybill data.
- Integration: Create Posted WB 1. Create Draft WB 2 with older odometer. Try to POST WB 2 -> Expect 409.
- Frontend: Test prefill conflict modal flow (manual/unit).


### Frontend
- **VehicleList**: (Already has Assigned Driver).
- **OrganizationManagement**: Add "Default Dispatcher/Controller" selects to Department form.

## Verification
- Manual verification of saving/loading defaults.
- Database migration (via push/dev).