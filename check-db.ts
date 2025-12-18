
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        include: { organization: true }
    });
    console.log('--- Users and their Orgs ---');
    users.forEach(u => console.log(`User: ${u.fullName} (${u.email}), OrgID: ${u.organizationId}, OrgName: ${u.organization?.shortName}`));

    const vehicles = await prisma.vehicle.findMany({
        include: { organization: true }
    });
    console.log('\n--- Vehicles and their Orgs ---');
    vehicles.forEach(v => console.log(`Vehicle: ${v.registrationNumber}, OrgID: ${v.organizationId}, OrgName: ${v.organization?.shortName}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
