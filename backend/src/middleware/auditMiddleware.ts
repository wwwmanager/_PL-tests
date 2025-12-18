import { Request, Response, NextFunction } from 'express';
import { createAuditLog } from '../services/auditService';
import { AuditActionType } from '@prisma/client';

export const auditLog = (action: AuditActionType, entityType: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        // Capture original send
        const originalSend = res.send;
        let responseBody: any;

        res.send = function (body) {
            responseBody = body;
            return originalSend.apply(res, arguments as any);
        };

        res.on('finish', () => {
            // Only log successful operations
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const userId = req.user?.id;

                if (userId) {
                    // Extract entity ID from response or params
                    let entityId = req.params.id;
                    if (!entityId && responseBody) {
                        try {
                            const parsed = typeof responseBody === 'string' ? JSON.parse(responseBody) : responseBody;
                            entityId = parsed.id;
                        } catch (e) {
                            // ignore
                        }
                    }

                    // Create log asynchronously
                    createAuditLog({
                        userId,
                        action,
                        entityType,
                        entityId,
                        changes: req.body,
                    }).catch(err => {
                        console.error('Failed to create audit log:', err);
                    });
                }
            }
        });

        next();
    };
};

// Backward compatibility wrapper - automatically log based on HTTP method
export const auditMiddleware = (entityType: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        // Determine action from HTTP method
        let action: AuditActionType | null = null;

        switch (req.method) {
            case 'POST':
                action = 'CREATE';
                break;
            case 'PUT':
            case 'PATCH':
                action = 'UPDATE';
                break;
            case 'DELETE':
                action = 'DELETE';
                break;
            default:
                // Don't log GET requests
                return next();
        }

        // Delegate to auditLog
        return auditLog(action, entityType)(req, res, next);
    };
};
