
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const start = new Date('2025-02-01T00:00:00.000Z');
    const end = new Date('2025-03-01T00:00:00.000Z');

    const waybills = await prisma.waybill.findMany({
        where: {
            status: 'POSTED',
            date: {
                gte: start,
                lt: end,
            }
        },
        include: {
            routes: true
        }
    });

    console.log(`Found ${waybills.length} POSTED waybills in Feb 2025`);

    let totalExams = 0;

    for (const wb of waybills) {
        console.log(`\nWaybill ${wb.number} (Date: ${wb.date.toISOString().slice(0, 10)})`);

        const uniqueDates = new Set<string>();
        // Add waybill start date
        uniqueDates.add(wb.date.toISOString().slice(0, 10));

        wb.routes.forEach(r => {
            if (r.date) {
                const d = r.date.toISOString().slice(0, 10);
                uniqueDates.add(d);
                console.log(`  - Route: ${d} (${r.fromPoint} -> ${r.toPoint})`);
            } else {
                console.log(`  - Route: No Date (${r.fromPoint} -> ${r.toPoint})`);
            }
        });

        console.log(`  => Unique Dates (Exams): ${uniqueDates.size}`);
        console.log(`  => Dates: ${Array.from(uniqueDates).sort().join(', ')}`);

        totalExams += uniqueDates.size;
    }

    console.log(`\nTOTAL EXAMS calculated: ${totalExams}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
