// TypeORM version of waybillService
import { AppDataSource } from '../db/data-source';
import { Waybill } from '../entities/Waybill';
import { Vehicle } from '../entities/Vehicle';
import { Employee } from '../entities/Employee';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { WaybillStatus } from '../entities/enums';

const waybillRepo = () => AppDataSource.getRepository(Waybill);
const vehicleRepo = () => AppDataSource.getRepository(Vehicle);
const employeeRepo = () => AppDataSource.getRepository(Employee);

interface CreateWaybillInput {
    number: string;
    date: string;
    vehicleId: string;
    driverId: string;
    blankId?: string | null;
    odometerStart?: number;
    odometerEnd?: number;
    plannedRoute?: string;
    notes?: string;
}

export async function listWaybills(organizationId: string, filters?: {
    startDate?: string;
    endDate?: string;
    vehicleId?: string;
    driverId?: string;
    status?: WaybillStatus;
}) {
    const qb = waybillRepo().createQueryBuilder('waybill')
        .leftJoinAndSelect('waybill.vehicle', 'vehicle')
        .leftJoinAndSelect('waybill.driver', 'driver')
        .where('waybill.organizationId = :organizationId', { organizationId });

    if (filters) {
        if (filters.startDate) {
            qb.andWhere('waybill.date >= :startDate', { startDate: filters.startDate });
        }
        if (filters.endDate) {
            qb.andWhere('waybill.date <= :endDate', { endDate: filters.endDate });
        }
        if (filters.vehicleId) {
            qb.andWhere('waybill.vehicleId = :vehicleId', { vehicleId: filters.vehicleId });
        }
        if (filters.driverId) {
            qb.andWhere('waybill.driverId = :driverId', { driverId: filters.driverId });
        }
        if (filters.status) {
            qb.andWhere('waybill.status = :status', { status: filters.status });
        }
    }

    qb.orderBy('waybill.date', 'DESC');

    return qb.getMany();
}

export async function getWaybillById(organizationId: string, id: string) {
    return waybillRepo().findOne({
        where: { id, organizationId },
        relations: {
            vehicle: true,
            driver: true
        }
    });
}

export async function createWaybill(organizationId: string, input: CreateWaybillInput) {
    // 🔍 DEBUG: Log input
    console.log('📝 createWaybill service called');
    console.log('  Input:', {
        organizationId,
        number: input.number,
        date: input.date,
        vehicleId: input.vehicleId,
        driverId: input.driverId,
        blankId: input.blankId ?? null,
        odometerStart: input.odometerStart,
        odometerEnd: input.odometerEnd
    });

    const date = new Date(input.date);
    if (Number.isNaN(date.getTime())) {
        console.error('❌ Invalid date format:', input.date);
        throw new BadRequestError('Некорректная дата');
    }

    // Проверяем, что vehicle и driver принадлежат этой организации
    console.log('🔍 Looking up vehicle:', input.vehicleId);
    const vehicle = await vehicleRepo().findOne({
        where: { id: input.vehicleId, organizationId }
    });
    if (!vehicle) {
        console.error('❌ Vehicle not found:', input.vehicleId);
        throw new BadRequestError('Транспортное средство не найдено');
    }
    console.log('  ✓ Vehicle found:', {
        id: vehicle.id,
        registrationNumber: vehicle.plateNumber,
        brand: vehicle.brand,
        model: vehicle.model
    });

    console.log('🔍 Looking up driver:', input.driverId);
    const driver = await employeeRepo().findOne({
        where: {
            id: input.driverId,
            organizationId,
            employeeType: 'driver'
        }
    });

    if (!driver) {
        console.error('❌ Driver not found or wrong organization:', input.driverId);
        throw new BadRequestError('Водитель не найден');
    }
    console.log('  ✓ Driver found:', {
        id: driver.id,
        employeeName: driver.fullName,
        licenseCategory: driver.licenseCategory
    });

    console.log('💾 Creating waybill entity...');
    const waybill = waybillRepo().create({
        organizationId,
        number: input.number,
        date: input.date,
        vehicleId: input.vehicleId,
        driverId: input.driverId,
        blankId: input.blankId || null,
        odometerStart: input.odometerStart,
        odometerEnd: input.odometerEnd,
        plannedRoute: input.plannedRoute || null,
        notes: input.notes || null,
        status: WaybillStatus.DRAFT,
    });

    console.log('  Entity prepared:', {
        organizationId: waybill.organizationId,
        number: waybill.number,
        date: waybill.date,
        vehicleId: waybill.vehicleId,
        driverId: waybill.driverId,
        blankId: waybill.blankId,
        status: waybill.status
    });

    console.log('💾 Saving to database...');
    const saved = await waybillRepo().save(waybill);
    console.log('  ✅ Saved with ID:', saved.id);

    return waybillRepo().findOne({
        where: { id: saved.id },
        relations: {
            vehicle: true,
            driver: true
        }
    });
}

interface UpdateWaybillInput {
    number?: string;
    date?: string;
    vehicleId?: string;
    driverId?: string;
    status?: WaybillStatus;
    odometerStart?: number;
    odometerEnd?: number;
    plannedRoute?: string;
    notes?: string;
}

export async function updateWaybill(organizationId: string, id: string, input: UpdateWaybillInput) {
    const existing = await waybillRepo().findOne({
        where: { id, organizationId }
    });

    if (!existing) {
        throw new NotFoundError('Путевой лист не найден');
    }

    if (input.number !== undefined) existing.number = input.number;
    if (input.date) existing.date = input.date;
    if (input.vehicleId !== undefined) existing.vehicleId = input.vehicleId;
    if (input.driverId !== undefined) existing.driverId = input.driverId;
    if (input.status !== undefined) existing.status = input.status;
    if (input.odometerStart !== undefined) existing.odometerStart = input.odometerStart;
    if (input.odometerEnd !== undefined) existing.odometerEnd = input.odometerEnd;
    if (input.plannedRoute !== undefined) existing.plannedRoute = input.plannedRoute;
    if (input.notes !== undefined) existing.notes = input.notes;

    await waybillRepo().save(existing);

    return waybillRepo().findOne({
        where: { id },
        relations: {
            vehicle: true,
            driver: true
        }
    });
}

export async function deleteWaybill(organizationId: string, id: string) {
    const waybill = await waybillRepo().findOne({
        where: { id, organizationId }
    });

    if (!waybill) {
        throw new NotFoundError('Путевой лист не найден');
    }

    return waybillRepo().remove(waybill);
}

// Метод для изменения статуса
export async function changeWaybillStatus(organizationId: string, id: string, status: WaybillStatus) {
    const waybill = await waybillRepo().findOne({
        where: { id, organizationId }
    });

    if (!waybill) {
        throw new NotFoundError('Путевой лист не найден');
    }

    // Здесь можно добавить валидацию переходов статусов (state machine)
    // например, из DRAFT можно перейти только в SUBMITTED и т.д.

    waybill.status = status;
    await waybillRepo().save(waybill);

    return waybillRepo().findOne({
        where: { id },
        relations: {
            vehicle: true,
            driver: true
        }
    });
}
