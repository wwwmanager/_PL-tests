const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Blank-Driver Linkage Check ---');

    // 1. Find all blanks with status ISSUED
    const issuedBlanks = await prisma.blank.findMany({
        where: { status: 'ISSUED' },
        select: {
            id: true,
            series: true,
            number: true,
            status: true,
            issuedToDriverId: true
        },
        take: 20
    });

    console.log(`\n📋 Found ${issuedBlanks.length} ISSUED blanks:`);
    for (const b of issuedBlanks) {
        console.log(`  - ${b.series} ${b.number}: issuedToDriverId=${b.issuedToDriverId}`);
    }

    // 2. Find all Driver records
    const drivers = await prisma.driver.findMany({
        include: { employee: true }
    });

    console.log(`\n👤 Found ${drivers.length} Driver records:`);
    for (const d of drivers) {
        console.log(`  - Driver.id=${d.id}, employeeId=${d.employeeId}, Employee: ${d.employee?.fullName}`);
    }

    // 3. Find all Employees who are drivers (by type)
    const driverEmployees = await prisma.employee.findMany({
        where: { employeeType: 'driver' },
        select: { id: true, fullName: true, employeeType: true }
    });

    console.log(`\n🧑‍✈️ Found ${driverEmployees.length} Employee records with employeeType='driver':`);
    for (const e of driverEmployees) {
        console.log(`  - Employee.id=${e.id}, fullName=${e.fullName}`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
