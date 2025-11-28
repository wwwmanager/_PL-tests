// TypeORM version of waybillService
import { AppDataSource } from '../db/data-source';
import { Waybill } from '../entities/Waybill';
import { Vehicle } from '../entities/Vehicle';
import { Driver } from '../entities/Driver';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { WaybillStatus } from '../entities/enums';

const waybillRepo = () => AppDataSource.getRepository(Waybill);
const vehicleRepo = () => AppDataSource.getRepository(Vehicle);
const driverRepo = () => AppDataSource.getRepository(Driver);

interface CreateWaybillInput {
    number: string;
    date: string;
    vehicleId: string;
    driverId: string;
    odometerStart?: number;
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
        .leftJoinAndSelect('driver.employee', 'employee')
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
            driver: { employee: true }
        }
    });
}

export async function createWaybill(organizationId: string, input: CreateWaybillInput) {
    const date = new Date(input.date);
    if (Number.isNaN(date.getTime())) {
        throw new BadRequestError('Некорректная дата');
    }

    // Проверяем, что vehicle и driver принадлежат этой организации
    const vehicle = await vehicleRepo().findOne({
        where: { id: input.vehicleId, organizationId }
    });
    if (!vehicle) {
        throw new BadRequestError('Транспортное средство не найдено');
    }

    const driver = await driverRepo().findOne({
        where: { id: input.driverId },
        relations: { employee: true }
    });
    if (!driver || driver.employee.organizationId !== organizationId) {
        throw new BadRequestError('Водитель не найден');
    }

    const waybill = waybillRepo().create({
        organizationId,
        number: input.number,
        date: input.date,
        vehicleId: input.vehicleId,
        driverId: input.driverId,
        odometerStart: input.odometerStart?.toString(),
        plannedRoute: input.plannedRoute || null,
        notes: input.notes || null,
        status: WaybillStatus.DRAFT,
    });

    const saved = await waybillRepo().save(waybill);

    return waybillRepo().findOne({
        where: { id: saved.id },
        relations: {
            vehicle: true,
            driver: { employee: true }
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
    if (input.odometerStart !== undefined) existing.odometerStart = input.odometerStart.toString();
    if (input.odometerEnd !== undefined) existing.odometerEnd = input.odometerEnd.toString();
    if (input.plannedRoute !== undefined) existing.plannedRoute = input.plannedRoute;
    if (input.notes !== undefined) existing.notes = input.notes;

    await waybillRepo().save(existing);

    return waybillRepo().findOne({
        where: { id },
        relations: {
            vehicle: true,
            driver: { employee: true }
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
            driver: { employee: true }
        }
    });
}
