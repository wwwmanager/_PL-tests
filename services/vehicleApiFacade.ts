// Vehicle API Facade with dynamic switching based on appMode
import { Vehicle } from '../types';
import * as mockApi from './mockApi';
import * as realVehicleApi from './api/vehicleApi';
import { getAppSettings } from './mockApi';

// Dynamic switching based on appMode
async function shouldUseRealAPI(): Promise<boolean> {
    const settings = await getAppSettings();
    return settings?.appMode === 'central';
}

export async function getVehicles(): Promise<Vehicle[]> {
    const useReal = await shouldUseRealAPI();
    if (useReal) {
        return realVehicleApi.getVehicles();
    }
    return mockApi.getVehicles();
}

export async function getVehicleById(id: string): Promise<Vehicle | undefined> {
    const useReal = await shouldUseRealAPI();
    if (useReal) {
        return realVehicleApi.getVehicleById(id);
    }
    const vehicles = await mockApi.getVehicles();
    return vehicles.find(v => v.id === id);
}

export async function createVehicle(data: Partial<Vehicle>): Promise<Vehicle> {
    const useReal = await shouldUseRealAPI();
    if (useReal) {
        return realVehicleApi.createVehicle(data);
    }
    return mockApi.addVehicle(data as Omit<Vehicle, 'id'>);
}

export async function updateVehicle(data: Vehicle): Promise<Vehicle> {
    const useReal = await shouldUseRealAPI();
    if (useReal) {
        return realVehicleApi.updateVehicle(data);
    }
    return mockApi.updateVehicle(data);
}

export async function deleteVehicle(id: string): Promise<void> {
    const useReal = await shouldUseRealAPI();
    if (useReal) {
        return realVehicleApi.deleteVehicle(id);
    }
    return mockApi.deleteVehicle(id);
}
