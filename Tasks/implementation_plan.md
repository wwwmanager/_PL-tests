# Implement Draft Fuel Reserve Display

## Goal
Display the amount of fuel reserved by other DRAFT waybills for the selected fuel card, to give the dispatcher a complete picture of available fuel.

## Proposed Changes

### Backend

#### [MODIFY] [fuelCardRoutes.ts](file:///c:/_PL-tests/backend/src/routes/fuelCardRoutes.ts)
-   Add `GET /:id/reserve` endpoint.

#### [MODIFY] [fuelCardService.ts](file:///c:/_PL-tests/backend/src/services/fuelCardService.ts)
-   Implement `getDraftReserve(fuelCardId, excludeWaybillId)`:
    -   Find all DRAFT waybills for this card.
    -   Sum `fuelReceived` from their `WaybillFuel` lines.

### Frontend

#### [MODIFY] [fuelCardApi.ts](file:///c:/_PL-tests/services/api/fuelCardApi.ts)
-   Add `getFuelCardReserve(id, excludeWaybillId)` method.

#### [MODIFY] [WaybillDetail.tsx](file:///c:/_PL-tests/components/waybills/WaybillDetail.tsx)
-   Add `fuelCardReserved` state.
-   Fetch reserve amount when fuel card is identified.
-   Display: "Available: X (Reserved: Y)".

## Verification
-   Create a DRAFT waybill with 50L.
-   Open a new waybill with same driver/card.
-   Verify "Reserved: 50.00 л" is displayed.