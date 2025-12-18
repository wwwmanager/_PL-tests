/**
 * WB-601: Status-specific permission middleware for waybill status changes
 * 
 * Maps status transitions to required permissions:
 * - DRAFT → SUBMITTED: waybill.submit
 * - SUBMITTED → POSTED: waybill.post
 * - * → CANCELLED: waybill.cancel
 */

import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, BadRequestError } from '../utils/errors';
import { PrismaClient, WaybillStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Map of target status to required permission
const STATUS_PERMISSION_MAP: Record<WaybillStatus, string> = {
    [WaybillStatus.SUBMITTED]: 'waybill.submit',
    [WaybillStatus.POSTED]: 'waybill.post',
    [WaybillStatus.CANCELLED]: 'waybill.cancel',
    [WaybillStatus.DRAFT]: 'waybill.update', // Unlikely, but fallback
};

// Cache for role permissions
let permissionCache: Record<string, string[]> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

async function getPermissionsForRole(roleCode: string): Promise<string[]> {
    const now = Date.now();

    if (!permissionCache || (now - cacheTimestamp > CACHE_TTL)) {
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

/**
 * Middleware that checks permission based on the target status in request body
 */
export function checkWaybillStatusPermission() {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.user) {
                return next(new ForbiddenError('Пользователь не авторизован'));
            }

            const { status } = req.body;

            if (!status) {
                return next(new BadRequestError('Статус не указан'));
            }

            // Validate status is a valid WaybillStatus
            if (!Object.values(WaybillStatus).includes(status)) {
                return next(new BadRequestError(`Недопустимый статус: ${status}`));
            }

            const userRole = req.user.role;

            // Admin has all permissions
            if (userRole === 'admin') {
                console.log(`[WB-601] Admin bypass for status change to ${status}`);
                return next();
            }

            const requiredPermission = STATUS_PERMISSION_MAP[status as WaybillStatus];

            if (!requiredPermission) {
                return next(new BadRequestError(`Нет правила для статуса ${status}`));
            }

            const permissions = await getPermissionsForRole(userRole);

            if (!permissions.includes(requiredPermission)) {
                console.warn(
                    `[WB-601] Access denied: User ${req.user.id} (${userRole}) cannot change status to ${status}. ` +
                    `Requires: ${requiredPermission}, Has: ${permissions.join(', ')}`
                );
                return next(new ForbiddenError(`Нет прав для перехода в статус ${status} (требуется ${requiredPermission})`));
            }

            console.log(`[WB-601] Permission granted: ${userRole} → ${status} (${requiredPermission})`);
            next();
        } catch (err) {
            next(err);
        }
    };
}
