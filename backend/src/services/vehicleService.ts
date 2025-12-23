// ... imports
import { prisma } from '../db/prisma';
import { BadRequestError, NotFoundError } from '../utils/errors';
import * as fs from 'fs';
import { StockLocationType } from '@prisma/client';

const LOG_FILE = 'c:/_PL-tests/vehicle_debug_v2.log';

function logToDebugFile(message: string) {
    try {
        const timestamp = new Date().toISOString();
        fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
    } catch (e) {
        console.error('Failed to write to debug log', e);
    }
}

// Common logic for status resolution
function resolveIsActive(status: string | undefined, isActive: boolean | undefined): boolean | undefined {
    // Log resolution attempt
    const resolved = (() => {
        if (!status) return isActive;
        const s = status.trim().toUpperCase();
        if (['ACTIVE', 'ACT', 'АКТИВЕН', 'АКТИВНЫЙ', 'РАБОТАЕТ'].includes(s)) return true;
        if (['ARCHIVED', 'INACTIVE', 'НЕАКТИВЕН', 'НЕ АКТИВЕН', 'АРХИВ', 'СПИСАН'].includes(s)) return false;
        return isActive;
    })();

    logToDebugFile(`resolveIsActive input: status="${status}", isActive=${isActive} -> result=${resolved}`);
    return resolved;
}

/**
 * Validate fuelConsumptionRates structure
 */
function validateFuelConsumptionRates(rates: any): void {
    if (rates === null || rates === undefined) return;

    if (typeof rates !== 'object' || Array.isArray(rates)) {
        throw new BadRequestError('fuelConsumptionRates должен быть объектом');
    }

    const allowedKeys = ['winterRate', 'summerRate', 'cityIncreasePercent', 'warmingIncreasePercent'];

    for (const key of Object.keys(rates)) {
        if (!allowedKeys.includes(key)) {
            throw new BadRequestError(`Неизвестное поле в fuelConsumptionRates: ${key}`);
        }

        const value = rates[key];
        if (value !== null && value !== undefined) {
            if (typeof value !== 'number' || isNaN(value)) {
                throw new BadRequestError(`fuelConsumptionRates.${key} должен быть числом`);
            }
            if (value < 0) {
                throw new BadRequestError(`fuelConsumptionRates.${key} не может быть отрицательным`);
            }
        }
    }
}

// Helper to handle frontend misbehavior where UUID is sent in the text 'fuelType' field
function normalizeFuelTypeData(data: any) {
    let { fuelType, fuelTypeId } = data;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // If fuelType looks like a UUID and fuelTypeId is missing, swap them
    if (fuelType && typeof fuelType === 'string' && uuidRegex.test(fuelType) && !fuelTypeId) {
        logToDebugFile(`⚠️ normalization: Detected UUID in fuelType field (${fuelType}). Swapping.`);
        fuelTypeId = fuelType;
        fuelType = null;
    }

    // Standard cleanup
    if (fuelType === '' || fuelType === null) fuelType = null;

    return { fuelType, fuelTypeId };
}

export async function listVehicles(organizationId: string, departmentId?: string | null) {
    console.log(`📊 [vehicleService] Listing vehicles for org: ${organizationId}, dept: ${departmentId || 'ALL'}`);
    const where: any = { organizationId };

    if (departmentId) {
        where.departmentId = departmentId;
    }

    const vehicles = await prisma.vehicle.findMany({
        where,
        orderBy: { registrationNumber: 'asc' },
        include: {
            organization: true,
            department: true,
            fuelTypeRelation: true,
            fuelStockItem: true,  // REL-202
            assignedDriver: true, // REL-205: Include driver for Fuel Balances
        },
    });
    console.log(`📊 [vehicleService] Found ${vehicles.length} vehicles`);

    return vehicles.map((v: any) => ({
        ...v,
        // FIX: Используем PascalCase для соответствия frontend enum VehicleStatus
        status: v.isActive ? 'Active' : 'Archived'
    }));
}

export async function getVehicleById(organizationId: string, id: string) {
    const vehicle = await prisma.vehicle.findFirst({
        where: { id, organizationId },
        include: {
            organization: true,
            department: true,
            fuelTypeRelation: true,
            fuelStockItem: true,  // REL-202
            assignedDriver: true, // REL-205
        },
    });

    if (!vehicle) return null;

    return {
        ...vehicle,
        // FIX: Используем PascalCase для соответствия frontend enum VehicleStatus
        status: (vehicle as any).isActive ? 'Active' : 'Archived'
    } as any;
}

export async function createVehicle(organizationId: string, data: any) {
    logToDebugFile(`CREATE input: ${JSON.stringify(data, null, 2)}`);

    // Validate required fields
    if (!data.registrationNumber) {
        throw new BadRequestError('Номер регистрации обязателен');
    }

    console.log(`📊 [vehicleService] Creating vehicle for org: ${organizationId}. Data:`, JSON.stringify(data, null, 2));
    const actualOrgId = data.organizationId || organizationId;
    console.log(`📊 [vehicleService] Final organizationId for new vehicle: ${actualOrgId}`);

    const { fuelType, fuelTypeId } = normalizeFuelTypeData(data);

    try {
        // Create vehicle and corresponding stock location in a transaction
        const vehicle = await prisma.$transaction(async (tx) => {
            const v = await tx.vehicle.create({
                data: {
                    organizationId: actualOrgId,
                    departmentId: data.departmentId || null,
                    code: data.code || null,
                    registrationNumber: data.registrationNumber,
                    brand: data.brand || null,
                    model: data.model || null,
                    vin: data.vin || null,
                    fuelType,
                    fuelTypeId: fuelTypeId || null,
                    fuelStockItemId: data.fuelStockItemId || null,  // REL-202
                    fuelTankCapacity: data.fuelTankCapacity ? Number(data.fuelTankCapacity) : null,
                    mileage: data.mileage ? Number(data.mileage) : 0,
                    currentFuel: data.currentFuel ? Number(data.currentFuel) : 0,
                    fuelConsumptionRates: data.fuelConsumptionRates || null,

                    year: data.year ? Number(data.year) : null,
                    vehicleType: data.vehicleType || null,
                    assignedDriverId: data.assignedDriverId || null,

                    ptsType: data.ptsType || null,
                    ptsSeries: data.ptsSeries || null,
                    ptsNumber: data.ptsNumber || null,
                    eptsNumber: data.eptsNumber || null,

                    diagnosticCardNumber: data.diagnosticCardNumber || null,
                    diagnosticCardIssueDate: data.diagnosticCardIssueDate || null,
                    diagnosticCardExpiryDate: data.diagnosticCardExpiryDate || null,

                    maintenanceHistory: data.maintenanceHistory || null,

                    useCityModifier: !!data.useCityModifier,
                    useWarmingModifier: !!data.useWarmingModifier,

                    osagoSeries: data.osagoSeries || null,
                    osagoNumber: data.osagoNumber || null,
                    osagoStartDate: data.osagoStartDate || null,
                    osagoEndDate: data.osagoEndDate || null,

                    storageLocationId: data.storageLocationId || null,
                    notes: data.notes || null,
                    disableFuelCapacityCheck: !!data.disableFuelCapacityCheck,

                    isActive: resolveIsActive(data.status, data.isActive) ?? true,
                } as any,
            });

            // Create StockLocation for the vehicle tank
            await tx.stockLocation.create({
                data: {
                    organizationId: actualOrgId,
                    type: StockLocationType.VEHICLE_TANK,
                    name: `Бак: ${v.registrationNumber} (${v.brand || ''})`,
                    vehicleId: v.id,
                    isActive: true,
                },
            });

            return v;
        });

        return vehicle;
    } catch (error: any) {
        if (error.code === 'P2002') {
            throw new BadRequestError(`Транспортное средство с номером "${data.registrationNumber}" уже существует`);
        }
        throw error;
    }
}

export async function updateVehicle(organizationId: string, id: string, data: any) {
    logToDebugFile(`UPDATE input for ${id}: ${JSON.stringify(data, null, 2)}`);

    const vehicle = await prisma.vehicle.findFirst({
        where: { id, organizationId },
        include: { stockLocation: true }, // Include to check if it exists
    });

    if (!vehicle) {
        throw new NotFoundError('Транспортное средство не найдено');
    }

    // Validate fuelConsumptionRates if provided
    if (data.fuelConsumptionRates !== undefined) {
        validateFuelConsumptionRates(data.fuelConsumptionRates);
    }

    const { fuelType, fuelTypeId } = normalizeFuelTypeData(data);

    // Update vehicle and verify/update stock location
    const updatedVehicle = await prisma.$transaction(async (tx) => {
        const v = await tx.vehicle.update({
            where: { id },
            data: {
                code: data.code,
                registrationNumber: data.registrationNumber,
                brand: data.brand,
                model: data.model,
                vin: data.vin,
                fuelType,
                fuelTypeId,
                fuelStockItemId: data.fuelStockItemId,  // REL-202
                fuelTankCapacity: data.fuelTankCapacity !== undefined ? Number(data.fuelTankCapacity) : undefined,
                mileage: data.mileage !== undefined ? Number(data.mileage) : undefined,
                currentFuel: data.currentFuel !== undefined ? Number(data.currentFuel) : undefined,
                fuelConsumptionRates: data.fuelConsumptionRates !== undefined ? data.fuelConsumptionRates : undefined,

                year: data.year !== undefined ? Number(data.year) : undefined,
                vehicleType: data.vehicleType,
                assignedDriverId: data.assignedDriverId,

                ptsType: data.ptsType,
                ptsSeries: data.ptsSeries,
                ptsNumber: data.ptsNumber,
                eptsNumber: data.eptsNumber,

                diagnosticCardNumber: data.diagnosticCardNumber,
                diagnosticCardIssueDate: data.diagnosticCardIssueDate,
                diagnosticCardExpiryDate: data.diagnosticCardExpiryDate,

                maintenanceHistory: data.maintenanceHistory,

                useCityModifier: data.useCityModifier !== undefined ? !!data.useCityModifier : undefined,
                useWarmingModifier: data.useWarmingModifier !== undefined ? !!data.useWarmingModifier : undefined,

                osagoSeries: data.osagoSeries,
                osagoNumber: data.osagoNumber,
                osagoStartDate: data.osagoStartDate,
                osagoEndDate: data.osagoEndDate,

                storageLocationId: data.storageLocationId,
                notes: data.notes,
                disableFuelCapacityCheck: data.disableFuelCapacityCheck !== undefined ? !!data.disableFuelCapacityCheck : undefined,

                isActive: resolveIsActive(data.status, data.isActive),
                departmentId: data.departmentId,
                organizationId: data.organizationId || organizationId,
            } as any,
        });

        // Ensure stock location exists and name is up to date
        const stockLocationName = `Бак: ${v.registrationNumber} (${v.brand || ''})`;

        // Check if we need to update existing or create new
        const existingLocation = await tx.stockLocation.findUnique({
            where: { vehicleId: v.id }
        });

        if (existingLocation) {
            // Update name if changed
            if (existingLocation.name !== stockLocationName) {
                await tx.stockLocation.update({
                    where: { id: existingLocation.id },
                    data: { name: stockLocationName }
                });
            }
        } else {
            // Create if missing (backfill for update)
            await tx.stockLocation.create({
                data: {
                    organizationId: v.organizationId,
                    type: StockLocationType.VEHICLE_TANK,
                    name: stockLocationName,
                    vehicleId: v.id,
                    isActive: true,
                }
            });
        }

        return v;
    });

    return updatedVehicle;
}

export async function deleteVehicle(organizationId: string, id: string) {
    const vehicle = await prisma.vehicle.findFirst({
        where: { id, organizationId },
    });

    if (!vehicle) {
        throw new NotFoundError('Транспортное средство не найдено');
    }

    return prisma.vehicle.delete({
        where: { id },
    });
}
