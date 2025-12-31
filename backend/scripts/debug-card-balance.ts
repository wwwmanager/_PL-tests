
import { PrismaClient } from '@prisma/client';
import * as stockService from '../src/services/stockService';

const prisma = new PrismaClient();

async function main() {
    const cardNumber = '1234-5678-1234-5678';
    console.log(`Checking balance for card: ${cardNumber} using stockService`);

    const card = await prisma.fuelCard.findUnique({
        where: { cardNumber },
        include: { stockLocation: true }
    });

    if (!card) {
        console.log('Card not found');
        return;
    }

    let locationId = card.stockLocation?.id;
    if (!locationId) {
        const loc = await prisma.stockLocation.findFirst({ where: { fuelCardId: card.id } });
        locationId = loc?.id;
    }

    if (!locationId) {
        console.log('Location not found');
        return;
    }
    console.log(`Location ID: ${locationId}`);

    const stockItemId = '13c82a3e-1e92-4110-b4b2-90781f56170f'; // AI-92

    // 1. Current Balance (Now)
    const balanceNow = await stockService.getBalanceAt(locationId, stockItemId, new Date());
    console.log(`Service Balance (Now): ${balanceNow}`);

    // 2. Balance at specific User reported time: 31.12.2025 15:04
    // Assumption: User time might be local (+5), so 10:04 UTC. Or maybe they meant server time.
    // Let's try 15:04 UTC
    const dateUTC = new Date('2025-12-31T15:04:00Z');
    const balanceUTC = await stockService.getBalanceAt(locationId, stockItemId, dateUTC);
    console.log(`Service Balance (2025-12-31T15:04:00Z): ${balanceUTC}`);

    // 3. Balance at 10:04 UTC (if local was 15:04)
    const dateLocal = new Date('2025-12-31T10:04:00Z');
    const balanceLocal = await stockService.getBalanceAt(locationId, stockItemId, dateLocal);
    console.log(`Service Balance (2025-12-31T10:04:00Z): ${balanceLocal}`);

    // 4. Debugging the logic manually again for 15:04 UTC
    console.log('\n--- Manual Verification for 15:04 UTC ---');
    const movements = await prisma.stockMovement.findMany({
        where: {
            OR: [
                { stockLocationId: locationId },
                { fromStockLocationId: locationId },
                { toStockLocationId: locationId }
            ],
            stockItemId: stockItemId,
            isVoid: false,
            occurredAt: { lte: dateUTC }
        }
    });

    let sum = 0;
    for (const m of movements) {
        if (m.movementType === 'INCOME') {
            if (m.stockLocationId === locationId) sum += Number(m.quantity);
        } else if (m.movementType === 'EXPENSE') {
            if (m.stockLocationId === locationId) sum -= Number(m.quantity);
        } else if (m.movementType === 'ADJUSTMENT') {
            if (m.stockLocationId === locationId) sum += Number(m.quantity);
        } else if (m.movementType === 'TRANSFER') {
            if (m.toStockLocationId === locationId) sum += Number(m.quantity);
            if (m.fromStockLocationId === locationId) sum -= Number(m.quantity);
        }
    }
    console.log(`Manual Sum for 15:04 UTC: ${sum}`);

    // Check what makes up the difference if any
    console.log(`Difference: ${balanceUTC - sum}`);

}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
