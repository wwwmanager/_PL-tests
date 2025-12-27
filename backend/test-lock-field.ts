import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    try {
        const org = await prisma.organization.findFirst({
            select: { id: true, stockLockedAt: true }
        });
        console.log('Success:', org);
    } catch (e: any) {
        console.error('Error:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
main();
