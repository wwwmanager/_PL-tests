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
        departmentId: user.departmentId,  // NEW: include department
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
                organizationId: user.organizationId,
                departmentId: user.departmentId  // NEW: return department info
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

/**
 * Ensure system admin user exists.
 * Called at server startup to auto-restore admin if deleted.
 */
export async function ensureAdminExists() {
    const ADMIN_EMAIL = 'admin@waybills.local';

    const existingAdmin = await prisma.user.findUnique({
        where: { email: ADMIN_EMAIL }
    });

    if (existingAdmin) {
        // Mark as system user if not already
        if (!existingAdmin.isSystem) {
            await prisma.user.update({
                where: { id: existingAdmin.id },
                data: { isSystem: true }
            });
            console.log('✅ Admin marked as system user');
        }
        return;
    }

    console.log('⚠️ System admin not found, creating...');

    // Get or create default organization
    let org = await prisma.organization.findFirst();
    if (!org) {
        org = await prisma.organization.create({
            data: {
                name: 'Default Organization',
                shortName: 'Default',
            }
        });
        console.log('📦 Created default organization');
    }

    // Get or create admin role
    let adminRole = await prisma.role.findFirst({ where: { code: 'admin' } });
    if (!adminRole) {
        adminRole = await prisma.role.create({
            data: { code: 'admin', name: 'Администратор' }
        });
        console.log('🎭 Created admin role');
    }

    // Create admin user with password '123'
    const passwordHash = await bcrypt.hash('123', 10);
    const newAdmin = await prisma.user.create({
        data: {
            email: ADMIN_EMAIL,
            passwordHash,
            fullName: 'Системный Администратор',
            organizationId: org.id,
            isActive: true,
            isSystem: true,
            roles: {
                create: { roleId: adminRole.id }
            }
        }
    });

    console.log('✅ System admin created:', newAdmin.email);
}
