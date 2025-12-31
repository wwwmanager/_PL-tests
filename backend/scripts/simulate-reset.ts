
import { PrismaClient } from '@prisma/client';
import * as fuelCardService from '../src/services/fuelCardService';
import * as stockService from '../src/services/stockService';

const prisma = new PrismaClient();

async function main() {
    const cardNumber = '1234-5678-1234-5678';
    console.log(`[SIM] Searching for card: ${cardNumber}`);

    const card = await prisma.fuelCard.findUnique({
        where: { cardNumber }
    });

    if (!card) {
        console.error('[SIM] Card not found');
        return;
    }

    const user = await prisma.user.findFirst({
        where: { email: 'admin@waybills.local' } // Adjust if needed
    });

    if (!user) {
        console.error('[SIM] Admin user not found');
        return;
    }

    console.log(`[SIM] Card ID: ${card.id}`);

    // 1. Find the "Benzin AI-92" stock item ID that likely has 0 balance (which frontend picks)
    const fuelTypes = await prisma.stockItem.findMany({
        where: { isFuel: true }
    });
    console.log(`[SIM] Found ${fuelTypes.length} fuel types:`);
    fuelTypes.forEach(f => console.log(`  - ${f.name} (${f.id})`));

    // Let's assume frontend picks the FIRST one.
    const defaultFuel = fuelTypes[0];
    const stockItemId = defaultFuel.id;
    console.log(`[SIM] Simulating reset with StockItem: ${defaultFuel.name} (${stockItemId})`);

    // Debug breakdown
    // const cardLocation = await fuelCardService.getOrCreateFuelCardLocation(card.id);
    let cardLocation = await prisma.stockLocation.findFirst({
        where: { fuelCardId: card.id }
    });
    if (!cardLocation) {
        // Fallback if not found (though it should exist for active usage)
        cardLocation = await prisma.stockLocation.create({
            data: {
                organizationId: card.organizationId,
                type: 'FUEL_CARD',
                name: `Топливная карта ${card.cardNumber}`,
                fuelCardId: card.id,
            },
        });
    }

    console.log(`[SIM] Card Location: ${cardLocation.id}`);

    const [incomes, expenses, adjustments, transfersIn, transfersOut] = await Promise.all([
        prisma.stockMovement.aggregate({
            where: { stockLocationId: cardLocation.id, stockItemId, movementType: 'INCOME', isVoid: false },
            _sum: { quantity: true },
        }),
        prisma.stockMovement.aggregate({
            where: { stockLocationId: cardLocation.id, stockItemId, movementType: 'EXPENSE', isVoid: false },
            _sum: { quantity: true },
        }),
        prisma.stockMovement.aggregate({
            where: { stockLocationId: cardLocation.id, stockItemId, movementType: 'ADJUSTMENT', isVoid: false },
            _sum: { quantity: true },
        }),
        prisma.stockMovement.aggregate({
            where: { toStockLocationId: cardLocation.id, stockItemId, movementType: 'TRANSFER', isVoid: false },
            _sum: { quantity: true },
        }),
        prisma.stockMovement.aggregate({
            where: { fromStockLocationId: cardLocation.id, stockItemId, movementType: 'TRANSFER', isVoid: false },
            _sum: { quantity: true },
        }),
    ]);

    console.log('Breakdown:');
    console.log('Incomes:', incomes._sum.quantity);
    console.log('Expenses:', expenses._sum.quantity);
    console.log('Adjustments:', adjustments._sum.quantity);
    console.log('Transfers In:', transfersIn._sum.quantity);
    console.log('Transfers Out:', transfersOut._sum.quantity);

    const calcBalance = (Number(incomes._sum.quantity || 0) -
        Number(expenses._sum.quantity || 0) +
        Number(adjustments._sum.quantity || 0) +
        Number(transfersIn._sum.quantity || 0) -
        Number(transfersOut._sum.quantity || 0));
    console.log('Calculated Balance (Manual):', calcBalance);

    try {
        const result = await fuelCardService.resetFuelCard(
            card.organizationId,
            card.id,
            defaultFuel.id,
            'TRANSFER_TO_WAREHOUSE',
            'DEBUG_RESET_SIMULATION',
            user.id
        );

        console.log('[SIM] Result:', result);
    } catch (e) {
        console.error('[SIM] Error:', e);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
