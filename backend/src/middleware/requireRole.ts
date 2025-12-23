// STOCK-VOID-RBAC-PR2-005: Minimal RBAC guard for void endpoint
// Simple role-based middleware (does not use permissions table)

import { Request, Response, NextFunction } from 'express';

/**
 * Require user to have one of the specified roles
 * @param allowedRoles - Array of role codes (case-insensitive), e.g., ['admin', 'accountant']
 * @returns Express middleware
 */
export function requireRoleAny(allowedRoles: string[]) {
    const allowed = new Set(allowedRoles.map(r => r.toLowerCase()));

    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                code: 'UNAUTHORIZED'
            });
        }

        const userRole = String(req.user.role ?? '').toLowerCase();

        if (!allowed.has(userRole)) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: insufficient role',
                code: 'FORBIDDEN',
                required: Array.from(allowed),
                actual: userRole || null
            });
        }

        next();
    };
}
