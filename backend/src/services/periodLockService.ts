// services/periodLockService.ts
// PERIOD-LOCK-001: Защита целостности данных за закрытые периоды

import { PrismaClient, WaybillStatus } from '@prisma/client';
import crypto from 'crypto';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// ============================================================================
// КАНОНИЗАЦИЯ И ХЭШИРОВАНИЕ
// ============================================================================

/**
 * Рекурсивная канонизация объекта для детерминированного хэша.
 * - Сортирует ключи объектов
 * - Исключает технические поля (createdAt, updatedAt)
 */
function canonicalize(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map(canonicalize);
    if (typeof obj === 'object') {
        const excludeKeys = ['createdAt', 'updatedAt', '__ui_selected'];
        return Object.keys(obj)
            .filter(key => !excludeKeys.includes(key))
            .sort()
            .reduce((acc, key) => {
                acc[key] = canonicalize(obj[key]);
                return acc;
            }, {} as Record<string, any>);
    }
    return obj;
}

/**
 * Вычисляет SHA-256 хэш для массива данных.
 * Данные сортируются по ID и канонизируются перед хэшированием.
 */
function computeHash(data: any[]): { hash: string; count: number } {
    // Сортировка по ID для детерминированности
    const sorted = [...data].sort((a, b) => {
        const idA = a.id || '';
        const idB = b.id || '';
        return idA.localeCompare(idB);
    });

    const canonical = canonicalize(sorted);
    const json = JSON.stringify(canonical);
    const hash = crypto.createHash('sha256').update(json).digest('hex');

    return { hash, count: sorted.length };
}

// ============================================================================
// СБОР ДАННЫХ ЗА ПЕРИОД
// ============================================================================

/**
 * Собирает все проведённые документы за указанный период.
 * @param organizationId ID организации
 * @param period Формат YYYY-MM
 */
async function getDataForPeriod(organizationId: string, period: string) {
    // Диапазон дат для периода
    const startDate = new Date(`${period}-01T00:00:00.000Z`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    // Путевые листы (POSTED)
    const waybills = await prisma.waybill.findMany({
        where: {
            organizationId,
            status: WaybillStatus.POSTED,
            date: {
                gte: startDate,
                lt: endDate,
            },
        },
        orderBy: { id: 'asc' },
    });

    // Складские движения (не voided)
    const stockMovements = await prisma.stockMovement.findMany({
        where: {
            organizationId,
            isVoid: false,
            occurredAt: {
                gte: startDate,
                lt: endDate,
            },
        },
        orderBy: { id: 'asc' },
    });

    // Объединяем для хэширования
    return [...waybills, ...stockMovements];
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Проверяет, закрыт ли период для указанной даты.
 * Используется для enforcement перед любыми изменениями.
 */
export async function checkPeriodLock(organizationId: string, dateStr: string): Promise<boolean> {
    if (!dateStr || dateStr.length < 7) return false;

    // Извлекаем YYYY-MM из даты
    const period = typeof dateStr === 'string'
        ? dateStr.substring(0, 7)
        : new Date(dateStr).toISOString().substring(0, 7);

    const count = await prisma.periodLock.count({
        where: { organizationId, period },
    });

    return count > 0;
}

/**
 * Получает список всех закрытых периодов для организации.
 */
export async function getPeriodLocks(organizationId: string) {
    return prisma.periodLock.findMany({
        where: { organizationId },
        orderBy: { period: 'desc' },
        include: {
            lockedByUser: {
                select: { id: true, fullName: true, email: true },
            },
        },
    });
}

/**
 * Закрывает период: собирает данные, вычисляет хэш, создаёт блокировку.
 */
export async function closePeriod(
    organizationId: string,
    period: string,
    userId: string,
    notes?: string
) {
    // Валидация формата периода
    if (!/^\d{4}-\d{2}$/.test(period)) {
        throw new Error('Неверный формат периода. Используйте YYYY-MM');
    }

    // Проверка: не закрыт ли уже?
    const existing = await prisma.periodLock.findUnique({
        where: { organizationId_period: { organizationId, period } },
    });
    if (existing) {
        throw new Error(`Период ${period} уже закрыт`);
    }

    // Сбор данных
    const data = await getDataForPeriod(organizationId, period);
    if (data.length === 0) {
        throw new Error(`Нет проведённых документов за период ${period}`);
    }

    // Вычисление хэша
    const { hash, count } = computeHash(data);

    // Создание блокировки
    const lock = await prisma.periodLock.create({
        data: {
            organizationId,
            period,
            lockedByUserId: userId,
            dataHash: hash,
            recordCount: count,
            notes,
        },
    });

    logger.info(`[PeriodLock] Closed period ${period} for org ${organizationId}. Hash: ${hash.substring(0, 16)}..., Records: ${count}`);

    return lock;
}

/**
 * Проверяет целостность закрытого периода.
 * Возвращает результат сравнения текущего хэша с сохранённым.
 */
export async function verifyPeriod(lockId: string) {
    const lock = await prisma.periodLock.findUnique({
        where: { id: lockId },
    });
    if (!lock) {
        throw new Error('Блокировка периода не найдена');
    }

    // Сбор текущих данных
    const data = await getDataForPeriod(lock.organizationId, lock.period);

    // Быстрая проверка количества записей
    if (data.length !== lock.recordCount) {
        const result = {
            isValid: false,
            currentHash: 'count_mismatch',
            storedHash: lock.dataHash,
            details: `Количество записей изменилось: было ${lock.recordCount}, стало ${data.length}`,
        };

        // Обновляем статус проверки
        await prisma.periodLock.update({
            where: { id: lockId },
            data: { lastVerifiedAt: new Date(), lastVerifyResult: false },
        });

        logger.warn(`[PeriodLock] Verification FAILED for ${lock.period}: ${result.details}`);
        return result;
    }

    // Пересчёт хэша
    const { hash } = computeHash(data);
    const isValid = hash === lock.dataHash;

    // Обновляем статус проверки
    await prisma.periodLock.update({
        where: { id: lockId },
        data: { lastVerifiedAt: new Date(), lastVerifyResult: isValid },
    });

    const result = {
        isValid,
        currentHash: hash,
        storedHash: lock.dataHash,
        details: isValid ? undefined : 'Хэш данных не совпадает — данные были изменены',
    };

    logger.info(`[PeriodLock] Verification ${isValid ? 'PASSED' : 'FAILED'} for ${lock.period}`);
    return result;
}

/**
 * Снимает блокировку периода (только для администраторов).
 */
export async function deletePeriodLock(lockId: string, userId: string) {
    const lock = await prisma.periodLock.findUnique({
        where: { id: lockId },
    });
    if (!lock) {
        throw new Error('Блокировка периода не найдена');
    }

    await prisma.periodLock.delete({
        where: { id: lockId },
    });

    logger.warn(`[PeriodLock] Lock REMOVED for period ${lock.period} by user ${userId}`);

    return { success: true, period: lock.period };
}
