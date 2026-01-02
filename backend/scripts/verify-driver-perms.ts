import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Verifying Driver permissions...');

    const driverRole = await prisma.role.findUnique({
        where: { code: 'driver' },
        include: {
            rolePermissions: {
                include: { permission: true }
            }
        }
    });

    if (!driverRole) {
        console.error('❌ Driver role not found');
        return;
    }

    const perms = driverRole.rolePermissions.map(rp => rp.permission.code);
    console.log('Driver Permissions:', perms);

    if (perms.includes('stock.create')) {
        console.log('✅ stock.create is assigned.');
    } else {
        console.error('❌ stock.create is MISSING!');
    }

    if (perms.includes('stock.update')) {
        console.log('✅ stock.update is assigned.');
    } else {
        console.error('❌ stock.update is MISSING!');
    }
}

main()
    .finally(() => prisma.$disconnect());
