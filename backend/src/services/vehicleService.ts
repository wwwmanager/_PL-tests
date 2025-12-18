import { prisma } from '../db/prisma';
import { BadRequestError, NotFoundError } from '../utils/errors';

export async function listVehicles(organizationId: string, departmentId?: string | null) {
    console.log(`📊 [vehicleService] Listing vehicles for org: ${organizationId}, dept: ${departmentId || 'ALL'}`);
    const where: any = { organizationId };

    // Only filter by department if explicitly provided and not null
    if (departmentId) {
        where.departmentId = departmentId;
    }

    const vehicles = await prisma.vehicle.findMany({
        where,
        orderBy: { registrationNumber: 'asc' },
        include: {
            organization: true,
            department: true,
        },
    });
    console.log(`📊 [vehicleService] Found ${vehicles.length} vehicles`);

    // Map database isActive to frontend status enum
    return vehicles.map((v: any) => ({
        ...v,
        status: v.isActive ? 'ACTIVE' : 'ARCHIVED'
    }));
}

export async function getVehicleById(organizationId: string, id: string) {
    const vehicle = await prisma.vehicle.findFirst({
        where: { id, organizationId },
        include: {
            organization: true,
            department: true,
        },
    });

    if (!vehicle) return null;

    // Map database isActive to frontend status enum
    return {
        ...vehicle,
        status: (vehicle as any).isActive ? 'ACTIVE' : 'ARCHIVED'
    } as any;
}

/**
 * Validate fuelConsumptionRates structure
 * Expected: { winterRate?, summerRate?, cityIncreasePercent?, warmingIncreasePercent? }
 * All values must be non-negative numbers
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

export async function createVehicle(organizationId: string, data: any) {
    // Validate required fields
    if (!data.registrationNumber) {
        throw new BadRequestError('Номер регистрации обязателен');
    }

    console.log(`📊 [vehicleService] Creating vehicle for org: ${organizationId}. Data.orgId: ${data.organizationId}`);
    const actualOrgId = data.organizationId || organizationId;
    console.log(`📊 [vehicleService] Final organizationId for new vehicle: ${actualOrgId}`);

    try {
        const vehicle = await prisma.vehicle.create({
            data: {
                organizationId: actualOrgId,
                departmentId: data.departmentId || null,
                code: data.code || null,
                registrationNumber: data.registrationNumber,
                brand: data.brand || null,
                model: data.model || null,
                vin: data.vin || null,
                fuelType: data.fuelType || null,
                fuelTypeId: data.fuelTypeId || null,
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

                isActive: data.status === 'ACTIVE' ? true : (data.status === 'ARCHIVED' ? false : (data.isActive !== undefined ? data.isActive : true)),
            } as any,
        });
        console.log(`📊 [vehicleService] Created vehicle internal ID: ${vehicle.id}`);
        return vehicle;
    } catch (error: any) {
        if (error.code === 'P2002') {
            throw new BadRequestError(`Транспортное средство с номером "${data.registrationNumber}" уже существует`);
        }
        throw error;
    }
}

export async function updateVehicle(organizationId: string, id: string, data: any) {
    const vehicle = await prisma.vehicle.findFirst({
        where: { id, organizationId },
    });

    if (!vehicle) {
        throw new NotFoundError('Транспортное средство не найдено');
    }

    // Validate fuelConsumptionRates if provided
    if (data.fuelConsumptionRates !== undefined) {
        validateFuelConsumptionRates(data.fuelConsumptionRates);
    }

    return prisma.vehicle.update({
        where: { id },
        data: {
            code: data.code,
            registrationNumber: data.registrationNumber,
            brand: data.brand,
            model: data.model,
            vin: data.vin,
            fuelType: data.fuelType,
            fuelTypeId: data.fuelTypeId,
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

            isActive: data.status === 'ACTIVE' ? true : (data.status === 'ARCHIVED' ? false : data.isActive),
            departmentId: data.departmentId,
            organizationId: data.organizationId || organizationId,
        } as any,
    });
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
