/**
 * REL-200: Backfill FuelType → StockItem
 * 
 * This script migrates existing FuelType entries into StockItem entries
 * with isFuel=true and category="FUEL".
 * 
 * Run with: npx ts-node prisma/scripts/backfill-fuel-type-to-stock-item.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillFuelTypes() {
    console.log('🔄 REL-200: Starting FuelType → StockItem backfill...\n');

    // Get all FuelTypes
    const fuelTypes = await prisma.fuelType.findMany();
    console.log(`Found ${fuelTypes.length} FuelType entries to migrate\n`);

    let created = 0;
    let linked = 0;

    for (const fuelType of fuelTypes) {
        console.log(`Processing: ${fuelType.code} - ${fuelType.name}`);

        // Get organization IDs that have waybills using this fuel type
        const orgsWithFuelType = await prisma.waybillFuel.findMany({
            where: { fuelTypeId: fuelType.id },
            select: {
                waybill: {
                    select: { organizationId: true },
                },
            },
            distinct: ['waybillId'],
        });

        const uniqueOrgIds = [...new Set(
            orgsWithFuelType.map(wf => wf.waybill.organizationId)
        )];

        if (uniqueOrgIds.length === 0) {
            const allOrgs = await prisma.organization.findMany({ select: { id: true } });
            uniqueOrgIds.push(...allOrgs.map(o => o.id));
        }

        // Check if ANY stock item has this legacy link
        // Note: property might be fuelTypeLegacyId or fuelTypeId depending on exact schema time, 
        // relying on schema.prisma saying fuelTypeLegacyId.
        const anyLinked = await prisma.stockItem.findFirst({ where: { fuelTypeLegacyId: fuelType.id } });
        let linkedToFuelType = !!anyLinked;

        for (const orgId of uniqueOrgIds) {
            const existing = await prisma.stockItem.findFirst({
                where: {
                    organizationId: orgId,
                    code: fuelType.code,
                },
            });

            if (existing) {
                const updateData: any = {
                    density: fuelType.density,
                    isFuel: true,
                    categoryEnum: 'FUEL', // Use enum
                };
                // Only link ONE stock item (the first one found) to the legacy ID to satisfy Unique constraint if it exists
                // If the constraint is global unique on fuelTypeLegacyId, we set it once.
                if (!linkedToFuelType) {
                    updateData.fuelTypeLegacyId = fuelType.id;
                    linkedToFuelType = true;
                }

                await prisma.stockItem.update({
                    where: { id: existing.id },
                    data: updateData,
                });
                console.log(`  🔗 Updated/Linked for org ${orgId.slice(0, 8)}...`);
                linked++;
            } else {
                const createData: any = {
                    organizationId: orgId,
                    code: fuelType.code,
                    name: fuelType.name,
                    unit: 'л',
                    isFuel: true,
                    density: fuelType.density,
                    categoryEnum: 'FUEL',
                };
                if (!linkedToFuelType) {
                    createData.fuelTypeLegacyId = fuelType.id;
                    linkedToFuelType = true;
                }

                await prisma.stockItem.create({ data: createData });
                console.log(`  ✅ Created StockItem for org ${orgId.slice(0, 8)}...`);
                created++;
            }
        }
    }

    console.log('\nStockItem Backfill Summary:');
    console.log(`   Created/Updated: ${created + linked}`);
}

async function backfillVehicles() {
    console.log('\n🔄 Starting Vehicle fuelStockItemId backfill...');

    // Get all vehicles with fuelTypeId but no fuelStockItemId
    // Or check all to be sure.
    const vehicles = await prisma.vehicle.findMany({
        where: {
            fuelTypeId: { not: null },
        },
        include: {
            organization: true,
        },
    });

    console.log(`Found ${vehicles.length} vehicles to process.`);

    let updated = 0;
    let notFound = 0;

    for (const vehicle of vehicles) {
        if (!vehicle.fuelTypeId) continue;

        // Fetch the FuelType to get the code.
        const fuelType = await prisma.fuelType.findUnique({
            where: { id: vehicle.fuelTypeId },
        });

        if (!fuelType) {
            console.log(`  ⚠️ Vehicle ${vehicle.registrationNumber}: FuelType ${vehicle.fuelTypeId} not found.`);
            notFound++;
            continue;
        }

        // Find matching StockItem for this Org and Fuel Code/LegacyId
        // Priority 1: Find by Legacy ID (if linked) - but Legacy Id is unique globally, so might not be in CURRENT org.
        // Priority 2: Find by Code + Category + Org (Robust)

        const stockItem = await prisma.stockItem.findFirst({
            where: {
                organizationId: vehicle.organizationId,
                categoryEnum: 'FUEL',
                code: fuelType.code, // Match by code matches the logic of StockItem creation
            },
        });

        if (stockItem) {
            if (vehicle.fuelStockItemId !== stockItem.id) {
                await prisma.vehicle.update({
                    where: { id: vehicle.id },
                    data: { fuelStockItemId: stockItem.id },
                });
                console.log(`  ✅ Linked Vehicle ${vehicle.registrationNumber} -> StockItem ${stockItem.name}`);
                updated++;
            }
        } else {
            console.log(`  ❌ Vehicle ${vehicle.registrationNumber}: No StockItem found for code ${fuelType.code} in org ${vehicle.organizationId}`);
            notFound++;
        }
    }

    console.log(`\nVehicle Backfill Summary:`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Not Found / Skipped: ${notFound}`);
}

async function main() {
    await backfillFuelTypes();
    await backfillVehicles();
    console.log('\n✅ All backfills complete!');
}

main()
    .catch((e) => {
        console.error('❌ Backfill failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
