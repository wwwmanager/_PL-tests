/**
 * REL-109: Migration and Backfill Script
 * 
 * Выполняет миграцию существующих данных:
 * 1. Бэкфилл occurredAt = createdAt для StockMovement
 * 2. Создание StockLocation(WAREHOUSE) для каждого Warehouse
 * 3. Создание StockLocation(VEHICLE_TANK) для каждого Vehicle
 * 4. Создание StockLocation(FUEL_CARD) для каждого FuelCard
 * 5. Связывание StockMovement.stockLocationId с созданными локациями
 * 
 * Запуск: npx ts-node scripts/backfill-stock-locations.ts
 */

import { PrismaClient, StockLocationType } from '@prisma/client';

const prisma = new PrismaClient();

interface MigrationStats {
    movementsBackfilled: number;
    warehouseLocations: number;
    vehicleTankLocations: number;
    fuelCardLocations: number;
    movementsLinked: number;
    errors: string[];
}

async function runMigration(): Promise<MigrationStats> {
    const stats: MigrationStats = {
        movementsBackfilled: 0,
        warehouseLocations: 0,
        vehicleTankLocations: 0,
        fuelCardLocations: 0,
        movementsLinked: 0,
        errors: [],
    };

    console.log('═'.repeat(60));
    console.log('REL-109: Migration and Backfill');
    console.log('═'.repeat(60));
    console.log('');

    // ============================================================================
    // STEP 1: Backfill occurredAt for StockMovements
    // ============================================================================
    console.log('📝 STEP 1: Backfill occurredAt = createdAt for StockMovements');

    try {
        const result = await prisma.$executeRaw`
            UPDATE stock_movements 
            SET "occurredAt" = "createdAt",
                "occurredSeq" = 0
            WHERE "occurredAt" IS NULL OR "occurredAt" = "createdAt"
        `;
        stats.movementsBackfilled = Number(result);
        console.log(`   ✅ Backfilled ${stats.movementsBackfilled} movements`);
    } catch (error) {
        const msg = `Failed to backfill occurredAt: ${error}`;
        stats.errors.push(msg);
        console.log(`   ⚠️ ${msg}`);
    }

    // ============================================================================
    // STEP 2: Create StockLocation for each Warehouse
    // ============================================================================
    console.log('\n📝 STEP 2: Create StockLocation(WAREHOUSE) for each Warehouse');

    const warehouses = await prisma.warehouse.findMany({
        include: { organization: true, stockLocation: true },
    });

    for (const warehouse of warehouses) {
        // Skip if already has a location
        if (warehouse.stockLocation) {
            console.log(`   ℹ️ Warehouse "${warehouse.name}" already has StockLocation`);
            continue;
        }

        try {
            await prisma.stockLocation.create({
                data: {
                    organizationId: warehouse.organizationId,
                    departmentId: warehouse.departmentId,
                    type: StockLocationType.WAREHOUSE,
                    name: warehouse.name,
                    warehouseId: warehouse.id,
                },
            });
            stats.warehouseLocations++;
            console.log(`   ✅ Created StockLocation for warehouse: ${warehouse.name}`);
        } catch (error) {
            const msg = `Failed to create location for warehouse ${warehouse.name}: ${error}`;
            stats.errors.push(msg);
            console.log(`   ⚠️ ${msg}`);
        }
    }

    // ============================================================================
    // STEP 3: Create StockLocation for each Vehicle (tank)
    // ============================================================================
    console.log('\n📝 STEP 3: Create StockLocation(VEHICLE_TANK) for each Vehicle');

    const vehicles = await prisma.vehicle.findMany({
        include: { stockLocation: true },
    });

    for (const vehicle of vehicles) {
        // Skip if already has a location
        if (vehicle.stockLocation) {
            console.log(`   ℹ️ Vehicle "${vehicle.registrationNumber}" already has StockLocation`);
            continue;
        }

        try {
            await prisma.stockLocation.create({
                data: {
                    organizationId: vehicle.organizationId,
                    departmentId: vehicle.departmentId,
                    type: StockLocationType.VEHICLE_TANK,
                    name: `Бак ${vehicle.registrationNumber}`,
                    vehicleId: vehicle.id,
                },
            });
            stats.vehicleTankLocations++;
            console.log(`   ✅ Created StockLocation for vehicle: ${vehicle.registrationNumber}`);
        } catch (error) {
            const msg = `Failed to create location for vehicle ${vehicle.registrationNumber}: ${error}`;
            stats.errors.push(msg);
            console.log(`   ⚠️ ${msg}`);
        }
    }

    // ============================================================================
    // STEP 4: Create StockLocation for each FuelCard
    // ============================================================================
    console.log('\n📝 STEP 4: Create StockLocation(FUEL_CARD) for each FuelCard');

    const fuelCards = await prisma.fuelCard.findMany({
        include: { stockLocation: true },
    });

    for (const card of fuelCards) {
        // Skip if already has a location
        if (card.stockLocation) {
            console.log(`   ℹ️ FuelCard "${card.cardNumber}" already has StockLocation`);
            continue;
        }

        try {
            await prisma.stockLocation.create({
                data: {
                    organizationId: card.organizationId,
                    type: StockLocationType.FUEL_CARD,
                    name: `Карта ${card.cardNumber}`,
                    fuelCardId: card.id,
                },
            });
            stats.fuelCardLocations++;
            console.log(`   ✅ Created StockLocation for fuel card: ${card.cardNumber}`);
        } catch (error) {
            const msg = `Failed to create location for card ${card.cardNumber}: ${error}`;
            stats.errors.push(msg);
            console.log(`   ⚠️ ${msg}`);
        }
    }

    // ============================================================================
    // STEP 5: Link StockMovements to StockLocations via warehouseId
    // ============================================================================
    console.log('\n📝 STEP 5: Link StockMovements to StockLocations');

    try {
        // Update movements where warehouseId is set but stockLocationId is not
        const result = await prisma.$executeRaw`
            UPDATE stock_movements sm
            SET "stockLocationId" = sl.id
            FROM stock_locations sl
            WHERE sm."warehouseId" = sl."warehouseId"
              AND sm."stockLocationId" IS NULL
              AND sl."warehouseId" IS NOT NULL
        `;
        stats.movementsLinked = Number(result);
        console.log(`   ✅ Linked ${stats.movementsLinked} movements to warehouse locations`);
    } catch (error) {
        const msg = `Failed to link movements: ${error}`;
        stats.errors.push(msg);
        console.log(`   ⚠️ ${msg}`);
    }

    // ============================================================================
    // SUMMARY
    // ============================================================================
    console.log('\n' + '═'.repeat(60));
    console.log('📊 Migration Summary');
    console.log('═'.repeat(60));
    console.log(`   Movements backfilled:     ${stats.movementsBackfilled}`);
    console.log(`   Warehouse locations:      ${stats.warehouseLocations}`);
    console.log(`   Vehicle tank locations:   ${stats.vehicleTankLocations}`);
    console.log(`   Fuel card locations:      ${stats.fuelCardLocations}`);
    console.log(`   Movements linked:         ${stats.movementsLinked}`);
    console.log(`   Errors:                   ${stats.errors.length}`);

    if (stats.errors.length > 0) {
        console.log('\n⚠️ Errors encountered:');
        stats.errors.forEach((err, i) => console.log(`   ${i + 1}. ${err}`));
    }

    console.log('\n✅ Migration completed!');

    return stats;
}

// ============================================================================
// DRY RUN MODE (Preview what will be migrated)
// ============================================================================
async function previewMigration(): Promise<void> {
    console.log('═'.repeat(60));
    console.log('REL-109: Migration Preview (DRY RUN)');
    console.log('═'.repeat(60));
    console.log('');

    // Total movements
    const totalMovements = await prisma.stockMovement.count();
    console.log(`📦 Total StockMovements: ${totalMovements}`);

    // Movements without stockLocationId
    const movementsWithoutLocation = await prisma.stockMovement.count({
        where: { stockLocationId: null },
    });
    console.log(`   → Without stockLocationId: ${movementsWithoutLocation}`);

    // Count warehouses without locations
    const warehousesWithoutLocation = await prisma.warehouse.count({
        where: { stockLocation: null },
    });
    console.log(`🏭 Warehouses without StockLocation: ${warehousesWithoutLocation}`);

    // Count vehicles without locations
    const vehiclesWithoutLocation = await prisma.vehicle.count({
        where: { stockLocation: null },
    });
    console.log(`🚗 Vehicles without StockLocation: ${vehiclesWithoutLocation}`);

    // Count fuel cards without locations
    const cardsWithoutLocation = await prisma.fuelCard.count({
        where: { stockLocation: null },
    });
    console.log(`💳 Fuel cards without StockLocation: ${cardsWithoutLocation}`);

    // Count movements with warehouseId but no stockLocationId
    const unlinkedMovements = await prisma.stockMovement.count({
        where: {
            warehouseId: { not: null },
            stockLocationId: null,
        },
    });
    console.log(`🔗 Movements to link (have warehouseId): ${unlinkedMovements}`);

    console.log('');
    console.log('Run with --run flag to execute migration');
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
    const args = process.argv.slice(2);
    const isRun = args.includes('--run');
    const isPreview = args.includes('--preview') || !isRun;

    try {
        if (isPreview && !isRun) {
            await previewMigration();
        } else {
            await runMigration();
        }
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
