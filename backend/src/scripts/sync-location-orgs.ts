/**
 * Sync all vehicle StockLocations with their vehicle's organizationId
 */
import { prisma } from '../db/prisma';

async function main() {
    console.log('Syncing StockLocations with Vehicle organizations...');

    const locations = await prisma.stockLocation.findMany({
        where: { type: 'VEHICLE_TANK' },
        include: {
            vehicle: {
                select: { id: true, registrationNumber: true, organizationId: true }
            }
        }
    });

    let updated = 0;
    for (const loc of locations) {
        if (loc.vehicle && loc.organizationId !== loc.vehicle.organizationId) {
            console.log(`  Fixing: ${loc.name}`);
            console.log(`    Old org: ${loc.organizationId}`);
            console.log(`    New org: ${loc.vehicle.organizationId}`);

            await prisma.stockLocation.update({
                where: { id: loc.id },
                data: { organizationId: loc.vehicle.organizationId }
            });
            updated++;
        }
    }

    console.log(`\nDone! Updated ${updated} locations.`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
