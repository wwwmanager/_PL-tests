import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// Category types for data organization
type DataCategory = 'documents' | 'dictionaries' | 'stock' | 'settings' | 'logs';

interface TablePreview {
    count: number;
    items: Array<{ id: string; label: string; subLabel?: string }>;
}

interface DataPreviewResponse {
    documents: {
        waybills: TablePreview;
        blanks: TablePreview;
        blankBatches: TablePreview;
    };
    dictionaries: {
        employees: TablePreview;
        drivers: TablePreview;
        vehicles: TablePreview;
        routes: TablePreview;
        fuelTypes: TablePreview;
        fuelCards: TablePreview;
        warehouses: TablePreview;
        organizations: TablePreview;
    };
    stock: {
        stockItems: TablePreview;
        stockMovements: TablePreview;
    };
    settings: {
        departments: TablePreview;
        settings: TablePreview;
    };
    logs: {
        auditLogs: TablePreview;
    };
}

/**
 * Get preview of all data in database grouped by category
 */
export const getDataPreview = async (req: Request, res: Response) => {
    console.log('[getDataPreview] Starting data preview fetch...');
    try {
        console.log('[getDataPreview] Fetching data from Prisma...');
        const [
            waybills,
            blanks,
            blankBatches,
            employees,
            drivers,
            vehicles,
            routes,
            fuelTypes,
            fuelCards,
            warehouses,
            stockItems,
            stockMovements,
            departments,
            settings,
            auditLogs,
            organizations
        ] = await Promise.all([
            prisma.waybill.findMany({ select: { id: true, number: true, date: true }, take: 100 }),
            prisma.blank.findMany({ select: { id: true, series: true, number: true, status: true }, take: 200 }),
            prisma.blankBatch.findMany({ select: { id: true, series: true, numberFrom: true, numberTo: true } }),
            prisma.employee.findMany({ select: { id: true, fullName: true, position: true } }),
            prisma.driver.findMany({ select: { id: true, licenseNumber: true, employee: { select: { fullName: true } } } }),
            prisma.vehicle.findMany({ select: { id: true, registrationNumber: true, brand: true, model: true } }),
            prisma.route.findMany({ select: { id: true, name: true } }),
            prisma.fuelType.findMany({ select: { id: true, code: true, name: true } }),
            prisma.fuelCard.findMany({ select: { id: true, cardNumber: true, provider: true } }),
            prisma.warehouse.findMany({ select: { id: true, name: true, address: true } }),
            prisma.stockItem.findMany({ select: { id: true, code: true, name: true, unit: true } }),
            prisma.stockMovement.findMany({ select: { id: true, movementType: true, quantity: true, createdAt: true }, take: 100 }),
            prisma.department.findMany({ select: { id: true, code: true, name: true } }),
            prisma.setting.findMany({ select: { key: true } }),
            prisma.auditLog.findMany({ select: { id: true, actionType: true, entityType: true, createdAt: true }, take: 100, orderBy: { createdAt: 'desc' } }),
            prisma.organization.findMany({ select: { id: true, name: true, shortName: true, inn: true } })
        ]);

        const response: DataPreviewResponse = {
            documents: {
                waybills: {
                    count: waybills.length,
                    items: waybills.map(w => ({
                        id: w.id,
                        label: `${w.number}`,
                        subLabel: new Date(w.date).toLocaleDateString('ru-RU')
                    }))
                },
                blanks: {
                    count: blanks.length,
                    items: blanks.map(b => ({
                        id: b.id,
                        label: `${b.series || ''} ${b.number}`,
                        subLabel: b.status
                    }))
                },
                blankBatches: {
                    count: blankBatches.length,
                    items: blankBatches.map(bb => ({
                        id: bb.id,
                        label: `${bb.series || ''} ${bb.numberFrom}-${bb.numberTo}`
                    }))
                }
            },
            dictionaries: {
                employees: {
                    count: employees.length,
                    items: employees.map(e => ({
                        id: e.id,
                        label: e.fullName,
                        subLabel: e.position || undefined
                    }))
                },
                drivers: {
                    count: drivers.length,
                    items: drivers.map(d => ({
                        id: d.id,
                        label: d.employee?.fullName || d.licenseNumber,
                        subLabel: d.licenseNumber
                    }))
                },
                vehicles: {
                    count: vehicles.length,
                    items: vehicles.map(v => ({
                        id: v.id,
                        label: v.registrationNumber,
                        subLabel: `${v.brand || ''} ${v.model || ''}`.trim() || undefined
                    }))
                },
                routes: {
                    count: routes.length,
                    items: routes.map(r => ({
                        id: r.id,
                        label: r.name
                    }))
                },
                fuelTypes: {
                    count: fuelTypes.length,
                    items: fuelTypes.map(ft => ({
                        id: ft.id,
                        label: ft.name,
                        subLabel: ft.code
                    }))
                },
                fuelCards: {
                    count: fuelCards.length,
                    items: fuelCards.map(fc => ({
                        id: fc.id,
                        label: fc.cardNumber,
                        subLabel: fc.provider || undefined
                    }))
                },
                warehouses: {
                    count: warehouses.length,
                    items: warehouses.map(w => ({
                        id: w.id,
                        label: w.name,
                        subLabel: w.address || undefined
                    }))
                },
                organizations: {
                    count: organizations.length,
                    items: organizations.map(o => ({
                        id: o.id,
                        label: o.shortName || o.name,
                        subLabel: o.inn || undefined
                    }))
                }
            },
            stock: {
                stockItems: {
                    count: stockItems.length,
                    items: stockItems.map(si => ({
                        id: si.id,
                        label: si.name,
                        subLabel: `${si.code || ''} (${si.unit})`
                    }))
                },
                stockMovements: {
                    count: stockMovements.length,
                    items: stockMovements.map(sm => ({
                        id: sm.id,
                        label: `${sm.movementType}: ${sm.quantity}`,
                        subLabel: new Date(sm.createdAt).toLocaleDateString('ru-RU')
                    }))
                }
            },
            settings: {
                departments: {
                    count: departments.length,
                    items: departments.map(d => ({
                        id: d.id,
                        label: d.name,
                        subLabel: d.code || undefined
                    }))
                },
                settings: {
                    count: settings.length,
                    items: settings.map(s => ({
                        id: s.key,
                        label: s.key
                    }))
                }
            },
            logs: {
                auditLogs: {
                    count: auditLogs.length,
                    items: auditLogs.map(al => ({
                        id: al.id,
                        label: `${al.actionType}: ${al.entityType}`,
                        subLabel: new Date(al.createdAt).toLocaleDateString('ru-RU')
                    }))
                }
            }
        };

        console.log('[getDataPreview] Sending response...');
        res.json(response);
    } catch (error) {
        console.error('[getDataPreview] ERROR:', error);
        logger.error({ error }, 'Failed to get data preview');
        res.status(500).json({ error: 'Failed to get data preview' });
    }
};

interface SelectiveDeleteRequest {
    tables?: string[];  // Delete entire tables
    items?: Record<string, string[]>;  // Delete specific items by table
}

/**
 * Selectively delete data from specified tables or items
 */
export const selectiveDelete = async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const { tables, items } = req.body as SelectiveDeleteRequest;

    logger.warn({ userId, tables, items }, 'Selective delete requested');

    try {
        const deletedCounts: Record<string, number> = {};

        await prisma.$transaction(async (tx) => {
            // Helper to delete by table name
            const deleteTable = async (tableName: string) => {
                switch (tableName) {
                    case 'waybills':
                        await tx.waybillFuel.deleteMany();
                        await tx.waybillRoute.deleteMany();
                        const wc = await tx.waybill.deleteMany();
                        deletedCounts.waybills = wc.count;
                        break;
                    case 'blanks':
                        const bc = await tx.blank.deleteMany();
                        deletedCounts.blanks = bc.count;
                        break;
                    case 'blankBatches':
                        await tx.blank.deleteMany();  // Must delete blanks first
                        const bbc = await tx.blankBatch.deleteMany();
                        deletedCounts.blankBatches = bbc.count;
                        break;
                    case 'employees':
                        await tx.driver.deleteMany();  // FK dependency
                        const ec = await tx.employee.deleteMany();
                        deletedCounts.employees = ec.count;
                        break;
                    case 'drivers':
                        const dc = await tx.driver.deleteMany();
                        deletedCounts.drivers = dc.count;
                        break;
                    case 'vehicles':
                        const vc = await tx.vehicle.deleteMany();
                        deletedCounts.vehicles = vc.count;
                        break;
                    case 'routes':
                        const rc = await tx.route.deleteMany();
                        deletedCounts.routes = rc.count;
                        break;
                    case 'fuelTypes':
                        const ftc = await tx.fuelType.deleteMany();
                        deletedCounts.fuelTypes = ftc.count;
                        break;
                    case 'fuelCards':
                        const fcc = await tx.fuelCard.deleteMany();
                        deletedCounts.fuelCards = fcc.count;
                        break;
                    case 'warehouses':
                        const whc = await tx.warehouse.deleteMany();
                        deletedCounts.warehouses = whc.count;
                        break;
                    case 'stockItems':
                        await tx.stockMovement.deleteMany();  // FK dependency
                        const sic = await tx.stockItem.deleteMany();
                        deletedCounts.stockItems = sic.count;
                        break;
                    case 'stockMovements':
                        const smc = await tx.stockMovement.deleteMany();
                        deletedCounts.stockMovements = smc.count;
                        break;
                    case 'departments':
                        const dpc = await tx.department.deleteMany();
                        deletedCounts.departments = dpc.count;
                        break;
                    case 'settings':
                        const sc = await tx.setting.deleteMany();
                        deletedCounts.settings = sc.count;
                        break;
                    case 'auditLogs':
                        const alc = await tx.auditLog.deleteMany();
                        deletedCounts.auditLogs = alc.count;
                        break;
                    case 'organizations':
                        // Organizations have many FK dependencies - must delete in proper order
                        // Never delete orgs with system users (like admin)
                        try {
                            // Delete dependent data first (in reverse FK order)
                            await tx.waybillFuel.deleteMany();
                            await tx.waybillRoute.deleteMany();
                            await tx.waybill.deleteMany();
                            await tx.blank.deleteMany();
                            await tx.blankBatch.deleteMany();
                            await tx.fuelCard.deleteMany();
                            await tx.driver.deleteMany();
                            await tx.employee.deleteMany();
                            await tx.vehicle.deleteMany();
                            await tx.stockMovement.deleteMany();
                            await tx.stockItem.deleteMany();
                            await tx.warehouse.deleteMany();
                            await tx.department.deleteMany();
                            // Finally delete organizations (except those with users or system users)
                            const orgc = await tx.organization.deleteMany({
                                where: {
                                    AND: [
                                        { users: { none: {} } },  // No users at all
                                        { users: { none: { isSystem: true } } }  // Double check: no system users
                                    ]
                                }
                            });
                            deletedCounts.organizations = orgc.count;
                            logger.info({ count: orgc.count }, 'Organizations deleted (orgs with users/system users preserved)');
                        } catch (e: any) {
                            logger.warn({ error: e.message }, 'Could not delete organizations - likely have active/system users');
                            deletedCounts.organizations = 0;
                        }
                        break;
                }
            };

            // Delete entire tables
            if (tables && tables.length > 0) {
                for (const table of tables) {
                    await deleteTable(table);
                }
            }

            // Delete specific items
            if (items) {
                for (const [tableName, ids] of Object.entries(items)) {
                    if (!ids || ids.length === 0) continue;

                    switch (tableName) {
                        case 'waybills':
                            await tx.waybillFuel.deleteMany({ where: { waybillId: { in: ids } } });
                            await tx.waybillRoute.deleteMany({ where: { waybillId: { in: ids } } });
                            const wc = await tx.waybill.deleteMany({ where: { id: { in: ids } } });
                            deletedCounts.waybills = (deletedCounts.waybills || 0) + wc.count;
                            break;
                        case 'blanks':
                            const bc = await tx.blank.deleteMany({ where: { id: { in: ids } } });
                            deletedCounts.blanks = (deletedCounts.blanks || 0) + bc.count;
                            break;
                        case 'blankBatches':
                            await tx.blank.deleteMany({ where: { batchId: { in: ids } } });
                            const bbc = await tx.blankBatch.deleteMany({ where: { id: { in: ids } } });
                            deletedCounts.blankBatches = (deletedCounts.blankBatches || 0) + bbc.count;
                            break;
                        case 'employees':
                            await tx.driver.deleteMany({ where: { employeeId: { in: ids } } });
                            const ec = await tx.employee.deleteMany({ where: { id: { in: ids } } });
                            deletedCounts.employees = (deletedCounts.employees || 0) + ec.count;
                            break;
                        case 'drivers':
                            const dc = await tx.driver.deleteMany({ where: { id: { in: ids } } });
                            deletedCounts.drivers = (deletedCounts.drivers || 0) + dc.count;
                            break;
                        case 'vehicles':
                            const vc = await tx.vehicle.deleteMany({ where: { id: { in: ids } } });
                            deletedCounts.vehicles = (deletedCounts.vehicles || 0) + vc.count;
                            break;
                        case 'routes':
                            const rc = await tx.route.deleteMany({ where: { id: { in: ids } } });
                            deletedCounts.routes = (deletedCounts.routes || 0) + rc.count;
                            break;
                        case 'fuelTypes':
                            const ftc = await tx.fuelType.deleteMany({ where: { id: { in: ids } } });
                            deletedCounts.fuelTypes = (deletedCounts.fuelTypes || 0) + ftc.count;
                            break;
                        case 'fuelCards':
                            const fcc = await tx.fuelCard.deleteMany({ where: { id: { in: ids } } });
                            deletedCounts.fuelCards = (deletedCounts.fuelCards || 0) + fcc.count;
                            break;
                        case 'warehouses':
                            const whc = await tx.warehouse.deleteMany({ where: { id: { in: ids } } });
                            deletedCounts.warehouses = (deletedCounts.warehouses || 0) + whc.count;
                            break;
                        case 'stockItems':
                            await tx.stockMovement.deleteMany({ where: { stockItemId: { in: ids } } });
                            const sic = await tx.stockItem.deleteMany({ where: { id: { in: ids } } });
                            deletedCounts.stockItems = (deletedCounts.stockItems || 0) + sic.count;
                            break;
                        case 'stockMovements':
                            const smc = await tx.stockMovement.deleteMany({ where: { id: { in: ids } } });
                            deletedCounts.stockMovements = (deletedCounts.stockMovements || 0) + smc.count;
                            break;
                        case 'departments':
                            const dpc = await tx.department.deleteMany({ where: { id: { in: ids } } });
                            deletedCounts.departments = (deletedCounts.departments || 0) + dpc.count;
                            break;
                        case 'settings':
                            const sc = await tx.setting.deleteMany({ where: { key: { in: ids } } });
                            deletedCounts.settings = (deletedCounts.settings || 0) + sc.count;
                            break;
                        case 'auditLogs':
                            const alc = await tx.auditLog.deleteMany({ where: { id: { in: ids } } });
                            deletedCounts.auditLogs = (deletedCounts.auditLogs || 0) + alc.count;
                            break;
                        case 'organizations':
                            // Delete specific orgs by ID, but only if they have no users
                            try {
                                const orgc = await tx.organization.deleteMany({
                                    where: {
                                        id: { in: ids },
                                        users: { none: {} }  // Only delete orgs without users
                                    }
                                });
                                deletedCounts.organizations = (deletedCounts.organizations || 0) + orgc.count;
                                if (orgc.count < ids.length) {
                                    logger.info({ requested: ids.length, deleted: orgc.count },
                                        'Some organizations skipped (have active users)');
                                }
                            } catch (e: any) {
                                logger.warn({ error: e.message }, 'Could not delete organizations');
                            }
                            break;
                    }
                }
            }
        });

        logger.info({ userId, deletedCounts }, 'Selective delete completed');

        res.json({
            success: true,
            message: 'Selected data deleted successfully',
            deletedCounts
        });
    } catch (error) {
        logger.error({ error, userId }, 'Selective delete failed');
        res.status(500).json({
            success: false,
            message: 'Failed to delete selected data',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Reset all data in the database.
 * WARNING: This is a destructive operation that cannot be undone.
 * Only accessible by admin users.
 */
export const resetDatabase = async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;

    logger.warn({ userId, userRole }, 'Database reset requested');

    try {
        await prisma.$transaction(async (tx) => {
            await tx.auditLog.deleteMany();
            await tx.waybillFuel.deleteMany();
            await tx.waybillRoute.deleteMany();
            await tx.waybill.deleteMany();
            await tx.blank.deleteMany();
            await tx.blankBatch.deleteMany();
            await tx.stockMovement.deleteMany();
            await tx.stockItem.deleteMany();
            await tx.warehouse.deleteMany();
            await tx.fuelCard.deleteMany();
            await tx.driver.deleteMany();
            await tx.employee.deleteMany();
            await tx.vehicle.deleteMany();
            await tx.route.deleteMany();
            await tx.fuelType.deleteMany();
            await tx.department.deleteMany();
            await tx.setting.deleteMany();

            logger.info({ userId }, 'Database reset completed successfully');
        });

        res.json({
            success: true,
            message: 'Database has been reset. Core users and organizations preserved.',
            preservedTables: ['User', 'Organization', 'Role', 'Permission', 'RefreshToken']
        });
    } catch (error) {
        logger.error({ error, userId }, 'Database reset failed');
        res.status(500).json({
            success: false,
            message: 'Failed to reset database',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

// ============================================================
// IMPORT DATA API
// ============================================================

interface ImportDataRequest {
    organizations?: any[];
    employees?: any[];
    vehicles?: any[];
    fuelTypes?: any[];
    routes?: any[];
    waybills?: any[];
    fuelCards?: any[];
}

interface ImportResult {
    table: string;
    created: number;
    updated: number;
    errors: string[];
}

/**
 * Import JSON data into PostgreSQL database
 * Supports upsert logic (create new or update existing by ID)
 */
export const importData = async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const organizationId = (req as any).user?.organizationId;
    const data: ImportDataRequest = req.body;

    logger.info({ userId, keys: Object.keys(data) }, 'Import data requested');

    // Helper: validate UUID format
    const isValidUuid = (id: string): boolean => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(id);
    };

    // ID mapping: original ID -> generated UUID (for cross-referencing)
    const idMap: Record<string, string> = {};

    const getOrCreateUuid = (originalId: string): string => {
        if (isValidUuid(originalId)) return originalId;
        if (idMap[originalId]) return idMap[originalId];
        const newId = crypto.randomUUID();
        idMap[originalId] = newId;
        return newId;
    };

    const results: ImportResult[] = [];

    try {
        // 1. Import Organizations
        if (data.organizations?.length) {
            const result: ImportResult = { table: 'organizations', created: 0, updated: 0, errors: [] };
            for (const org of data.organizations) {
                try {
                    const orgId = getOrCreateUuid(org.id);
                    const existing = await prisma.organization.findUnique({ where: { id: orgId } });
                    if (existing) {
                        await prisma.organization.update({
                            where: { id: orgId },
                            data: {
                                name: org.name,
                                shortName: org.shortName,
                                fullName: org.fullName,
                                inn: org.inn,
                                kpp: org.kpp,
                                ogrn: org.ogrn,
                                address: org.address,
                                phone: org.phone,
                                email: org.email,
                                bankName: org.bankName,
                                bankBik: org.bankBik,
                                bankAccount: org.bankAccount,
                                correspondentAccount: org.correspondentAccount,
                            }
                        });
                        result.updated++;
                    } else {
                        await prisma.organization.create({
                            data: {
                                id: orgId,
                                name: org.name,
                                shortName: org.shortName,
                                fullName: org.fullName,
                                inn: org.inn,
                                kpp: org.kpp,
                                ogrn: org.ogrn,
                                address: org.address,
                                phone: org.phone,
                                email: org.email,
                                bankName: org.bankName,
                                bankBik: org.bankBik,
                                bankAccount: org.bankAccount,
                                correspondentAccount: org.correspondentAccount,
                            }
                        });
                        result.created++;
                    }
                } catch (e: any) {
                    result.errors.push(`Organization ${org.id}: ${e.message}`);
                }
            }
            results.push(result);
        }

        // 2. Import FuelTypes (must be before vehicles)
        if (data.fuelTypes?.length) {
            const result: ImportResult = { table: 'fuelTypes', created: 0, updated: 0, errors: [] };
            for (const ft of data.fuelTypes) {
                try {
                    const ftId = getOrCreateUuid(ft.id);
                    const existing = await prisma.fuelType.findUnique({ where: { id: ftId } });
                    if (existing) {
                        await prisma.fuelType.update({
                            where: { id: ftId },
                            data: { code: ft.code, name: ft.name }
                        });
                        result.updated++;
                    } else {
                        await prisma.fuelType.create({
                            data: {
                                id: ftId,
                                code: ft.code,
                                name: ft.name,
                                density: ft.density
                            }
                        });
                        result.created++;
                    }
                } catch (e: any) {
                    result.errors.push(`FuelType ${ft.id}: ${e.message}`);
                }
            }
            results.push(result);
        }

        // 3. Import Routes
        if (data.routes?.length) {
            const result: ImportResult = { table: 'routes', created: 0, updated: 0, errors: [] };
            for (const route of data.routes) {
                try {
                    const routeId = getOrCreateUuid(route.id);
                    const existing = await prisma.route.findUnique({ where: { id: routeId } });
                    if (existing) {
                        await prisma.route.update({
                            where: { id: routeId },
                            data: {
                                name: route.name,
                                distance: route.distance,
                                estimatedTime: route.estimatedTime
                            }
                        });
                        result.updated++;
                    } else {
                        await prisma.route.create({
                            data: {
                                id: routeId,
                                name: route.name,
                                distance: route.distance,
                                estimatedTime: route.estimatedTime
                            }
                        });
                        result.created++;
                    }
                } catch (e: any) {
                    result.errors.push(`Route ${route.id}: ${e.message}`);
                }
            }
            results.push(result);
        }

        // 4. Import Employees (must be before drivers)
        if (data.employees?.length) {
            const result: ImportResult = { table: 'employees', created: 0, updated: 0, errors: [] };
            for (const emp of data.employees) {
                try {
                    // Resolve IDs - generate UUID if needed, map organizationId
                    const empId = getOrCreateUuid(emp.id);
                    const empOrgId = emp.organizationId ? getOrCreateUuid(emp.organizationId) : organizationId;

                    const existing = await prisma.employee.findUnique({ where: { id: empId } });
                    if (existing) {
                        await prisma.employee.update({
                            where: { id: empId },
                            data: {
                                fullName: emp.fullName,
                                position: emp.position,
                                phone: emp.phone,
                                email: emp.email,
                                dateOfBirth: emp.birthDate || emp.dateOfBirth || undefined,
                            }
                        });
                        result.updated++;
                    } else {
                        await prisma.employee.create({
                            data: {
                                id: empId,
                                organizationId: empOrgId,
                                fullName: emp.fullName,
                                position: emp.position,
                                phone: emp.phone,
                                email: emp.email,
                                dateOfBirth: emp.birthDate || emp.dateOfBirth || undefined,
                            }
                        });
                        result.created++;
                    }
                } catch (e: any) {
                    result.errors.push(`Employee ${emp.id}: ${e.message}`);
                }
            }
            results.push(result);
        }

        // 5. Import Vehicles
        if (data.vehicles?.length) {
            const result: ImportResult = { table: 'vehicles', created: 0, updated: 0, errors: [] };
            for (const veh of data.vehicles) {
                try {
                    const vehId = getOrCreateUuid(veh.id);
                    const vehOrgId = veh.organizationId ? getOrCreateUuid(veh.organizationId) : organizationId;

                    const existing = await prisma.vehicle.findUnique({ where: { id: vehId } });
                    if (existing) {
                        await prisma.vehicle.update({
                            where: { id: vehId },
                            data: {
                                code: veh.code,
                                registrationNumber: veh.registrationNumber,
                                brand: veh.brand,
                                model: veh.model,
                                vin: veh.vin,
                                fuelType: veh.fuelType,
                                fuelTankCapacity: veh.fuelTankCapacity,
                            }
                        });
                        result.updated++;
                    } else {
                        await prisma.vehicle.create({
                            data: {
                                id: vehId,
                                organizationId: vehOrgId,
                                code: veh.code,
                                registrationNumber: veh.registrationNumber,
                                brand: veh.brand,
                                model: veh.model,
                                vin: veh.vin,
                                fuelType: veh.fuelType,
                                fuelTankCapacity: veh.fuelTankCapacity,
                            }
                        });
                        result.created++;
                    }
                } catch (e: any) {
                    result.errors.push(`Vehicle ${veh.id}: ${e.message}`);
                }
            }
            results.push(result);
        }

        // 6. Import FuelCards
        if (data.fuelCards?.length) {
            const result: ImportResult = { table: 'fuelCards', created: 0, updated: 0, errors: [] };
            for (const fc of data.fuelCards) {
                try {
                    const fcId = getOrCreateUuid(fc.id);
                    const fcOrgId = fc.organizationId ? getOrCreateUuid(fc.organizationId) : organizationId;

                    const existing = await prisma.fuelCard.findUnique({ where: { id: fcId } });
                    if (existing) {
                        await prisma.fuelCard.update({
                            where: { id: fcId },
                            data: {
                                cardNumber: fc.cardNumber,
                                provider: fc.provider,
                            }
                        });
                        result.updated++;
                    } else {
                        await prisma.fuelCard.create({
                            data: {
                                id: fcId,
                                organizationId: fcOrgId,
                                cardNumber: fc.cardNumber,
                                provider: fc.provider,
                            }
                        });
                        result.created++;
                    }
                } catch (e: any) {
                    result.errors.push(`FuelCard ${fc.id}: ${e.message}`);
                }
            }
            results.push(result);
        }

        // 7. Import Waybills (complex - simplified for now, just basic fields)
        if (data.waybills?.length) {
            const result: ImportResult = { table: 'waybills', created: 0, updated: 0, errors: [] };
            for (const wb of data.waybills) {
                try {
                    const wbOrgId = wb.organizationId || organizationId;

                    // Resolve vehicle and driver
                    const vehicleId = wb.vehicleId;
                    // For driver, we need to find or create driver record
                    // For simplicity, we'll skip driver/mechanic/dispatcher lookups

                    // Waybill requires driverId - for now we'll skip waybills without driver
                    // driverId must reference Driver table (which requires Employee first)
                    // Skip waybill import for now - too complex to handle driver lookup
                    result.errors.push(`Waybill ${wb.id}: Skipped - waybill import not fully supported yet (requires driver mapping)`);
                } catch (e: any) {
                    result.errors.push(`Waybill ${wb.id}: ${e.message}`);
                }
            }
            results.push(result);
        }

        // Log audit entry
        try {
            await prisma.auditLog.create({
                data: {
                    actionType: 'CREATE',
                    entityType: 'SYSTEM',
                    userId: userId,
                }
            });
        } catch (auditError) {
            logger.warn({ auditError }, 'Failed to log import audit');
        }

        const totalCreated = results.reduce((sum, r) => sum + r.created, 0);
        const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);
        const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

        logger.info({ userId, totalCreated, totalUpdated, totalErrors }, 'Import completed');

        res.json({
            success: true,
            message: `Import completed: ${totalCreated} created, ${totalUpdated} updated, ${totalErrors} errors`,
            results
        });
    } catch (error) {
        logger.error({ error, userId }, 'Import failed');
        res.status(500).json({
            success: false,
            message: 'Import failed',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Transfer a user to a different organization
 * Optionally transfers ALL related data (employees, vehicles, etc.)
 * Allows moving admin user to a new org so old org can be deleted
 */
export const transferUser = async (req: Request, res: Response) => {
    const adminUserId = (req as any).user?.id;
    const { userId, targetOrganizationId, targetDepartmentId, createOrganization, transferAllData } = req.body;

    logger.info({ adminUserId, userId, targetOrganizationId, targetDepartmentId, createOrganization, transferAllData }, 'Transfer user requested');

    try {
        // Validate user exists
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { organization: true }
        });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        let targetOrgId = targetOrganizationId;

        // Create new organization if requested
        if (createOrganization && !targetOrganizationId) {
            const { name, shortName } = createOrganization;
            if (!name) {
                return res.status(400).json({ success: false, message: 'Organization name required' });
            }

            const newOrg = await prisma.organization.create({
                data: {
                    name,
                    shortName: shortName || name,
                    status: 'Active'
                }
            });
            targetOrgId = newOrg.id;
            logger.info({ orgId: newOrg.id, name }, 'Created new organization for transfer');
        }

        if (!targetOrgId) {
            return res.status(400).json({
                success: false,
                message: 'Either targetOrganizationId or createOrganization is required'
            });
        }

        // Verify target org exists
        const targetOrg = await prisma.organization.findUnique({
            where: { id: targetOrgId }
        });

        if (!targetOrg) {
            return res.status(404).json({ success: false, message: 'Target organization not found' });
        }

        const sourceOrgId = user.organizationId;
        const sourceOrgName = user.organization.shortName || user.organization.name;

        // Transfer counts for response
        const transferCounts: Record<string, number> = {};

        // REL-402: Transfer user AND revoke tokens in single transaction
        const txResult = await prisma.$transaction(async (tx) => {
            // 1) Update user organization and increment tokenVersion (AUTH-003)
            const updatedUser = await tx.user.update({
                where: { id: userId },
                data: {
                    organizationId: targetOrgId,
                    departmentId: targetDepartmentId ?? null,
                    tokenVersion: { increment: 1 }
                },
                select: { id: true, organizationId: true, departmentId: true, tokenVersion: true }
            });

            // 2) Revoke all active refresh tokens for this user
            const revokedTokens = await tx.refreshToken.updateMany({
                where: {
                    userId: userId,
                    revokedAt: null  // Only revoke active tokens
                },
                data: {
                    revokedAt: new Date()
                }
            });

            // 3) Create audit log
            await tx.auditLog.create({
                data: {
                    organizationId: targetOrgId,
                    userId: adminUserId,
                    actionType: 'UPDATE',
                    entityType: 'USER',
                    entityId: userId,
                    description: `Перенос пользователя из "${sourceOrgName}" в "${targetOrg.shortName || targetOrg.name}". Revoked tokens: ${revokedTokens.count}`,
                    oldValue: { organizationId: sourceOrgId, departmentId: user.departmentId, tokenVersion: user.tokenVersion },
                    newValue: { organizationId: updatedUser.organizationId, departmentId: updatedUser.departmentId, tokenVersion: updatedUser.tokenVersion }
                }
            });

            return { updatedUser, revokedCount: revokedTokens.count };
        });

        transferCounts.users = 1;
        const revokedTokensCount = txResult.revokedCount;
        logger.info({ userId, revokedCount: revokedTokensCount }, '[REL-402] Revoked refresh tokens after organization change');

        // If transferAllData is true, move all data from source org to target org
        if (transferAllData) {
            // Transfer ALL users from source org
            const usersResult = await prisma.user.updateMany({
                where: { organizationId: sourceOrgId },
                data: { organizationId: targetOrgId }
            });
            transferCounts.users = usersResult.count;

            // Transfer employees
            const employeesResult = await prisma.employee.updateMany({
                where: { organizationId: sourceOrgId },
                data: { organizationId: targetOrgId }
            });
            transferCounts.employees = employeesResult.count;

            // Transfer vehicles
            const vehiclesResult = await prisma.vehicle.updateMany({
                where: { organizationId: sourceOrgId },
                data: { organizationId: targetOrgId }
            });
            transferCounts.vehicles = vehiclesResult.count;

            // Transfer blank batches
            const blankBatchesResult = await prisma.blankBatch.updateMany({
                where: { organizationId: sourceOrgId },
                data: { organizationId: targetOrgId }
            });
            transferCounts.blankBatches = blankBatchesResult.count;

            // Transfer blanks
            const blanksResult = await prisma.blank.updateMany({
                where: { organizationId: sourceOrgId },
                data: { organizationId: targetOrgId }
            });
            transferCounts.blanks = blanksResult.count;

            // Transfer fuel cards
            const fuelCardsResult = await prisma.fuelCard.updateMany({
                where: { organizationId: sourceOrgId },
                data: { organizationId: targetOrgId }
            });
            transferCounts.fuelCards = fuelCardsResult.count;

            // Transfer stock items
            const stockItemsResult = await prisma.stockItem.updateMany({
                where: { organizationId: sourceOrgId },
                data: { organizationId: targetOrgId }
            });
            transferCounts.stockItems = stockItemsResult.count;

            // Transfer stock movements
            const stockMovementsResult = await prisma.stockMovement.updateMany({
                where: { organizationId: sourceOrgId },
                data: { organizationId: targetOrgId }
            });
            transferCounts.stockMovements = stockMovementsResult.count;

            // Transfer warehouses
            const warehousesResult = await prisma.warehouse.updateMany({
                where: { organizationId: sourceOrgId },
                data: { organizationId: targetOrgId }
            });
            transferCounts.warehouses = warehousesResult.count;

            // Transfer waybills
            const waybillsResult = await prisma.waybill.updateMany({
                where: { organizationId: sourceOrgId },
                data: { organizationId: targetOrgId }
            });
            transferCounts.waybills = waybillsResult.count;

            // Transfer departments
            const departmentsResult = await prisma.department.updateMany({
                where: { organizationId: sourceOrgId },
                data: { organizationId: targetOrgId }
            });
            transferCounts.departments = departmentsResult.count;

            // Transfer audit logs  
            const auditLogsResult = await prisma.auditLog.updateMany({
                where: { organizationId: sourceOrgId },
                data: { organizationId: targetOrgId }
            });
            transferCounts.auditLogs = auditLogsResult.count;

            logger.info({ sourceOrgId, targetOrgId, transferCounts }, 'All organization data transferred');
        }

        // Check if source org is now empty
        const remainingUsers = await prisma.user.count({
            where: { organizationId: sourceOrgId }
        });
        const remainingEmployees = await prisma.employee.count({
            where: { organizationId: sourceOrgId }
        });
        const remainingVehicles = await prisma.vehicle.count({
            where: { organizationId: sourceOrgId }
        });
        const remainingBlanks = await prisma.blank.count({
            where: { organizationId: sourceOrgId }
        });
        const remainingWaybills = await prisma.waybill.count({
            where: { organizationId: sourceOrgId }
        });

        const canDeleteSourceOrg = remainingUsers === 0 && remainingEmployees === 0 &&
            remainingVehicles === 0 && remainingBlanks === 0 &&
            remainingWaybills === 0;

        logger.info({
            userId,
            userEmail: user.email,
            fromOrg: sourceOrgName,
            toOrg: targetOrg.shortName || targetOrg.name,
            sourceOrgRemainingUsers: remainingUsers,
            transferAllData,
            transferCounts,
            canDeleteSourceOrg
        }, 'User transferred successfully');

        res.json({
            success: true,
            message: `User ${user.email} transferred to ${targetOrg.shortName || targetOrg.name}`,
            data: {
                userId,
                userEmail: user.email,
                fromOrganizationId: sourceOrgId,
                fromOrganizationName: sourceOrgName,
                toOrganizationId: targetOrgId,
                toOrganizationName: targetOrg.shortName || targetOrg.name,
                sourceOrganizationEmpty: remainingUsers === 0,
                canDeleteSourceOrg,
                transferCounts,
                remainingInSourceOrg: {
                    users: remainingUsers,
                    employees: remainingEmployees,
                    vehicles: remainingVehicles,
                    blanks: remainingBlanks,
                    waybills: remainingWaybills
                }
            }
        });
    } catch (error) {
        logger.error({ error, adminUserId, userId }, 'Transfer user failed');
        res.status(500).json({
            success: false,
            message: 'Transfer failed',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Transfer ALL data from one organization to another
 * This is a direct transfer without needing a specific user
 */
export const transferOrganizationData = async (req: Request, res: Response) => {
    const adminUserId = (req as any).user?.id;
    const { sourceOrganizationId, targetOrganizationId } = req.body;

    logger.info({ adminUserId, sourceOrganizationId, targetOrganizationId }, 'Transfer organization data requested');

    if (!sourceOrganizationId || !targetOrganizationId) {
        return res.status(400).json({
            success: false,
            message: 'sourceOrganizationId and targetOrganizationId are required'
        });
    }

    if (sourceOrganizationId === targetOrganizationId) {
        return res.status(400).json({
            success: false,
            message: 'Source and target organizations must be different'
        });
    }

    try {
        // Verify both organizations exist
        const [sourceOrg, targetOrg] = await Promise.all([
            prisma.organization.findUnique({ where: { id: sourceOrganizationId } }),
            prisma.organization.findUnique({ where: { id: targetOrganizationId } })
        ]);

        if (!sourceOrg) {
            return res.status(404).json({ success: false, message: 'Source organization not found' });
        }
        if (!targetOrg) {
            return res.status(404).json({ success: false, message: 'Target organization not found' });
        }

        // Transfer counts for response
        const transferCounts: Record<string, number> = {};

        // Transfer ALL users from source org
        const usersResult = await prisma.user.updateMany({
            where: { organizationId: sourceOrganizationId },
            data: { organizationId: targetOrganizationId }
        });
        transferCounts.users = usersResult.count;

        // Transfer employees
        const employeesResult = await prisma.employee.updateMany({
            where: { organizationId: sourceOrganizationId },
            data: { organizationId: targetOrganizationId }
        });
        transferCounts.employees = employeesResult.count;

        // Transfer vehicles
        const vehiclesResult = await prisma.vehicle.updateMany({
            where: { organizationId: sourceOrganizationId },
            data: { organizationId: targetOrganizationId }
        });
        transferCounts.vehicles = vehiclesResult.count;

        // Transfer blank batches
        const blankBatchesResult = await prisma.blankBatch.updateMany({
            where: { organizationId: sourceOrganizationId },
            data: { organizationId: targetOrganizationId }
        });
        transferCounts.blankBatches = blankBatchesResult.count;

        // Transfer blanks
        const blanksResult = await prisma.blank.updateMany({
            where: { organizationId: sourceOrganizationId },
            data: { organizationId: targetOrganizationId }
        });
        transferCounts.blanks = blanksResult.count;

        // Transfer fuel cards
        const fuelCardsResult = await prisma.fuelCard.updateMany({
            where: { organizationId: sourceOrganizationId },
            data: { organizationId: targetOrganizationId }
        });
        transferCounts.fuelCards = fuelCardsResult.count;

        // Transfer stock items
        const stockItemsResult = await prisma.stockItem.updateMany({
            where: { organizationId: sourceOrganizationId },
            data: { organizationId: targetOrganizationId }
        });
        transferCounts.stockItems = stockItemsResult.count;

        // Transfer stock movements
        const stockMovementsResult = await prisma.stockMovement.updateMany({
            where: { organizationId: sourceOrganizationId },
            data: { organizationId: targetOrganizationId }
        });
        transferCounts.stockMovements = stockMovementsResult.count;

        // Transfer warehouses
        const warehousesResult = await prisma.warehouse.updateMany({
            where: { organizationId: sourceOrganizationId },
            data: { organizationId: targetOrganizationId }
        });
        transferCounts.warehouses = warehousesResult.count;

        // Transfer waybills
        const waybillsResult = await prisma.waybill.updateMany({
            where: { organizationId: sourceOrganizationId },
            data: { organizationId: targetOrganizationId }
        });
        transferCounts.waybills = waybillsResult.count;

        // Transfer departments
        const departmentsResult = await prisma.department.updateMany({
            where: { organizationId: sourceOrganizationId },
            data: { organizationId: targetOrganizationId }
        });
        transferCounts.departments = departmentsResult.count;

        // Transfer audit logs  
        const auditLogsResult = await prisma.auditLog.updateMany({
            where: { organizationId: sourceOrganizationId },
            data: { organizationId: targetOrganizationId }
        });
        transferCounts.auditLogs = auditLogsResult.count;

        logger.info({ sourceOrganizationId, targetOrganizationId, transferCounts }, 'All organization data transferred');

        res.json({
            success: true,
            message: `Все данные перенесены из "${sourceOrg.shortName || sourceOrg.name}" в "${targetOrg.shortName || targetOrg.name}"`,
            data: {
                sourceOrganizationId,
                sourceOrganizationName: sourceOrg.shortName || sourceOrg.name,
                targetOrganizationId,
                targetOrganizationName: targetOrg.shortName || targetOrg.name,
                transferCounts,
                canDeleteSourceOrg: true
            }
        });
    } catch (error) {
        logger.error({ error, adminUserId, sourceOrganizationId, targetOrganizationId }, 'Transfer organization data failed');
        res.status(500).json({
            success: false,
            message: 'Transfer failed',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * P0-4: STOCK-PERIOD-LOCK — Lock stock period for an organization
 */
export const lockStockPeriod = async (req: Request, res: Response) => {
    const { organizationId, lockedAt } = req.body;
    const userId = (req as any).user?.userId;

    if (!organizationId || !lockedAt) {
        return res.status(400).json({ success: false, message: 'organizationId and lockedAt are required' });
    }

    try {
        const date = new Date(lockedAt);
        if (isNaN(date.getTime())) {
            return res.status(400).json({ success: false, message: 'Invalid lockedAt date' });
        }

        const org = await prisma.organization.update({
            where: { id: organizationId },
            data: { stockLockedAt: date }
        });

        await prisma.auditLog.create({
            data: {
                organizationId,
                userId,
                actionType: 'UPDATE',
                entityType: 'Organization',
                entityId: organizationId,
                description: `Stock period locked at ${date.toISOString()}`,
                newValue: { stockLockedAt: date }
            }
        });

        res.json({ success: true, data: org });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * P0-4: STOCK-PERIOD-LOCK — Unlock stock period for an organization
 */
export const unlockStockPeriod = async (req: Request, res: Response) => {
    const { organizationId } = req.body;
    const userId = (req as any).user?.userId;

    if (!organizationId) {
        return res.status(400).json({ success: false, message: 'organizationId is required' });
    }

    try {
        const org = await prisma.organization.update({
            where: { id: organizationId },
            data: { stockLockedAt: null }
        });

        await prisma.auditLog.create({
            data: {
                organizationId,
                userId,
                actionType: 'UPDATE',
                entityType: 'Organization',
                entityId: organizationId,
                description: 'Stock period unlocked',
                newValue: { stockLockedAt: null }
            }
        });

        res.json({ success: true, data: org });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

