import { z } from 'zod';

export const employeeSchema = z.object({
    // Required
    fullName: z.string().min(1, 'ФИО обязательно'),

    // Basic info
    shortName: z.string().optional().nullable(),
    position: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    email: z.string().email().optional().nullable(),
    address: z.string().optional().nullable(),
    dateOfBirth: z.string().optional().nullable(),
    personnelNumber: z.string().optional().nullable(),
    snils: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),

    employeeType: z.enum(['driver', 'mechanic', 'dispatcher', 'accountant', 'controller', 'other'])
        .optional()
        .default('driver'),

    status: z.enum(['Active', 'Inactive']).optional().default('Active'),
    isActive: z.boolean().optional().default(true),

    // Relations
    departmentId: z.string().uuid().optional().nullable(),
    dispatcherId: z.string().uuid().optional().nullable(),
    controllerId: z.string().uuid().optional().nullable(),
    medicalInstitutionId: z.string().uuid().optional().nullable(),

    // License/Documents
    documentNumber: z.string().optional().nullable(),
    documentExpiry: z.string().optional().nullable(),
    licenseCategory: z.string().optional().nullable(),

    // Driver card
    driverCardType: z.string().optional().nullable(),
    driverCardNumber: z.string().optional().nullable(),
    driverCardStartDate: z.string().optional().nullable(),
    driverCardExpiryDate: z.string().optional().nullable(),

    // Medical certificate
    medicalCertificateSeries: z.string().optional().nullable(),
    medicalCertificateNumber: z.string().optional().nullable(),
    medicalCertificateIssueDate: z.string().optional().nullable(),
    medicalCertificateExpiryDate: z.string().optional().nullable(),

    // Fuel card
    fuelCardNumber: z.string().optional().nullable(),
    fuelCardBalance: z.union([z.string(), z.number()]).optional().nullable(),
}).strict();

export type EmployeeInput = z.infer<typeof employeeSchema>;

