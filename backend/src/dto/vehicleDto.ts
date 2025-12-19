import { z } from 'zod';

export const vehicleSchema = z.object({
    code: z.string().optional().nullable(),
    registrationNumber: z.string().min(1, 'Госномер обязателен'),
    brand: z.string().optional().nullable(),
    model: z.string().optional().nullable(),
    vin: z.string().optional().nullable(),
    year: z.number().int().optional().nullable(),
    fuelType: z.string().optional().nullable(),
    fuelTankCapacity: z.number().min(0).optional().nullable(),
    departmentId: z.string().uuid().optional().nullable(),

    // JSON field for fuel rates
    fuelConsumptionRates: z.string().optional().nullable(),
});

export type VehicleInput = z.infer<typeof vehicleSchema>;
