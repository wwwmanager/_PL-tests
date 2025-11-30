// Employee Service - CRUD operations for employees
import { AppDataSource } from '../db/data-source';
import { Employee } from '../entities/Employee';
import { BadRequestError } from '../utils/errors';

const employeeRepo = () => AppDataSource.getRepository(Employee);

export interface EmployeeFilters {
    organizationId?: string;
    departmentId?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
}

export async function getEmployees(filters: EmployeeFilters = {}) {
    const {
        organizationId,
        departmentId,
        isActive,
        page = 1,
        limit = 100,
    } = filters;

    const query = employeeRepo()
        .createQueryBuilder('employee')
        .leftJoinAndSelect('employee.organization', 'organization')
        .leftJoinAndSelect('employee.department', 'department')
        .orderBy('employee.fullName', 'ASC');

    if (organizationId) {
        query.andWhere('employee.organizationId = :organizationId', { organizationId });
    }

    if (departmentId) {
        query.andWhere('employee.departmentId = :departmentId', { departmentId });
    }

    if (isActive !== undefined) {
        query.andWhere('employee.isActive = :isActive', { isActive });
    }

    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);

    const [employees, total] = await query.getManyAndCount();

    return {
        employees,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
}

export async function getEmployeeById(id: string): Promise<Employee | null> {
    return employeeRepo().findOne({
        where: { id },
        relations: {
            organization: true,
            department: true,
        },
    });
}

export async function createEmployee(data: {
    organizationId: string;
    departmentId?: string;
    fullName: string;
    position: string;
    isActive?: boolean;
}): Promise<Employee> {
    const employee = employeeRepo().create({
        organizationId: data.organizationId,
        departmentId: data.departmentId || null,
        fullName: data.fullName,
        position: data.position,
        isActive: data.isActive !== undefined ? data.isActive : true,
    });

    return employeeRepo().save(employee);
}

export async function updateEmployee(
    id: string,
    data: Partial<{
        departmentId: string;
        fullName: string;
        position: string;
        isActive: boolean;
    }>
): Promise<Employee> {
    const employee = await getEmployeeById(id);

    if (!employee) {
        throw new BadRequestError('Employee not found');
    }

    Object.assign(employee, data);

    return employeeRepo().save(employee);
}

export async function deleteEmployee(id: string): Promise<void> {
    const employee = await getEmployeeById(id);

    if (!employee) {
        throw new BadRequestError('Employee not found');
    }

    // Soft delete - set isActive to false
    employee.isActive = false;
    await employeeRepo().save(employee);
}
