/**
 * Fix isActive mismatch in employees table
 * Synchronizes isActive boolean with status string field
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🔧 Fixing employee isActive field based on status...\n');

    // Fix: status='Active' but isActive=false
    const fixedActive = await prisma.employee.updateMany({
        where: {
            status: 'Active',
            isActive: false,
        },
        data: {
            isActive: true,
        },
    });
    console.log(`✅ Fixed ${fixedActive.count} employees: status='Active' → isActive=true`);

    // Fix: status='Inactive' but isActive=true
    const fixedInactive = await prisma.employee.updateMany({
        where: {
            status: 'Inactive',
            isActive: true,
        },
        data: {
            isActive: false,
        },
    });
    console.log(`✅ Fixed ${fixedInactive.count} employees: status='Inactive' → isActive=false`);

    // Report current state
    const activeCount = await prisma.employee.count({ where: { isActive: true } });
    const inactiveCount = await prisma.employee.count({ where: { isActive: false } });
    console.log(`\n📊 Current state: ${activeCount} active, ${inactiveCount} inactive employees`);
}

main()
    .then(() => prisma.$disconnect())
    .catch((e) => {
        console.error('❌ Error:', e);
        prisma.$disconnect();
        process.exit(1);
    });
