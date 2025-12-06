import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { UnauthorizedError } from '../utils/errors';

declare module 'express-serve-static-core' {
    interface Request {
        user?: {
            id: string;
            organizationId: string;
            departmentId: string | null;  // NEW: department-level isolation
            role: string;
        };
    }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    console.log('[authMiddleware] Authorization header:', header ? `Bearer ${header.substring(0, 20)}...` : 'MISSING');

    if (!header || !header.startsWith('Bearer ')) {
        console.log('[authMiddleware] No valid Bearer token');
        return next(new UnauthorizedError('Требуется авторизация'));
    }

    const token = header.substring('Bearer '.length);
    console.log('[authMiddleware] Token length:', token.length);

    try {
        const payload = verifyAccessToken(token);
        console.log('[authMiddleware] Decoded payload:', JSON.stringify(payload, null, 2));

        req.user = {
            id: payload.sub,
            organizationId: payload.organizationId,
            departmentId: payload.departmentId,  // NEW: extract from JWT
            role: payload.role,
        };
        console.log('[authMiddleware] req.user set:', req.user);
        next();
    } catch (err: any) {
        console.error('[authMiddleware] Token verification error:', err.name, err.message);
        next(new UnauthorizedError('Неверный или истёкший токен'));
    }
};
