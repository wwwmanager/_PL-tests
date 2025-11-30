// Audit Middleware - Automatic logging for CRUD operations
import { Request, Response, NextFunction } from 'express';
import { createAuditLog } from '../services/auditService';
import { AuditActionType } from '../entities/enums';

// Helper to extract real IP address
function getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
}

// Helper to determine action type from HTTP method
function getActionType(method: string): AuditActionType | null {
    switch (method) {
        case 'POST':
            return AuditActionType.CREATE;
        case 'PUT':
        case 'PATCH':
            return AuditActionType.UPDATE;
        case 'DELETE':
            return AuditActionType.DELETE;
        default:
            return null; // Don't log GET requests
    }
}

// Helper to extract entity info from request path
function getEntityTypeFromPath(path: string): string {
    // Extract entity type from path like /api/waybills/123 -> 'waybill'
    const match = path.match(/\/api\/([^/]+)/);
    if (match && match[1]) {
        // Remove trailing 's' if plural
        return match[1].endsWith('s') ? match[1].slice(0, -1) : match[1];
    }
    return 'unknown';
}

// Helper to extract entity ID from path
function getEntityIdFromPath(path: string, method: string): string | undefined {
    // For POST, there's usually no ID in path
    if (method === 'POST') {
        return undefined;
    }

    // Extract ID from path like /api/waybills/123abc -> '123abc'
    const match = path.match(/\/api\/[^/]+\/([^/]+)/);
    return match ? match[1] : undefined;
}

export function auditMiddleware(entityType?: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const action = getActionType(req.method);

        // Skip GET requests and non-CRUD operations
        if (!action) {
            return next();
        }

        const userId = (req as any).user?.id;

        // Skip if no authenticated user
        if (!userId) {
            return next();
        }

        const entityTypeResolved = entityType || getEntityTypeFromPath(req.path);
        const entityId = getEntityIdFromPath(req.path, req.method);
        const ipAddress = getClientIp(req);
        const userAgent = req.headers['user-agent'];

        // Capture request body for changes tracking
        const requestBody = req.body;

        // Store original send to capture response
        const originalSend = res.send;
        let responseBody: any;

        res.send = function (this: Response, data: any): Response {
            responseBody = data;
            return originalSend.call(this, data);
        };

        // Wait for response to complete
        res.on('finish', async () => {
            try {
                // Only log successful operations (2xx status codes)
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    let changes: Record<string, any> | undefined;

                    if (action === AuditActionType.UPDATE && requestBody) {
                        // For UPDATE, store the changes
                        changes = {
                            before: {}, // Could fetch from DB if needed
                            after: requestBody,
                        };
                    } else if (action === AuditActionType.CREATE && requestBody) {
                        changes = {
                            created: requestBody,
                        };
                    }

                    await createAuditLog({
                        userId,
                        action,
                        entityType: entityTypeResolved,
                        entityId,
                        changes,
                        ipAddress,
                        userAgent,
                    });
                }
            } catch (error) {
                // Log error but don't fail the request
                console.error('Audit logging failed:', error);
            }
        });

        next();
    };
}
