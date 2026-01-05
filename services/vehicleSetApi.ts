import { httpClient } from './httpClient';

export type SetKind = 'TIRE' | 'WHEEL';
export type SeasonType = 'SUMMER' | 'WINTER' | 'ALL_SEASON';
export type SetStatus = 'STORED' | 'IN_USE' | 'SCRAPPED';

export interface VehicleSet {
    id: string;
    vehicleId: string;
    kind: SetKind;
    season: SeasonType;
    spec: string;
    status: SetStatus;
    stockLocationId?: string | null;
    installedAt?: string | null;
    removedAt?: string | null;
    installedAtOdometerKm?: number | null;
    removedAtOdometerKm?: number | null;
    wearPct: number;
    vehicle?: { registrationNumber: string };
    stockLocation?: { name: string };
}

export interface VehicleSetCreateInput {
    vehicleId: string;
    kind: SetKind;
    season: SeasonType;
    spec: string;
    initialStatus?: SetStatus;
    stockLocationId?: string;
    wearPct?: number;
}

export async function getVehicleSets(vehicleId: string): Promise<VehicleSet[]> {
    const response = await httpClient.get<VehicleSet[]>(`/vehicles/${vehicleId}/sets`);
    return response || [];
}

export async function createVehicleSet(data: VehicleSetCreateInput): Promise<VehicleSet> {
    const response = await httpClient.post<VehicleSet>('/vehicle-sets', data);
    return response;
}

export async function equipVehicleSet(setId: string, odometer: number): Promise<VehicleSet> {
    const response = await httpClient.post<VehicleSet>(`/vehicle-sets/${setId}/equip`, { odometer });
    return response;
}

export async function unequipVehicleSet(setId: string, odometer: number, locationId: string): Promise<VehicleSet> {
    const response = await httpClient.post<VehicleSet>(`/vehicle-sets/${setId}/unequip`, { odometer, locationId });
    return response;
}
