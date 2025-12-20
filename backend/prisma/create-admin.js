const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Find user
    let user = await prisma.user.findUnique({ where: { email: 'admin@waybills.local' } });
    if (!user) {
        throw new Error('User not found');
    }
    console.log('Found user:', user.email);

    // Find admin role by code (unique field)
    let adminRole = await prisma.role.findFirst({ where: { code: 'admin' } });
    if (!adminRole) {
        // Try finding by name
        adminRole = await prisma.role.findFirst({ where: { name: 'admin' } });
    }

    if (!adminRole) {
        throw new Error('Admin role not found in database');
    }
    console.log('Found role:', adminRole.name, adminRole.id);

    // Assign role to user (ignore if already exists)
    try {
        await prisma.userRole.create({
            data: { userId: user.id, roleId: adminRole.id }
        });
        console.log('Assigned role to user');
    } catch (e) {
        if (e.code === 'P2002') {
            console.log('Role already assigned');
        } else {
            throw e;
        }
    }

    console.log('✅ Admin user ready: admin@waybills.local / 111');
}

main()
    .then(() => prisma.$disconnect())
    .catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
