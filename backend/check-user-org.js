const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- User Organization Check ---');

    const users = await prisma.user.findMany({
        include: { organization: true }
    });

    console.log(`Found ${users.length} users:`);
    for (const u of users) {
        console.log(`  - ${u.login} (ID: ${u.id}): Org=${u.organization?.shortName} (${u.organizationId})`);
    }

    const orgs = await prisma.organization.findMany();
    console.log(`\nOrganizations:`);
    for (const o of orgs) {
        console.log(`  - ${o.shortName}: ${o.id}`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
