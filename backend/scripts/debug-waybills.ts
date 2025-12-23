
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- User Info ---');
    const adminUser = await prisma.user.findUnique({
        where: { email: 'admin@waybills.local' },
        include: { organization: true }
    });

    if (adminUser) {
        console.log(`Admin User: ${adminUser.email}`);
        console.log(`Organization ID: ${adminUser.organizationId}`);
        console.log(`Organization Name: ${adminUser.organization?.name}`);
    } else {
        console.log('Admin user not found!');
    }

    console.log('\n--- Waybills ---');
    const waybills = await prisma.waybill.findMany({
        include: { organization: true }
    });

    if (waybills.length === 0) {
        console.log('No waybills found in the database.');
    } else {
        waybills.forEach(wb => {
            console.log(`ID: ${wb.id}`);
            console.log(`Number: ${wb.number}`);
            console.log(`Status: ${wb.status}`);
            console.log(`Date: ${wb.date.toISOString()}`);
            console.log(`Org ID: ${wb.organizationId} (${wb.organization?.name})`);
            console.log(`Department ID: ${wb.departmentId}`);
            console.log('---');
        });
    }

    console.log('\n--- Organizations ---');
    const orgs = await prisma.organization.findMany();
    orgs.forEach(o => {
        console.log(`ID: ${o.id}, Name: ${o.name}`);
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
