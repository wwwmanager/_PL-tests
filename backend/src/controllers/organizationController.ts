import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getMyOrganization(req: Request, res: Response, next: NextFunction) {
    try {
        // req.user заполняется authMiddleware (id, organizationId, role)
        if (!req.user) {
            return res.status(401).json({ error: 'Un authorized' });
        }

        const orgId = req.user.organizationId;
        if (!orgId) {
            return res.status(400).json({ error: 'User has no organizationId' });
        }

        const organization = await prisma.organization.findUnique({
            where: { id: orgId },
        });

        if (!organization) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        res.json({ data: organization });
    } catch (err) {
        next(err);
    }
}

export async function listOrganizations(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const user = req.user;

        // RLS-ORG-010: Driver sees only their employee's organization, parent, and siblings
        if (user.role === 'driver' && user.employeeId) {
            // Get the employee's organization (the one driver can edit)
            const employee = await prisma.employee.findUnique({
                where: { id: user.employeeId },
                select: { organizationId: true }
            });

            if (!employee) {
                return res.json({ data: [] });
            }

            const employeeOrgId = employee.organizationId;

            // Get employee's org with parent info
            const employeeOrg = await prisma.organization.findUnique({
                where: { id: employeeOrgId },
                include: {
                    parentOrganization: {
                        select: { id: true, shortName: true, inn: true, name: true, status: true }
                    }
                }
            });

            if (!employeeOrg) {
                return res.json({ data: [] });
            }

            // Start with employee's org (the only one driver CAN edit)
            const orgs: any[] = [{
                ...employeeOrg,
                _canEdit: true  // Driver can edit their employee's org
            }];

            // Add parent org (read-only)
            if (employeeOrg.parentOrganization) {
                const parentOrg = await prisma.organization.findUnique({
                    where: { id: employeeOrg.parentOrganization.id },
                    include: {
                        parentOrganization: {
                            select: { id: true, shortName: true, inn: true, name: true, status: true }
                        }
                    }
                });
                if (parentOrg) {
                    orgs.push({
                        ...parentOrg,
                        _canEdit: false  // Driver cannot edit parent org
                    });
                }

                // Also add sibling orgs (other children of parent, read-only)
                const siblingOrgs = await prisma.organization.findMany({
                    where: {
                        parentOrganizationId: employeeOrg.parentOrganization.id,
                        id: { not: employeeOrgId }  // Exclude driver's own org (already added)
                    },
                    include: {
                        parentOrganization: {
                            select: { id: true, shortName: true, inn: true, name: true, status: true }
                        }
                    }
                });
                for (const siblingOrg of siblingOrgs) {
                    orgs.push({
                        ...siblingOrg,
                        _canEdit: false  // Driver cannot edit sibling orgs
                    });
                }
            }

            console.log(`[RLS-ORG-010] Driver ${user.id} (employee ${user.employeeId}) sees ${orgs.length} org(s), can edit: ${employeeOrg.shortName}`);
            return res.json({ data: orgs });
        }

        const organizations = await prisma.organization.findMany({
            orderBy: { name: 'asc' },
            // ORG-HIERARCHY-001: Include parent org for hierarchy display
            include: {
                parentOrganization: {
                    select: { id: true, shortName: true, inn: true }
                }
            }
        });

        res.json({ data: organizations });
    } catch (err) {
        next(err);
    }
}

export async function createOrganization(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Sanitize input: remove id (auto-generated), fix empty DateTime fields
        const { id, stockLockedAt, ...rest } = req.body;

        // name is required in Prisma schema, populate from shortName if not provided
        const data: any = {
            ...rest,
            name: rest.name || rest.shortName || 'Unnamed Organization',
        };

        // Only set stockLockedAt if it's a valid non-empty string
        if (stockLockedAt && typeof stockLockedAt === 'string' && stockLockedAt.trim() !== '') {
            data.stockLockedAt = new Date(stockLockedAt);
        }

        // OWN-ORG-BE-020: Validate only one organization can have isOwn=true
        if (data.isOwn === true) {
            const existingOwn = await prisma.organization.findFirst({
                where: { isOwn: true }
            });
            if (existingOwn) {
                return res.status(400).json({
                    error: 'Только одна организация может быть собственной'
                });
            }
        }

        const organization = await prisma.organization.create({
            data
        });

        res.status(201).json({ data: organization });
    } catch (err) {
        next(err);
    }
}

export async function updateOrganization(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;

        // Sanitize input: remove id from body (use URL param), fix empty DateTime fields
        const { id: bodyId, stockLockedAt, ...rest } = req.body;

        // If shortName is updated but name is not provided, update name too
        const data: any = { ...rest };
        if (rest.shortName && !rest.name) {
            data.name = rest.shortName;
        }

        // Only set stockLockedAt if it's a valid non-empty string; 
        // empty string means don't change it (use undefined to skip update)
        if (stockLockedAt !== undefined) {
            if (stockLockedAt && typeof stockLockedAt === 'string' && stockLockedAt.trim() !== '') {
                data.stockLockedAt = new Date(stockLockedAt);
            } else if (stockLockedAt === null) {
                // Explicitly set to null if client wants to clear it
                data.stockLockedAt = null;
            }
            // Empty string = skip update
        }

        // OWN-ORG-BE-020: Validate only one organization can have isOwn=true
        if (data.isOwn === true) {
            const existingOwn = await prisma.organization.findFirst({
                where: { isOwn: true, id: { not: id } }
            });
            if (existingOwn) {
                return res.status(400).json({
                    error: 'Только одна организация может быть собственной'
                });
            }
        }

        const organization = await prisma.organization.update({
            where: { id },
            data
        });

        res.json({ data: organization });
    } catch (err) {
        next(err);
    }
}

export async function deleteOrganization(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;

        // Check if org exists
        const org = await prisma.organization.findUnique({ where: { id } });
        if (!org) {
            return res.status(404).json({ error: 'Организация не найдена' });
        }

        console.log(`🗑️ Cascade deleting organization ${id} (${org.shortName || org.name})`);

        // CASCADE DELETE: Delete ALL related data
        // Order matters due to FK constraints - delete deepest children first

        // 1. Delete waybills (WaybillRoute, WaybillFuel cascade automatically)
        await prisma.waybill.deleteMany({ where: { organizationId: id } });

        // 2. Delete stock movements
        await prisma.stockMovement.deleteMany({ where: { organizationId: id } });

        // 3. Delete blanks and blank batches
        await prisma.blank.deleteMany({ where: { organizationId: id } });
        await prisma.blankBatch.deleteMany({ where: { organizationId: id } });

        // 4. Delete audit logs
        await prisma.auditLog.deleteMany({ where: { organizationId: id } });

        // 5. Delete stock items
        await prisma.stockItem.deleteMany({ where: { organizationId: id } });

        // 6. Delete warehouses
        await prisma.warehouse.deleteMany({ where: { organizationId: id } });

        // 7. Delete fuel cards
        await prisma.fuelCard.deleteMany({ where: { organizationId: id } });

        // 8. Delete vehicles
        await prisma.vehicle.deleteMany({ where: { organizationId: id } });

        // 9. Delete drivers (via raw SQL)
        await prisma.$executeRaw`
            DELETE FROM drivers 
            WHERE "employeeId" IN (
                SELECT id FROM employees WHERE "organizationId" = ${id}::uuid
            )
        `;

        // 10. Delete employees
        await prisma.employee.deleteMany({ where: { organizationId: id } });

        // 11. Delete departments
        await prisma.department.deleteMany({ where: { organizationId: id } });

        // 12. Delete ALL user_roles for ALL users of this org (no exceptions!)
        await prisma.$executeRaw`
            DELETE FROM user_roles 
            WHERE "userId" IN (
                SELECT id FROM users WHERE "organizationId" = ${id}::uuid
            )
        `;

        // 13. Delete ALL refresh_tokens for ALL users of this org
        await prisma.$executeRaw`
            DELETE FROM refresh_tokens 
            WHERE "userId" IN (
                SELECT id FROM users WHERE "organizationId" = ${id}::uuid
            )
        `;

        // 14. Delete ALL users of this org (no exceptions, no transfers!)
        await prisma.user.deleteMany({ where: { organizationId: id } });

        // 15. Finally delete the organization
        await prisma.organization.delete({ where: { id } });

        console.log(`✅ Organization ${id} deleted with all data`);
        res.status(204).send();
    } catch (err) {
        console.error('Delete organization error:', err);
        next(err);
    }
}


