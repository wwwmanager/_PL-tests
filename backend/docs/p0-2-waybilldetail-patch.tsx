// P0-2: WB-POSTED-UI-002 Fix
// File: c:\_PL-tests\components\waybills\WaybillDetail.tsx
// Replace lines 1180-1191 with this code:

try {
    const frontStatus = nextStatus.toLowerCase() as FrontWaybillStatus;
    await changeWaybillStatus(savedWaybill.id, frontStatus, {
        userId: currentUser?.id,
        appMode: appSettings?.appMode || 'driver',
    });

    // P0-2: WB-POSTED-UI-002 - Reload full waybill to preserve all fields (routes, dates, fuel)
    const freshWaybill = await getWaybillById(savedWaybill.id);

    // Map fuel from backend to form fields (same mapping logic as line 265-287)
    const f = freshWaybill.fuel;
    const mappedFormData = {
        ...freshWaybill,
        routes: freshWaybill.routes || [],
        date: freshWaybill.date?.split('T')[0] || new Date().toISOString().split('T')[0],
        fuelAtStart: f?.fuelStart ? Number(f.fuelStart) : (freshWaybill.fuelAtStart || 0),
        fuelFilled: f?.fuelReceived ? Number(f.fuelReceived) : (freshWaybill.fuelFilled || 0),
        fuelAtEnd: f?.fuelEnd ? Number(f.fuelEnd) : (freshWaybill.fuelAtEnd || 0),
        fuelPlanned: f?.fuelPlanned ? Number(f.fuelPlanned) : (freshWaybill.fuelPlanned || 0),
        fuelCardId: freshWaybill.fuelCardId || '',
        dispatcherEmployeeId: freshWaybill.dispatcherEmployeeId || '',
        controllerEmployeeId: freshWaybill.controllerEmployeeId || '',
        validFrom: freshWaybill.validFrom?.slice(0, 16) || '',
        validTo: freshWaybill.validTo?.slice(0, 16) || '',
    };

    setFormData(mappedFormData as Waybill);
    setInitialFormData(JSON.parse(JSON.stringify(mappedFormData)));
    showToast(`Статус изменен на "${WAYBILL_STATUS_TRANSLATIONS[nextStatus]}"`, 'success');
} catch (e) {
    showToast((e as Error).message, 'error');
}
