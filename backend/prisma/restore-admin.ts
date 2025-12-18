import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function restoreAdmin() {
    console.log('🔧 Restoring admin user...');

    // Check if admin exists
    const existingAdmin = await prisma.user.findFirst({
        where: {
            OR: [
                { email: { startsWith: 'admin@' } },
                { fullName: 'Системный Администратор' }
            ]
        },
        include: {
            organization: true,
            roles: { include: { role: true } }
        }
    });

    if (existingAdmin) {
        console.log('✅ Admin user found:', existingAdmin.email);
        console.log('   Organization:', existingAdmin.organization?.shortName || existingAdmin.organization?.name);
        console.log('   isActive:', existingAdmin.isActive);
        console.log('   Current roles:', existingAdmin.roles.map(r => r.role.code).join(', ') || 'NONE');

        // Reset password to 123
        const passwordHash = await bcrypt.hash('123', 10);
        await prisma.user.update({
            where: { id: existingAdmin.id },
            data: {
                passwordHash,
                isActive: true,
                isSystem: true
            }
        });
        console.log('✅ Password reset to "123"');

        // Ensure admin role is assigned
        let adminRole = await prisma.role.findUnique({ where: { code: 'admin' } });
        if (!adminRole) {
            adminRole = await prisma.role.create({
                data: { code: 'admin', name: 'Администратор', description: 'Полный доступ' }
            });
            console.log('✅ Admin role created');
        }

        // Check if admin role is already assigned
        const hasAdminRole = existingAdmin.roles.some(r => r.role.code === 'admin');
        if (!hasAdminRole) {
            // Remove existing roles and add admin role
            await prisma.userRole.deleteMany({ where: { userId: existingAdmin.id } });
            await prisma.userRole.create({
                data: {
                    userId: existingAdmin.id,
                    roleId: adminRole.id
                }
            });
            console.log('✅ Admin role assigned');
        } else {
            console.log('✅ Admin role already assigned');
        }
    } else {
        console.log('❌ Admin user not found. Creating new admin...');

        // Get first organization or create one
        let org = await prisma.organization.findFirst();
        if (!org) {
            org = await prisma.organization.create({
                data: {
                    name: 'Default Organization',
                    shortName: 'Default',
                    status: 'Active'
                }
            });
        }

        // Get admin role
        let adminRole = await prisma.role.findUnique({ where: { code: 'admin' } });
        if (!adminRole) {
            adminRole = await prisma.role.create({
                data: { code: 'admin', name: 'Администратор', description: 'Полный доступ' }
            });
        }

        const passwordHash = await bcrypt.hash('123', 10);
        const newAdmin = await prisma.user.create({
            data: {
                email: 'admin@waybills.local',
                passwordHash,
                fullName: 'Системный Администратор',
                isActive: true,
                isSystem: true,
                organizationId: org.id,
                roles: {
                    create: { roleId: adminRole.id }
                }
            }
        });
        console.log('✅ Admin user created:', newAdmin.email);
    }

    console.log('');
    console.log('🔑 Login with:');
    console.log('   Email: admin');
    console.log('   Password: 123');
}

restoreAdmin()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
