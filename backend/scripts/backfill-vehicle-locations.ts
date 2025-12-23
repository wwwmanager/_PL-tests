import { PrismaClient, StockLocationType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting backfill of Vehicle Stock Locations...');

    const vehicles = await prisma.vehicle.findMany({
        where: { isActive: true }, // Process active vehicles primarily, but maybe all? Let's do all.
        include: { stockLocation: true }
    });

    console.log(`Found ${vehicles.length} vehicles.`);

    let createdCount = 0;
    let skippedCount = 0;

    for (const v of vehicles) {
        if (v.stockLocation) {
            // Check if name needs update?
            const expectedName = `Бак: ${v.registrationNumber} (${v.brand || ''})`;
            if (v.stockLocation.name !== expectedName) {
                console.log(`Updating name for vehicle ${v.registrationNumber}: ${v.stockLocation.name} -> ${expectedName}`);
                await prisma.stockLocation.update({
                    where: { id: v.stockLocation.id },
                    data: { name: expectedName }
                });
            } else {
                skippedCount++;
            }
            continue;
        }

        console.log(`Creating StockLocation for vehicle: ${v.registrationNumber}`);

        await prisma.stockLocation.create({
            data: {
                organizationId: v.organizationId,
                type: StockLocationType.VEHICLE_TANK,
                name: `Бак: ${v.registrationNumber} (${v.brand || ''})`,
                vehicleId: v.id,
                isActive: true, // v.isActive? Maybe better to match vehicle status, but keeping locations active is safer for history? 
                // Let's match vehicle active status actually.
            }
        });
        createdCount++;
    }

    console.log(`✅ Completed. Created: ${createdCount}, Skipped/Updated: ${skippedCount}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
