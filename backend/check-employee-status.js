
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('--- Employees Status Check ---');
    const employees = await prisma.employee.findMany({
        include: { organization: true }
    });

    employees.forEach(e => {
        console.log(`[${e.isActive ? 'ACTIVE' : 'INACTIVE'}] ${e.fullName} (Org: ${e.organization?.shortName})`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
