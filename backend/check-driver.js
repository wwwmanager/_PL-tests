const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Driver Check ---');

    // Check driver with ID from error
    const targetId = '4f1a1b35-de96-45f0-bcec-a329ab0b099a';

    const driver = await prisma.driver.findUnique({
        where: { id: targetId },
        include: { employee: { include: { organization: true } } }
    });

    if (driver) {
        console.log('Found driver:');
        console.log('  - ID:', driver.id);
        console.log('  - Employee:', driver.employee?.fullName);
        console.log('  - Org:', driver.employee?.organization?.shortName);
    } else {
        console.log('❌ Driver NOT FOUND with ID:', targetId);
    }

    console.log('\n--- All Drivers ---');
    const allDrivers = await prisma.driver.findMany({
        include: { employee: { include: { organization: true } } }
    });

    console.log(`Found ${allDrivers.length} drivers:`);
    for (const d of allDrivers) {
        console.log(`  - ${d.employee?.fullName} (ID: ${d.id}) Org: ${d.employee?.organization?.shortName}`);
    }

    console.log('\n--- All Employees (drivers) ---');
    const allEmployees = await prisma.employee.findMany({
        where: { employeeType: 'driver' },
        include: { organization: true, driver: true }
    });

    console.log(`Found ${allEmployees.length} driver-type employees:`);
    for (const e of allEmployees) {
        console.log(`  - ${e.fullName} (ID: ${e.id}) hasDriver: ${!!e.driver} Org: ${e.organization?.shortName}`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
