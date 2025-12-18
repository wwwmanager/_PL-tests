/**
 * WB-201 Test Script: Verify fuelConsumptionRates in Vehicle API
 * 
 * Run: npx ts-node scripts/test-wb201.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('WB-201: Testing fuelConsumptionRates in Vehicle API\n');

    // Find first organization
    const org = await prisma.organization.findFirst();
    if (!org) {
        console.error('❌ No organization found. Please seed the database first.');
        process.exit(1);
    }
    console.log(`Using organization: ${org.name} (${org.id})\n`);

    // Test 1: Create vehicle with fuelConsumptionRates
    console.log('Test 1: Creating vehicle with fuelConsumptionRates...');
    const testRates = {
        winterRate: 12.5,
        summerRate: 10.2,
        cityIncreasePercent: 15,
        warmingIncreasePercent: 5
    };

    const vehicle = await prisma.vehicle.create({
        data: {
            organizationId: org.id,
            registrationNumber: `TEST-WB201-${Date.now()}`,
            brand: 'TestBrand',
            model: 'TestModel',
            fuelType: 'diesel',
            fuelConsumptionRates: testRates
        }
    });
    console.log(`✅ Created vehicle: ${vehicle.id}`);
    console.log(`   fuelConsumptionRates: ${JSON.stringify(vehicle.fuelConsumptionRates)}\n`);

    // Test 2: Read vehicle and verify rates
    console.log('Test 2: Reading vehicle...');
    const fetched = await prisma.vehicle.findUnique({ where: { id: vehicle.id } });
    if (!fetched) {
        console.error('❌ Vehicle not found');
        process.exit(1);
    }
    const fetchedRates = fetched.fuelConsumptionRates as any;
    if (
        fetchedRates?.winterRate === testRates.winterRate &&
        fetchedRates?.summerRate === testRates.summerRate &&
        fetchedRates?.cityIncreasePercent === testRates.cityIncreasePercent &&
        fetchedRates?.warmingIncreasePercent === testRates.warmingIncreasePercent
    ) {
        console.log('✅ fuelConsumptionRates matches expected values\n');
    } else {
        console.error('❌ fuelConsumptionRates mismatch!');
        console.error('   Expected:', testRates);
        console.error('   Got:', fetchedRates);
        process.exit(1);
    }

    // Test 3: Update vehicle with new rates
    console.log('Test 3: Updating vehicle fuelConsumptionRates...');
    const newRates = {
        winterRate: 14.0,
        summerRate: 11.5,
        cityIncreasePercent: 20,
        warmingIncreasePercent: 8
    };

    await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: { fuelConsumptionRates: newRates }
    });

    const updated = await prisma.vehicle.findUnique({ where: { id: vehicle.id } });
    const updatedRates = updated?.fuelConsumptionRates as any;
    if (updatedRates?.winterRate === newRates.winterRate) {
        console.log('✅ fuelConsumptionRates updated successfully\n');
    } else {
        console.error('❌ Update failed');
        process.exit(1);
    }

    // Clean up
    console.log('Cleaning up test data...');
    await prisma.vehicle.delete({ where: { id: vehicle.id } });
    console.log('✅ Test vehicle deleted\n');

    console.log('═══════════════════════════════════════════');
    console.log('WB-201: All tests PASSED ✅');
    console.log('═══════════════════════════════════════════');
}

main()
    .catch(e => {
        console.error('Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
