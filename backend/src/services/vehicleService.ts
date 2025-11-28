// vehicleService - TypeORM version
import { AppDataSource } from '../db/data-source';
import { Vehicle } from '../entities/Vehicle';
import { NotFoundError } from '../utils/errors';

const vehicleRepo = () => AppDataSource.getRepository(Vehicle);

export async function listVehicles(organizationId: string) {
    return vehicleRepo().find({
        where: { organizationId },
        relations: { organization: true, department: true },
        order: { registrationNumber: 'ASC' }
    });
}

export async function getVehicleById(organizationId: string, id: string) {
    return vehicleRepo().findOne({
        where: { id, organizationId },
        relations: { organization: true, department: true }
    });
}

export async function createVehicle(organizationId: string, data: any) {
    const vehicle = vehicleRepo().create({
        ...data,
        organizationId
    });
    return vehicleRepo().save(vehicle);
}

export async function updateVehicle(organizationId: string, id: string, data: any) {
    const vehicle = await vehicleRepo().findOne({
        where: { id, organizationId }
    });

    if (!vehicle) {
        throw new NotFoundError('Транспортное средство не найдено');
    }

    Object.assign(vehicle, data);
    return vehicleRepo().save(vehicle);
}

export async function deleteVehicle(organizationId: string, id: string) {
    const vehicle = await vehicleRepo().findOne({
        where: { id, organizationId }
    });

    if (!vehicle) {
        throw new NotFoundError('Транспортное средство не найдено');
    }

    return vehicleRepo().remove(vehicle);
}
