// authService - Prisma version
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { BadRequestError } from '../utils/errors';
import { signAccessToken } from '../utils/jwt';

const prisma = new PrismaClient();

export async function login(email: string, password: string) {
    const user = await prisma.user.findUnique({
        where: { email },
        include: {
            organization: true,
            department: true,
            roles: {
                include: {
                    role: true
                }
            }
        }
    });

    if (!user) {
        throw new BadRequestError('Неверный email или пароль');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
        throw new BadRequestError('Неверный email или пароль');
    }

    if (!user.isActive) {
        throw new BadRequestError('Пользователь неактивен');
    }

    // Get role (use first role or fallback to 'user')
    const primaryRole = user.roles[0]?.role.code || 'user';

    // Generate JWT token
    const token = signAccessToken({
        id: user.id,
        organizationId: user.organizationId,
        role: primaryRole
    });

    // Return formatted response for frontend
    return {
        success: true,
        data: {
            token,
            user: {
                id: user.id,
                email: user.email,
                role: primaryRole,
                displayName: user.fullName,
                organizationId: user.organizationId
            }
        }
    };
}

export async function findUserById(id: string) {
    return prisma.user.findUnique({
        where: { id },
        include: {
            organization: true,
            department: true,
            roles: {
                include: {
                    role: true
                }
            }
        }
    });
}
