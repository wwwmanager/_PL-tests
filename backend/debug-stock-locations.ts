
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- CUSTOM DEBUG: Stock Locations ---');

    // 1. Check Users and their Orgs
    const users = await prisma.user.findMany({
        include: { organization: true },
        take: 5
    });
    console.log('\nUsers (first 5):');
    users.forEach(u => {
        console.log(`  User: ${u.email} (OrgID: ${u.organizationId})`);
    });

    const targetOrgId = users[0]?.organizationId;
    if (!targetOrgId) {
        console.log('No users found, cannot determine target org.');
        return;
    }
    console.log(`\nTarget Org ID (from first user): ${targetOrgId}`);

    // 2. Check Organizations
    const orgs = await prisma.organization.findMany();
    console.log(`\nAll Organizations (${orgs.length}):`);
    orgs.forEach(o => console.log(`  - ${o.shortName} (${o.id})`));

    // 3. Check Vehicles (ALL)
    const vehiclesAll = await prisma.vehicle.findMany({
        include: { organization: true }
    });
    console.log(`\nALL Vehicles in Database (${vehiclesAll.length}):`);
    vehiclesAll.slice(0, 10).forEach(v => console.log(`  - ${v.registrationNumber} (Org: ${v.organization.shortName}) (OrgID: ${v.organizationId})`));

    const vehicles = vehiclesAll.filter(v => v.organizationId === targetOrgId);
    // 3b. Check Drivers (ALL)
    const driversAll = await prisma.driver.findMany({
        include: { employee: { include: { organization: true } } }
    });
    console.log(`\nALL Drivers in Database (${driversAll.length}):`);
    driversAll.slice(0, 10).forEach(d => console.log(`  - ${d.licenseNumber} (Org: ${d.employee.organization?.shortName})`));


    // 4. Check Stock Locations
    const locs = await prisma.stockLocation.findMany({
        where: { organizationId: targetOrgId }
    });
    console.log(`\nStock Locations in Target Org (${locs.length}):`);
    locs.forEach(l => console.log(`  - ${l.name} [Type: ${l.type}] (Linked Vehicle: ${l.vehicleId})`));

    // 5. Check specific Vehicle linkage
    if (vehicles.length > 0) {
        const v = vehicles[0];
        const linkedLoc = await prisma.stockLocation.findUnique({
            where: { vehicleId: v.id }
        });
        console.log(`\nCheck Link for Vehicle ${v.registrationNumber}:`);
        console.log(`  Vehicle ID: ${v.id}`);
        console.log(`  Linked Location: ${linkedLoc ? `${linkedLoc.name} (${linkedLoc.id})` : 'NONE'}`);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
