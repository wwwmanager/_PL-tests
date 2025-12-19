import { z } from 'zod';

export const driverSchema = z.object({
    employeeId: z.string().uuid('employeeId должен быть UUID'),
    licenseNumber: z.string().min(1, 'Номер удостоверения обязателен'),
    licenseCategory: z.string().optional().nullable(),
    licenseValidTo: z.string().optional().nullable().transform(val => val ? new Date(val).toISOString() : null),
});

export type DriverInput = z.infer<typeof driverSchema>;
