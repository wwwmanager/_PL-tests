
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const plate = 'A168XH174';
    console.log(`Searching for vehicle with plate containing: ${plate}`);

    const vehicles = await prisma.vehicle.findMany({
        where: {
            registrationNumber: {
                contains: '168' // Search part of it to avoid cyrillic/latin issues
            }
        },
        include: {
            stockLocation: true,
        }
    });

    if (vehicles.length === 0) {
        console.log('Vehicle not found');
        return;
    }

    for (const v of vehicles) {
        console.log(`\nVehicle Found: ${v.brand} ${v.model} (${v.registrationNumber}) ID: ${v.id}`);
        console.log(`Current State: Mileage=${v.mileage}, Fuel=${v.currentFuel}`);

        // 1. Get Waybills for this vehicle
        const waybills = await prisma.waybill.findMany({
            where: { vehicleId: v.id },
            orderBy: { number: 'asc' }, // Order by number seems to follow the user's issue description
            include: {
                fuelLines: {
                    include: { stockItem: true }
                }
            }
        });

        console.log(`\n--- Waybill Chain (${waybills.length}) ---`);
        let prevW = null;

        waybills.forEach(w => {
            const fuelLine = w.fuelLines[0]; // Assuming single fuel type for now
            const fuelDetails = fuelLine
                ? `Fuel: ${fuelLine.fuelStart} -> ${fuelLine.fuelEnd} (+${fuelLine.fuelReceived} / -${fuelLine.fuelConsumed})`
                : 'No Fuel Data';

            console.log(`[${w.status}] #${w.number} (${w.date.toISOString().split('T')[0]}) ` +
                `Odo: ${w.odometerStart} -> ${w.odometerEnd} ` +
                fuelDetails);

            if (prevW) {
                // Check Mileage Gap
                const odoDiff = Number(w.odometerStart) - Number(prevW.odometerEnd);
                if (odoDiff !== 0) {
                    console.log(`   >>> MILEAGE GAP! Prev End: ${prevW.odometerEnd} / Curr Start: ${w.odometerStart} (Diff: ${odoDiff})`);
                }

                // Check Fuel Gap (if exists)
                if (prevW.fuelLines[0] && fuelLine) {
                    const prevFuelEnd = Number(prevW.fuelLines[0].fuelEnd);
                    const currFuelStart = Number(fuelLine.fuelStart);
                    const fuelDiff = currFuelStart - prevFuelEnd;
                    if (Math.abs(fuelDiff) > 0.01) {
                        console.log(`   >>> FUEL GAP! Prev End: ${prevFuelEnd} / Curr Start: ${currFuelStart} (Diff: ${fuelDiff})`);
                    }
                }
            }
            prevW = w;
        });


        // 2. Get Stock Movements (Tank)
        if (v.stockLocation) {
            const movements = await prisma.stockMovement.findMany({
                where: {
                    OR: [
                        { stockLocationId: v.stockLocation.id },
                        { fromStockLocationId: v.stockLocation.id },
                        { toStockLocationId: v.stockLocation.id }
                    ],
                    isVoid: false
                },
                orderBy: { occurredAt: 'desc' },
                take: 10,
                include: {
                    stockItem: true
                }
            });

            console.log(`\n--- Last 10 Stock Movements (Tank) ---`);
            movements.forEach(m => {
                console.log(`${m.occurredAt.toISOString()} [${m.movementType}] ${m.quantity} ${m.stockItem?.name} Type=${m.documentType} Ref=${m.externalRef}`);
            });
        }
    }

    // Global search for problematic waybills
    const problemNumbers = ['000015', '000016', '000019', '15', '16', '19', '000001', '000002', '000003'];
    console.log(`\n--- Searching for problematic Waybill Numbers: ${problemNumbers.join(', ')} ---`);
    const ghostWaybills = await prisma.waybill.findMany({
        where: {
            number: { in: problemNumbers }
        },
        include: {
            vehicle: true,
            organization: true // Include org info
        }
    });

    if (ghostWaybills.length === 0) {
        console.log('No waybills found with these numbers.');
    } else {
        ghostWaybills.forEach(w => {
            console.log(`Found #${w.number} ` +
                `Vehicle: ${w.vehicle.registrationNumber} ` +
                `Org: "${w.organization?.name}" (ID: ${w.organizationId}) ` +
                `Exists? ${!!w.organization}`);
        });

        // Double check if org exists separately if relation is null (shouldn't happen with strict FK but...)
        const orgIds = [...new Set(ghostWaybills.map(w => w.organizationId))];
        for (const orgId of orgIds) {
            const org = await prisma.organization.findUnique({ where: { id: orgId } });
            console.log(`Checking Org ID ${orgId}: Found = ${!!org}, Name = ${org?.name}`);
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
