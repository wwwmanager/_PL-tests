// Department Service - CRUD operations for departments
import { AppDataSource } from '../db/data-source';
import { Department } from '../entities/Department';
import { BadRequestError } from '../utils/errors';

const departmentRepo = () => AppDataSource.getRepository(Department);

export interface DepartmentFilters {
    organizationId?: string;
    page?: number;
    limit?: number;
}

export async function getDepartments(filters: DepartmentFilters = {}) {
    const {
        organizationId,
        page = 1,
        limit = 100,
    } = filters;

    const query = departmentRepo()
        .createQueryBuilder('department')
        .leftJoinAndSelect('department.organization', 'organization')
        .orderBy('department.name', 'ASC');

    if (organizationId) {
        query.andWhere('department.organizationId = :organizationId', { organizationId });
    }

    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);

    const [departments, total] = await query.getManyAndCount();

    return {
        departments,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
}

export async function getDepartmentById(id: string): Promise<Department | null> {
    return await departmentRepo().findOne({
        where: { id },
        relations: {
            organization: true,
        },
    });
}

export async function createDepartment(data: {
    organizationId: string;
    code?: string;
    name: string;
    address?: string;
}): Promise<Department> {
    const department = departmentRepo().create({
        organizationId: data.organizationId,
        code: data.code || null,
        name: data.name,
        address: data.address || null,
    });

    return await departmentRepo().save(department);
}

export async function updateDepartment(
    id: string,
    data: Partial<{
        code: string;
        name: string;
        address: string;
    }>
): Promise<Department> {
    const department = await getDepartmentById(id);

    if (!department) {
        throw new BadRequestError('Department not found');
    }

    Object.assign(department, data);

    return await departmentRepo().save(department);
}

export async function deleteDepartment(id: string): Promise<void> {
    const department = await getDepartmentById(id);

    if (!department) {
        throw new BadRequestError('Department not found');
    }

    // Check for dependencies (employees, vehicles, waybills)
    // For now, allow deletion - FK constraints will handle it
    // TODO: Add dependency check if needed

    await departmentRepo().remove(department);
}
