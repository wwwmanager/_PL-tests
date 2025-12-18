// Audit Service - Save and retrieve audit logs
import { PrismaClient, Prisma, AuditActionType } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateAuditLogDto {
    userId: string;
    action: AuditActionType;
    entityType: string;
    entityId?: string;
    changes?: Record<string, any>; // Will be saved to newValue for now
    description?: string;
}

export interface AuditLogFilters {
    userId?: string;
    action?: AuditActionType;
    entityType?: string;
    entityId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
}

export async function createAuditLog(data: CreateAuditLogDto) {
    return prisma.auditLog.create({
        data: {
            userId: data.userId,
            actionType: data.action, // Map action -> actionType
            entityType: data.entityType,
            entityId: data.entityId || null,
            description: data.description || null,
            newValue: data.changes ? (data.changes as any) : Prisma.JsonNull,
        },
    });
}

export async function getAuditLogs(filters: AuditLogFilters = {}) {
    const {
        userId,
        action,
        entityType,
        entityId,
        startDate,
        endDate,
        page = 1,
        limit = 50,
    } = filters;

    const where: Prisma.AuditLogWhereInput = {};

    if (userId) {
        where.userId = userId;
    }

    if (action) {
        where.actionType = action; // Map action -> actionType
    }

    if (entityType) {
        where.entityType = entityType;
    }

    if (entityId) {
        where.entityId = entityId;
    }

    if (startDate) {
        where.createdAt = { ...where.createdAt as Prisma.DateTimeFilter, gte: startDate };
    }

    if (endDate) {
        where.createdAt = { ...where.createdAt as Prisma.DateTimeFilter, lte: endDate };
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
            where,
            include: {
                user: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
            skip,
            take: limit,
        }),
        prisma.auditLog.count({ where }),
    ]);

    return {
        logs,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
}

export async function getAuditLogById(id: string) {
    return prisma.auditLog.findUnique({
        where: { id },
        include: { user: true },
    });
}

export async function getAuditLogStats() {
    const totalLogs = await prisma.auditLog.count();

    const actionStats = await prisma.auditLog.groupBy({
        by: ['actionType'], // Map action -> actionType
        _count: {
            actionType: true,
        },
    });

    const recentActivity = await prisma.auditLog.count({
        where: {
            createdAt: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // last 7 days
            },
        },
    });

    return {
        totalLogs,
        actionStats: actionStats.map(stat => ({ action: stat.actionType, count: stat._count.actionType })),
        recentActivity,
    };
}
