# Implement Draft Fuel Reserve Display

## Goal
Display the amount of fuel reserved by other DRAFT waybills for the selected fuel card, to give the dispatcher a complete picture of available fuel.

## Proposed Changes

### Backend

#### [MODIFY] [fuelCardRoutes.ts](file:///c:/_PL-tests/backend/src/routes/fuelCardRoutes.ts)
- [x] Add `GET /:id/reserve` endpoint.

#### [MODIFY] [fuelCardService.ts](file:///c:/_PL-tests/backend/src/services/fuelCardService.ts)
- [x] Implement `getDraftReserve(fuelCardId, excludeWaybillId)`:
    - [x] Find all DRAFT waybills for this card.
    - [x] Sum `fuelReceived` from their `WaybillFuel` lines.

### Frontend

#### [MODIFY] [fuelCardApi.ts](file:///c:/_PL-tests/services/api/fuelCardApi.ts)
- [x] Add `getFuelCardReserve(id, excludeWaybillId)` method. (Implemented in `stockApi.ts`)

#### [MODIFY] [WaybillDetail.tsx](file:///c:/_PL-tests/components/waybills/WaybillDetail.tsx)
- [x] Add `fuelCardReserved` state.
- [x] Fetch reserve amount when fuel card is identified.
- [x] Display: "Available: X (Reserved: Y)".

## Verification
- [x] Create a DRAFT waybill with 50L.
- [x] Open a new waybill with same driver/card.
- [x] Verify "Reserved: 50.00 л" is displayed.