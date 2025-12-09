// Script to restore admin role for admin user
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Find admin user
    const adminUser = await prisma.user.findUnique({
        where: { email: 'admin' }
    });

    if (!adminUser) {
        console.log('Admin user not found!');
        return;
    }

    // Find admin role
    const adminRole = await prisma.role.findUnique({
        where: { code: 'admin' }
    });

    if (!adminRole) {
        console.log('Admin role not found!');
        return;
    }

    // Check if userRole already exists
    const existingUserRole = await prisma.userRole.findUnique({
        where: {
            userId_roleId: {
                userId: adminUser.id,
                roleId: adminRole.id
            }
        }
    });

    if (existingUserRole) {
        console.log('Admin user already has admin role!');
        return;
    }

    // Create userRole
    await prisma.userRole.create({
        data: {
            userId: adminUser.id,
            roleId: adminRole.id
        }
    });

    console.log('✅ Admin role restored for admin user!');
}

main()
    .catch((e) => {
        console.error('Error:', e);
        process.exit(1);
    })
    .finally(() => {
        prisma.$disconnect();
    });
