/**
 * Stock Movement DTO Validation Schemas
 * BE-002: Uses Zod for runtime validation and type safety
 */

import { z } from 'zod';

/**
 * Decimal string validator - accepts both string ("10.5") and number (10.5)
 * Converts to string for Prisma Decimal compatibility
 */
const decimalString = z.preprocess(
    (val) => {
        if (typeof val === 'number') return String(val);
        if (typeof val === 'string') return val;
        return val;
    },
    z.string()
        .regex(/^-?\d+(\.\d+)?$/, 'Должно быть числом (Decimal)')
        .refine((val) => parseFloat(val) !== 0, 'Количество не может быть 0')
);

/**
 * Positive decimal string validator
 */
const positiveDecimalString = z.preprocess(
    (val) => {
        if (typeof val === 'number') return String(val);
        if (typeof val === 'string') return val;
        return val;
    },
    z.string()
        .regex(/^\d+(\.\d+)?$/, 'Должно быть положительным числом')
        .refine((val) => parseFloat(val) > 0, 'Количество должно быть > 0')
);

/**
 * DateTime string validator - accepts ISO string
 */
const dateTimeString = z.string()
    .refine((val) => !isNaN(Date.parse(val)), 'Некорректный формат даты/времени (ожидается ISO 8601)');

/**
 * Base movement fields (common to all types)
 */
const baseMovementSchema = z.object({
    stockItemId: z.string().uuid('stockItemId должен быть UUID'),
    occurredAt: dateTimeString.optional(), // Optional - defaults to now()
    occurredSeq: z.number().int().min(0).optional(),
    documentType: z.string().optional().nullable(),
    documentId: z.string().uuid().optional().nullable(),
    externalRef: z.string().max(120).optional().nullable(),
    comment: z.string().max(500).optional().nullable(),
});

/**
 * INCOME movement schema
 */
export const incomeMovementSchema = baseMovementSchema.extend({
    movementType: z.literal('INCOME'),
    quantity: positiveDecimalString,
    stockLocationId: z.string().uuid('stockLocationId обязателен для INCOME'),
});

/**
 * EXPENSE movement schema
 */
export const expenseMovementSchema = baseMovementSchema.extend({
    movementType: z.literal('EXPENSE'),
    quantity: positiveDecimalString,
    stockLocationId: z.string().uuid('stockLocationId обязателен для EXPENSE'),
});

/**
 * TRANSFER movement schema
 */
export const transferMovementSchema = baseMovementSchema.extend({
    movementType: z.literal('TRANSFER'),
    quantity: positiveDecimalString,
    fromLocationId: z.string().uuid('fromLocationId обязателен для TRANSFER'),
    toLocationId: z.string().uuid('toLocationId обязателен для TRANSFER'),
}).refine(
    (data) => data.fromLocationId !== data.toLocationId,
    {
        message: 'fromLocationId и toLocationId не могут совпадать',
        path: ['toLocationId'],
    }
);

/**
 * ADJUSTMENT movement schema (can be negative)
 * BE-002: occurredAt and comment are required for audit trail
 */
export const adjustmentMovementSchema = baseMovementSchema.extend({
    movementType: z.literal('ADJUSTMENT'),
    quantity: decimalString, // Can be negative (e.g., -10.5)
    stockLocationId: z.string().uuid('stockLocationId обязателен для ADJUSTMENT'),
    occurredAt: dateTimeString, // Required for ADJUSTMENT (override optional from base)
    comment: z.string().min(1, 'Комментарий обязателен для корректировки').max(500),
});

/**
 * Combined movement schema - discriminated union
 */
export const createMovementSchema = z.discriminatedUnion('movementType', [
    incomeMovementSchema,
    expenseMovementSchema,
    transferMovementSchema,
    adjustmentMovementSchema,
]);

// Export types
export type IncomeMovementInput = z.infer<typeof incomeMovementSchema>;
export type ExpenseMovementInput = z.infer<typeof expenseMovementSchema>;
export type TransferMovementInput = z.infer<typeof transferMovementSchema>;
export type AdjustmentMovementInput = z.infer<typeof adjustmentMovementSchema>;
export type CreateMovementInput = z.infer<typeof createMovementSchema>;
