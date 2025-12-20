/**
 * FUEL-SCHED-002: Advisory Locks for Multi-Instance Safety
 * 
 * Uses PostgreSQL advisory locks to ensure only one instance runs
 * a job at a time in multi-instance deployments.
 */
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// Lock keys for different jobs (use stable integers)
export const LOCK_KEYS = {
    FUEL_TOPUP_JOB: 1001,
} as const;

/**
 * Try to acquire an advisory lock (non-blocking)
 * Returns true if lock acquired, false otherwise
 */
export async function tryAcquireLock(lockKey: number): Promise<boolean> {
    try {
        const result = await prisma.$queryRaw<[{ pg_try_advisory_lock: boolean }]>`
            SELECT pg_try_advisory_lock(${lockKey})
        `;
        const acquired = result[0]?.pg_try_advisory_lock === true;

        if (acquired) {
            logger.debug({ lockKey }, '[Lock] Advisory lock acquired');
        } else {
            logger.debug({ lockKey }, '[Lock] Advisory lock not available (held by another instance)');
        }

        return acquired;
    } catch (error) {
        logger.error({ err: error, lockKey }, '[Lock] Failed to acquire advisory lock');
        return false;
    }
}

/**
 * Release an advisory lock
 * Returns true if lock was released, false if it wasn't held
 */
export async function releaseLock(lockKey: number): Promise<boolean> {
    try {
        const result = await prisma.$queryRaw<[{ pg_advisory_unlock: boolean }]>`
            SELECT pg_advisory_unlock(${lockKey})
        `;
        const released = result[0]?.pg_advisory_unlock === true;

        if (released) {
            logger.debug({ lockKey }, '[Lock] Advisory lock released');
        } else {
            logger.warn({ lockKey }, '[Lock] Advisory lock was not held');
        }

        return released;
    } catch (error) {
        logger.error({ err: error, lockKey }, '[Lock] Failed to release advisory lock');
        return false;
    }
}

/**
 * Execute a function with an advisory lock.
 * If lock cannot be acquired, returns null without executing.
 * Guarantees lock release even on exceptions.
 */
export async function withAdvisoryLock<T>(
    lockKey: number,
    fn: () => Promise<T>
): Promise<T | null> {
    const acquired = await tryAcquireLock(lockKey);

    if (!acquired) {
        return null;
    }

    try {
        return await fn();
    } finally {
        await releaseLock(lockKey);
    }
}
