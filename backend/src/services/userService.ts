import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { BadRequestError, NotFoundError } from '../utils/errors';

const prisma = new PrismaClient();

export interface CreateUserData {
    email: string;
    password?: string;
    fullName: string;
    roleCodes: string[];
    departmentId?: string | null;
    isActive: boolean;
    organizationId: string;
}

export interface UpdateUserData {
    email?: string;
    password?: string;
    fullName?: string;
    roleCodes?: string[];
    departmentId?: string | null;
    isActive?: boolean;
}

export async function listUsers(organizationId: string | undefined) {
    const where = organizationId ? { organizationId } : {};

    const users = await prisma.user.findMany({
        where,
        include: {
            organization: { select: { shortName: true } },
            department: { select: { name: true } },
            roles: {
                include: {
                    role: true
                }
            }
        },
        orderBy: { email: 'asc' }
    });

    return users.map((user: any) => ({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        isActive: user.isActive,
        organizationId: user.organizationId,
        organizationName: user.organization?.shortName || user.organization?.name || 'Unknown',
        departmentId: user.departmentId,
        departmentName: user.department?.name,
        // @ts-ignore: Prisma include types are sometimes tricky
        roles: user.roles?.map((ur: any) => ur.role.code) || [],
        lastLogin: undefined
    }));
}

export async function getUser(id: string, organizationId?: string) {
    const where = {
        id,
        ...(organizationId ? { organizationId } : {})
    };

    const user = await prisma.user.findFirst({
        where,
        include: {
            roles: { include: { role: true } }
        }
    });

    if (!user) {
        throw new NotFoundError('Пользователь не найден');
    }

    return {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        isActive: user.isActive,
        organizationId: user.organizationId,
        departmentId: user.departmentId,
        // @ts-ignore
        roleCodes: user.roles?.map((ur: any) => ur.role.code) || []
    };
}

export async function createUser(data: CreateUserData) {
    // Check email
    const existing = await prisma.user.findUnique({
        where: { email: data.email }
    });
    if (existing) {
        throw new BadRequestError('Email уже используется');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password || '123456', 10);

    // Transaction to create user and assign roles
    const user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
            data: {
                email: data.email,
                passwordHash,
                fullName: data.fullName,
                isActive: data.isActive,
                organizationId: data.organizationId,
                departmentId: data.departmentId
            }
        });

        // Assign roles
        if (data.roleCodes && data.roleCodes.length > 0) {
            const roles = await tx.role.findMany({
                where: { code: { in: data.roleCodes } }
            });

            if (roles.length !== data.roleCodes.length) {
                // Some roles not found, maybe ignore or throw?
                // Let's just link what we found
            }

            // Create UserRole entries
            await tx.userRole.createMany({
                data: roles.map(role => ({
                    userId: newUser.id,
                    roleId: role.id
                }))
            });
        }

        return newUser;
    });

    return user;
}

export async function updateUser(id: string, organizationId: string | undefined, data: UpdateUserData) {
    const where = {
        id,
        ...(organizationId ? { organizationId } : {})
    };

    const user = await prisma.user.findFirst({ where });
    if (!user) throw new NotFoundError('Пользователь не найден');

    let passwordHash = undefined;
    if (data.password) {
        passwordHash = await bcrypt.hash(data.password, 10);
    }

    // Update user
    const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.user.update({
            where: { id },
            data: {
                email: data.email,
                passwordHash,
                fullName: data.fullName,
                isActive: data.isActive,
                departmentId: data.departmentId
            }
        });

        // Update roles if provided
        if (data.roleCodes) {
            // Remove existing roles
            await tx.userRole.deleteMany({ where: { userId: id } });

            // Find new roles
            const roles = await tx.role.findMany({
                where: { code: { in: data.roleCodes } }
            });

            // Add new roles
            if (roles.length > 0) {
                await tx.userRole.createMany({
                    data: roles.map(role => ({
                        userId: id,
                        roleId: role.id
                    }))
                });
            }
        }

        return updated;
    });

    return result;
}

export async function deleteUser(id: string, organizationId: string | undefined) {
    const where = {
        id,
        ...(organizationId ? { organizationId } : {})
    };

    const user = await prisma.user.findFirst({ where });
    if (!user) throw new NotFoundError('Пользователь не найден');

    await prisma.user.delete({ where: { id } });
    return { success: true };
}
