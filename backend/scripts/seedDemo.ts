import { PrismaClient, WaybillStatus, BlankStatus, StockMovementType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting Demo Seed (REL-501)...');

    const suffix = crypto.randomBytes(2).toString('hex');
    const orgName = `Минсельхоз Demo (${suffix})`;
    const deptName = 'Автотранспортный цех';

    // 1. Organization
    console.log(`Creating organization: ${orgName}`);
    const org = await prisma.organization.create({
        data: {
            name: orgName,
            shortName: 'Минсельхоз',
            status: 'Active',
            inn: '7700000001',
        }
    });

    // 2. Department
    const dept = await prisma.department.create({
        data: {
            organizationId: org.id,
            name: deptName,
            code: 'ATC-01'
        }
    });

    // 3. Roles lookup
    const adminRole = await prisma.role.findUnique({ where: { code: 'admin' } });
    const dispatcherRole = await prisma.role.findUnique({ where: { code: 'dispatcher' } });
    const driverRole = await prisma.role.findUnique({ where: { code: 'driver' } });

    if (!adminRole || !dispatcherRole || !driverRole) {
        throw new Error('Roles (admin, dispatcher, driver) must exist. Run main seed first.');
    }

    // 4. Users
    const passwordHash = await bcrypt.hash('pass123', 10);

    console.log('Creating users...');
    const adminUser = await prisma.user.create({
        data: {
            organizationId: org.id,
            email: `admin@minselhoz-${suffix}.demo`,
            passwordHash,
            fullName: 'Иванов Иван (Админ)',
            isActive: true,
        }
    });
    await prisma.userRole.create({ data: { userId: adminUser.id, roleId: adminRole.id } });

    const dispatcherUser = await prisma.user.create({
        data: {
            organizationId: org.id,
            departmentId: dept.id,
            email: `dispatcher@minselhoz-${suffix}.demo`,
            passwordHash,
            fullName: 'Петрова Анна (Диспетчер)',
            isActive: true,
        }
    });
    await prisma.userRole.create({ data: { userId: dispatcherUser.id, roleId: dispatcherRole.id } });

    // 5. Employee + Driver (REL-302 auto-creation test)
    // We'll use the service if possible, or just create directly as the service does.
    console.log('Creating employee and auto-linking driver...');
    const employee = await prisma.employee.create({
        data: {
            organizationId: org.id,
            departmentId: dept.id,
            fullName: 'Сидоров Степан (Водитель)',
            employeeType: 'driver',
            isActive: true,
            documentNumber: '74 00 123456',
            licenseCategory: 'B, C',
        }
    });

    // Manually create Driver since we are not using the service layer here (Prisma direct)
    const driver = await prisma.driver.create({
        data: {
            employeeId: employee.id,
            licenseNumber: employee.documentNumber!,
            licenseCategory: employee.licenseCategory!,
        }
    });

    // 6. Vehicle
    console.log('Creating vehicle with rates...');
    const vehicle = await prisma.vehicle.create({
        data: {
            organizationId: org.id,
            departmentId: dept.id,
            registrationNumber: `М 777 ХЗ ${suffix.slice(0, 2)}`,
            brand: 'КАМАЗ',
            model: '65115',
            fuelType: 'Дизель',
            fuelConsumptionRates: JSON.stringify({
                summerRate: 10,
                winterRate: 12,
                cityIncreasePercent: 10,
                warmingIncreasePercent: 5,
            })
        }
    });

    // 7. Stock Diesel
    const diesel = await prisma.stockItem.create({
        data: {
            organizationId: org.id,
            name: 'Дизельное топливо (Demo)',
            unit: 'л',
            isFuel: true,
        }
    });

    // 8. Blank Batch
    console.log('Creating blank batch and materializing...');
    const batch = await prisma.blankBatch.create({
        data: {
            organizationId: org.id,
            departmentId: dept.id,
            series: 'МСХ',
            numberFrom: 1,
            numberTo: 10,
            createdByUserId: adminUser.id,
        }
    });

    await prisma.blank.createMany({
        data: Array.from({ length: 10 }).map((_, i) => ({
            organizationId: org.id,
            departmentId: dept.id,
            batchId: batch.id,
            series: 'МСХ',
            number: i + 1,
            status: BlankStatus.AVAILABLE,
        }))
    });

    console.log('');
    console.log('✅ Demo Context "Минсельхоз" created successfully!');
    console.log('----------------------------------------------------');
    console.log(`Organization ID: ${org.id}`);
    console.log(`Department ID:   ${dept.id}`);
    console.log(`Driver ID:       ${driver.id}`);
    console.log(`Vehicle ID:      ${vehicle.id}`);
    console.log(`Diesel Item ID:  ${diesel.id}`);
    console.log('----------------------------------------------------');
    console.log('🔑 Login Credentials:');
    console.log(`Admin:      admin@minselhoz-${suffix}.demo / pass123`);
    console.log(`Dispatcher: dispatcher@minselhoz-${suffix}.demo / pass123`);
    console.log('----------------------------------------------------');
}

main()
    .catch((e) => {
        console.error('❌ Demo seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
