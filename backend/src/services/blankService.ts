import { PrismaClient, BlankStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

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

    const [total, items] = await Promise.all([
        prisma.blank.count({ where }),
        prisma.blank.findMany({
            where,
            skip,
            take: limit,
            orderBy: [{ series: 'asc' }, { number: 'asc' }],
            include: {
                issuedToDriver: { include: { employee: true } },
                issuedToVehicle: true
            }
        })
    ]);

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

    // Update blank
    return prisma.blank.update({
        where: { id: blank.id },
        data: {
            status: BlankStatus.ISSUED,
            issuedToDriverId: data.driverId,
            issuedToVehicleId: data.vehicleId,
            issuedAt: new Date()
        }
    });
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

export async function getDriverSummary(driverId: string): Promise<DriverBlankSummary> {
    // Find all blanks issued to this driver
    const blanks = await prisma.blank.findMany({
        where: { issuedToDriverId: driverId },
        select: { series: true, number: true, status: true }
    });

    // Categorize by status
    const activeBlanks = blanks.filter(b => b.status === BlankStatus.ISSUED);
    const usedBlanks = blanks.filter(b => b.status === BlankStatus.USED);
    const spoiledBlanks = blanks.filter(b => b.status === BlankStatus.SPOILED);

    return {
        active: buildBlankRanges(activeBlanks),
        used: buildBlankRanges(usedBlanks),
        spoiled: buildBlankRanges(spoiledBlanks)
    };
}

