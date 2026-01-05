import { httpClient } from './httpClient';

export type AssetKind = 'BATTERY' | 'AGGREGATE';
export type WearMode = 'BY_MILEAGE' | 'BY_MONTHS';

export interface VehicleAsset {
    id: string;
    vehicleId: string;
    kind: AssetKind;
    stockItemId?: string | null;
    serialNo?: string | null;
    installedAt: string;
    installedAtOdometerKm?: number | null;
    wearMode: WearMode;
    wearPct: number;
    serviceLifeMonths?: number | null;
    wearPctPer1000km?: number | null;
    status: string; // IN_USE, SCRAPPED
}

export interface VehicleAssetCreateInput {
    vehicleId: string;
    kind: AssetKind;
    stockItemId?: string;
    serialNo?: string;
    installedAt: string;
    installedAtOdometerKm?: number;
    wearMode: WearMode;
    serviceLifeMonths?: number;
    wearPctPer1000km?: number;
    initialWearPct?: number;
}

export async function getVehicleAssets(vehicleId: string): Promise<VehicleAsset[]> {
    const response = await httpClient.get<VehicleAsset[]>(`/vehicles/${vehicleId}/assets`);
    return response || [];
}

export async function createVehicleAsset(data: VehicleAssetCreateInput): Promise<VehicleAsset> {
    const response = await httpClient.post<VehicleAsset>('/vehicle-assets', data);
    return response;
}

export async function decommissionVehicleAsset(id: string, reason: string): Promise<VehicleAsset> {
    const response = await httpClient.post<VehicleAsset>(`/vehicle-assets/${id}/decommission`, { reason });
    return response;
}
