# Implementation Plan - Posting Service & Immutable Documents (ARCH-POSTING-REPLY-001)

## Goal Description
Implement a proper "Ledger-based" transaction processing system where:
1.  **Waybills** drive the creation of **Stock Movements** via strict status transitions (Draft -> Posted).
2.  **Stock Movements** are immutable ledger entries (no physical delete, only Void/Storno).
3.  **PostingService** acts as the central orchestrator for creating these ledger entries atomically.

> [!IMPORTANT]
> **NO STATUS ON STOCK MOVEMENT**: We strictly adhere to the decision that `StockMovement` is a ledger row without a "Draft" state. It exists or it doesn't (or it is Void).

## User Review Required
*   **Immutable Documents**: Once a Waybill is `POSTED`, it cannot be deleted physically. It can only be `CANCELLED` (Void), which generates reversing ledger entries. This is a behavior change for users used to deleting anything.

## Proposed Changes

### 1. New Service: `PostingService` (Backend)
Create `backend/src/services/postingService.ts`.
This service will be responsible for the "Business Logic of Posting".

#### Ledger Logic
*   **postWaybill(waybillId, userId)**:
    *   Verifies Waybill is in `DRAFT` (or correct state).
    *   Calculates required stock movements (Fuel consumption, etc.).
    *   Executes a `prisma.$transaction`:
        *   Sets Waybill.status = `POSTED`.
        *   Calls `stockService.createExpenseMovement` / `createIncomeMovement` etc.
        *   Validates balances (if not allowed to go negative).
*   **cancelWaybill(waybillId, userId, reason)**:
    *   Verifies Waybill is `POSTED`.
    *   Executes a `prisma.$transaction`:
        *   Sets Waybill.status = `CANCELLED`.
        *   Finds previously created StockMovements for this Waybill.
        *   Marks them as `isVoid = true` OR creates explicit "Storno" movements (depending on strictness preference, plan says "storno/void". `isVoid` is cleaner for balance calculation if supported by `getBalance`).
        *   *Decision*: We will use `isVoid = true` for simplicity if existing queries support it (they seem to: `isVoid: false` check exists in `stockService.ts`).

### 2. Update `WaybillService` (Backend)
*   Remove any ad-hoc stock movement creation if it exists.
*   Integrate `PostingService` calls.

### 3. Update `AdminController` / Routes (Backend)
*   Add endpoints for `POST /waybills/:id/post` and `POST /waybills/:id/cancel`.

### 4. Database Schema (Verification)
*   Ensure `StockMovement` has `documentType`, `documentId`, `isVoid` (Confirmed: they exist).
*   Ensure `Waybill` has `status` (Confirmed).

## Verification Plan

### Automated Tests
*   **Unit Tests (`postingService.test.ts`)**:
    *   Post a waybill -> Check `StockMovement` created.
    *   Post a waybill with insufficient funds -> Check error.
    *   Cancel a waybill -> Check `StockMovement` is voided and balance restored.

### Manual Verification
1.  **Create Waybill (Draft)**:
    *   Verify NO `StockMovements` are created.
    *   Verify Fuel Card balance is UNCHANGED.
2.  **Post Waybill**:
    *   Verify `StockMovements` appear (EXPENSE).
    *   Verify Fuel Card balance DECREASES (if applicable).
3.  **Cancel Waybill**:
    *   Verify `StockMovements` disappear from ledger (or marked Void).
    *   Verify Fuel Card balance RESTORES.