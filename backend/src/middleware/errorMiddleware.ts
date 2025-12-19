import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * REL-102: Error middleware with requestId + context logging
 * Logs: requestId, userId, organizationId, path, code, message
 * Returns: requestId in error response for frontend diagnostics
 */
export function errorMiddleware(err: any, req: Request, res: Response, next: NextFunction) {
    // Extract context from request
    const requestId = (req as any).requestId ?? req.headers['x-request-id'] ?? null;
    const userId = (req as any).user?.id ?? null;
    const organizationId = (req as any).user?.organizationId ?? null;
    const path = req.originalUrl || req.path;
    const method = req.method;

    if (err instanceof AppError) {
        logger.warn({
            requestId,
            userId,
            organizationId,
            method,
            path,
            code: err.code,
            statusCode: err.statusCode,
            message: err.message,
        }, `AppError: ${err.message}`);

        return res.status(err.statusCode).json({
            error: err.message,
            code: err.code,
            requestId,
        });
    }

    // Unhandled errors - log full context
    logger.error({
        requestId,
        userId,
        organizationId,
        method,
        path,
        errorName: err?.name,
        errorMessage: err?.message,
        stack: err?.stack,
    }, 'Unhandled error');

    res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        requestId,
    });
}
