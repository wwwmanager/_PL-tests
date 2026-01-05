# Walkthrough - Nomenclature Improvements (REL-200) & Groups (UI-050)

## Overview
This update refined the "Nomenclature" (StockItem) dictionary by:
1.  Expanding fields (Group, Description, Initial Balance).
2.  **Groups Configuration**: Replacing the generic "Category" selector with a specific "Group" dropdown list (ГСМ, Техжидкости, Запчасти, etc.) as the primary method of classification.
3.  **Auto-Classification**: The system now automatically maps the selected "Group" to the internal system "Category" (e.g., ГСМ -> FUEL).

## Changes

### 1. Groups & UI
- **Fixed Groups List**: Defines strict groups: 'ГСМ', 'Техжидкости', 'Запчасти', 'Шины', 'АКБ', 'Агрегаты', 'Услуги'.
- **UI Interaction**:
    - The **Group** field is now a dropdown menu.
    - The **Category** field has been removed from the Form UI to simplify the experience.
    - Selecting a Group automatically sets the correct internal system Category and Fuel flags.
- **Table**: Moving forward, the "Group" column is the primary visual identifier.

### 2. Schema & Data Model
- **New Fields**: `group` (Text) and `description` (Text) persisted in DB.
- **Initial Balance**: Implemented `INITIAL_BALANCE` movement creation on item creation.

## Verification

### Manual Usage
1.  Go to **Warehouse -> Nomenclature**.
2.  Click **Add**.
3.  Select a **Group** (e.g., 'ГСМ').
    - *System creates item as FUEL category internally.*
    - *Density field appears automatically for ГСМ.*
4.  Select a **Group** (e.g., 'Запчасти').
    - *System creates item as SPARE_PART category internally.*
    - *Density field disappears.*
5.  Fill in Name, Description, Initial Balance.
6.  Click **Create**.
7.  Verify the item appears in the list with the correct Group name.
