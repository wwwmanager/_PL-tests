/**
 * REL-302 Backfill Script: Ensure all driver-type employees have a Driver record
 * 
 * Run: npx ts-node backend/scripts/ensureDriversExist.ts
 * Or: npm run backfill:drivers
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 [REL-302] Checking for driver-type employees without Driver record...\n');

    // 1. Find all employees with type 'driver', including their Driver relation
    const employees = await prisma.employee.findMany({
        where: { employeeType: 'driver' },
        include: { driver: true },
    });

    console.log(`Found ${employees.length} employees with employeeType='driver'\n`);

    let createdCount = 0;
    let skippedCount = 0;

    for (const emp of employees) {
        // If driver relation is null, create the Driver record
        if (!emp.driver) {
            console.log(`🛠  Creating Driver for: ${emp.fullName} (${emp.id})`);

            await prisma.driver.create({
                data: {
                    employeeId: emp.id,
                    licenseNumber: emp.documentNumber || `BACKFILL-${emp.id.slice(0, 8)}`,
                    licenseCategory: emp.licenseCategory || 'B',
                    licenseValidTo: emp.documentExpiry || null,
                },
            });
            createdCount++;
        } else {
            skippedCount++;
        }
    }

    console.log('\n✅ [REL-302] Backfill complete:');
    console.log(`   - Drivers created: ${createdCount}`);
    console.log(`   - Already had Driver: ${skippedCount}`);
}

main()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
