const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Admin User Check and Reset ---');

    // Find admin user by email
    const adminUser = await prisma.user.findFirst({
        where: { email: { contains: 'admin' } },
        include: { organization: true }
    });

    if (!adminUser) {
        console.log('❌ Admin user not found! Looking for any user...');
        const anyUser = await prisma.user.findFirst({ include: { organization: true } });
        if (anyUser) {
            console.log('Found user:', anyUser.email, '- resetting password...');
            const newHash = await bcrypt.hash('111', 10);
            await prisma.user.update({
                where: { id: anyUser.id },
                data: { passwordHash: newHash }
            });
            console.log('✅ Password reset for', anyUser.email);
        }
        return;
    }

    console.log('Found admin user:');
    console.log('  - ID:', adminUser.id);
    console.log('  - Email:', adminUser.email);
    console.log('  - Role:', adminUser.role);
    console.log('  - Org:', adminUser.organization?.shortName);

    // Reset password to 111
    const newHash = await bcrypt.hash('111', 10);
    await prisma.user.update({
        where: { id: adminUser.id },
        data: { passwordHash: newHash }
    });

    console.log('\n✅ Password reset to "111" for user:', adminUser.email);
}

main().catch(console.error).finally(() => prisma.$disconnect());
