import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteOrgManually() {
    const id = '395cf57e-e87e-45c1-922a-d14013c34b24';

    console.log(`\n🗑️ Deleting organization ${id}\n`);

    try {
        // Check if org exists
        const org = await prisma.organization.findUnique({ where: { id } });
        if (!org) {
            console.log('❌ Organization not found');
            return;
        }
        console.log(`Found: ${org.shortName || org.name}`);

        // Step by step deletion with logging
        console.log('\n1. Deleting waybills...');
        const r1 = await prisma.waybill.deleteMany({ where: { organizationId: id } });
        console.log(`   Deleted: ${r1.count}`);

        console.log('2. Deleting stockMovements...');
        const r2 = await prisma.stockMovement.deleteMany({ where: { organizationId: id } });
        console.log(`   Deleted: ${r2.count}`);

        console.log('3. Deleting blanks...');
        const r3 = await prisma.blank.deleteMany({ where: { organizationId: id } });
        console.log(`   Deleted: ${r3.count}`);

        console.log('4. Deleting blankBatches...');
        const r4 = await prisma.blankBatch.deleteMany({ where: { organizationId: id } });
        console.log(`   Deleted: ${r4.count}`);

        console.log('5. Deleting auditLogs...');
        const r5 = await prisma.auditLog.deleteMany({ where: { organizationId: id } });
        console.log(`   Deleted: ${r5.count}`);

        console.log('6. Deleting stockItems...');
        const r6 = await prisma.stockItem.deleteMany({ where: { organizationId: id } });
        console.log(`   Deleted: ${r6.count}`);

        console.log('7. Deleting warehouses...');
        const r7 = await prisma.warehouse.deleteMany({ where: { organizationId: id } });
        console.log(`   Deleted: ${r7.count}`);

        console.log('8. Deleting fuelCards...');
        const r8 = await prisma.fuelCard.deleteMany({ where: { organizationId: id } });
        console.log(`   Deleted: ${r8.count}`);

        console.log('9. Deleting vehicles...');
        const r9 = await prisma.vehicle.deleteMany({ where: { organizationId: id } });
        console.log(`   Deleted: ${r9.count}`);

        console.log('10. Deleting drivers (raw SQL)...');
        const r10 = await prisma.$executeRaw`
      DELETE FROM drivers 
      WHERE employee_id IN (
        SELECT id FROM employees WHERE organization_id = ${id}::uuid
      )
    `;
        console.log(`   Deleted: ${r10}`);

        console.log('11. Deleting employees...');
        const r11 = await prisma.employee.deleteMany({ where: { organizationId: id } });
        console.log(`   Deleted: ${r11.count}`);

        console.log('12. Deleting departments...');
        const r12 = await prisma.department.deleteMany({ where: { organizationId: id } });
        console.log(`   Deleted: ${r12.count}`);

        console.log('13. Deleting user_roles (raw SQL)...');
        const r13 = await prisma.$executeRaw`
      DELETE FROM user_roles 
      WHERE user_id IN (
        SELECT id FROM users WHERE organization_id = ${id}::uuid
      )
    `;
        console.log(`   Deleted: ${r13}`);

        console.log('14. Deleting refresh_tokens (raw SQL)...');
        const r14 = await prisma.$executeRaw`
      DELETE FROM refresh_tokens 
      WHERE user_id IN (
        SELECT id FROM users WHERE organization_id = ${id}::uuid
      )
    `;
        console.log(`   Deleted: ${r14}`);

        console.log('15. Deleting users...');
        const r15 = await prisma.user.deleteMany({ where: { organizationId: id } });
        console.log(`   Deleted: ${r15.count}`);

        console.log('16. Deleting organization...');
        await prisma.organization.delete({ where: { id } });
        console.log('   ✅ DONE!');

    } catch (err: any) {
        console.error('\n❌ ERROR:', err.message);
        console.error('Code:', err.code);
        console.error('Meta:', err.meta);
    }
}

deleteOrgManually()
    .finally(() => prisma.$disconnect());
