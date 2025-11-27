import { prisma } from '../src/db/prisma';
import { hashPassword } from '../src/utils/password';

async function seed() {
    console.log('🌱 Seeding database...');

    // Создаем организацию
    const org = await prisma.organization.upsert({
        where: { id: 'test-org-id' },
        update: {},
        create: {
            id: 'test-org-id',
            name: 'Тестовая организация'
        }
    });

    console.log('✅ Organization created:', org.name);

    // Создаем администратора
    const passwordHash = await hashPassword('admin123');
    const admin = await prisma.user.upsert({
        where: { email: 'admin@test.ru' },
        update: {},
        create: {
            email: 'admin@test.ru',
            passwordHash,
            fullName: 'Администратор Системы',
            role: 'admin',
            organizationId: org.id
        }
    });

    console.log('✅ Admin user created:', admin.email);
    console.log('📧 Email: admin@test.ru');
    console.log('🔑 Password: admin123');

    // Создаем диспетчера
    const dispatcherHash = await hashPassword('dispatcher123');
    const dispatcher = await prisma.user.upsert({
        where: { email: 'dispatcher@test.ru' },
        update: {},
        create: {
            email: 'dispatcher@test.ru',
            passwordHash: dispatcherHash,
            fullName: 'Диспетчер Иванов',
            role: 'dispatcher',
            organizationId: org.id
        }
    });

    console.log('✅ Dispatcher user created:', dispatcher.email);
    console.log('📧 Email: dispatcher@test.ru');
    console.log('🔑 Password: dispatcher123');

    // Создаем несколько тестовых ТС
    const vehicles = await Promise.all([
        prisma.vehicle.create({
            data: {
                organizationId: org.id,
                code: 'ТС-001',
                registrationNumber: 'А123БВ74',
                brand: 'КАМАЗ',
                model: '5320',
                fuelType: 'diesel'
            }
        }),
        prisma.vehicle.create({
            data: {
                organizationId: org.id,
                code: 'ТС-002',
                registrationNumber: 'В456ГД74',
                brand: 'ГАЗ',
                model: '3307',
                fuelType: 'petrol'
            }
        })
    ]);

    console.log(`✅ Created ${vehicles.length} test vehicles`);

    // Создаем тестовых водителей
    const employee1 = await prisma.employee.create({
        data: {
            organizationId: org.id,
            fullName: 'Петров Иван Сергеевич',
            position: 'Водитель',
            phone: '+7-912-345-67-89',
            driver: {
                create: {
                    licenseNumber: '7412345678',
                    licenseCategory: 'C,D',
                    licenseValidTo: new Date('2026-12-31')
                }
            }
        },
        include: { driver: true }
    });

    const employee2 = await prisma.employee.create({
        data: {
            organizationId: org.id,
            fullName: 'Сидоров Петр Александрович',
            position: 'Водитель',
            phone: '+7-912-765-43-21',
            driver: {
                create: {
                    licenseNumber: '7498765432',
                    licenseCategory: 'B,C',
                    licenseValidTo: new Date('2027-06-30')
                }
            }
        },
        include: { driver: true }
    });

    console.log(`✅ Created 2 test drivers`);

    // Создаем несколько тестовых путевых листов
    if (employee1.driver && employee2.driver) {
        await prisma.waybill.create({
            data: {
                organizationId: org.id,
                number: 'ПЛ-001',
                date: new Date('2024-01-15'),
                vehicleId: vehicles[0].id,
                driverId: employee1.driver.id,
                status: 'DRAFT',
                odometerStart: 12500,
                plannedRoute: 'Челябинск - Екатеринбург'
            }
        });

        await prisma.waybill.create({
            data: {
                organizationId: org.id,
                number: 'ПЛ-002',
                date: new Date('2024-01-16'),
                vehicleId: vehicles[1].id,
                driverId: employee2.driver.id,
                status: 'APPROVED',
                odometerStart: 45200,
                plannedRoute: 'Челябинск - Курган'
            }
        });

        console.log(`✅ Created 2 test waybills`);
    }

    console.log('\n🎉 Seeding completed successfully!');
}

seed()
    .catch((error) => {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
