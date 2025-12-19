/**
 * BLK-02: Backfill script to fix stuck RESERVED blanks
 * Finds RESERVED blanks not attached to any waybill and returns them to ISSUED
 * 
 * Usage: npx ts-node scripts/backfillReservedBlanks.ts
 */
import { PrismaClient, BlankStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 BLK-02: Searching for stuck RESERVED blanks...');

    // Find all RESERVED blanks
    const reservedBlanks = await prisma.blank.findMany({
        where: { status: BlankStatus.RESERVED },
        select: {
            id: true,
            series: true,
            number: true,
            organizationId: true,
            issuedToDriverId: true
        }
    });

    console.log(`📊 Found ${reservedBlanks.length} blanks in RESERVED status.`);

    if (reservedBlanks.length === 0) {
        console.log('✅ No RESERVED blanks found. Nothing to do.');
        return;
    }

    // Check which ones are NOT attached to any waybill
    const stuckBlanks: typeof reservedBlanks = [];

    for (const blank of reservedBlanks) {
        const waybill = await prisma.waybill.findFirst({
            where: { blankId: blank.id },
            select: { id: true, status: true }
        });

        if (!waybill) {
            // Blank is RESERVED but no waybill uses it - this is stuck
            stuckBlanks.push(blank);
        }
    }

    console.log(`⚠️ Found ${stuckBlanks.length} stuck RESERVED blanks (no waybill attached).`);

    if (stuckBlanks.length === 0) {
        console.log('✅ All RESERVED blanks are correctly attached to waybills.');
        return;
    }

    console.log('\n📝 Returning stuck blanks to ISSUED status:');
    let fixed = 0;
    let errors = 0;

    for (const blank of stuckBlanks) {
        try {
            await prisma.blank.update({
                where: { id: blank.id },
                data: { status: BlankStatus.ISSUED }
                // Keep issuedToDriverId - blank stays with the driver
            });

            console.log(`  ✅ Fixed blank ${blank.series}-${blank.number} -> ISSUED`);
            fixed++;
        } catch (error: any) {
            console.error(`  ❌ Failed to fix blank ${blank.series}-${blank.number}:`, error.message);
            errors++;
        }
    }

    console.log('\n📊 Summary:');
    console.log(`  Fixed: ${fixed}`);
    console.log(`  Errors: ${errors}`);
    console.log(`  Total stuck: ${stuckBlanks.length}`);
}

main()
    .catch(e => {
        console.error('💥 Backfill failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
