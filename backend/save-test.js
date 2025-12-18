
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const org = await prisma.organization.findFirst();
    if (!org) throw new Error('No org found');

    const regNo = 'TEST-' + Math.floor(Math.random() * 10000);
    console.log(`Creating vehicle ${regNo} for org ${org.shortName} (${org.id})...`);

    const v = await prisma.vehicle.create({
        data: {
            registrationNumber: regNo,
            organizationId: org.id,
            brand: 'Test Brand',
            mileage: 100,
        }
    });

    console.log('Successfully created:', v.id);

    const count = await prisma.vehicle.count();
    console.log('Total vehicles now:', count);
}

main().catch(console.error).finally(() => prisma.$disconnect());
