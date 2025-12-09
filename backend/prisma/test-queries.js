const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function test() {
    try {
        console.log('Testing ALL Prisma queries used in getDataPreview...');

        console.log('1. waybill.findMany...');
        const waybills = await prisma.waybill.findMany({ select: { id: true, number: true, date: true }, take: 100 });
        console.log('   Waybills:', waybills.length);

        console.log('2. blank.findMany...');
        const blanks = await prisma.blank.findMany({ select: { id: true, series: true, number: true, status: true }, take: 200 });
        console.log('   Blanks:', blanks.length);

        console.log('3. blankBatch.findMany...');
        const blankBatches = await prisma.blankBatch.findMany({ select: { id: true, series: true, numberFrom: true, numberTo: true } });
        console.log('   BlankBatches:', blankBatches.length);

        console.log('4. employee.findMany...');
        const employees = await prisma.employee.findMany({ select: { id: true, fullName: true, position: true } });
        console.log('   Employees:', employees.length);

        console.log('5. driver.findMany...');
        const drivers = await prisma.driver.findMany({ select: { id: true, licenseNumber: true, employee: { select: { fullName: true } } } });
        console.log('   Drivers:', drivers.length);

        console.log('6. vehicle.findMany...');
        const vehicles = await prisma.vehicle.findMany({ select: { id: true, registrationNumber: true, brand: true, model: true } });
        console.log('   Vehicles:', vehicles.length);

        console.log('7. route.findMany...');
        const routes = await prisma.route.findMany({ select: { id: true, name: true } });
        console.log('   Routes:', routes.length);

        console.log('8. fuelType.findMany...');
        const fuelTypes = await prisma.fuelType.findMany({ select: { id: true, code: true, name: true } });
        console.log('   FuelTypes:', fuelTypes.length);

        console.log('9. fuelCard.findMany...');
        const fuelCards = await prisma.fuelCard.findMany({ select: { id: true, cardNumber: true, provider: true } });
        console.log('   FuelCards:', fuelCards.length);

        console.log('10. warehouse.findMany...');
        const warehouses = await prisma.warehouse.findMany({ select: { id: true, name: true, address: true } });
        console.log('   Warehouses:', warehouses.length);

        console.log('11. stockItem.findMany...');
        const stockItems = await prisma.stockItem.findMany({ select: { id: true, code: true, name: true, unit: true } });
        console.log('   StockItems:', stockItems.length);

        console.log('12. stockMovement.findMany...');
        const stockMovements = await prisma.stockMovement.findMany({ select: { id: true, movementType: true, quantity: true, createdAt: true }, take: 100 });
        console.log('   StockMovements:', stockMovements.length);

        console.log('13. department.findMany...');
        const departments = await prisma.department.findMany({ select: { id: true, code: true, name: true } });
        console.log('   Departments:', departments.length);

        console.log('14. setting.findMany...');
        const settings = await prisma.setting.findMany({ select: { key: true } });
        console.log('   Settings:', settings.length, settings);

        console.log('15. auditLog.findMany...');
        const auditLogs = await prisma.auditLog.findMany({ select: { id: true, actionType: true, entityType: true, createdAt: true }, take: 100, orderBy: { createdAt: 'desc' } });
        console.log('   AuditLogs:', auditLogs.length);

        console.log('\n✅ All queries OK!');
    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

test();
