
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const regNo = 'В123АВ174';
    const vehicles = await prisma.vehicle.findMany({
        where: { registrationNumber: regNo },
        orderBy: { createdAt: 'desc' }
    });

    if (vehicles.length > 1) {
        console.log(`Found ${vehicles.length} duplicates for ${regNo}. Keeping ${vehicles[0].id}, deleting others...`);
        const idsToDelete = vehicles.slice(1).map(v => v.id);
        await prisma.vehicle.deleteMany({
            where: { id: { in: idsToDelete } }
        });
        console.log('Cleanup complete.');
    } else {
        console.log('No duplicates found.');
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
