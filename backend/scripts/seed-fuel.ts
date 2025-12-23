
import { PrismaClient, StockMovementType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Seeding Fuel to Warehouse ---');

    // 1. Find Admin Org
    const adminUser = await prisma.user.findUnique({
        where: { email: 'admin@waybills.local' },
        include: { organization: true }
    });

    if (!adminUser || !adminUser.organizationId) {
        throw new Error('Admin user or organization not found');
    }

    const organizationId = adminUser.organizationId;
    console.log(`Organization: ${adminUser.organization?.name} (${organizationId})`);

    // 2. Find Fuel Stock Item (first one found)
    const fuelItem = await prisma.stockItem.findFirst({
        where: {
            organizationId,
            categoryEnum: 'FUEL'
        }
    });

    if (!fuelItem) {
        throw new Error('No FUEL stock item found. Please create a nomenclature item with category FUEL first.');
    }
    console.log(`Fuel Item: ${fuelItem.name} (${fuelItem.id})`);

    // 3. Find Default Warehouse Location
    // Logic matches getOrCreateDefaultWarehouseLocation
    let warehouse = await prisma.stockLocation.findFirst({
        where: {
            organizationId,
            type: 'WAREHOUSE',
            isActive: true
        }
    });

    if (!warehouse) {
        throw new Error('No Warehouse location found.');
    }
    console.log(`Warehouse: ${warehouse.name} (${warehouse.id})`);

    // 4. Create INCOME movement
    const quantity = 5000;
    const movement = await prisma.stockMovement.create({
        data: {
            organizationId,
            stockItemId: fuelItem.id,
            stockLocationId: warehouse.id,
            movementType: StockMovementType.INCOME,
            quantity: quantity,
            occurredAt: new Date(),
            comment: 'Initial Fuel Seeding (Fixing Post Error)',
            createdByUserId: adminUser.id
        }
    });

    console.log(`✅ Successfully added ${quantity} ${fuelItem.unit} of ${fuelItem.name} to ${warehouse.name}`);
    console.log('Movement ID:', movement.id);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
