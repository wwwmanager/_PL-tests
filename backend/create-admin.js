const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Creating Admin User ---');

    // First, ensure we have an organization
    let org = await prisma.organization.findFirst();

    if (!org) {
        console.log('Creating default organization...');
        org = await prisma.organization.create({
            data: {
                fullName: 'Главная организация',
                shortName: 'Главная',
                address: 'Россия',
                inn: '000000000000',
            }
        });
        console.log('✅ Created organization:', org.shortName);
    } else {
        console.log('Found organization:', org.shortName);
    }

    // Check if admin role exists
    let adminRole = await prisma.role.findFirst({
        where: { code: 'admin' }
    });

    if (!adminRole) {
        console.log('Creating admin role...');
        adminRole = await prisma.role.create({
            data: {
                code: 'admin',
                name: 'Администратор',
                description: 'Полный доступ'
            }
        });
        console.log('✅ Created admin role');
    }

    const passwordHash = await bcrypt.hash('111', 10);

    // Check if admin user exists
    let adminUser = await prisma.user.findFirst({
        where: { email: 'admin@waybills.local' }
    });

    if (!adminUser) {
        console.log('Creating admin user...');
        adminUser = await prisma.user.create({
            data: {
                email: 'admin@waybills.local',
                fullName: 'Администратор',
                passwordHash,
                isActive: true,
                organizationId: org.id
            }
        });
        console.log('✅ Created admin user:', adminUser.id);
    } else {
        console.log('Admin user exists, resetting password...');
        await prisma.user.update({
            where: { id: adminUser.id },
            data: { passwordHash, organizationId: org.id }
        });
        console.log('✅ Password reset');
    }

    // Link admin user to admin role
    const existingUserRole = await prisma.userRole.findFirst({
        where: { userId: adminUser.id, roleId: adminRole.id }
    });

    if (!existingUserRole) {
        await prisma.userRole.create({
            data: { userId: adminUser.id, roleId: adminRole.id }
        });
        console.log('✅ Linked admin user to admin role');
    }

    console.log('\n========================================');
    console.log('Admin login: admin@waybills.local');
    console.log('Password: 111');
    console.log('========================================');
}

main().catch(console.error).finally(() => prisma.$disconnect());
