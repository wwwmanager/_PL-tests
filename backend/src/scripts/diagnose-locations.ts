/**
 * Script to diagnose StockLocation issues
 */
import { prisma } from '../db/prisma';

async function main() {
    console.log('=== All Vehicles ===');
    const vehicles = await prisma.vehicle.findMany({
        select: {
            id: true,
            registrationNumber: true,
            organizationId: true,
            stockLocation: {
                select: { id: true, name: true, organizationId: true }
            }
        }
    });

    for (const v of vehicles) {
        console.log(`  ${v.registrationNumber} (org: ${v.organizationId})`);
        if (v.stockLocation) {
            console.log(`    -> StockLoc: ${v.stockLocation.name} (locOrg: ${v.stockLocation.organizationId})`);
        } else {
            console.log(`    -> NO StockLocation!`);
        }
    }

    console.log('\n=== All Stock Locations (VEHICLE_TANK) ===');
    const locations = await prisma.stockLocation.findMany({
        where: { type: 'VEHICLE_TANK' },
        select: {
            id: true,
            name: true,
            organizationId: true,
            vehicleId: true
        }
    });

    for (const loc of locations) {
        console.log(`  ${loc.name} (org: ${loc.organizationId}, vehicleId: ${loc.vehicleId})`);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
