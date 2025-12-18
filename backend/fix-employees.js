
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const minorgId = '9f8f0970-34fa-49d9-a507-b4177f2bab0b'; // Минсельхоз ЧО

    console.log('Fixing employee organization...');

    const updated = await prisma.employee.updateMany({
        where: { fullName: 'Иванов Иван Иванович' },
        data: { organizationId: minorgId }
    });

    console.log(`Updated ${updated.count} records.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
