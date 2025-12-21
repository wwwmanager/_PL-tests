import { z } from 'zod';

export const vehicleSchema = z.object({
    code: z.string().optional().nullable(),
    registrationNumber: z.string().min(1, 'Госномер обязателен'),
    brand: z.string().optional().nullable(),
    model: z.string().optional().nullable(),
    vin: z.string().optional().nullable(),
    year: z.number().int().optional().nullable(),
    vehicleType: z.string().optional().nullable(),

    // Fuel settings
    fuelType: z.string().optional().nullable(),      // @deprecated REL-202: use fuelStockItemId
    fuelTypeId: z.string().uuid().optional().nullable(), // @deprecated REL-202: use fuelStockItemId
    fuelStockItemId: z.string().uuid().optional().nullable(), // REL-202: new FK to StockItem
    fuelTankCapacity: z.number().min(0).optional().nullable(),
    fuelConsumptionRates: z.preprocess(
        (val) => {
            if (val === '' || val === null || val === undefined) return null;
            if (typeof val === 'string') {
                try {
                    return JSON.parse(val);
                } catch (e) {
                    return null;
                }
            }
            return val;
        },
        z.object({
            summerRate: z.coerce.number().optional().default(0),
            winterRate: z.coerce.number().optional().default(0),
            winterStartMonth: z.coerce.number().optional().nullable(),
            winterEndMonth: z.coerce.number().optional().nullable(),
            cityIncreasePercent: z.coerce.number().optional().default(0),
            warmingIncreasePercent: z.coerce.number().optional().default(0),
        }).passthrough().nullable().optional()
    ),

    // Mileage & fuel
    mileage: z.number().min(0).optional().nullable(),
    currentFuel: z.number().min(0).optional().nullable(),

    // Relations
    departmentId: z.string().uuid().optional().nullable(),
    assignedDriverId: z.string().uuid().optional().nullable(), // IMPORTANT: must accept null for empty
    storageLocationId: z.string().uuid().optional().nullable(),

    // Boolean flags
    isActive: z.boolean().optional(),
    useCityModifier: z.boolean().optional(),
    useWarmingModifier: z.boolean().optional(),
    disableFuelCapacityCheck: z.boolean().optional(),
}).passthrough(); // Allow extra fields without error

export type VehicleInput = z.infer<typeof vehicleSchema>;

