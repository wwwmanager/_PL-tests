// Audit Service - Save and retrieve audit logs
import { AppDataSource } from '../db/data-source';
import { AuditLog } from '../entities/AuditLog';
import { AuditActionType } from '../entities/enums';

const auditRepo = () => AppDataSource.getRepository(AuditLog);

export interface CreateAuditLogDto {
    userId: string;
    action: AuditActionType;
    entityType: string;
    entityId?: string;
    changes?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
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

export async function createAuditLog(data: CreateAuditLogDto): Promise<AuditLog> {
    const log = auditRepo().create({
        userId: data.userId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId || null,
        changes: data.changes || null,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
    });

    return await auditRepo().save(log);
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

    const query = auditRepo()
        .createQueryBuilder('audit')
        .leftJoinAndSelect('audit.user', 'user')
        .orderBy('audit.createdAt', 'DESC');

    if (userId) {
        query.andWhere('audit.userId = :userId', { userId });
    }

    if (action) {
        query.andWhere('audit.action = :action', { action });
    }

    if (entityType) {
        query.andWhere('audit.entityType = :entityType', { entityType });
    }

    if (entityId) {
        query.andWhere('audit.entityId = :entityId', { entityId });
    }

    if (startDate) {
        query.andWhere('audit.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
        query.andWhere('audit.createdAt <= :endDate', { endDate });
    }

    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);

    const [logs, total] = await query.getManyAndCount();

    return {
        logs,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
}

export async function getAuditLogById(id: string): Promise<AuditLog | null> {
    return await auditRepo().findOne({
        where: { id },
        relations: { user: true },
    });
}

export async function getAuditLogStats() {
    const totalLogs = await auditRepo().count();

    const actionStats = await auditRepo()
        .createQueryBuilder('audit')
        .select('audit.action', 'action')
        .addSelect('COUNT(*)', 'count')
        .groupBy('audit.action')
        .getRawMany();

    const recentActivity = await auditRepo()
        .createQueryBuilder('audit')
        .where('audit.createdAt >= :date', {
            date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // last 7 days
        })
        .getCount();

    return {
        totalLogs,
        actionStats,
        recentActivity,
    };
}
