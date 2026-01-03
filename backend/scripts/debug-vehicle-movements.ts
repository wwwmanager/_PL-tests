
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- DEBUGGING VEHICLE MOVEMENTS ---');
    const vehicle = await prisma.vehicle.findFirst({
        where: { registrationNumber: { contains: 'А169ХН174' } }
    });

    if (!vehicle) {
        console.log('Vehicle А169ХН174 not found');
        return;
    }

    const loc = await prisma.stockLocation.findFirst({
        where: { vehicleId: vehicle.id }
    });

    if (!loc) {
        console.log('StockLocation for vehicle not found!');
        return;
    }

    console.log(`Location: ${loc.id}, Name: ${loc.name}`);
    console.log(`Vehicle Table Data -> CurrentFuel: ${vehicle.currentFuel}, Mileage: ${vehicle.mileage}`);

    const movements = await prisma.stockMovement.findMany({
        where: {
            OR: [
                { stockLocationId: loc.id },
                { toStockLocationId: loc.id },
                { fromStockLocationId: loc.id }
            ]
        },
        orderBy: { occurredAt: 'desc' },
        take: 20
    });

    console.log(`Found ${movements.length} recent movements:`);
    let balance = 0;

    // Simple balance calc (not chronological, just verifying content)
    movements.forEach(m => {
        console.log(`[${m.occurredAt.toISOString()}] Type: ${m.movementType}, Qty: ${m.quantity}, Void: ${m.isVoid}, Comment: ${m.comment}`);

        // Check if this looks like a zeroing action
        if (m.comment?.includes('reset') || m.comment?.includes('сброс') || m.comment?.includes('корректировка') || m.comment?.includes('Correction')) {
            console.log('  >>> FOUND POTENTIAL RESET MOVEMENT ABOVE <<<');
        }
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
