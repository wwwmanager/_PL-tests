
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Checking Organizations ---');
    const orgs = await prisma.organization.findMany();
    orgs.forEach(o => console.log(`Org: ${o.shortName}, ID: ${o.id}`));

    console.log('\n--- Checking Vehicles ---');
    const vehicles = await prisma.vehicle.findMany();
    console.log(`Total Vehicles: ${vehicles.length}`);

    const orgCounts = {};
    vehicles.forEach(v => {
        const oid = v.organizationId || 'NULL';
        orgCounts[oid] = (orgCounts[oid] || 0) + 1;
    });

    for (const [oid, count] of Object.entries(orgCounts)) {
        console.log(`Org ${oid}: ${count} vehicles`);
    }

    const users = await prisma.user.findMany({ include: { organization: true } });
    console.log('\n--- Checking Users ---');
    users.forEach(u => console.log(`User: ${u.fullName}, Role: ${u.role}, OrgID: ${u.organizationId}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
