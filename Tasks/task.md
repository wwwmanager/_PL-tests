# Task Checklist

- [x] **POSTING-SVC-010**: Create `PostingService`
    - [x] Implement `postWaybill` (Draft -> Posted -> Ledger Entries)
    - [x] Implement `cancelWaybill` (Posted -> Cancelled -> Void key Ledger Entries)
- [x] **DOC-IMMUTABLE-020**: Enforce Immutability
    - [x] Prevent physical deletion of POSTED waybills in `waybillService`
    - [x] Ensure only CANCEL allowed for POSTED
- [ ] **RECALC-030**: Admin Recalculation Tool (Optional/Later)
    - [ ] Create endpoint for balance recalculation if caching is used
- [ ] **Verification**
    - [ ] Verify Waybill flow (Create -> Post -> Cancel) with Fuel Balance checks
