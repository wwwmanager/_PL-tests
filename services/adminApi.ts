import { httpClient } from './httpClient';

/**
 * Admin API - Administrative operations
 */

// Types for data preview
export interface TablePreview {
    count: number;
    items: Array<{ id: string; label: string; subLabel?: string }>;
}

export interface DataPreviewResponse {
    documents: {
        waybills: TablePreview;
        blanks: TablePreview;
        blankBatches: TablePreview;
    };
    dictionaries: {
        employees: TablePreview;
        drivers: TablePreview;
        vehicles: TablePreview;
        routes: TablePreview;
        fuelTypes: TablePreview;
        fuelCards: TablePreview;
        warehouses: TablePreview;
    };
    stock: {
        stockItems: TablePreview;
        stockMovements: TablePreview;
    };
    settings: {
        departments: TablePreview;
        settings: TablePreview;
    };
    logs: {
        auditLogs: TablePreview;
    };
}

export interface SelectiveDeleteRequest {
    tables?: string[];
    items?: Record<string, string[]>;
}

export interface SelectiveDeleteResponse {
    success: boolean;
    message: string;
    deletedCounts: Record<string, number>;
}

interface ResetDatabaseResponse {
    success: boolean;
    message: string;
    preservedTables?: string[];
}

/**
 * Get preview of all data in database grouped by category
 */
export async function getDataPreview(): Promise<DataPreviewResponse> {
    return httpClient.get<DataPreviewResponse>('/admin/data-preview');
}

/**
 * Export selected data
 * Returns a Blob (file download)
 */
export async function exportData(request: SelectiveDeleteRequest): Promise<any> {
    return httpClient.post<any>('/admin/export', request);
}

/**
 * Selectively delete data from specified tables or items
 */
export async function selectiveDelete(request: SelectiveDeleteRequest): Promise<SelectiveDeleteResponse> {
    return httpClient.post<SelectiveDeleteResponse>('/admin/selective-delete', request);
}

/**
 * Reset all data in the PostgreSQL database.
 * WARNING: This is a destructive operation.
 */
export async function resetDatabase(): Promise<ResetDatabaseResponse> {
    return httpClient.delete<ResetDatabaseResponse>('/admin/reset-database');
}

// Types for import
export interface ImportDataRequest {
    organizations?: any[];
    employees?: any[];
    drivers?: any[];
    vehicles?: any[];
    fuelTypes?: any[];
    routes?: any[];
    waybills?: any[];
    fuelCards?: any[];
    warehouses?: any[];
    stockItems?: any[];
    stockMovements?: any[];
    blanks?: any[];
    blankBatches?: any[];
    departments?: any[];
    settings?: any[];
    auditLogs?: any[];
}

export interface ImportResult {
    table: string;
    created: number;
    updated: number;
    errors: string[];
}

export interface ImportDataResponse {
    success: boolean;
    message: string;
    results: ImportResult[];
}

/**
 * Import JSON data into PostgreSQL database
 * Uses upsert logic (create new or update existing)
 */
export async function importData(data: ImportDataRequest): Promise<ImportDataResponse> {
    return httpClient.post<ImportDataResponse>('/admin/import', data);
}

// Types for user transfer
export interface TransferUserRequest {
    userId: string;
    targetOrganizationId?: string;
    createOrganization?: {
        name: string;
        shortName?: string;
    };
    transferAllData?: boolean;
}

export interface TransferUserResponse {
    success: boolean;
    message: string;
    data?: {
        userId: string;
        userEmail: string;
        fromOrganizationId: string;
        fromOrganizationName: string;
        toOrganizationId: string;
        toOrganizationName: string;
        sourceOrganizationEmpty: boolean;
        canDeleteSourceOrg: boolean;
        transferCounts?: Record<string, number>;
        remainingInSourceOrg?: {
            users: number;
            employees: number;
            vehicles: number;
            blanks: number;
            waybills: number;
        };
    };
}

/**
 * Transfer a user to a different organization
 * Can either move to existing org or create a new one
 */
export async function transferUser(data: TransferUserRequest): Promise<TransferUserResponse> {
    return httpClient.post<TransferUserResponse>('/admin/transfer-user', data);
}

// Types for organization data transfer
export interface TransferOrganizationDataRequest {
    sourceOrganizationId: string;
    targetOrganizationId: string;
}

export interface TransferOrganizationDataResponse {
    success: boolean;
    message: string;
    data?: {
        sourceOrganizationId: string;
        sourceOrganizationName: string;
        targetOrganizationId: string;
        targetOrganizationName: string;
        transferCounts: Record<string, number>;
        canDeleteSourceOrg: boolean;
    };
}

/**
 * Transfer ALL data from one organization to another
 * This allows cleaning up an org before deletion
 */
export async function transferOrganizationData(data: TransferOrganizationDataRequest): Promise<TransferOrganizationDataResponse> {
    return httpClient.post<TransferOrganizationDataResponse>('/admin/transfer-organization', data);
}

/**
 * P0-4: STOCK-PERIOD-LOCK — Lock stock period for an organization
 */
export async function lockStockPeriod(organizationId: string, lockedAt: string): Promise<{ success: boolean; data: any }> {
    return httpClient.post('/admin/stock-period/lock', { organizationId, lockedAt });
}

/**
 * P0-4: STOCK-PERIOD-LOCK — Unlock stock period for an organization
 */
export async function unlockStockPeriod(organizationId: string): Promise<{ success: boolean; data: any }> {
    return httpClient.post('/admin/stock-period/unlock', { organizationId });
}

// ============================================================================
// PERIOD-LOCK-001: Period Locking with hash integrity
// ============================================================================

export interface PeriodLock {
    id: string;
    organizationId: string;
    period: string;
    lockedAt: string;
    lockedByUserId: string;
    dataHash: string;
    recordCount: number;
    notes?: string;
    lastVerifiedAt?: string;
    lastVerifyResult?: boolean;
    lockedByUser?: {
        id: string;
        fullName: string;
        email: string;
    };
}

export interface VerifyResult {
    isValid: boolean;
    currentHash: string;
    storedHash: string;
    details?: string;
}

/**
 * Get all period locks for current organization
 */
export async function getPeriodLocks(): Promise<{ success: boolean; data: PeriodLock[] }> {
    return httpClient.get('/admin/period-locks');
}

/**
 * Close a period (create lock with hash)
 */
export async function closePeriod(period: string, notes?: string): Promise<{ success: boolean; data: PeriodLock }> {
    return httpClient.post('/admin/period-locks/close', { period, notes });
}

/**
 * Verify period integrity (recalculate hash and compare)
 */
export async function verifyPeriod(lockId: string): Promise<{ success: boolean; data: VerifyResult }> {
    return httpClient.post(`/admin/period-locks/${lockId}/verify`, {});
}

/**
 * Delete period lock (open period for editing)
 */
export async function deletePeriodLock(lockId: string): Promise<{ success: boolean; data: { period: string } }> {
    return httpClient.delete(`/admin/period-locks/${lockId}`);
}

