
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const regNo = 'В123АВ174';
    const vehicle = await prisma.vehicle.findUnique({
        where: { registrationNumber: regNo }
    });

    if (vehicle) {
        console.log(`Vehicle found: ${vehicle.registrationNumber} (ID: ${vehicle.id}, Org: ${vehicle.organizationId}, isActive: ${vehicle.isActive})`);
    } else {
        console.log(`Vehicle ${regNo} not found.`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
