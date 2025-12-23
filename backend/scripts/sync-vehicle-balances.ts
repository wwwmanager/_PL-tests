import { PrismaClient, StockMovementType, StockLocationType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting sync of Vehicle Fuel Balances...');

    const vehicles = await prisma.vehicle.findMany({
        where: { isActive: true },
        include: {
            stockLocation: true,
            fuelStockItem: true
        }
    });

    console.log(`Checking ${vehicles.length} vehicles...`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const v of vehicles) {
        if (!v.stockLocation) {
            console.log(`⚠️ Vehicle ${v.registrationNumber} has no stock location. Run backfill first.`);
            skippedCount++;
            continue;
        }

        if (!v.fuelStockItem) {
            console.log(`ℹ️ Vehicle ${v.registrationNumber} has no fuel type assigned (stock item). Skipping.`);
            skippedCount++;
            continue;
        }

        const currentFuel = Number(v.currentFuel || 0);
        if (currentFuel <= 0) {
            skippedCount++;
            continue;
        }

        // Check if there are any existing movements for this location
        const movementCount = await prisma.stockMovement.count({
            where: {
                OR: [
                    { stockLocationId: v.stockLocation.id },
                    { fromStockLocationId: v.stockLocation.id },
                    { toStockLocationId: v.stockLocation.id }
                ]
            }
        });

        if (movementCount > 0) {
            console.log(`Vehicle ${v.registrationNumber} already has ${movementCount} movements. Skipping to avoid double counting.`);
            skippedCount++;
            continue;
        }

        console.log(`🔄 Initializing balance for ${v.registrationNumber}: ${currentFuel}L (${v.fuelStockItem.name})`);

        // Create adjustment
        await prisma.stockMovement.create({
            data: {
                organizationId: v.organizationId,
                stockItemId: v.fuelStockItem.id,
                stockLocationId: v.stockLocation.id,
                movementType: StockMovementType.ADJUSTMENT,
                quantity: currentFuel,
                occurredAt: new Date(), // Now
                comment: 'Начальный ввод остатков (из карточки ТС)',
                createdByUserId: null // System
            }
        });

        updatedCount++;
    }

    console.log(`✅ Completed. Initialized: ${updatedCount}, Skipped: ${skippedCount}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
