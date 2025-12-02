import { PrismaClient, WaybillStatus, BlankStatus, StockMovementType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting seed...');

    // ============================================================================
    // 1. ROLES - 8 ролей
    // ============================================================================
    console.log('Creating roles...');

    const roles = await Promise.all([
        prisma.role.create({
            data: { code: 'admin', name: 'Администратор', description: 'Полный доступ ко всем функциям' },
        }),
        prisma.role.create({
            data: { code: 'dispatcher', name: 'Диспетчер', description: 'Управление ПЛ и транспортом' },
        }),
        prisma.role.create({
            data: { code: 'mechanic', name: 'Механик/Кладовщик', description: 'Управление складом и бланками' },
        }),
        prisma.role.create({
            data: { code: 'driver', name: 'Водитель', description: 'Работа с путевыми листами' },
        }),
        prisma.role.create({
            data: { code: 'reviewer', name: 'Проверяющий', description: 'Проверка и утверждение ПЛ' },
        }),
        prisma.role.create({
            data: { code: 'accountant', name: 'Бухгалтер', description: 'Проведение документов' },
        }),
        prisma.role.create({
            data: { code: 'auditor', name: 'Аудитор', description: 'Просмотр логов и отчётов' },
        }),
        prisma.role.create({
            data: { code: 'viewer', name: 'Наблюдатель', description: 'Только просмотр' },
        }),
    ]);

    const roleMap = Object.fromEntries(roles.map(r => [r.code, r]));

    // ============================================================================
    // 2. PERMISSIONS - 36 прав
    // ============================================================================
    console.log('Creating permissions...');

    const permissionCodes = [
        // Waybills
        'waybill.create', 'waybill.submit', 'waybill.post', 'waybill.cancel',
        'waybill.backdate', 'waybill.correct',
        // Blanks
        'blanks.issue', 'blanks.return', 'blanks.spoil.self', 'blanks.spoil.warehouse',
        'blanks.spoil.override',
        // RBAC
        'rbac.delegate',
        // Audit
        'audit.business.read', 'audit.read', 'audit.diff', 'audit.rollback', 'audit.delete',
        // Admin
        'admin.panel',
        // Import/Export
        'import.run', 'import.limited', 'export.run',
        // Stock
        'stock.view', 'stock.create', 'stock.update', 'stock.delete',
        // Vehicles
        'vehicle.view', 'vehicle.create', 'vehicle.update', 'vehicle.delete',
        // Drivers
        'driver.view', 'driver.create', 'driver.update', 'driver.delete',
        // Organizations
        'org.manage',
    ];

    const permissions = await Promise.all(
        permissionCodes.map(code =>
            prisma.permission.create({ data: { code, description: `Permission: ${code}` } })
        )
    );

    const permMap = Object.fromEntries(permissions.map(p => [p.code, p]));

    // ============================================================================
    // 3. ROLE-PERMISSION mappings
    // ============================================================================
    console.log('Mapping role permissions...');

    const rolePolicies: Record<string, string[]> = {
        admin: permissionCodes, // все права
        dispatcher: [
            'waybill.create', 'waybill.submit', 'waybill.cancel',
            'vehicle.view', 'vehicle.create', 'vehicle.update',
            'driver.view', 'driver.create', 'driver.update',
            'stock.view', 'blanks.issue', 'blanks.return',
        ],
        mechanic: [
            'blanks.issue', 'blanks.return', 'blanks.spoil.warehouse',
            'stock.view', 'stock.create', 'stock.update',
        ],
        driver: ['waybill.create', 'waybill.submit', 'blanks.spoil.self'],
        reviewer: ['waybill.submit', 'audit.business.read', 'waybill.view'],
        accountant: ['waybill.post', 'audit.business.read', 'export.run'],
        auditor: ['audit.read', 'audit.diff', 'audit.business.read'],
        viewer: ['audit.read'],
    };

    for (const [roleCode, permCodes] of Object.entries(rolePolicies)) {
        const role = roleMap[roleCode];
        for (const permCode of permCodes) {
            const perm = permMap[permCode];
            if (role && perm) {
                await prisma.rolePermission.create({
                    data: { roleId: role.id, permissionId: perm.id },
                });
            }
        }
    }

    // ============================================================================
    // 4. ORGANIZATION
    // ============================================================================
    console.log('Creating organization...');

    const org = await prisma.organization.create({
        data: {
            name: 'ООО "Тестовая Транспортная Компания"',
            inn: '7401234567',
            kpp: '740101001',
            address: 'г. Челябинск, ул. Транспортная, д. 1',
        },
    });

    // ============================================================================
    // 5. DEPARTMENTS
    // ============================================================================
    console.log('Creating departments...');

    const mainDept = await prisma.department.create({
        data: {
            organizationId: org.id,
            code: 'MAIN',
            name: 'Главное подразделение',
            address: org.address,
        },
    });

    const branchDept = await prisma.department.create({
        data: {
            organizationId: org.id,
            code: 'BRANCH-01',
            name: 'Филиал №1',
            address: 'г. Челябинск, ул. Филиальная, д. 5',
        },
    });

    // ============================================================================
    // 6. USERS
    // ============================================================================
    console.log('Creating users...');

    const passwordHash = await bcrypt.hash('123', 10);

    const adminUser = await prisma.user.create({
        data: {
            organizationId: org.id,
            email: 'admin',
            passwordHash,
            fullName: 'Иванов Иван Иванович',
            isActive: true,
        },
    });

    await prisma.userRole.create({
        data: { userId: adminUser.id, roleId: roleMap.admin.id },
    });

    const dispatcherUser = await prisma.user.create({
        data: {
            organizationId: org.id,
            departmentId: mainDept.id,
            email: 'dispatcher@test.ru',
            passwordHash,
            fullName: 'Петров Петр Петрович',
        },
    });

    await prisma.userRole.create({
        data: { userId: dispatcherUser.id, roleId: roleMap.dispatcher.id },
    });

    const mechanicUser = await prisma.user.create({
        data: {
            organizationId: org.id,
            departmentId: mainDept.id,
            email: 'mechanic@test.ru',
            passwordHash,
            fullName: 'Сидоров Сидор Сидорович',
        },
    });

    await prisma.userRole.create({
        data: { userId: mechanicUser.id, roleId: roleMap.mechanic.id },
    });

    // ============================================================================
    // 7. EMPLOYEES & DRIVERS
    // ============================================================================
    console.log('Creating employees and drivers...');

    const emp1 = await prisma.employee.create({
        data: {
            organizationId: org.id,
            departmentId: mainDept.id,
            fullName: 'Водителев Василий Васильевич',
            position: 'Водитель',
            phone: '+7 912 345-67-01',
        },
    });

    const driver1 = await prisma.driver.create({
        data: {
            employeeId: emp1.id,
            licenseNumber: '7401 123456',
            licenseCategory: 'B, C',
            licenseValidTo: new Date('2027-12-31'),
        },
    });

    const emp2 = await prisma.employee.create({
        data: {
            organizationId: org.id,
            departmentId: branchDept.id,
            fullName: 'Рулёв Руслан Рулевич',
            position: 'Водитель',
            phone: '+7 912 345-67-02',
        },
    });

    const driver2 = await prisma.driver.create({
        data: {
            employeeId: emp2.id,
            licenseNumber: '7401 654321',
            licenseCategory: 'B, C, D',
            licenseValidTo: new Date('2026-06-30'),
        },
    });

    const emp3 = await prisma.employee.create({
        data: {
            organizationId: org.id,
            departmentId: mainDept.id,
            fullName: 'Газов Григорий Гаврилович',
            position: 'Водитель',
            phone: '+7 912 345-67-03',
        },
    });

    const driver3 = await prisma.driver.create({
        data: {
            employeeId: emp3.id,
            licenseNumber: '7401 111222',
            licenseCategory: 'B, C, E',
            licenseValidTo: new Date('2028-03-15'),
        },
    });

    // ============================================================================
    // 8. VEHICLES
    // ============================================================================
    console.log('Creating vehicles...');

    const vehicle1 = await prisma.vehicle.create({
        data: {
            organizationId: org.id,
            departmentId: mainDept.id,
            code: 'A001',
            registrationNumber: 'В123АВ174',
            brand: 'КАМАЗ',
            model: '65115',
            vin: 'XTC65115012345678',
            fuelType: 'Дизель',
            fuelTankCapacity: 250,
        },
    });

    const vehicle2 = await prisma.vehicle.create({
        data: {
            organizationId: org.id,
            departmentId: branchDept.id,
            code: 'A002',
            registrationNumber: 'С456СД174',
            brand: 'ГАЗель NEXT',
            model: 'A21R22',
            vin: 'XTH21R220A1234567',
            fuelType: 'Бензин АИ-92',
            fuelTankCapacity: 105,
        },
    });

    const vehicle3 = await prisma.vehicle.create({
        data: {
            organizationId: org.id,
            departmentId: mainDept.id,
            code: 'A003',
            registrationNumber: 'Е789ЕК174',
            brand: 'МАЗ',
            model: '6312',
            vin: 'Y3M631200L1234567',
            fuelType: 'Дизель',
            fuelTankCapacity: 300,
        },
    });

    // ============================================================================
    // 9. FUEL CARDS
    // ============================================================================
    console.log('Creating fuel cards...');

    await prisma.fuelCard.create({
        data: {
            organizationId: org.id,
            cardNumber: '1234-5678-9012-3456',
            provider: 'Лукойл',
            assignedToDriverId: driver1.id,
            assignedToVehicleId: vehicle1.id,
        },
    });

    await prisma.fuelCard.create({
        data: {
            organizationId: org.id,
            cardNumber: '9876-5432-1098-7654',
            provider: 'Газпром',
            assignedToDriverId: driver2.id,
            assignedToVehicleId: vehicle2.id,
        },
    });

    // ============================================================================
    // 10. WAREHOUSES
    // ============================================================================
    console.log('Creating warehouses...');

    const warehouse1 = await prisma.warehouse.create({
        data: {
            organizationId: org.id,
            departmentId: mainDept.id,
            name: 'Центральный склад ГСМ',
            address: 'г. Челябинск, ул. Складская, д. 10',
        },
    });

    const warehouse2 = await prisma.warehouse.create({
        data: {
            organizationId: org.id,
            departmentId: branchDept.id,
            name: 'Склад филиала',
            address: 'г. Челябинск, ул. Филиальная, д. 5, стр. 2',
        },
    });

    // ============================================================================
    // 11. STOCK ITEMS
    // ============================================================================
    console.log('Creating stock items...');

    const diesel = await prisma.stockItem.create({
        data: {
            organizationId: org.id,
            code: 'FUEL-001',
            name: 'Дизельное топливо (зимнее)',
            unit: 'л',
            isFuel: true,
        },
    });

    const petrol92 = await prisma.stockItem.create({
        data: {
            organizationId: org.id,
            code: 'FUEL-002',
            name: 'Бензин АИ-92',
            unit: 'л',
            isFuel: true,
        },
    });

    const petrol95 = await prisma.stockItem.create({
        data: {
            organizationId: org.id,
            code: 'FUEL-003',
            name: 'Бензин АИ-95',
            unit: 'л',
            isFuel: true,
        },
    });

    const oil = await prisma.stockItem.create({
        data: {
            organizationId: org.id,
            code: 'MAT-001',
            name: 'Масло моторное 10W-40',
            unit: 'л',
            isFuel: false,
        },
    });

    // Приход топлива на склад
    await prisma.stockMovement.create({
        data: {
            organizationId: org.id,
            warehouseId: warehouse1.id,
            stockItemId: diesel.id,
            movementType: StockMovementType.INCOME,
            quantity: 5000,
            documentType: 'INVOICE',
            comment: 'Приход от поставщика',
            createdByUserId: dispatcherUser.id,
        },
    });

    await prisma.stockMovement.create({
        data: {
            organizationId: org.id,
            warehouseId: warehouse1.id,
            stockItemId: petrol92.id,
            movementType: StockMovementType.INCOME,
            quantity: 3000,
            documentType: 'INVOICE',
            comment: 'Приход от поставщика',
            createdByUserId: dispatcherUser.id,
        },
    });

    // ============================================================================
    // 12. BLANK BATCHES & BLANKS
    // ============================================================================
    console.log('Creating blank batches and blanks...');

    const blankBatch = await prisma.blankBatch.create({
        data: {
            organizationId: org.id,
            departmentId: mainDept.id,
            series: 'ЧБ',
            numberFrom: 1,
            numberTo: 100,
            createdByUserId: mechanicUser.id,
        },
    });

    // Создаём 100 бланков
    const blanks = [];
    for (let i = 1; i <= 100; i++) {
        blanks.push({
            organizationId: org.id,
            departmentId: mainDept.id,
            batchId: blankBatch.id,
            series: 'ЧБ',
            number: i,
            status: BlankStatus.AVAILABLE,
        });
    }
    await prisma.blank.createMany({ data: blanks });

    // Выдать несколько бланков водителям
    const blank1 = await prisma.blank.findFirst({
        where: { series: 'ЧБ', number: 1 },
    });
    if (blank1) {
        await prisma.blank.update({
            where: { id: blank1.id },
            data: {
                status: BlankStatus.ISSUED,
                issuedToDriverId: driver1.id,
                issuedToVehicleId: vehicle1.id,
                issuedAt: new Date(),
            },
        });
    }

    // ============================================================================
    // 13. WAYBILLS
    // ============================================================================
    console.log('Creating waybills...');

    const waybill1 = await prisma.waybill.create({
        data: {
            organizationId: org.id,
            departmentId: mainDept.id,
            number: 'ПЛ-001',
            date: new Date('2025-11-28'),
            vehicleId: vehicle1.id,
            driverId: driver1.id,
            blankId: blank1?.id,
            status: WaybillStatus.SUBMITTED,
            odometerStart: 12345.5,
            plannedRoute: 'Челябинск - Екатеринбург - Челябинск',
            createdByUserId: dispatcherUser.id,
        },
    });

    // Маршрут
    await prisma.waybillRoute.createMany({
        data: [
            {
                waybillId: waybill1.id,
                legOrder: 1,
                fromPoint: 'Челябинск, ул. Транспортная, 1',
                toPoint: 'Екатеринбург, ул. Грузовая, 10',
                distanceKm: 210,
            },
            {
                waybillId: waybill1.id,
                legOrder: 2,
                fromPoint: 'Екатеринбург, ул. Грузовая, 10',
                toPoint: 'Челябинск, ул. Транспортная, 1',
                distanceKm: 210,
            },
        ],
    });

    // Топливо
    await prisma.waybillFuel.create({
        data: {
            waybillId: waybill1.id,
            stockItemId: diesel.id,
            fuelStart: 150,
            fuelReceived: 100,
            fuelConsumed: 85,
            fuelEnd: 165,
        },
    });

    // Второй ПЛ
    const waybill2 = await prisma.waybill.create({
        data: {
            organizationId: org.id,
            departmentId: branchDept.id,
            number: 'ПЛ-001',
            date: new Date('2025-11-28'),
            vehicleId: vehicle2.id,
            driverId: driver2.id,
            status: WaybillStatus.DRAFT,
            odometerStart: 54321.0,
            plannedRoute: 'Челябинск - Копейск - Челябинск',
            createdByUserId: dispatcherUser.id,
        },
    });

    // ============================================================================
    // 14. AUDIT LOG
    // ============================================================================
    console.log('Creating audit log entries...');

    await prisma.auditLog.create({
        data: {
            organizationId: org.id,
            userId: dispatcherUser.id,
            actionType: 'CREATE',
            entityType: 'WAYBILL',
            entityId: waybill1.id,
            description: 'Создан путевой лист ПЛ-001',
            newValue: { number: 'ПЛ-001', status: 'ISSUED' },
        },
    });

    await prisma.auditLog.create({
        data: {
            organizationId: org.id,
            userId: mechanicUser.id,
            actionType: 'CREATE',
            entityType: 'BLANK_BATCH',
            entityId: blankBatch.id,
            description: 'Создана партия бланков ЧБ 1-100',
        },
    });

    console.log('✅ Seed completed successfully!');
    console.log('');
    console.log('📊 Created:');
    console.log(`   - ${roles.length} roles`);
    console.log(`   - ${permissions.length} permissions`);
    console.log(`   - 1 organization`);
    console.log(`   - 2 departments`);
    console.log(`   - 3 users (admin, dispatcher, mechanic)`);
    console.log(`   - 3 drivers`);
    console.log(`   - 3 vehicles`);
    console.log(`   - 2 fuel cards`);
    console.log(`   - 2 warehouses`);
    console.log(`   - 4 stock items`);
    console.log(`   - 100 blanks (ЧБ 1-100)`);
    console.log(`   - 2 waybills`);
    console.log('');
    console.log('🔑 Test credentials:');
    console.log('   admin / 123 (admin)');
    console.log('   dispatcher@test.ru / password123 (dispatcher)');
    console.log('   mechanic@test.ru / password123 (mechanic)');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
