/**
 * FUEL-SCHED-001 + FUEL-SCHED-002: Job Scheduler with Advisory Locks
 * 
 * Manages periodic execution of background jobs.
 * Controlled via environment variables:
 * - ENABLE_SCHEDULERS: true/false (default: false)
 * - FUEL_TOPUP_INTERVAL_MS: interval in ms (default: 60000 = 1 minute)
 * - USE_ADVISORY_LOCK: true/false (default: true) - for multi-instance safety
 */
import { runFuelCardTopUps, TopUpResult } from './fuelCardTopUpJob';
import { withAdvisoryLock, LOCK_KEYS } from './locks';
import { logger } from '../utils/logger';

interface SchedulerConfig {
    enabled: boolean;
    fuelTopUpIntervalMs: number;
    useAdvisoryLock: boolean;
}

function getSchedulerConfig(): SchedulerConfig {
    return {
        enabled: process.env.ENABLE_SCHEDULERS === 'true',
        fuelTopUpIntervalMs: parseInt(process.env.FUEL_TOPUP_INTERVAL_MS ?? '60000', 10),
        useAdvisoryLock: process.env.USE_ADVISORY_LOCK !== 'false', // default true
    };
}

let fuelTopUpIntervalId: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Core job execution logic
 */
async function runFuelTopUpJobCore(): Promise<TopUpResult> {
    const startTime = Date.now();

    logger.info('[Scheduler] Starting FuelTopUp job...');

    const result: TopUpResult = await runFuelCardTopUps();
    const durationMs = Date.now() - startTime;

    logger.info({
        processed: result.processed,
        toppedUp: result.toppedUp,
        skipped: result.skipped,
        errors: result.errors.length,
        durationMs,
    }, '[Scheduler] FuelTopUp job completed');

    if (result.errors.length > 0) {
        logger.warn({ errors: result.errors }, '[Scheduler] FuelTopUp job had errors');
    }

    return result;
}

/**
 * Executes the fuel card top-up job with timing, logging, and optional advisory lock
 */
async function executeFuelTopUpJob(): Promise<void> {
    const config = getSchedulerConfig();

    // Prevent overlapping runs within same instance
    if (isRunning) {
        logger.warn('[Scheduler] FuelTopUp job already running locally, skipping this tick');
        return;
    }

    isRunning = true;

    try {
        if (config.useAdvisoryLock) {
            // Use advisory lock for multi-instance safety
            const result = await withAdvisoryLock(LOCK_KEYS.FUEL_TOPUP_JOB, runFuelTopUpJobCore);

            if (result === null) {
                logger.info('[Scheduler] FuelTopUp job skipped - another instance holds the lock');
            }
        } else {
            // No lock, just run
            await runFuelTopUpJobCore();
        }
    } catch (error) {
        logger.error({ err: error }, '[Scheduler] FuelTopUp job failed');
    } finally {
        isRunning = false;
    }
}


/**
 * Starts all scheduled jobs.
 * Call this at server startup.
 */
export function startSchedulers(): void {
    const config = getSchedulerConfig();

    if (!config.enabled) {
        logger.info('[Scheduler] Schedulers disabled (ENABLE_SCHEDULERS != true)');
        return;
    }

    logger.info({
        fuelTopUpIntervalMs: config.fuelTopUpIntervalMs,
    }, '[Scheduler] Starting schedulers...');

    // Schedule fuel card top-up job
    fuelTopUpIntervalId = setInterval(executeFuelTopUpJob, config.fuelTopUpIntervalMs);

    // Run immediately on startup (optional, useful for testing)
    if (process.env.SCHEDULER_RUN_ON_START === 'true') {
        logger.info('[Scheduler] Running initial FuelTopUp job on startup');
        executeFuelTopUpJob();
    }

    logger.info('[Scheduler] Schedulers started successfully');
}

/**
 * Stops all scheduled jobs.
 * Call this on server shutdown.
 */
export function stopSchedulers(): void {
    logger.info('[Scheduler] Stopping schedulers...');

    if (fuelTopUpIntervalId) {
        clearInterval(fuelTopUpIntervalId);
        fuelTopUpIntervalId = null;
    }

    logger.info('[Scheduler] Schedulers stopped');
}

/**
 * Returns scheduler status for diagnostics
 */
export function getSchedulerStatus(): {
    enabled: boolean;
    fuelTopUpRunning: boolean;
    fuelTopUpIntervalMs: number;
    useAdvisoryLock: boolean;
} {
    const config = getSchedulerConfig();
    return {
        enabled: config.enabled,
        fuelTopUpRunning: isRunning,
        fuelTopUpIntervalMs: config.fuelTopUpIntervalMs,
        useAdvisoryLock: config.useAdvisoryLock,
    };
}
