import pinoHttp from 'pino-http';
import { logger } from '../utils/logger';
import { v4 as uuid } from 'uuid';
import { Request, Response, NextFunction } from 'express';

// Request logging middleware with correlation-id
export const loggerMiddleware = pinoHttp({
    logger,
    genReqId: (req) => (req.headers['x-correlation-id'] as string) || uuid(),
    customProps: (req) => ({ correlationId: req.id }),
    customLogLevel: (req, res, err) => {
        if (res.statusCode >= 500 || err) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
    },
    customSuccessMessage: (req, res) =>
        `${req.method} ${req.url} ${res.statusCode}`,
    customErrorMessage: (req, res, err) =>
        `${req.method} ${req.url} ${res.statusCode} - ${err.message}`,
    serializers: {
        req: (req) => ({
            method: req.method,
            url: req.url,
            headers: {
                'user-agent': req.headers['user-agent'],
                'content-type': req.headers['content-type'],
            },
        }),
        res: (res) => ({
            statusCode: res.statusCode,
        }),
    },
});

// Middleware to set correlation-id in response header
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
    const correlationId = (req.headers['x-correlation-id'] as string) || uuid();
    req.headers['x-correlation-id'] = correlationId;
    res.setHeader('x-correlation-id', correlationId);
    next();
}
