// Seed script for TypeORM - Create test admin user
import 'reflect-metadata';
import { AppDataSource } from './data-source';
import { User } from '../entities/User';
import { Organization } from '../entities/Organization';
import bcrypt from 'bcrypt';

async function seed() {
    console.log('🌱 Starting seed...');

    // Initialize DataSource
    await AppDataSource.initialize();
    console.log('✅ Database connection established');

    const userRepo = AppDataSource.getRepository(User);
    const orgRepo = AppDataSource.getRepository(Organization);

    // Check if admin user already exists
    const existingAdmin = await userRepo.findOne({ where: { email: 'admin@example.com' } });
    if (existingAdmin) {
        console.log('⚠️  Admin user already exists, skipping...');
        await AppDataSource.destroy();
        return;
    }

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

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const adminUser = userRepo.create({
        email: 'admin@example.com',
        passwordHash: hashedPassword,
        fullName: 'Администратор',
        role: 'admin',
        organizationId: testOrg.id,
        isActive: true,
    });

    await userRepo.save(adminUser);
    console.log('✅ Created admin user');
    console.log('📧 Email: admin@example.com');
    console.log('🔑 Password: admin123');

    await AppDataSource.destroy();
    console.log('🎉 Seed completed successfully!');
}

seed().catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
});
