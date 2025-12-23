
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Repairing Driver Records ---');

    // 1. Find all employees of type 'driver'
    const drivers = await prisma.employee.findMany({
        where: {
            employeeType: 'driver'
        },
        include: {
            driver: true
        }
    });

    console.log(`Found ${drivers.length} employees with type 'driver'.`);

    let createdCount = 0;

    for (const emp of drivers) {
        if (!emp.driver) {
            console.log(`Creating Driver record for ${emp.fullName} (${emp.id})...`);

            try {
                // Ensure unique constraint on employeeId
                // We check again just to be safe in async loop, though serial is fine here.
                const exists = await prisma.driver.findUnique({ where: { employeeId: emp.id } });
                if (exists) {
                    console.log(`  - Driver record already appeared? Skipping.`);
                    continue;
                }

                await prisma.driver.create({
                    data: {
                        employeeId: emp.id,
                        licenseNumber: emp.documentNumber || `AUTO-${emp.id.slice(0, 8)}`,
                        licenseCategory: emp.licenseCategory || 'B',
                        licenseValidTo: emp.documentExpiry ? new Date(emp.documentExpiry) : null,
                    }
                });
                createdCount++;
                console.log(`  ✅ Created.`);
            } catch (e) {
                console.error(`  ❌ Failed to create driver for ${emp.id}:`, e);
            }
        }
    }

    console.log(`\nRepair Complete.`);
    console.log(`Created ${createdCount} missing driver records.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
