import type { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * GET /me - Returns current user context with organization/department info
 * REL-001: Provides visible context for debugging "empty lists" issues
 */
export async function getMe(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ code: "UNAUTHORIZED", message: "Требуется авторизация" });
        }

        const userId = req.user.id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                fullName: true,
                isActive: true,
                organizationId: true,
                departmentId: true,
                employeeId: true,
                organization: { select: { id: true, name: true, shortName: true } },
                department: { select: { id: true, name: true } },
            },
        });

        if (!user) {
            return res.status(401).json({ code: "USER_NOT_FOUND", message: "Пользователь не найден" });
        }

        // Get linked driver if user has employee
        let driverId: string | null = null;
        if (user.employeeId) {
            const driver = await prisma.driver.findUnique({
                where: { employeeId: user.employeeId }
            });
            driverId = driver?.id || null;
        }

        // Role from token (as issued at login, even if DB changed since)
        const roleFromToken = req.user.role;

        return res.json({
            requestId: (req as any).requestId ?? null,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                role: roleFromToken,
                isActive: user.isActive,
                employeeId: user.employeeId || null,
                driverId: driverId,
            },
            organization: user.organization
                ? { id: user.organization.id, name: user.organization.shortName ?? user.organization.name }
                : { id: user.organizationId, name: null },
            department: user.department
                ? { id: user.department.id, name: user.department.name }
                : null,
            // Token claims vs DB - useful to detect mismatches
            tokenClaims: {
                organizationId: req.user.organizationId,
                departmentId: req.user.departmentId,
                role: req.user.role,
            },
            serverTime: new Date().toISOString(),
            backendVersion: "1.0.0",
        });
    } catch (e) {
        next(e);
    }
}
