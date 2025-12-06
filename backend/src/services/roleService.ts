import { PrismaClient } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../utils/errors';

const prisma = new PrismaClient();

export interface CreateRoleData {
    code: string;
    name: string;
    description?: string;
    permissionCodes?: string[];
}

export interface UpdateRoleData {
    name?: string;
    description?: string;
    permissionCodes?: string[];
}

export async function listRoles() {
    return prisma.role.findMany({
        orderBy: { name: 'asc' },
        include: {
            rolePermissions: {
                include: { permission: true }
            }
        }
    });
}

export async function getRole(id: string) {
    const role = await prisma.role.findUnique({
        where: { id },
        include: {
            rolePermissions: {
                include: { permission: true }
            }
        }
    });

    if (!role) throw new NotFoundError('Роль не найдена');
    return role;
}

export async function createRole(data: CreateRoleData) {
    // Check code uniqueness
    const existing = await prisma.role.findUnique({
        where: { code: data.code }
    });
    if (existing) throw new BadRequestError('Код роли уже существует');

    return prisma.$transaction(async (tx) => {
        const role = await tx.role.create({
            data: {
                code: data.code,
                name: data.name,
                description: data.description
            }
        });

        if (data.permissionCodes && data.permissionCodes.length > 0) {
            const permissions = await tx.permission.findMany({
                where: { code: { in: data.permissionCodes } }
            });

            if (permissions.length > 0) {
                await tx.rolePermission.createMany({
                    data: permissions.map(p => ({
                        roleId: role.id,
                        permissionId: p.id
                    }))
                });
            }
        }

        return role;
    });
}

export async function updateRole(id: string, data: UpdateRoleData) {
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundError('Роль не найдена');

    return prisma.$transaction(async (tx) => {
        const updated = await tx.role.update({
            where: { id },
            data: {
                name: data.name,
                description: data.description
            }
        });

        if (data.permissionCodes) {
            // Remove existing permissions
            await tx.rolePermission.deleteMany({ where: { roleId: id } });

            // Add new permissions
            const permissions = await tx.permission.findMany({
                where: { code: { in: data.permissionCodes } }
            });

            if (permissions.length > 0) {
                await tx.rolePermission.createMany({
                    data: permissions.map(p => ({
                        roleId: id,
                        permissionId: p.id
                    }))
                });
            }
        }

        return updated;
    });
}

export async function deleteRole(id: string) {
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundError('Роль не найдена');

    // Prevent deleting system roles if needed (e.g. admin, user)
    if (role.code === 'admin' || role.code === 'user') {
        throw new BadRequestError('Нельзя удалить системную роль');
    }

    await prisma.role.delete({ where: { id } });
    return { success: true };
}
