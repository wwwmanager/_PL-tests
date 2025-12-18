
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findFirst({ where: { fullName: 'админ' } });
    console.log('User админ orgId:', user?.organizationId);

    const vehicles = await prisma.vehicle.findMany({ where: { organizationId: user.organizationId } });
    console.log('Vehicles found for this orgId:', vehicles.length);

    vehicles.forEach(v => console.log(` - ${v.registrationNumber} (ID: ${v.id})`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
