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

        // RLS-ME-010: Load employee with department for accurate data
        let employeeData: {
            id: string;
            fullName: string;
            employeeType: string;
            departmentId: string | null;
            departmentName: string | null;
            assignedVehicleIds: string[];
        } | null = null;

        let driverId: string | null = null;

        if (user.employeeId) {
            const employee = await prisma.employee.findUnique({
                where: { id: user.employeeId },
                select: {
                    id: true,
                    fullName: true,
                    employeeType: true,
                    departmentId: true,
                    department: { select: { id: true, name: true } },
                    assignedVehicles: { select: { id: true } },
                    driver: { select: { id: true } },
                }
            });

            if (employee) {
                employeeData = {
                    id: employee.id,
                    fullName: employee.fullName,
                    employeeType: employee.employeeType,
                    departmentId: employee.departmentId,
                    departmentName: employee.department?.name || null,
                    assignedVehicleIds: employee.assignedVehicles.map(v => v.id),
                };
                driverId = employee.driver?.id || null;
            }
        }

        // Role from token (as issued at login, even if DB changed since)
        const roleFromToken = req.user.role;

        // RLS-ME-010: Prefer employee.department over user.department
        const effectiveDepartment = employeeData?.departmentId
            ? { id: employeeData.departmentId, name: employeeData.departmentName }
            : (user.department ? { id: user.department.id, name: user.department.name } : null);

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
                employeeType: employeeData?.employeeType || null,  // RLS-ME-010
            },
            organization: user.organization
                ? { id: user.organization.id, name: user.organization.shortName ?? user.organization.name }
                : { id: user.organizationId, name: null },
            department: effectiveDepartment,
            employee: employeeData,  // RLS-ME-010: Full employee data
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
