
import { PrismaClient, StockLocationType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking for missing StockLocations...');

    const orgs = await prisma.organization.findMany();
    console.log(`Found ${orgs.length} organizations.`);

    for (const org of orgs) {
        console.log(`Processing organization: ${org.name}`);

        // 1. Ensure Warehouses have StockLocations
        const warehouses = await prisma.warehouse.findMany({
            where: { organizationId: org.id },
            include: { stockLocation: true }
        });

        for (const wh of warehouses) {
            if (!wh.stockLocation) {
                console.log(`Creating StockLocation for warehouse: ${wh.name}`);
                await prisma.stockLocation.create({
                    data: {
                        organizationId: org.id,
                        departmentId: wh.departmentId,
                        type: StockLocationType.WAREHOUSE,
                        name: wh.name,
                        warehouseId: wh.id,
                        isActive: true
                    }
                });
            }
        }

        // 2. If no warehouse exists, create a default one
        const whCount = await prisma.warehouse.count({ where: { organizationId: org.id } });
        if (whCount === 0) {
            console.log('No warehouse found. Creating default warehouse...');
            const newWh = await prisma.warehouse.create({
                data: {
                    organizationId: org.id,
                    name: 'Основной склад',
                }
            });
            await prisma.stockLocation.create({
                data: {
                    organizationId: org.id,
                    type: StockLocationType.WAREHOUSE,
                    name: newWh.name,
                    warehouseId: newWh.id,
                    isActive: true
                }
            });
        }

        // 3. Ensure Vehicles have StockLocations (Tanks)
        const vehicles = await prisma.vehicle.findMany({
            where: { organizationId: org.id },
            include: { stockLocation: true }
        });

        for (const v of vehicles) {
            if (!v.stockLocation) {
                console.log(`Creating Tank Location for vehicle: ${v.registrationNumber}`);
                await prisma.stockLocation.create({
                    data: {
                        organizationId: org.id,
                        departmentId: v.departmentId,
                        type: StockLocationType.VEHICLE_TANK,
                        name: `Бак ${v.registrationNumber}`,
                        vehicleId: v.id,
                        isActive: true
                    }
                });
            }
        }
    }

    console.log('Done.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
