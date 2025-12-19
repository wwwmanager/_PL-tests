import { z } from 'zod';

export const employeeSchema = z.object({
    fullName: z.string().min(1, 'ФИО обязательно'),
    position: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    email: z.string().email().optional().nullable(),
    employeeType: z.enum(['driver', 'mechanic', 'dispatcher', 'accountant', 'other']).optional().default('other'),
    departmentId: z.string().uuid().optional().nullable(),
    isActive: z.boolean().optional().default(true),

    // For drivers
    documentNumber: z.string().optional().nullable(),
    licenseCategory: z.string().optional().nullable(),
});

export type EmployeeInput = z.infer<typeof employeeSchema>;
