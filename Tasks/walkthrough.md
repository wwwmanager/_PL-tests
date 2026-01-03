# Walkthrough: Advanced Data Export

I have successfully implemented the "Advanced Data Export" feature, allowing granular selection and export of data from the admin panel via the backend.

## Key Changes

### Backend
1.  **Modified `adminController.ts`**:
    *   Added `exportData` controller.
    *   Implemented logic to fetch selected data (using Prisma) based on tables and item IDs.
    *   Bundles data into the standard JSON export format (`ExportBundle`).
    *   Fixed `Waybill` relation issue (`fuel` -> `fuelLines`).
2.  **Modified `adminRoutes.ts`**:
    *   Added `POST /api/admin/export` endpoint.
    *   Protected by `admin` role.

### Frontend
1.  **Modified `adminApi.ts`**:
    *   Added `exportData` function to call the new endpoint.
    *   Configured to return a `Blob` for file download.
2.  **Refactored `DataExportModal.tsx`**:
    *   Replaced `localStorage` data loading with `getDataPreview()` from the API.
    *   Replicated the UI/UX of `DataDeletionModal`:
        *   Grouped categories (Documents, Dictionaries, etc.).
        *   Accordion-style expansion.
        *   Granular selection (Category -> Table -> Item).
        *   "Select All" / "Deselect" functionality.
    *   Implemented file download trigger using `URL.createObjectURL`.
3.  **Updated `Admin.tsx`**:
    *   Updated `DataExportModal` usage to remove deprecated `onExport` prop (modal now handles export internally).

## Verification Steps

To verify the changes, please follow these steps:

1.  **Login as Admin**: Ensure you are logged in with an account having admin privileges.
2.  **Navigate to Admin Grid**: Go to Settings -> Export.
3.  **Open Export Modal**: Click the **Export...** button.
    *   *Verify*: A new modal titled "Экспорт данных" should appear.
    *   *Verify*: It should show a spinner while loading data ("Загрузка данных...").
    *   *Verify*: After loading, you should see categories like 'Документы', 'Справочники', etc., with counts (e.g., "0 / 15").
4.  **Test Selection**:
    *   Expand "Справочники".
    *   Expand "Организации".
    *   Select specific organizations.
    *   *Verify*: The counter for "Справочники" and "Организации" updates correctly.
    *   Select the entire "Документы" category.
    *   *Verify*: All items inside "Документы" are selected.
5.  **Perform Export**:
    *   Click the **"Экспортировать выбранное"** button.
    *   *Verify*: A loading spinner appears on the button.
    *   *Verify*: A file named `data-export-YYYY-MM-DD.json` starts downloading.
    *   *Verify*: A success toast notification appears.
6.  **Validate Exported File**:
    *   Open the downloaded JSON file.
    *   *Verify*: The structure contains `meta` and `data`.
    *   *Verify*: The `data` object contains keys for the selected tables (e.g., `organizations`, `waybills`).
    *   *Verify*: The items inside match your selection.

## Notes
-   The export now uses the backend database as the source of truth, ensuring compatibility with Central Mode and consistent data.
-   The file format is compatible with the existing Import functionality.
