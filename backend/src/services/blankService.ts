import { BlankStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../db/prisma';

export interface CreateBatchDto {
    series: string;
    numberFrom: number;
    numberTo: number;
    departmentId?: string;
}

export interface IssueBlankDto {
    series: string;
    number: number;
    driverId?: string;
    vehicleId?: string;
}

export async function createBatch(organizationId: string, userId: string, data: CreateBatchDto) {
    // 1. Create Batch Record
    const batch = await prisma.blankBatch.create({
        data: {
            organizationId,
            departmentId: data.departmentId,
            series: data.series,
            numberFrom: data.numberFrom,
            numberTo: data.numberTo,
            createdByUserId: userId
        }
    });

    // 2. Generate individual blanks
    // This can be heavy for large batches, so we might want to do it in chunks or background job in real prod
    // For now (up to 1000 items) it's fine.
    const blanksData = [];
    for (let i = data.numberFrom; i <= data.numberTo; i++) {
        blanksData.push({
            organizationId,
            departmentId: data.departmentId,
            batchId: batch.id,
            series: data.series,
            number: i,
            status: BlankStatus.AVAILABLE
        });
    }

    await prisma.blank.createMany({
        data: blanksData,
        skipDuplicates: true // In case some numbers already exist (shouldn't happen if validated)
    });

    return batch;
}

export async function listBatches(organizationId?: string) {
    const batches = await prisma.blankBatch.findMany({
        where: organizationId ? { organizationId } : undefined,  // No filter for admin
        orderBy: { createdAt: 'desc' }
    });

    // Transform to match frontend WaybillBlankBatch interface
    return batches.map(batch => ({
        id: batch.id,
        organizationId: batch.organizationId,
        series: batch.series || '',
        startNumber: batch.numberFrom,
        endNumber: batch.numberTo,
        status: 'active',
        notes: batch.departmentId ? `Отдел: ${batch.departmentId}` : undefined,
        createdAt: batch.createdAt.toISOString(),
        updatedAt: batch.createdAt.toISOString()  // BlankBatch doesn't have updatedAt
    }));
}

export async function materializeBatch(organizationId: string | undefined, batchId: string) {
    // Find the batch (admin can find any batch, others only their org)
    const batch = await prisma.blankBatch.findFirst({
        where: organizationId ? { id: batchId, organizationId } : { id: batchId }
    });

    if (!batch) {
        throw new Error('Партия бланков не найдена');
    }

    // Check if blanks already exist for this batch
    const existingCount = await prisma.blank.count({
        where: { batchId }
    });

    if (existingCount > 0) {
        return {
            message: 'Бланки уже материализованы',
            count: existingCount,
            batch
        };
    }

    // Generate individual blanks (same logic as createBatch)
    const blanksData = [];
    for (let i = batch.numberFrom; i <= batch.numberTo; i++) {
        blanksData.push({
            organizationId: batch.organizationId,
            departmentId: batch.departmentId,
            batchId: batch.id,
            series: batch.series || '',
            number: i,
            status: BlankStatus.AVAILABLE
        });
    }

    await prisma.blank.createMany({
        data: blanksData,
        skipDuplicates: true
    });

    return {
        message: 'Бланки успешно материализованы',
        count: blanksData.length,
        batch
    };
}

export async function listBlanks(organizationId: string | undefined, filters: { series?: string; status?: BlankStatus; page?: number; limit?: number }) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const where = {
        ...(organizationId ? { organizationId } : {}),  // Admin sees all orgs
        series: filters.series ? { contains: filters.series } : undefined,
        status: filters.status
    };

    const [total, rawItems] = await Promise.all([
        prisma.blank.count({ where }),
        prisma.blank.findMany({
            where,
            skip,
            take: limit,
            orderBy: [{ series: 'asc' }, { number: 'asc' }],
            include: {
                issuedToDriver: { include: { employee: true } },
                issuedToVehicle: true,
                waybills: { select: { id: true, number: true }, take: 1 }
            }
        })
    ]);

    // Map to frontend format
    const items = rawItems.map(b => ({
        id: b.id,
        organizationId: b.organizationId,
        batchId: b.batchId || '',
        series: b.series || '',
        number: b.number,
        status: b.status.toLowerCase(), // Prisma enum to lowercase
        // Map Driver.employeeId to ownerEmployeeId for frontend compatibility
        ownerEmployeeId: b.issuedToDriver?.employeeId || null,
        ownerName: b.issuedToDriver?.employee?.shortName || b.issuedToDriver?.employee?.fullName || null,
        usedInWaybillId: b.waybills?.[0]?.number || null,
        usedAt: b.usedAt?.toISOString() || null,
        issuedAt: b.issuedAt?.toISOString() || null,
    }));

    return { total, items, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function issueBlank(organizationId: string, data: IssueBlankDto) {
    // Find the blank
    const blank = await prisma.blank.findFirst({
        where: {
            organizationId,
            series: data.series,
            number: data.number
        }
    });

    if (!blank) {
        throw new Error('Бланк не найден');
    }

    if (blank.status !== BlankStatus.AVAILABLE) {
        throw new Error(`Бланк не доступен (статус: ${blank.status})`);
    }

    // REL-702: Validate driverId references Driver table, not Employee
    let actualDriverId = data.driverId;
    if (data.driverId) {
        // First try direct Driver lookup
        let driver = await prisma.driver.findUnique({
            where: { id: data.driverId }
        });

        if (!driver) {
            // Fallback: maybe frontend sent Employee.id instead of Driver.id
            driver = await prisma.driver.findUnique({
                where: { employeeId: data.driverId }
            });
            if (driver) {
                console.warn(`[REL-702] WARNING: issueBlank received employeeId '${data.driverId}' instead of driverId '${driver.id}'. Frontend should send Driver.id.`);
                actualDriverId = driver.id;
            }
        }

        if (!driver && !actualDriverId) {
            throw new Error('Водитель не найден');
        }
    }

    // Update blank
    return prisma.blank.update({
        where: { id: blank.id },
        data: {
            status: BlankStatus.ISSUED,
            issuedToDriverId: actualDriverId || null,
            issuedToVehicleId: data.vehicleId,
            issuedAt: new Date()
        }
    });
}

// Issue blanks by range (for bulk issue from frontend)
export interface IssueBlanksRangeDto {
    batchId: string;
    driverId: string;
    numberFrom: number;
    numberTo: number;
}

export async function issueBlanksRange(organizationId: string | undefined, data: IssueBlanksRangeDto) {
    // Find blanks in the given range that belong to this batch
    const blanks = await prisma.blank.findMany({
        where: {
            batchId: data.batchId,
            number: {
                gte: data.numberFrom,
                lte: data.numberTo
            },
            status: BlankStatus.AVAILABLE,
            ...(organizationId ? { organizationId } : {})
        }
    });

    if (blanks.length === 0) {
        throw new Error('Нет доступных бланков в указанном диапазоне');
    }

    // Find the driver record for this employee, or create if missing
    let driver = await prisma.driver.findUnique({
        where: { employeeId: data.driverId }
    });

    if (!driver) {
        // Check if employee exists
        const employee = await prisma.employee.findUnique({
            where: { id: data.driverId }
        });

        if (!employee) {
            throw new Error('Сотрудник не найден');
        }

        // Auto-create Driver record for this employee
        console.log('[issueBlanksRange] Auto-creating Driver record for employee:', data.driverId);
        driver = await prisma.driver.create({
            data: {
                employeeId: data.driverId,
                licenseNumber: employee.documentNumber || 'НЕ УКАЗАНО'
            }
        });
    }

    // Update all blanks
    const result = await prisma.blank.updateMany({
        where: {
            id: { in: blanks.map(b => b.id) }
        },
        data: {
            status: BlankStatus.ISSUED,
            issuedToDriverId: driver.id,
            issuedAt: new Date()
        }
    });

    return {
        issued: result.count,
        message: `Выдано ${result.count} бланков водителю`
    };
}

// --- Driver Blank Summary ---

export interface DriverBlankRange {
    series: string;
    numberStart: number;
    numberEnd: number;
    count: number;
}

export interface DriverBlankSummary {
    active: DriverBlankRange[];
    used: DriverBlankRange[];
    spoiled: DriverBlankRange[];
}

function buildBlankRanges(blanks: { series: string | null; number: number }[]): DriverBlankRange[] {
    const items = blanks
        .filter(b => b.series && b.number != null)
        .map(b => ({ series: b.series!, num: b.number }))
        .sort((a, b) => {
            const bySeries = a.series.localeCompare(b.series);
            if (bySeries !== 0) return bySeries;
            return a.num - b.num;
        });

    const ranges: DriverBlankRange[] = [];
    let current: DriverBlankRange | null = null;

    for (const item of items) {
        if (
            !current ||
            item.series !== current.series ||
            item.num !== current.numberEnd + 1
        ) {
            if (current) ranges.push(current);
            current = {
                series: item.series,
                numberStart: item.num,
                numberEnd: item.num,
                count: 1
            };
        } else {
            current.numberEnd = item.num;
            current.count += 1;
        }
    }

    if (current) ranges.push(current);
    return ranges;
}

export async function getDriverSummary(organizationId: string, employeeId: string): Promise<DriverBlankSummary> {
    console.log(`📊 [blankService] Fetching summary for employeeId: ${employeeId} in org: ${organizationId}`);

    // First find the Driver record by employeeId and check organization
    const driver = await prisma.driver.findFirst({
        where: {
            employeeId,
            employee: { organizationId }
        }
    });

    if (!driver) {
        console.warn(`⚠️ [blankService] No Driver record found for employeeId: ${employeeId}`);
        // No driver record means no blanks issued
        return { active: [], used: [], spoiled: [] };
    }

    console.log(`✅ [blankService] Found Driver record: ${driver.id} for employeeId: ${employeeId}`);

    // Find all blanks issued to this driver
    const blanks = await prisma.blank.findMany({
        where: { issuedToDriverId: driver.id },
        select: { series: true, number: true, status: true }
    });

    console.log(`📋[blankService] Found ${blanks.length} total blanks for driver: ${driver.id} `);

    // Categorize by status
    // Include both ISSUED and RESERVED in active blanks
    const activeBlanks = blanks.filter(b => b.status === BlankStatus.ISSUED || b.status === BlankStatus.RESERVED);
    const usedBlanks = blanks.filter(b => b.status === BlankStatus.USED);
    const spoiledBlanks = blanks.filter(b => b.status === BlankStatus.SPOILED);

    console.log(`📈[blankService] Categorized: active = ${activeBlanks.length}, used = ${usedBlanks.length}, spoiled = ${spoiledBlanks.length} `);

    return {
        active: buildBlankRanges(activeBlanks),
        used: buildBlankRanges(usedBlanks),
        spoiled: buildBlankRanges(spoiledBlanks)
    };
}

/**
 * REL-501: Get available blanks for driver (ISSUED status only)
 * Returns list of blanks that can be selected for waybill creation.
 * 
 * @param driverId - Driver ID (references Driver table, not Employee)
 * @returns Array of available blanks with id, series, number
 */
export async function getAvailableBlanksForDriver(organizationId: string, driverId: string): Promise<Array<{
    id: string;
    series: string;
    number: number;
    formattedNumber: string;
}>> {
    console.log(`🎫[blankService] getAvailableBlanksForDriver called for driverId: ${driverId} in org: ${organizationId} `);

    const blanks = await prisma.blank.findMany({
        where: {
            organizationId,
            issuedToDriverId: driverId,
            status: BlankStatus.ISSUED  // Only ISSUED, not RESERVED or USED
        },
        select: {
            id: true,
            series: true,
            number: true
        },
        orderBy: [
            { series: 'asc' },
            { number: 'asc' }
        ]
    });

    console.log(`📋[blankService] Found ${blanks.length} available blanks for driverId: ${driverId} `);

    return blanks.map(b => ({
        id: b.id,
        series: b.series || '',
        number: b.number,
        formattedNumber: `${b.series || ''} ${String(b.number).padStart(6, '0')} `.trim()
    }));
}

// ============================================================================
// BLS-201: Atomic Blank Lifecycle Operations
// ============================================================================

export interface ReserveBlankResult {
    blank: {
        id: string;
        series: string;
        number: number;
    };
    success: boolean;
}

/**
 * Reserve the next available blank for a driver atomically.
 * Uses transaction with row-level locking (FOR UPDATE) to prevent race conditions.
 * 
 * @param organizationId - Organization ID
 * @param driverId - Driver ID (references Driver table, not Employee)
 * @param departmentId - Optional department filter
 * @returns Reserved blank info
 */
export async function reserveNextBlankForDriver(
    organizationId: string,
    driverId: string,
    departmentId?: string
): Promise<ReserveBlankResult> {
    return prisma.$transaction(async (tx) => {
        // Find the next available blank with row lock (FOR UPDATE)
        // This raw query locks the row so parallel transactions wait
        // BLS-FIX: Use Prisma.sql for conditional department filtering
        // Column names must be quoted camelCase to match Prisma schema
        const { Prisma } = require('@prisma/client');

        const departmentFilter = departmentId
            ? Prisma.sql`AND "departmentId" = ${departmentId} `
            : Prisma.empty;

        const blanks = await tx.$queryRaw<Array<{ id: string; series: string; number: number }>>`
            SELECT id, series, number 
            FROM blanks 
            WHERE "organizationId" = ${organizationId}
              AND status = 'AVAILABLE'
              ${departmentFilter}
            ORDER BY series ASC, number ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
        `;



        if (blanks.length === 0) {
            throw new Error('Нет доступных бланков для резервирования');
        }

        const blank = blanks[0];

        // Update blank status to RESERVED
        await tx.blank.update({
            where: { id: blank.id },
            data: {
                status: BlankStatus.RESERVED,
                issuedToDriverId: driverId,
                issuedAt: new Date()
            }
        });

        return {
            blank: {
                id: blank.id,
                series: blank.series,
                number: blank.number
            },
            success: true
        };
    }, {
        isolationLevel: 'Serializable', // Highest isolation for atomicity
        maxWait: 5000, // 5s max wait for lock
        timeout: 10000 // 10s transaction timeout
    });
}

/**
 * Reserve a specific blank for a driver.
 */
export async function reserveSpecificBlank(
    organizationId: string,
    blankId: string,
    driverId: string,
    departmentId?: string
): Promise<ReserveBlankResult> {
    return prisma.$transaction(async (tx) => {
        // Find blank with lock
        const blank = await tx.blank.findFirst({
            where: {
                id: blankId,
                organizationId,
                status: BlankStatus.AVAILABLE,
                ...(departmentId ? { departmentId } : {})
            }
        });

        if (!blank) {
            throw new Error('Бланк не найден или недоступен');
        }

        // Reserve it
        await tx.blank.update({
            where: { id: blank.id },
            data: {
                status: BlankStatus.RESERVED,
                issuedToDriverId: driverId,
                issuedAt: new Date()
            }
        });

        return {
            blank: {
                id: blank.id,
                series: blank.series || '',
                number: blank.number
            },
            success: true
        };
    });
}

/**
 * Release a reserved blank back to available.
 * Only blanks in RESERVED status can be released.
 */
export async function releaseBlank(
    organizationId: string,
    blankId: string
): Promise<{ success: boolean; message: string }> {
    return prisma.$transaction(async (tx) => {
        const blank = await tx.blank.findFirst({
            where: {
                id: blankId,
                organizationId,
                status: BlankStatus.RESERVED
            }
        });

        if (!blank) {
            throw new Error('Бланк не найден или не находится в статусе RESERVED');
        }

        await tx.blank.update({
            where: { id: blank.id },
            data: {
                status: BlankStatus.AVAILABLE,
                issuedToDriverId: null,
                issuedAt: null
            }
        });

        return { success: true, message: `Бланк ${blank.series} -${blank.number} освобождён` };
    });
}

/**
 * Mark a blank as used (after waybill is created).
 * Only ISSUED or RESERVED blanks can be marked as used.
 */
export async function useBlank(
    organizationId: string,
    blankId: string
): Promise<{ success: boolean; message: string }> {
    return prisma.$transaction(async (tx) => {
        const blank = await tx.blank.findFirst({
            where: {
                id: blankId,
                organizationId,
                status: { in: [BlankStatus.ISSUED, BlankStatus.RESERVED] }
            }
        });

        if (!blank) {
            throw new Error('Бланк не найден или в неподходящем статусе для использования');
        }

        await tx.blank.update({
            where: { id: blank.id },
            data: {
                status: BlankStatus.USED,
                usedAt: new Date()
            }
        });

        return { success: true, message: `Бланк ${blank.series} -${blank.number} использован` };
    });
}

/**
 * Spoil options
 */
export interface SpoilBlankOptions {
    reason: 'damaged' | 'misprint' | 'lost' | 'other';
    note?: string;
    userId?: string;
}

/**
 * Spoil a blank (mark as unusable).
 * Can only spoil AVAILABLE, ISSUED, or RESERVED blanks.
 */
export async function spoilBlank(
    organizationId: string,
    blankId: string,
    options: SpoilBlankOptions
): Promise<{ success: boolean; message: string }> {
    return prisma.$transaction(async (tx) => {
        const blank = await tx.blank.findFirst({
            where: {
                id: blankId,
                organizationId,
                status: { in: [BlankStatus.AVAILABLE, BlankStatus.ISSUED, BlankStatus.RESERVED] }
            }
        });

        if (!blank) {
            throw new Error('Бланк не найден или уже использован/испорчен');
        }

        await tx.blank.update({
            where: { id: blank.id },
            data: {
                status: BlankStatus.SPOILED,
                damagedReason: `${options.reason}: ${options.note || ''} `
            }
        });

        // Create audit log
        await tx.auditLog.create({
            data: {
                organizationId,
                userId: options.userId || 'system',
                actionType: 'STATUS_CHANGE',
                entityType: 'BLANK',
                entityId: blank.id,
                description: `Бланк ${blank.series} -${blank.number} списан: ${options.reason} `,
                oldValue: { status: blank.status },
                newValue: { status: BlankStatus.SPOILED, reason: options.reason }
            }
        });

        return { success: true, message: `Бланк ${blank.series} -${blank.number} списан` };
    });
}
