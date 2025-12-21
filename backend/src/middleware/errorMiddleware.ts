import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { Prisma } from '@prisma/client';

/**
 * Sanitize payload for logging - removes sensitive fields
 */
function sanitizePayload(body: any): any {
    if (!body || typeof body !== 'object') return body;

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'accessToken', 'refreshToken'];

    for (const field of sensitiveFields) {
        if (sanitized[field]) {
            sanitized[field] = '[REDACTED]';
        }
    }

    return sanitized;
}

/**
 * BE-004: Map Prisma error codes to HTTP status codes
 * Extended mapping for common database errors
 */
function getPrismaErrorResponse(err: Prisma.PrismaClientKnownRequestError): { statusCode: number; message: string; code: string } | null {
    switch (err.code) {
        // ===== 404 Not Found =====
        case 'P2025': // Record not found
            return {
                statusCode: 404,
                message: 'Запись не найдена',
                code: 'NOT_FOUND',
            };

        // ===== 409 Conflict =====
        case 'P2002': // Unique constraint violation
            const target = (err.meta?.target as string[])?.join(', ') || 'field';
            return {
                statusCode: 409,
                message: `Конфликт: такая запись уже существует (${target})`,
                code: 'UNIQUE_VIOLATION',
            };
        case 'P2034': // Transaction conflict / deadlock
            return {
                statusCode: 409,
                message: 'Конфликт транзакции. Повторите операцию',
                code: 'TRANSACTION_CONFLICT',
            };

        // ===== 400 Bad Request =====
        case 'P2003': // Foreign key constraint violation
            return {
                statusCode: 400,
                message: 'Связанная запись не существует',
                code: 'FOREIGN_KEY_VIOLATION',
            };
        case 'P2014': // Required relation violation
            return {
                statusCode: 400,
                message: 'Нарушение связи между записями',
                code: 'RELATION_VIOLATION',
            };
        case 'P2016': // Query interpretation error / required relation not found
            return {
                statusCode: 400,
                message: 'Связанная запись не найдена (required relation)',
                code: 'REQUIRED_RELATION_NOT_FOUND',
            };
        case 'P2000': // Value too long for column
            const column = err.meta?.column_name || 'поле';
            return {
                statusCode: 400,
                message: `Значение слишком длинное для поля: ${column}`,
                code: 'VALUE_TOO_LONG',
            };
        case 'P2011': // Null constraint violation
            const constraint = err.meta?.constraint || 'поле';
            return {
                statusCode: 400,
                message: `Обязательное поле не может быть пустым: ${constraint}`,
                code: 'NULL_CONSTRAINT_VIOLATION',
            };

        // ===== P2021/P2022 intentionally fall through to 500 =====
        // These are schema mismatches (table/column doesn't exist)
        // and should be treated as infrastructure errors

        default:
            return null; // Let it fall through to 500
    }
}

/**
 * REL-102 + BE-001 + BE-004: Error middleware with Prisma error mapping
 * - AppError: returns custom statusCode
 * - Prisma P2025: returns 404
 * - Prisma P2002: returns 409
 * - Other: returns 500 with diagnostic logging
 */
export function errorMiddleware(err: any, req: Request, res: Response, next: NextFunction) {
    // Extract context from request
    const requestId = (req as any).requestId ?? req.headers['x-request-id'] ?? null;
    const userId = (req as any).user?.id ?? null;
    const organizationId = (req as any).user?.organizationId ?? null;
    const path = req.originalUrl || req.path;
    const method = req.method;

    // Sanitize payload for logging
    const payload = sanitizePayload(req.body);

    // Handle AppError (custom domain errors)
    if (err instanceof AppError) {
        logger.warn({
            requestId,
            userId,
            organizationId,
            method,
            path,
            payload,
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

    // BE-004: Handle Prisma errors
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        const prismaResponse = getPrismaErrorResponse(err);
        if (prismaResponse) {
            logger.warn({
                requestId,
                userId,
                organizationId,
                method,
                path,
                payload,
                prismaCode: err.code,
                prismaMeta: err.meta,
                statusCode: prismaResponse.statusCode,
                message: prismaResponse.message,
            }, `Prisma ${err.code}: ${prismaResponse.message}`);

            return res.status(prismaResponse.statusCode).json({
                error: prismaResponse.message,
                code: prismaResponse.code,
                requestId,
            });
        }
    }

    // Unhandled errors (500) - log full context including payload and stack
    logger.error({
        requestId,
        userId,
        organizationId,
        method,
        path,
        payload,
        errorName: err?.name,
        errorMessage: err?.message,
        stack: err?.stack,
    }, `❌ 500 Internal Error: ${err?.message || 'Unknown error'}`);

    // Also console.error for immediate visibility in terminal
    console.error(`❌ [500 ERROR] requestId=${requestId} path=${method} ${path}`);
    console.error(`   userId=${userId} orgId=${organizationId}`);
    console.error(`   payload=${JSON.stringify(payload)}`);
    console.error(`   error=${err?.message}`);
    console.error(`   stack=${err?.stack}`);

    res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        requestId,
    });
}


