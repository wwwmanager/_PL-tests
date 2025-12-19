import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { UnauthorizedError } from '../utils/errors';
import { prisma } from '../db/prisma';

declare module 'express-serve-static-core' {
    interface Request {
        user?: {
            id: string;
            organizationId: string;
            departmentId: string | null;
            role: string;
            employeeId: string | null;
            tokenVersion?: number;
        };
    }
}

/**
 * AUTH-003: Auth middleware with database-backed tokenVersion check.
 * Ensures immediate invalidation of access tokens when user properties change.
 */
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
        console.log('[authMiddleware] No valid Bearer token');
        return next(new UnauthorizedError('Требуется авторизация'));
    }

    const token = header.substring('Bearer '.length);

    try {
        const payload = verifyAccessToken(token);

        // ✅ AUTH-003: Check tokenVersion against database
        const tokenVersionFromJwt = Number(payload.tokenVersion ?? 0);

        const userRow = await prisma.user.findUnique({
            where: { id: payload.sub },
            select: {
                id: true,
                isActive: true,
                tokenVersion: true,
                organizationId: true,
                departmentId: true,
            },
        });

        if (!userRow || !userRow.isActive) {
            console.log('[authMiddleware] User not found or inactive:', payload.sub);
            return next(new UnauthorizedError('Неверный или истёкший токен'));
        }

        if (Number(userRow.tokenVersion ?? 0) !== tokenVersionFromJwt) {
            console.warn('[authMiddleware] SESSION_INVALIDATED for user:', payload.sub,
                'DB version:', userRow.tokenVersion, 'JWT version:', tokenVersionFromJwt);
            return next(new UnauthorizedError('Сессия недействительна (SESSION_INVALIDATED)'));
        }

        req.user = {
            id: payload.sub,
            organizationId: payload.organizationId,
            departmentId: payload.departmentId,
            role: payload.role,
            employeeId: payload.employeeId,
            tokenVersion: userRow.tokenVersion
        };

        next();
    } catch (err: any) {
        console.error('[authMiddleware] Token verification error:', err.name, err.message);
        next(new UnauthorizedError('Неверный или истёкший токен'));
    }
};
