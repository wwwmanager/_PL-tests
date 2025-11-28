// driverService - TypeORM version
import { AppDataSource } from '../db/data-source';
import { Driver } from '../entities/Driver';
import { Employee } from '../entities/Employee';
import { NotFoundError } from '../utils/errors';

const driverRepo = () => AppDataSource.getRepository(Driver);
const employeeRepo = () => AppDataSource.getRepository(Employee);

export async function listDrivers(organizationId: string) {
    return driverRepo()
        .createQueryBuilder('driver')
        .leftJoinAndSelect('driver.employee', 'employee')
        .where('employee.organizationId = :organizationId', { organizationId })
        .orderBy('employee.fullName', 'ASC')
        .getMany();
}

export async function getDriverById(organizationId: string, id: string) {
    return driverRepo().findOne({
        where: { id },
        relations: { employee: { organization: true, department: true } }
    });
}

export async function createDriver(organizationId: string, data: any) {
    // First create employee if needed or get existing
    const employee = await employeeRepo().findOne({
        where: { id: data.employeeId, organizationId }
    });

    if (!employee) {
        throw new NotFoundError('Сотрудник не найден');
    }

    const driver = driverRepo().create({
        employeeId: data.employeeId,
        licenseNumber: data.licenseNumber,
        licenseCategory: data.licenseCategory || null,
        licenseValidTo: data.licenseValidTo || null
    });

    return driverRepo().save(driver);
}

export async function updateDriver(organizationId: string, id: string, data: any) {
    const driver = await driverRepo().findOne({
        where: { id },
        relations: { employee: true }
    });

    if (!driver || driver.employee.organizationId !== organizationId) {
        throw new NotFoundError('Водитель не найден');
    }

    Object.assign(driver, data);
    return driverRepo().save(driver);
}

export async function deleteDriver(organizationId: string, id: string) {
    const driver = await driverRepo().findOne({
        where: { id },
        relations: { employee: true }
    });

    if (!driver || driver.employee.organizationId !== organizationId) {
        throw new NotFoundError('Водитель не найден');
    }

    return driverRepo().remove(driver);
}
