
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const vehicles = await prisma.vehicle.findMany({
        where: { isActive: true },
        include: { stockLocation: true }
    });

    console.log(`Total Active Vehicles: ${vehicles.length}`);
    const withoutLocation = vehicles.filter(v => !v.stockLocation);
    console.log(`Vehicles WITHOUT StockLocation: ${withoutLocation.length}`);

    withoutLocation.forEach(v => {
        console.log(`- ${v.registrationNumber} (ID: ${v.id})`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
