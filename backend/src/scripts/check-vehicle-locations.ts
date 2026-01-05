/**
 * Script to check and create missing StockLocations for vehicles
 */
import { prisma } from '../db/prisma';
import { StockLocationType } from '@prisma/client';

async function main() {
    console.log('Checking vehicles without StockLocation...');

    const vehiclesWithoutLocation = await prisma.vehicle.findMany({
        where: {
            stockLocation: null
        },
        select: {
            id: true,
            registrationNumber: true,
            brand: true,
            organizationId: true
        }
    });

    console.log(`Found ${vehiclesWithoutLocation.length} vehicles without StockLocation`);

    for (const vehicle of vehiclesWithoutLocation) {
        console.log(`Creating StockLocation for: ${vehicle.registrationNumber}`);

        await prisma.stockLocation.create({
            data: {
                organizationId: vehicle.organizationId,
                type: StockLocationType.VEHICLE_TANK,
                name: `Бак: ${vehicle.registrationNumber} (${vehicle.brand || ''})`,
                vehicleId: vehicle.id,
                isActive: true,
            }
        });

        console.log(`  ✅ Created`);
    }

    console.log('Done!');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
