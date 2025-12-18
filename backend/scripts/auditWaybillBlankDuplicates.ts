
import { PrismaClient, WaybillStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Starting Audit: Checking for duplicate blankId usage in Waybills...');

    // 1. Find blankIds used more than once
    // Using simple approach: fetch all waybills with blanks, map them in memory (safe for reasonable dataset size),
    // or use groupBy if available. For robustness on potentially large DB, let's use groupBy.

    const grouped = await prisma.waybill.groupBy({
        by: ['blankId'],
        where: {
            blankId: { not: null }
        },
        _count: {
            blankId: true
        },
        having: {
            blankId: {
                _count: {
                    gt: 1
                }
            }
        }
    });

    if (grouped.length === 0) {
        console.log('✅ 0 conflicts found. It is safe to add @unique constraint.');
        return;
    }

    console.warn(`⚠️  Found ${grouped.length} blank(s) used in multiple waybills!`);

    for (const group of grouped) {
        if (!group.blankId) continue;

        const waybills = await prisma.waybill.findMany({
            where: { blankId: group.blankId },
            select: {
                id: true,
                number: true,
                date: true,
                status: true,
                createdAt: true,
                updatedAt: true
            },
            orderBy: { createdAt: 'desc' }
        });

        console.log(`\nConflict for Blank ID: ${group.blankId}`);
        console.table(waybills.map(w => ({
            id: w.id,
            number: w.number,
            status: w.status,
            date: w.date.toISOString().split('T')[0],
            updatedAt: w.updatedAt.toISOString()
        })));

        // Suggest resolution
        const posted = waybills.filter(w => w.status === WaybillStatus.POSTED);
        if (posted.length === 1) {
            console.log(`➡️  Resolution hint: Keep POSTED waybill ${posted[0].number}, unlink others.`);
        } else if (posted.length > 1) {
            console.warn(`❗ Critical: Multiple POSTED waybills share this blank!`);
        } else {
            console.log(`➡️  Resolution hint: Keep most recent (or correct) draft.`);
        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
