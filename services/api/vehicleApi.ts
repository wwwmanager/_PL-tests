// Vehicle API Facade
import { httpClient } from '../httpClient';
import { Vehicle } from '../../types';

export interface VehicleFilters {
    organizationId?: string;
    page?: number;
    limit?: number;
}

/**
 * Sanitize vehicle payload before sending to backend
 * - Converts empty strings to null
 * - Removes fields not expected by backend
 * - Maps frontend field names to backend expectations
 */
function sanitizeVehiclePayload(data: Record<string, unknown>): Record<string, unknown> {
    const toNullIfEmpty = (val: unknown): unknown => {
        if (val === '' || val === undefined) return null;
        return val;
    };

    // --- ЛОГИКА СТАТУСОВ (HARD FORCE) ---

    // 1. Вычисляем isActive. 
    // Приоритет: 1) Явный boolean 2) Строка статуса 3) true (по умолчанию)
    let calculatedIsActive = true;

    if (typeof data.isActive === 'boolean') {
        calculatedIsActive = data.isActive;
    } else if (data.status) {
        const s = String(data.status).trim();
        // Список значений, которые точно означают "Выключено"
        // FIX: Добавлены 'Archived' и 'ARCHIVED' для соответствия VehicleStatus.ARCHIVED = 'Archived'
        if (['Inactive', 'Неактивен', 'Archive', 'Archived', 'ARCHIVED', 'Архив', 'false'].includes(s)) {
            calculatedIsActive = false;
        }
    }

    // 2. Формируем finalStatus.
    // Если isActive = true, статус ОБЯЗАН быть заполнен (Active или др.), нельзя слать null/undefined.
    let finalStatus = data.status;

    if (!calculatedIsActive) {
        // FIX: Если выключено, сохраняем оригинальный статус если это 'Archived', иначе ставим 'Inactive'
        const currentS = String(data.status || '').trim();
        if (['Archived', 'ARCHIVED', 'Archive', 'Архив'].includes(currentS)) {
            finalStatus = 'Archived';
        } else {
            finalStatus = 'Inactive';
        }
    } else {
        // Если включено -> проверяем текущий статус
        const currentS = String(data.status || '').trim();
        // Если статус пустой, или он "Inactive/Inactive-like" -> принудительно ставим "Active"
        // Но НЕ трогаем 'Archived' - это отдельный статус
        const shouldForceActive = !currentS || ['Inactive', 'Неактивен', 'false', ''].includes(currentS);

        if (shouldForceActive) {
            finalStatus = 'Active';
        }
        // Иначе оставляем как есть (например, там может быть "Ремонт" или "В рейсе" или "Archived")
    }

    return {
        registrationNumber: data.registrationNumber,
        code: toNullIfEmpty(data.code),
        brand: toNullIfEmpty(data.brand),
        model: toNullIfEmpty(data.model),
        vin: toNullIfEmpty(data.vin),
        vehicleType: toNullIfEmpty(data.vehicleType),
        year: data.year ?? null,
        fuelTankCapacity: data.fuelTankCapacity ?? null,
        mileage: data.mileage ?? null,
        currentFuel: data.currentFuel ?? null,
        fuelType: toNullIfEmpty(data.fuelType ?? data.fuelTypeId),
        fuelStockItemId: toNullIfEmpty(data.fuelStockItemId),

        fuelConsumptionRates: typeof data.fuelConsumptionRates === 'object'
            ? JSON.stringify(data.fuelConsumptionRates)
            : toNullIfEmpty(data.fuelConsumptionRates),

        departmentId: toNullIfEmpty(data.departmentId),
        assignedDriverId: toNullIfEmpty(data.assignedDriverId),
        storageLocationId: toNullIfEmpty(data.storageLocationId),

        useCityModifier: data.useCityModifier ?? false,
        useWarmingModifier: data.useWarmingModifier ?? false,
        disableFuelCapacityCheck: data.disableFuelCapacityCheck ?? false,

        // ОТПРАВЛЯЕМ ГАРАНТИРОВАННО СИНХРОНИЗИРОВАННУЮ ПАРУ
        isActive: calculatedIsActive,
        status: finalStatus,
    };
}

export async function getVehicles(filters: VehicleFilters = {}): Promise<Vehicle[]> {
    const params = new URLSearchParams();
    if (filters.organizationId) params.append('organizationId', filters.organizationId);

    console.log('🔍 [vehicleApi] Calling GET /vehicles with params:', params.toString());
    // httpClient returns data directly (unwrapped)
    const vehiclesArray = await httpClient.get<Vehicle[]>(`/vehicles?${params.toString()}`);
    console.log('🔍 [vehicleApi] GET /vehicles response:', vehiclesArray);
    return vehiclesArray || [];
}

export async function getVehicleById(id: string): Promise<Vehicle> {
    // httpClient returns data directly (unwrapped)
    const vehicle = await httpClient.get<Vehicle>(`/vehicles/${id}`);
    return vehicle;
}

export async function createVehicle(data: Partial<Vehicle> | Record<string, unknown>): Promise<Vehicle> {
    // Sanitize payload to match backend expectations
    const payload = sanitizeVehiclePayload(data as Record<string, unknown>);
    console.log('🚗 [vehicleApi] createVehicle sanitized payload:', JSON.stringify(payload, null, 2));

    // httpClient returns data directly (unwrapped)
    const vehicle = await httpClient.post<Vehicle>('/vehicles', payload);
    return vehicle;
}

export async function updateVehicle(data: (Partial<Vehicle> | Record<string, unknown>) & { id: string }): Promise<Vehicle> {
    const { id, ...updateData } = data;
    // Sanitize payload to match backend expectations
    const payload = sanitizeVehiclePayload(updateData as Record<string, unknown>);
    console.log('📝 [vehicleApi] PUT /vehicles/' + id, 'sanitized payload:', JSON.stringify(payload, null, 2));
    // Backend now returns the updated vehicle object (updated in WB-201)
    const vehicle = await httpClient.put<Vehicle>(`/vehicles/${id}`, payload);
    return vehicle;
}

export async function deleteVehicle(id: string): Promise<void> {
    await httpClient.delete(`/vehicles/${id}`);
}

// Re-export from mockApi for now if needed, or implement real ones if backend supports
// For now, VehicleList uses getFuelTypes from mockApi, so we don't need to export it here if we keep hybrid imports.
