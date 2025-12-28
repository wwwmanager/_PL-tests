// Driver Controller - CRUD operations for drivers
// REL-301: Provides unified driver list for frontend selectors
import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * REL-301: GET /drivers
 * Returns list of drivers with joined Employee data
 * Filters by organizationId from JWT token
 * Returns flat structure: { id (driverId), employeeId, fullName, departmentId, isActive }
 */
export async function listDrivers(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Требуется авторизация' });
        }

        const organizationId = req.user.organizationId;
        const departmentId = req.query.departmentId as string | undefined;

        // ORG-HIERARCHY: Include drivers from this org AND all child orgs
        const childOrgs = await prisma.organization.findMany({
            where: { parentOrganizationId: organizationId },
            select: { id: true }
        });
        const orgIds = [organizationId, ...childOrgs.map(o => o.id)];

        const drivers = await prisma.driver.findMany({
            where: {
                employee: {
                    organizationId: { in: orgIds },
                    ...(departmentId ? { departmentId } : {}),
                },
            },
            include: {
                employee: {
                    select: {
                        id: true,
                        fullName: true,
                        shortName: true,
                        departmentId: true,
                        isActive: true,
                    },
                },
            },
            orderBy: {
                employee: {
                    fullName: 'asc',
                },
            },
        });

        // REL-301: Transform to flat structure for frontend
        const result = drivers.map(d => ({
            id: d.id,                                    // Driver.id - use this for waybills/blanks
            employeeId: d.employeeId,                    // Employee.id - for reference only
            fullName: d.employee?.fullName ?? 'Без имени',
            shortName: d.employee?.shortName ?? null,
            departmentId: d.employee?.departmentId ?? null,
            isActive: d.employee?.isActive ?? true,
        }));

        res.json(result);
    } catch (err) {
        next(err);
    }
}

export async function getDriverById(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;

        const driver = await prisma.driver.findUnique({
            where: { id },
            include: {
                employee: {
                    include: {
                        organization: true,
                        department: true,
                    },
                },
            },
        });

        if (!driver) {
            return res.status(404).json({ error: 'Driver not found' });
        }

        res.json(driver);
    } catch (err) {
        next(err);
    }
}

/**
 * FUEL-CARD-LINK-UI: Search drivers by name for autocomplete
 * GET /api/drivers/search?q=...
 */
export async function searchDrivers(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Требуется авторизация' });
        }

        const organizationId = req.user.organizationId;
        const query = (req.query.q as string || '').trim();
        const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 50);

        const where: any = {
            employee: {
                organizationId,
                isActive: true,
            },
        };

        if (query) {
            where.employee.fullName = { contains: query, mode: 'insensitive' };
        }

        const drivers = await prisma.driver.findMany({
            where,
            include: {
                employee: {
                    select: {
                        id: true,
                        fullName: true,
                    },
                },
            },
            take: limit,
            orderBy: {
                employee: {
                    fullName: 'asc',
                },
            },
        });

        const result = drivers.map(d => ({
            id: d.id,
            employeeId: d.employeeId,
            fullName: d.employee?.fullName ?? 'Без имени',
        }));

        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}
