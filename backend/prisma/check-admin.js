const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
    // Check if admin user exists
    const adminUser = await prisma.user.findFirst({
        where: { email: 'admin@waybills.local' },
        include: { roles: { include: { role: true } } }
    });

    if (adminUser) {
        console.log('✅ Admin user exists:', adminUser.email);
        console.log('   Roles:', adminUser.roles.map(r => r.role.code).join(', ') || 'none');
    } else {
        console.log('❌ Admin user NOT FOUND');

        // Get organization (use first one or create)
        let org = await prisma.organization.findFirst();
        if (!org) {
            org = await prisma.organization.create({
                data: {
                    name: 'Default Organization',
                    shortName: 'DefaultOrg',
                }
            });
            console.log('   Created default organization');
        }

        // Get admin role
        let adminRole = await prisma.role.findFirst({ where: { code: 'admin' } });
        if (!adminRole) {
            adminRole = await prisma.role.create({
                data: { code: 'admin', name: 'Администратор' }
            });
            console.log('   Created admin role');
        }

        // Create admin user with password '123'
        const passwordHash = await bcrypt.hash('123', 10);
        const newAdmin = await prisma.user.create({
            data: {
                email: 'admin@waybills.local',
                passwordHash,
                fullName: 'Administrator',
                organizationId: org.id,
                roles: {
                    create: { roleId: adminRole.id }
                }
            }
        });
        console.log('✅ Created admin user:', newAdmin.email);
    }

    // Count all users
    const userCount = await prisma.user.count();
    console.log('📊 Total users in DB:', userCount);
}

main()
    .catch(e => console.error('Error:', e))
    .finally(() => prisma.$disconnect());
