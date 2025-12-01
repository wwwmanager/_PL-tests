// Seed script for TypeORM - Create test admin user, employees, and vehicles
import 'reflect-metadata';
import { AppDataSource } from './data-source';
import { User } from '../entities/User';
import { Organization } from '../entities/Organization';
import { Employee } from '../entities/Employee';
import { Vehicle } from '../entities/Vehicle';
import { Department } from '../entities/Department';
import bcrypt from 'bcrypt';

async function seed() {
    console.log('🌱 Starting seed...');

    // Initialize DataSource
    await AppDataSource.initialize();
    console.log('✅ Database connection established');

    const userRepo = AppDataSource.getRepository(User);
    const orgRepo = AppDataSource.getRepository(Organization);
    const deptRepo = AppDataSource.getRepository(Department);
    const employeeRepo = AppDataSource.getRepository(Employee);
    const vehicleRepo = AppDataSource.getRepository(Vehicle);

    // Create test organization if it doesn't exist
    let testOrg = await orgRepo.findOne({ where: { name: 'Test Organization' } });
    if (!testOrg) {
        testOrg = orgRepo.create({
            name: 'Test Organization',
            inn: '1234567890',
            kpp: '123456789',
            address: 'Test Address',
        });
        await orgRepo.save(testOrg);
        console.log('✅ Created test organization');
    }

    // Create test department
    let testDept = await deptRepo.findOne({ where: { name: 'Транспортный отдел', organizationId: testOrg.id } });
    if (!testDept) {
        testDept = deptRepo.create({
            name: 'Транспортный отдел',
            code: 'TRANS-01',
            organizationId: testOrg.id,
            address: 'Test Address',
        });
        await deptRepo.save(testDept);
        console.log('✅ Created test department');
    }

    // Check if admin user already exists
    const existingAdmin = await userRepo.findOne({ where: { email: 'admin@example.com' } });
    if (!existingAdmin) {
        // Create admin user
        const hashedPassword = await bcrypt.hash('password', 10);
        const adminUser = userRepo.create({
            email: 'admin@example.com',
            passwordHash: hashedPassword,
            fullName: 'Администратор',
            role: 'admin',
            organizationId: testOrg.id,
            departmentId: testDept.id,
            isActive: true,
        });

        await userRepo.save(adminUser);
        console.log('✅ Created admin user');
        console.log('📧 Email: admin@example.com');
        console.log('🔑 Password: password');
    } else {
        console.log('⚠️  Admin user already exists, skipping...');
    }

    // Create test employees (drivers) if they don't exist
    const existingEmployees = await employeeRepo.count({ where: { organizationId: testOrg.id } });
    if (existingEmployees === 0) {
        const employees = [
            {
                fullName: 'Иванов Иван Иванович',
                shortName: 'Иванов И.И.',
                employeeType: 'driver' as const,
                position: 'Водитель',
                personnelNumber: 'DRV-001',
                licenseCategory: 'B,C,D',
                documentNumber: '1234567890',
                documentExpiry: '2030-01-15',
                medicalCertificateIssueDate: '2024-01-01',
                medicalCertificateExpiryDate: '2025-01-01',
            },
            {
                fullName: 'Петров Петр Петрович',
                shortName: 'Петров П.П.',
                employeeType: 'driver' as const,
                position: 'Водитель',
                personnelNumber: 'DRV-002',
                licenseCategory: 'B,C',
                documentNumber: '0987654321',
                documentExpiry: '2029-06-20',
                medicalCertificateIssueDate: '2024-02-01',
                medicalCertificateExpiryDate: '2025-02-01',
            },
            {
                fullName: 'Сидоров Сидор Сидорович',
                shortName: 'Сидоров С.С.',
                employeeType: 'driver' as const,
                position: 'Водитель',
                personnelNumber: 'DRV-003',
                licenseCategory: 'B,C,D,E',
                documentNumber: '1122334455',
                documentExpiry: '2028-03-10',
                medicalCertificateIssueDate: '2024-03-01',
                medicalCertificateExpiryDate: '2025-03-01',
            },
        ];

        for (const empData of employees) {
            const employee = employeeRepo.create({
                ...empData,
                organizationId: testOrg.id,
                departmentId: testDept.id,
                isActive: true,
            });
            await employeeRepo.save(employee);
        }
        console.log('✅ Created 3 test employees (drivers)');
    } else {
        console.log(`⚠️  ${existingEmployees} employees already exist, skipping...`);
    }

    // Create test vehicles if they don't exist
    const existingVehicles = await vehicleRepo.count({ where: { organizationId: testOrg.id } });
    if (existingVehicles === 0) {
        const vehicles = [
            {
                plateNumber: 'А123БВ777',
                brand: 'ГАЗель',
                model: 'Next',
                year: 2022,
                vin: 'XTH33140LJ0123456',
                registrationCertificate: 'РС1234567',
                mileage: 15000,
                currentFuel: 50,
                fuelTankCapacity: '80',  // String for numeric type
                organizationId: testOrg.id,
                departmentId: testDept.id,
                isActive: true,
            },
            {
                plateNumber: 'В456ГД777',
                brand: 'КамАЗ',
                model: '65115',
                year: 2021,
                vin: 'XTC65115LK0987654',
                registrationCertificate: 'РС7654321',
                mileage: 45000,
                currentFuel: 120,
                fuelTankCapacity: '250',  // String for numeric type
                organizationId: testOrg.id,
                departmentId: testDept.id,
                isActive: true,
            },
            {
                plateNumber: 'С789ЕЖ777',
                brand: 'МАЗ',
                model: '5440',
                year: 2020,
                vin: 'Y3M5440LM0111222',
                registrationCertificate: 'РС1112223',
                mileage: 78000,
                currentFuel: 80,
                fuelTankCapacity: '200',  // String for numeric type
                organizationId: testOrg.id,
                departmentId: testDept.id,
                isActive: true,
            },
        ];

        for (const vehData of vehicles) {
            const vehicle = vehicleRepo.create(vehData as any);
            await vehicleRepo.save(vehicle);
        }
        console.log('✅ Created 3 test vehicles');
    } else {
        console.log(`⚠️  ${existingVehicles} vehicles already exist, skipping...`);
    }

    await AppDataSource.destroy();
    console.log('🎉 Seed completed successfully!');
}

seed().catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
});
