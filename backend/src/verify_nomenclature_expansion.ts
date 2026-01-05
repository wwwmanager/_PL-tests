
import { PrismaClient, StockItemCategory } from '@prisma/client';
import * as stockItemService from './services/stockItemService';
// Mock logger removed

const prisma = new PrismaClient();

async function verifyExpansion() {
    console.log('🚀 Verifying Nomenclature Expansion...');

    const org = await prisma.organization.findFirst();
    if (!org) throw new Error('No organization');

    // Find a warehouse for initial balance
    const warehouse = await prisma.stockLocation.findFirst({
        where: { type: 'WAREHOUSE' }
    });

    if (!warehouse) {
        console.warn('⚠️ No warehouse found, skipping initial balance test');
    } else {
        console.log(`Using Warehouse: ${warehouse.name} (${warehouse.id})`);
    }

    const name = `Expanded Item ${Date.now()}`;
    const group = 'TEST_GROUP';
    const description = 'Test Description';
    const initialBalance = 100;

    console.log('Creating Item...');

    // @ts-ignore
    const item = await stockItemService.create({
        organizationId: org.id,
        name,
        code: `CODE-${Date.now()}`,
        unit: 'шт',
        isFuel: false,
        categoryEnum: StockItemCategory.MATERIAL,
        group,
        description,
        initialBalance: warehouse ? initialBalance : 0,
        storageLocationId: warehouse ? warehouse.id : undefined,
        userId: 'system' // Mock user id
    });

    console.log(`Created Item ID: ${item.id}`);

    // Verify fields via Raw Query (since Client types might be old)
    const raw: any[] = await prisma.$queryRaw`SELECT * FROM "stock_items" WHERE id = ${item.id}::uuid`;
    const fetched = raw[0];

    console.log(`Fetched Group: ${fetched.group}`);
    console.log(`Fetched Description: ${fetched.description}`);

    if (fetched.group === group && fetched.description === description) {
        console.log('✅ New fields persisted correctly');
    } else {
        console.error('❌ New fields failed persistence');
    }

    // Verify Initial Balance
    if (warehouse) {
        // Check StockMovement
        const movements = await prisma.stockMovement.findMany({
            where: { stockItemId: item.id, organizationId: org.id }
        });
        console.log(`Found ${movements.length} movements`);
        const initMov = movements.find(m => m.documentType === 'INITIAL_BALANCE');
        if (initMov && Number(initMov.quantity) === initialBalance) {
            console.log('✅ Initial Balance movement created correctly');
        } else {
            console.error('❌ Initial Balance movement MISSING or wrong quantity');
        }
    }
}

verifyExpansion()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
