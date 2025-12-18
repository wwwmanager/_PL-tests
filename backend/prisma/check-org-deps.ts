import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkOrgDependencies() {
    const orgId = '395cf57e-e87e-45c1-922a-d14013c34b24';

    console.log(`\n🔍 Checking dependencies for organization ${orgId}\n`);

    const checks = [
        { name: 'users', query: async () => await prisma.user.count({ where: { organizationId: orgId } }) },
        { name: 'employees', query: async () => await prisma.employee.count({ where: { organizationId: orgId } }) },
        { name: 'vehicles', query: async () => await prisma.vehicle.count({ where: { organizationId: orgId } }) },
        { name: 'waybills', query: async () => await prisma.waybill.count({ where: { organizationId: orgId } }) },
        { name: 'blanks', query: async () => await prisma.blank.count({ where: { organizationId: orgId } }) },
        { name: 'blankBatches', query: async () => await prisma.blankBatch.count({ where: { organizationId: orgId } }) },
        { name: 'stockItems', query: async () => await prisma.stockItem.count({ where: { organizationId: orgId } }) },
        { name: 'stockMovements', query: async () => await prisma.stockMovement.count({ where: { organizationId: orgId } }) },
        { name: 'warehouses', query: async () => await prisma.warehouse.count({ where: { organizationId: orgId } }) },
        { name: 'fuelCards', query: async () => await prisma.fuelCard.count({ where: { organizationId: orgId } }) },
        { name: 'departments', query: async () => await prisma.department.count({ where: { organizationId: orgId } }) },
        { name: 'auditLogs', query: async () => await prisma.auditLog.count({ where: { organizationId: orgId } }) },
    ];

    for (const check of checks) {
        try {
            const count = await check.query();
            console.log(`  ${check.name}: ${count}`);
        } catch (e) {
            console.log(`  ${check.name}: ERROR - ${e}`);
        }
    }

    // Check drivers for employees of this org
    console.log('\n🔍 Checking drivers (linked to employees):');
    const drivers = await prisma.$queryRaw`
    SELECT COUNT(*) as cnt FROM drivers d
    JOIN employees e ON d.employee_id = e.id
    WHERE e.organization_id = ${orgId}::uuid
  `;
    console.log('  drivers:', drivers);

    // Check waybillRoutes for waybills of this org  
    console.log('\n🔍 Checking waybillRoutes (linked to waybills):');
    const waybillRoutes = await prisma.$queryRaw`
    SELECT COUNT(*) as cnt FROM waybill_routes wr
    JOIN waybills w ON wr.waybill_id = w.id
    WHERE w.organization_id = ${orgId}::uuid
  `;
    console.log('  waybillRoutes:', waybillRoutes);

    // Check waybillFuel for waybills of this org
    console.log('\n🔍 Checking waybillFuel (linked to waybills):');
    const waybillFuel = await prisma.$queryRaw`
    SELECT COUNT(*) as cnt FROM waybill_fuel wf
    JOIN waybills w ON wf.waybill_id = w.id
    WHERE w.organization_id = ${orgId}::uuid
  `;
    console.log('  waybillFuel:', waybillFuel);

    console.log('\n✅ Check complete\n');
}

checkOrgDependencies()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
