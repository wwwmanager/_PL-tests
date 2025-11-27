import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { UnauthorizedError } from '../utils/errors';

declare module 'express-serve-static-core' {
    interface Request {
        user?: {
            id: string;
            organizationId: string;
            role: string;
        };
    }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return next(new UnauthorizedError('Требуется авторизация'));
    }

    const token = header.substring('Bearer '.length);
    try {
        const payload = verifyAccessToken(token);
        req.user = {
            id: payload.sub,
            organizationId: payload.organizationId,
            role: payload.role
        };
        next();
    } catch {
        next(new UnauthorizedError('Неверный или истёкший токен'));
    }
}
