/**
 * RECALC-030: Recalculation Service
 * Пересчёт балансов и статистики
 */

import { PrismaClient, StockMovementType } from '@prisma/client';
import { logger } from '../utils/logger';
import { getBalanceAt } from './stockService';

const prisma = new PrismaClient();

/**
 * Recalculate StockItem balances (global per item, NOT per location)
 * RECALC-030: Fixed to exclude voided movements
 */
export const recalculateStockBalances = async () => {
    logger.info('[RECALC] Starting Stock Balance Recalculation...');

    const items = await prisma.stockItem.findMany();
    let count = 0;

    for (const item of items) {
        // RECALC-030: Add isVoid: false filter
        const movements = await prisma.stockMovement.groupBy({
            by: ['movementType'],
            where: {
                stockItemId: item.id,
                isVoid: false  // <-- FIX: exclude voided movements
            },
            _sum: { quantity: true }
        });

        const income = movements.find(m => m.movementType === 'INCOME')?._sum.quantity?.toNumber() || 0;
        const expense = movements.find(m => m.movementType === 'EXPENSE')?._sum.quantity?.toNumber() || 0;
        const adj = movements.find(m => m.movementType === 'ADJUSTMENT')?._sum.quantity?.toNumber() || 0;

        // Note: TRANSFER doesn't affect global item balance (moves between locations)
        const balance = income - expense + adj;

        await prisma.stockItem.update({
            where: { id: item.id },
            data: { balance }
        });
        count++;
    }
    logger.info(`[RECALC] Stock Balance Recalculation Completed. Updated ${count} items.`);
};

/**
 * Recalculate Vehicle stats: mileage AND currentFuel from tank balance
 * RECALC-030: Added currentFuel sync from StockLocation
 */
export const recalculateVehicleStats = async () => {
    logger.info('[RECALC] Starting Vehicle Stats Recalculation...');

    const vehicles = await prisma.vehicle.findMany({
        include: { fuelStockItem: true }
    });
    let mileageCount = 0;
    let fuelCount = 0;

    for (const v of vehicles) {
        const updateData: { mileage?: any; currentFuel?: number } = {};

        // 1. Mileage from last POSTED waybill
        const lastWb = await prisma.waybill.findFirst({
            where: { vehicleId: v.id, status: 'POSTED' },
            orderBy: { date: 'desc' },
            include: { fuelLines: true }
        });

        if (lastWb) {
            updateData.mileage = lastWb.odometerEnd || v.mileage;
            mileageCount++;

            // 2. RECALC-030: Get currentFuel from fuelEnd of last waybill
            const fuelEnd = lastWb.fuelLines.reduce((acc, fl) => {
                return Number(fl.fuelEnd) || acc;
            }, 0);

            if (fuelEnd > 0) {
                updateData.currentFuel = fuelEnd;
                fuelCount++;
            }
        }

        // 3. Alternative: Calculate from tank StockLocation balance
        if (!updateData.currentFuel && v.fuelStockItemId) {
            const tankLocation = await prisma.stockLocation.findFirst({
                where: { vehicleId: v.id, type: 'VEHICLE_TANK', isActive: true }
            });

            if (tankLocation) {
                const tankBalance = await getBalanceAt(tankLocation.id, v.fuelStockItemId, new Date());
                if (tankBalance > 0) {
                    updateData.currentFuel = tankBalance;
                    fuelCount++;
                    logger.info(`[RECALC] Vehicle ${v.registrationNumber}: tank balance = ${tankBalance}`);
                }
            }
        }

        if (Object.keys(updateData).length > 0) {
            await prisma.vehicle.update({
                where: { id: v.id },
                data: updateData
            });
        }
    }

    logger.info(`[RECALC] Vehicle Stats Completed. Mileage: ${mileageCount}, Fuel: ${fuelCount}`);
};

/**
 * RECALC-030: Removed placeholder, function now logs summary only
 * Driver balances are calculated live via FuelCard StockLocation
 */
export const recalculateDriverBalances = async () => {
    logger.info('[RECALC] Driver balances are calculated live via FuelCard StockLocations.');

    // Count fuel cards with locations for info
    const fuelCardLocations = await prisma.stockLocation.count({
        where: { type: 'FUEL_CARD', isActive: true }
    });

    logger.info(`[RECALC] Active Fuel Card locations: ${fuelCardLocations}`);
};
