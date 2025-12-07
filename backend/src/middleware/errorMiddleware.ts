import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export function errorMiddleware(err: any, req: Request, res: Response, next: NextFunction) {
    if (err instanceof AppError) {
        logger.warn({ err, correlationId: req.headers['x-correlation-id'] }, `AppError: ${err.message}`);
        return res.status(err.statusCode).json({ error: err.message, code: err.code });
    }

    logger.error({ err, correlationId: req.headers['x-correlation-id'] }, 'Unhandled error');
    res.status(500).json({ error: 'Internal server error' });
}
