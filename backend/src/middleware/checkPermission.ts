import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../utils/errors';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Cache for role permissions to avoid DB hits on every request
// In a real production app, use Redis or a more sophisticated cache with invalidation
let permissionCache: Record<string, string[]> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

async function getPermissionsForRole(roleCode: string): Promise<string[]> {
    const now = Date.now();

    // Refresh cache if needed
    if (!permissionCache || (now - cacheTimestamp > CACHE_TTL)) {
        console.log('🔄 Refreshing permission cache...');
        const roles = await prisma.role.findMany({
            include: {
                rolePermissions: {
                    include: {
                        permission: true
                    }
                }
            }
        });

        permissionCache = {};
        for (const role of roles) {
            permissionCache[role.code] = role.rolePermissions.map(rp => rp.permission.code);
        }
        cacheTimestamp = now;
    }

    return permissionCache[roleCode] || [];
}

export function checkPermission(requiredPermission: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.user) {
                return next(new ForbiddenError('Пользователь не авторизован'));
            }

            const userRole = req.user.role;

            // Admin has all permissions (optional, but good for safety)
            if (userRole?.toLowerCase() === 'admin') {
                return next();
            }

            const permissions = await getPermissionsForRole(userRole);

            if (!permissions.includes(requiredPermission)) {
                console.warn(`⛔ Access denied: User ${req.user.id} (${userRole}) tried to access ${req.originalUrl} requiring ${requiredPermission}`);
                return next(new ForbiddenError(`Нет прав: требуется ${requiredPermission}`));
            }

            next();
        } catch (err) {
            next(err);
        }
    };
}
