
import { PrismaClient } from '@prisma/client';
import { createVehicleModel, updateVehicleModel } from './services/vehicleModelService';
import { createVehicle, getVehicleById, updateVehicle } from './services/vehicleService';
import { StockLocationType } from '@prisma/client';

const prisma = new PrismaClient();

async function runVerification() {
    console.log('🚀 Starting Vehicle Model Verification...');

    try {
        // 1. Setup Data: Organization and Fuel Stock Item
        const org = await prisma.organization.create({
            data: { name: 'Test Org ' + Date.now(), status: 'Active' }
        });
        console.log(`✅ Created Org: ${org.id}`);

        const fuelItem = await prisma.stockItem.create({
            data: {
                organizationId: org.id,
                departmentId: '00000000-0000-0000-0000-000000000000',
                name: 'Diesel Test',
                code: 'FUEL-TEST-' + Date.now(),
                // category: 'FUEL', // Legacy
                categoryEnum: 'FUEL',
                unit: 'l',
                isActive: true
            }
        });
        console.log(`✅ Created Fuel Item: ${fuelItem.id}`);

        // 2. Create Vehicle Model
        const modelData = {
            name: 'Kamaz TestModel',
            brand: 'KAMAZ',
            model: '5490',
            type: 'Truck',
            fuelStockItemId: fuelItem.id,
            tankCapacity: 500,
            summerRate: 30,
            winterRate: 35,
            manufactureYearFrom: 2020,
            manufactureYearTo: 2022
        };

        const vehicleModel = await createVehicleModel(org.id, modelData);
        console.log(`✅ Created Vehicle Model: ${vehicleModel.id} with rates 30/35`);

        // 3. Create Vehicle LINKED to Model (Inheritance)
        const timestamp = Date.now();
        const vehicle1 = await createVehicle(org.id, {
            registrationNumber: `A${timestamp}AA`,
            vin: `VIN${timestamp}`,
            vehicleModelId: vehicleModel.id,
            fuelStockItemId: fuelItem.id,
            // Explicitly NULL to force inheritance
            fuelTankCapacity: null,
            fuelConsumptionRates: null,
            status: 'Active'
        });
        console.log(`✅ Created Vehicle 1 (Inheriting): ${vehicle1.id}`);

        // 4. Verify Inheritance
        const v1Fetched = await getVehicleById(org.id, vehicle1.id);
        if (Number(v1Fetched.fuelTankCapacity) !== 500) throw new Error(`Failed Inheritance: Tank Capacity is ${v1Fetched.fuelTankCapacity}, expected 500`);
        if (v1Fetched.fuelConsumptionRates?.summerRate !== 30) throw new Error(`Failed Inheritance: Summer Rate is ${v1Fetched.fuelConsumptionRates?.summerRate}, expected 30`);
        console.log(`✅ Vehicle 1 correctly inherited values from Model`);

        // 5. Create Vehicle with OVERRIDES
        const vehicle2 = await createVehicle(org.id, {
            registrationNumber: `B${timestamp}BB`,
            vin: `VIN${timestamp}2`,
            vehicleModelId: vehicleModel.id,
            fuelStockItemId: fuelItem.id,
            fuelTankCapacity: 600, // Override
            fuelConsumptionRates: { summerRate: 40, winterRate: 45 }, // Override
            status: 'Active'
        });
        console.log(`✅ Created Vehicle 2 (Overriding): ${vehicle2.id}`);

        // 6. Verify Overrides
        const v2Fetched = await getVehicleById(org.id, vehicle2.id);
        if (Number(v2Fetched.fuelTankCapacity) !== 600) throw new Error(`Failed Override: Tank Capacity is ${v2Fetched.fuelTankCapacity}, expected 600`);
        if (v2Fetched.fuelConsumptionRates?.summerRate !== 40) throw new Error(`Failed Override: Summer Rate is ${v2Fetched.fuelConsumptionRates?.summerRate}, expected 40`);
        console.log(`✅ Vehicle 2 correctly used overrides`);

        // 7. Update Model
        await updateVehicleModel(org.id, vehicleModel.id, {
            ...modelData,
            summerRate: 32, // Changed from 30
            tankCapacity: 550 // Changed from 500
        });
        console.log(`✅ Updated Vehicle Model rates to 32/550`);

        // 8. Verify Impact
        const v1Refetched = await getVehicleById(org.id, vehicle1.id); // Should change
        const v2Refetched = await getVehicleById(org.id, vehicle2.id); // Should NOT change

        if (Number(v1Refetched.fuelTankCapacity) !== 550) throw new Error(`Failed Update Propagation: V1 Tank is ${v1Refetched.fuelTankCapacity}, expected 550`);
        if (v1Refetched.fuelConsumptionRates?.summerRate !== 32) throw new Error(`Failed Update Propagation: V1 Summer Rate is ${v1Refetched.fuelConsumptionRates?.summerRate}, expected 32`);
        console.log(`✅ Vehicle 1 automatically updated (Inheritance works dynamically)`);

        if (Number(v2Refetched.fuelTankCapacity) !== 600) throw new Error(`Failed Update Isolation: V2 Tank is ${v2Refetched.fuelTankCapacity}, expected 600`);
        if (v2Refetched.fuelConsumptionRates?.summerRate !== 40) throw new Error(`Failed Update Isolation: V2 Summer Rate is ${v2Refetched.fuelConsumptionRates?.summerRate}, expected 40`);
        console.log(`✅ Vehicle 2 stayed same (Overrides preserved)`);

        console.log('🎉 ALL VERIFICATION STEPS PASSED!');

    } catch (e) {
        console.error('❌ Verification Failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

runVerification();
