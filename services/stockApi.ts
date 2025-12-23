/**
 * Stock API Facade
 * 
 * Uses real backend API for all stock item and movement operations.
 * Replaces mockApi stock functions.
 */

import { httpClient } from './httpClient';
import type { GarageStockItem, StockTransaction, StockTransactionItem } from '../types';

// ==================== TYPES ====================

interface ApiResponse<T> {
    data: T;
}

// Backend StockItem model
interface BackendStockItem {
    id: string;
    organizationId: string;
    code: string | null;
    name: string;
    unit: string;
    isFuel: boolean;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

// Backend StockMovement model
interface BackendStockMovement {
    id: string;
    organizationId: string;
    warehouseId: string | null;
    stockItemId: string;
    movementType: 'INCOME' | 'EXPENSE' | 'ADJUSTMENT';
    quantity: number;
    documentType: string | null;
    documentId: string | null;
    comment: string | null;
    createdByUserId: string | null;
    createdAt: string;
    stockItem?: BackendStockItem;
}

// ==================== MAPPERS ====================

function mapBackendItemToFrontend(item: BackendStockItem): GarageStockItem {
    return {
        id: item.id,
        name: item.name,
        code: item.code || undefined,
        unit: item.unit,
        itemType: 'Товар',
        group: item.isFuel ? 'ГСМ' : 'Прочее',
        balance: 0, // Will be calculated from movements
        storageType: 'centralWarehouse',
        isActive: item.isActive,
        organizationId: item.organizationId,
        fuelTypeId: item.isFuel ? item.id : undefined, // Simplified
    };
}

function mapBackendMovementToFrontend(movement: BackendStockMovement): StockTransaction {
    return {
        id: movement.id,
        docNumber: movement.id.slice(0, 8), // Generate doc number from id
        date: movement.createdAt.split('T')[0],
        type: movement.movementType === 'INCOME' ? 'income' : 'expense',
        items: [{
            stockItemId: movement.stockItemId,
            quantity: movement.quantity,
        }],
        waybillId: movement.documentType === 'waybill' ? movement.documentId : null,
        notes: movement.comment || undefined,
        organizationId: movement.organizationId,
    };
}

// ==================== STOCK ITEMS API ====================

/**
 * Get all stock items (garage nomenclature)
 */
export async function getGarageStockItems(isFuel?: boolean): Promise<GarageStockItem[]> {
    console.log('📡 [stockApi] Fetching stock items from backend...');
    let url = '/stock/items';
    if (isFuel !== undefined) {
        url += `?isFuel=${isFuel}`;
    }
    const response = await httpClient.get<ApiResponse<BackendStockItem[]>>(url);
    const items = (response.data || []).map(mapBackendItemToFrontend);
    console.log('📡 [stockApi] Received', items.length, 'stock items');
    return items;
}

/**
 * Add a new stock item
 */
export async function addGarageStockItem(data: Omit<GarageStockItem, 'id'>): Promise<GarageStockItem> {
    console.log('📡 [stockApi] Creating stock item:', data.name);
    const response = await httpClient.post<ApiResponse<BackendStockItem>>('/stock/items', {
        name: data.name,
        code: data.code,
        unit: data.unit,
        isFuel: data.group === 'ГСМ' || !!data.fuelTypeId,
        isActive: data.isActive,
    });
    return mapBackendItemToFrontend(response.data);
}

/**
 * Update an existing stock item
 */
export async function updateGarageStockItem(data: GarageStockItem): Promise<GarageStockItem> {
    console.log('📡 [stockApi] Updating stock item:', data.id);
    const response = await httpClient.put<ApiResponse<BackendStockItem>>(`/stock/items/${data.id}`, {
        name: data.name,
        code: data.code,
        unit: data.unit,
        isFuel: data.group === 'ГСМ' || !!data.fuelTypeId,
        isActive: data.isActive,
    });
    return mapBackendItemToFrontend(response.data);
}

/**
 * Delete a stock item
 */
export async function deleteGarageStockItem(id: string): Promise<void> {
    console.log('📡 [stockApi] Deleting stock item:', id);
    await httpClient.delete(`/stock/items/${id}`);
}

// ==================== STOCK MOVEMENTS (TRANSACTIONS) API ====================

/**
 * Get all stock transactions
 */
export async function getStockTransactions(): Promise<StockTransaction[]> {
    console.log('📡 [stockApi] Fetching stock movements from backend...');
    const response = await httpClient.get<ApiResponse<BackendStockMovement[]>>('/stock/movements');
    const transactions = (response.data || []).map(mapBackendMovementToFrontend);
    console.log('📡 [stockApi] Received', transactions.length, 'movements');
    return transactions;
}

/**
 * Add a new stock transaction
 */
export async function addStockTransaction(data: Omit<StockTransaction, 'id'>): Promise<StockTransaction> {
    console.log('📡 [stockApi] Creating stock movement:', data.type);
    const response = await httpClient.post<ApiResponse<BackendStockMovement>>('/stock/movements', {
        movementType: data.type,
        items: data.items,
        warehouseId: null,
        documentType: data.waybillId ? 'waybill' : null,
        documentId: data.waybillId || null,
        comment: data.notes,
    });
    return mapBackendMovementToFrontend(response.data);
}

/**
 * Update a stock transaction
 */
export async function updateStockTransaction(data: StockTransaction): Promise<StockTransaction> {
    console.log('📡 [stockApi] Updating stock movement:', data.id);
    const firstItem = data.items[0];
    const response = await httpClient.put<ApiResponse<BackendStockMovement>>(`/stock/movements/${data.id}`, {
        stockItemId: firstItem?.stockItemId,
        movementType: data.type,
        quantity: firstItem?.quantity || 0,
        documentType: data.waybillId ? 'waybill' : null,
        documentId: data.waybillId || null,
        comment: data.notes,
    });
    return mapBackendMovementToFrontend(response.data);
}

/**
 * Delete a stock transaction
 */
export async function deleteStockTransaction(id: string): Promise<void> {
    console.log('📡 [stockApi] Deleting stock movement:', id);
    await httpClient.delete(`/stock/movements/${id}`);
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Get fuel card balance for a driver
 */
export async function getFuelCardBalance(driverId: string): Promise<number> {
    try {
        const response = await httpClient.get<ApiResponse<{ balance: number }>>(`/stock/fuel-card-balance/${driverId}`);
        return response.data?.balance || 0;
    } catch {
        return 0;
    }
}

/**
 * REL-602: Get fuel cards assigned to a driver
 */
export interface FuelCardInfo {
    id: string;
    cardNumber: string;
    provider: string | null;
}

export async function getFuelCardsForDriver(driverId: string): Promise<FuelCardInfo[]> {
    try {
        const response = await httpClient.get<{ data: FuelCardInfo[] }>(`/fuel-cards/driver/${driverId}`);
        return response.data || [];
    } catch {
        console.error('[stockApi] getFuelCardsForDriver error');
        return [];
    }
}

/**
 * Get available fuel expenses for a driver
 */
export async function getAvailableFuelExpenses(
    driverId: string,
    organizationId: string,
    waybillId?: string
): Promise<StockTransaction[]> {
    try {
        const params = new URLSearchParams();
        if (waybillId) params.append('waybillId', waybillId);
        const response = await httpClient.get<ApiResponse<BackendStockMovement[]>>(
            `/stock/available-fuel-expenses/${driverId}?${params.toString()}`
        );
        return (response.data || []).map(mapBackendMovementToFrontend);
    } catch {
        return [];
    }
}

/**
 * Get next waybill number (simple increment)
 */
export async function getNextWaybillNumber(organizationId: string): Promise<string> {
    // For now, generate a simple number based on timestamp
    // In production, this should query the backend for the last waybill number
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const seq = String(Math.floor(Math.random() * 1000)).padStart(4, '0');
    return `${year}${month}${day}-${seq}`;
}

// ==================== REL-107: FUEL MANAGEMENT API ====================

/**
 * Stock location from backend
 */
export interface StockLocation {
    id: string;
    organizationId: string;
    type: 'WAREHOUSE' | 'FUEL_CARD' | 'VEHICLE_TANK';
    name: string;
    warehouseId?: string;
    fuelCardId?: string;
    vehicleId?: string;
}

/**
 * Balance at a specific date
 */
export interface LocationBalance {
    locationId: string;
    locationName: string;
    locationType: string;
    stockItemId: string;
    stockItemName: string;
    balance: number;
    unit: string;
}

/**
 * Get all stock locations
 */
export async function getStockLocations(): Promise<StockLocation[]> {
    console.log('📡 [stockApi] Fetching stock locations...');
    const response = await httpClient.get<ApiResponse<StockLocation[]>>('/stock/locations');
    return response.data || [];
}

/**
 * Get balances at a specific date
 */
export async function getBalancesAt(asOf?: Date): Promise<LocationBalance[]> {
    console.log('📡 [stockApi] Fetching balances at:', asOf?.toISOString() || 'now');
    const params = asOf ? `?asOf=${asOf.toISOString()}` : '';
    const response = await httpClient.get<ApiResponse<LocationBalance[]>>(`/stock/balances${params}`);
    return response.data || [];
}

/**
 * Get balance for a specific location and item
 */
export async function getBalanceAt(
    locationId: string,
    stockItemId: string,
    asOf?: Date
): Promise<number> {
    const params = new URLSearchParams({ locationId, stockItemId });
    if (asOf) params.append('asOf', asOf.toISOString());
    const response = await httpClient.get<ApiResponse<{ balance: number }>>(`/stock/balance?${params.toString()}`);
    return response.data?.balance || 0;
}

/**
 * Movement from backend with full details
 */
export interface StockMovementV2 {
    id: string;
    movementType: 'INCOME' | 'EXPENSE' | 'ADJUSTMENT' | 'TRANSFER';
    quantity: number;
    stockItemId: string;
    stockItemName?: string;
    stockLocationId?: string;
    stockLocationName?: string;
    fromStockLocationId?: string;
    fromStockLocationName?: string;
    toStockLocationId?: string;
    toStockLocationName?: string;
    occurredAt: string;
    createdAt: string;
    documentType?: string;
    documentId?: string;
    comment?: string;
}

/**
 * Get movements with filters
 */
export async function getMovementsV2(filters?: {
    locationId?: string;
    stockItemId?: string;
    movementType?: string;
    from?: Date;
    to?: Date;
}): Promise<StockMovementV2[]> {
    const params = new URLSearchParams();
    if (filters?.locationId) params.append('locationId', filters.locationId);
    if (filters?.stockItemId) params.append('stockItemId', filters.stockItemId);
    if (filters?.movementType) params.append('movementType', filters.movementType);
    if (filters?.from) params.append('from', filters.from.toISOString());
    if (filters?.to) params.append('to', filters.to.toISOString());

    const response = await httpClient.get<ApiResponse<StockMovementV2[]>>(`/stock/movements/v2?${params.toString()}`);
    return response.data || [];
}

// ==================== FUEL CARDS ====================

export interface FuelCard {
    id: string;
    cardNumber: string;
    provider?: string;
    isActive: boolean;
    balanceLiters: number;
    assignedToDriverId?: string;
    assignedToVehicleId?: string;
    assignedToDriver?: { id: string; fullName: string } | null;
}

export interface FuelCardAssignment {
    id: string;
    fuelCardId: string;
    validFrom: string;
    validTo?: string;
    driverId?: string;
    driverName?: string;
    vehicleId?: string;
    vehicleNumber?: string;
    providerName?: string;
}

/**
 * Get all fuel cards
 */
export async function getFuelCards(): Promise<FuelCard[]> {
    const response = await httpClient.get<FuelCard[]>('/fuel-cards');
    return response || [];
}

/**
 * Create a new fuel card
 */
export interface CreateFuelCardParams {
    cardNumber: string;
    provider?: string;
    isActive?: boolean;
}

export async function createFuelCard(params: CreateFuelCardParams): Promise<FuelCard> {
    console.log('📡 [stockApi] Creating fuel card:', params);
    const response = await httpClient.post<ApiResponse<FuelCard>>('/fuel-cards', params);
    return response.data;
}

/**
 * Get assignment history for a fuel card
 */
export async function getCardAssignments(fuelCardId: string): Promise<FuelCardAssignment[]> {
    const response = await httpClient.get<ApiResponse<FuelCardAssignment[]>>(`/fuel-cards/${fuelCardId}/assignments`);
    return response.data || [];
}

/**
 * Check if card is valid at date
 */
export async function isCardValidAt(fuelCardId: string, asOf?: Date): Promise<{ valid: boolean; reason?: string }> {
    const params = asOf ? `?asOf=${asOf.toISOString()}` : '';
    const response = await httpClient.get<ApiResponse<{ valid: boolean; reason?: string }>>(`/fuel-cards/${fuelCardId}/valid${params}`);
    return response.data || { valid: false };
}

/**
 * FUEL-CARD-LINK-UI: Assign fuel card to a driver
 */
export async function assignFuelCard(fuelCardId: string, driverId: string | null): Promise<FuelCard> {
    const response = await httpClient.patch<FuelCard>(`/fuel-cards/${fuelCardId}/assign`, { driverId });
    return response;
}

/**
 * FUEL-CARD-LINK-UI: Search drivers by name for autocomplete
 */
export interface DriverSearchResult {
    id: string;
    fullName: string;
    employeeId: string;
}

export async function searchDrivers(query: string): Promise<DriverSearchResult[]> {
    const response = await httpClient.get<ApiResponse<DriverSearchResult[]>>(`/drivers/search?q=${encodeURIComponent(query)}`);
    return response.data || [];
}

/**
 * FUEL-CARDS-003: Delete a fuel card
 */
export async function deleteFuelCard(fuelCardId: string): Promise<void> {
    await httpClient.delete(`/fuel-cards/${fuelCardId}`);
}

/**
 * FUEL-CARDS-003: Create or update a top-up rule for a fuel card
 */
export interface CreateTopUpRuleParams {
    scheduleType: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    amountLiters: number;
    minBalanceLiters?: number;
    stockItemId?: string;
    sourceLocationId?: string;
    timezone?: string;
    isActive?: boolean;
}

export async function createTopUpRule(fuelCardId: string, data: CreateTopUpRuleParams): Promise<TopUpRule> {
    const response = await httpClient.put<ApiResponse<TopUpRule>>(`/fuel-cards/${fuelCardId}/topup-rule`, data);
    return response.data;
}

/**
 * FUEL-CARDS-003: Delete a top-up rule
 */
export async function deleteTopUpRule(fuelCardId: string): Promise<void> {
    await httpClient.delete(`/fuel-cards/${fuelCardId}/topup-rule`);
}

// ==================== TOP-UP & RESET RULES ====================

export interface TopUpRule {
    id: string;
    fuelCardId: string;
    fuelCardNumber?: string;
    isActive: boolean;
    scheduleType: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    amountLiters: number;
    minBalanceLiters?: number;
    stockItemId?: string;
    stockItemName?: string;
    nextRunAt?: string;
    lastRunAt?: string;
}

export interface ResetRule {
    id: string;
    name: string;
    isActive: boolean;
    frequency: 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'MANUAL';
    scope: 'ALL_CARDS' | 'BY_PROVIDER' | 'BY_DEPARTMENT' | 'SPECIFIC_CARDS';
    mode: 'TRANSFER_TO_WAREHOUSE' | 'EXPIRE_EXPENSE';
    stockItemId?: string;
    stockItemName?: string;
    nextRunAt?: string;
    lastRunAt?: string;
}

/**
 * Get all top-up rules
 */
export async function getTopUpRules(): Promise<TopUpRule[]> {
    const response = await httpClient.get<ApiResponse<TopUpRule[]>>('/fuel-cards/topup-rules');
    return response.data || [];
}

/**
 * Get all reset rules
 */
export async function getResetRules(): Promise<ResetRule[]> {
    const response = await httpClient.get<ApiResponse<ResetRule[]>>('/fuel-cards/reset-rules');
    return response.data || [];
}

/**
 * Run top-up job manually
 */
export async function runTopUpJob(): Promise<{ processed: number; toppedUp: number; skipped: number }> {
    const response = await httpClient.post<ApiResponse<{ processed: number; toppedUp: number; skipped: number }>>('/admin/jobs/run-fuelcard-topups');
    return response.data || { processed: 0, toppedUp: 0, skipped: 0 };
}

/**
 * Run reset rules
 */
export async function runResetRules(ruleId?: string): Promise<{ processed: number; reset: number; skipped: number }> {
    const body = ruleId ? { ruleId } : {};
    const response = await httpClient.post<ApiResponse<{ processed: number; reset: number; skipped: number }>>('/admin/fuel/resets/run', body);
    return response.data || { processed: 0, reset: 0, skipped: 0 };
}

/**
 * Preview reset without making changes
 */
export async function previewResetRules(ruleId?: string): Promise<{ processed: number; reset: number; skipped: number }> {
    const params = ruleId ? `?ruleId=${ruleId}` : '';
    const response = await httpClient.get<ApiResponse<{ processed: number; reset: number; skipped: number }>>(`/admin/fuel/resets/preview${params}`);
    return response.data || { processed: 0, reset: 0, skipped: 0 };
}

// ==================== FUEL-TOPUP-001: MANUAL TOP-UP ====================

/**
 * Get or create a stock location for a fuel card
 * Used as the destination for manual top-up transfers
 */
export async function getOrCreateFuelCardLocation(fuelCardId: string): Promise<StockLocation> {
    console.log('📡 [stockApi] Getting/creating fuel card location for:', fuelCardId);
    const response = await httpClient.post<StockLocation>('/stock/locations/fuel-card', { fuelCardId });
    return response;
}

/**
 * Get stock items (fuel types) for top-up dropdown
 */
export async function getStockItems(isFuel?: boolean): Promise<BackendStockItem[]> {
    console.log('📡 [stockApi] Fetching stock items...');
    let url = '/stock/items';
    if (isFuel !== undefined) {
        url += `?isFuel=${isFuel}`;
    }
    const response = await httpClient.get<{ data: BackendStockItem[] }>(url);
    return response.data || [];
}

export interface StockItemOption {
    id: string;
    name: string;
    code: string | null;
    unit: string;
}

/**
 * Get fuel types for top-up selector
 */
export async function getFuelTypes(): Promise<StockItemOption[]> {
    const items = await getStockItems(true);
    return items.map(item => ({
        id: item.id,
        name: item.name,
        code: item.code,
        unit: item.unit,
    }));
}

/**
 * Create a TRANSFER movement (used for manual top-up)
 */
export interface CreateTransferParams {
    stockItemId: string;
    quantity: number;
    fromLocationId: string;
    toLocationId: string;
    occurredAt: string; // ISO date string
    externalRef: string;
    comment?: string;
}

export async function createTransferMovement(params: CreateTransferParams): Promise<StockMovementV2> {
    console.log('📡 [stockApi] Creating TRANSFER movement:', params);
    const response = await httpClient.post<StockMovementV2>('/stock/movements/v2', {
        movementType: 'TRANSFER',
        stockItemId: params.stockItemId,
        quantity: String(params.quantity), // Backend expects string decimal
        fromLocationId: params.fromLocationId,
        toLocationId: params.toLocationId,
        occurredAt: params.occurredAt,
        externalRef: params.externalRef,
        comment: params.comment,
    });
    return response;
}

/**
 * Get warehouses for source location dropdown
 */
export async function getWarehouses(): Promise<StockLocation[]> {
    const locations = await getStockLocations();
    return locations.filter(loc => loc.type === 'WAREHOUSE');
}

