
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('--- Organizations ---');
    const orgs = await prisma.organization.findMany();
    orgs.forEach(o => console.log(`${o.shortName}: ${o.id}`));

    console.log('\n--- Employees ---');
    const employees = await prisma.employee.findMany({ include: { organization: true } });
    employees.forEach(e => console.log(`${e.fullName} | Org: ${e.organization?.shortName || 'NULL'} (${e.organizationId})`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
