/**
 * REL-302: Backfill script to create missing Driver records
 * Finds Employees where employeeType='driver' but no Driver record exists
 * 
 * Usage: npx ts-node scripts/backfillDrivers.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 REL-302: Searching for employees without Driver records...');

    // Find employees of type 'driver' who don't have a Driver record
    const employeesWithoutDriver = await prisma.employee.findMany({
        where: {
            employeeType: 'driver',
            driver: null  // No associated Driver record
        },
        select: {
            id: true,
            fullName: true,
            organizationId: true,
            documentNumber: true,
            licenseCategory: true,
            documentExpiry: true,
        }
    });

    console.log(`📊 Found ${employeesWithoutDriver.length} employees without Driver records.`);

    if (employeesWithoutDriver.length === 0) {
        console.log('✅ All driver-type employees have Driver records. Nothing to do.');
        return;
    }

    console.log('\n📝 Creating missing Driver records:');
    let created = 0;
    let errors = 0;

    for (const emp of employeesWithoutDriver) {
        try {
            const driver = await prisma.driver.create({
                data: {
                    employeeId: emp.id,
                    licenseNumber: emp.documentNumber || `BACKFILL-${emp.id.slice(0, 8)}`,
                    licenseCategory: emp.licenseCategory || 'B',
                    licenseValidTo: emp.documentExpiry || null,
                }
            });

            console.log(`  ✅ Created Driver ${driver.id} for employee "${emp.fullName}" (${emp.id})`);
            created++;
        } catch (error: any) {
            // Handle unique constraint violation (Driver already exists)
            if (error.code === 'P2002') {
                console.log(`  ⏭️ Driver already exists for "${emp.fullName}" - skipping`);
            } else {
                console.error(`  ❌ Failed to create Driver for "${emp.fullName}":`, error.message);
                errors++;
            }
        }
    }

    console.log('\n📊 Summary:');
    console.log(`  Created: ${created}`);
    console.log(`  Errors: ${errors}`);
    console.log(`  Skipped: ${employeesWithoutDriver.length - created - errors}`);
}

main()
    .catch(e => {
        console.error('💥 Backfill failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
