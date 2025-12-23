
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Checking Driver Fuel Card Assignment ---');

    // 1. Find Driver via Employee
    // Search for "Ivanov"
    const employee = await prisma.employee.findFirst({
        where: {
            fullName: { contains: 'Иванов Иван', mode: 'insensitive' }
        }
    });

    if (!employee) {
        console.log('❌ Employee "Иванов Иван" not found.');
        return;
    }
    console.log(`Found Employee: ${employee.fullName} (${employee.id})`);
    console.log(`Legacy Fuel Card: ${employee.fuelCardNumber || 'N/A'}, Balance: ${employee.fuelCardBalance}`);


    // 2. Find Driver Record - CORRECTLY via employeeId
    const driver = await prisma.driver.findUnique({
        where: { employeeId: employee.id }
    });

    if (!driver) {
        console.log('❌ Driver record not found for this employee via employeeId link.');
        return;
    }
    console.log(`Driver ID: ${driver.id} (Different from Employee ID)`);

    // 3. Find Fuel Cards
    const cards = await prisma.fuelCard.findMany({
        where: {
            assignedToDriverId: driver.id
        }
    });

    if (cards.length === 0) {
        console.log('❌ No fuel cards assigned to this driver.');

        // Check for unassigned cards
        const unassigned = await prisma.fuelCard.findMany({
            where: { assignedToDriverId: null, isActive: true },
            take: 3
        });
        console.log('Unassigned cards available:', unassigned.map(c => c.cardNumber).join(', '));
    } else {
        console.log(`✅ Found ${cards.length} assigned cards:`);
        cards.forEach(c => {
            console.log(`- Card: ${c.cardNumber}, Active: ${c.isActive}, Balance: ${c.balanceLiters}`);
        });
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
