/**
 * Waybill DTO Validation Schemas
 * Uses Zod for runtime validation and type safety
 */

import { z } from 'zod';

/**
 * Single fuel line schema
 */
export const fuelLineSchema = z.object({
    stockItemId: z.string().uuid(),
    fuelTypeId: z.string().uuid().optional().nullable(),
    fuelStart: z.number().optional().nullable(),
    fuelReceived: z.number().min(0).optional().nullable(),
    fuelConsumed: z.number().min(0).optional().nullable(),
    fuelEnd: z.number().optional().nullable(),
    fuelPlanned: z.number().min(0).optional().nullable(),
    comment: z.string().optional().nullable(),
});

/**
 * Route segment schema
 */
export const routeSchema = z.object({
    routeId: z.string().uuid().optional().nullable(),
    legOrder: z.number().int().min(0),
    fromPoint: z.string().optional().nullable(),
    toPoint: z.string().optional().nullable(),
    distanceKm: z.number().min(0).optional().nullable(),
    plannedTime: z.string().optional().nullable(),
    actualTime: z.string().optional().nullable(),
    comment: z.string().optional().nullable(),
    date: z.string().optional().nullable(), // WB-ROUTE-DATE: Route-specific date
});

/**
 * Legacy fuel fields (for backward compatibility with frontend)
 * These will be mapped to fuelLines[0]
 */
const legacyFuelFieldsSchema = z.object({
    fuelAtStart: z.number().optional().nullable(),
    fuelFilled: z.number().min(0).optional().nullable(),
    fuelAtEnd: z.number().optional().nullable(),
    fuelPlanned: z.number().min(0).optional().nullable(),
    fuelConsumed: z.number().min(0).optional().nullable(),
    stockItemId: z.string().uuid().optional().nullable(), // For legacy single-fuel mode
});

/**
 * Single fuel object schema (for frontend fuel: {...} object)
 * This is what the frontend sends, different from fuelLines array
 */
export const fuelObjectSchema = z.object({
    stockItemId: z.string().uuid().optional().nullable(),
    fuelStart: z.number().optional().nullable(),
    fuelReceived: z.number().min(0).optional().nullable(),
    fuelConsumed: z.number().min(0).optional().nullable(),
    fuelEnd: z.number().optional().nullable(),
    fuelPlanned: z.number().min(0).optional().nullable(),
    sourceType: z.enum(['MANUAL', 'GAS_STATION', 'FUEL_CARD']).optional().nullable(),
    refueledAt: z.string().datetime().optional().nullable(),
    comment: z.string().optional().nullable(),
}).optional().nullable();

/**
 * Create waybill input schema
 */
export const createWaybillSchema = z.object({
    // WB-901: number is optional - backend assigns it from blank
    number: z.string().optional().default(''),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Дата должна быть в формате YYYY-MM-DD'),
    vehicleId: z.string().uuid('vehicleId должен быть UUID'),
    driverId: z.string().uuid('driverId должен быть UUID'),

    // Optional IDs
    departmentId: z.string().uuid().optional().nullable(),
    fuelCardId: z.string().uuid().optional().nullable(),
    blankId: z.string().uuid().optional().nullable(),

    // Odometer
    odometerStart: z.number().min(0).optional().nullable(),
    odometerEnd: z.number().min(0).optional().nullable(),

    // Driving flags (WB-102)
    isCityDriving: z.boolean().optional().default(false),
    isWarming: z.boolean().optional().default(false),

    // Routes and fuel lines
    routes: z.array(routeSchema).optional().default([]),
    fuelLines: z.array(fuelLineSchema).optional().default([]),

    // WB-FUEL-FIX: Frontend sends fuel as object, not as flat fields or fuelLines
    fuel: fuelObjectSchema,

    // Notes
    plannedRoute: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),

    // WB-FIX-PL-001: New fields
    dispatcherEmployeeId: z.string().uuid().optional().nullable(),
    controllerEmployeeId: z.string().uuid().optional().nullable(),
    // REL-103: Departure and return datetime
    startAt: z.string().datetime().optional().nullable(),
    endAt: z.string().datetime().optional().nullable(),
    validTo: z.string().datetime().optional().nullable(),
    // Legacy aliases
    dispatcherId: z.string().uuid().optional().nullable(),
    controllerId: z.string().uuid().optional().nullable(),

    // Legacy fuel fields (will be mapped to fuelLines if present)
}).merge(legacyFuelFieldsSchema);

/**
 * Update waybill input schema (all fields optional except for validation)
 */
export const updateWaybillSchema = z.object({
    // Optional IDs - can update these
    departmentId: z.string().uuid().optional().nullable(),
    fuelCardId: z.string().uuid().optional().nullable(),
    blankId: z.string().uuid().optional().nullable(),
    vehicleId: z.string().uuid().optional(),
    driverId: z.string().uuid().optional(),

    // Waybill details
    number: z.string().min(1).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),

    // Odometer
    odometerStart: z.number().min(0).optional().nullable(),
    odometerEnd: z.number().min(0).optional().nullable(),

    // Driving flags
    isCityDriving: z.boolean().optional(),
    isWarming: z.boolean().optional(),

    // Routes and fuel - replace strategy
    routes: z.array(routeSchema).optional(),
    fuelLines: z.array(fuelLineSchema).optional(),

    // WB-FUEL-FIX: Frontend sends fuel as object
    fuel: fuelObjectSchema,

    // Notes
    plannedRoute: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),

    // WB-FIX-PL-001: New fields
    dispatcherEmployeeId: z.string().uuid().optional().nullable(),
    controllerEmployeeId: z.string().uuid().optional().nullable(),
    // REL-103: Departure and return datetime
    startAt: z.string().datetime().optional().nullable(),
    endAt: z.string().datetime().optional().nullable(),
    validTo: z.string().datetime().optional().nullable(),
    // Legacy aliases
    dispatcherId: z.string().uuid().optional().nullable(),
    controllerId: z.string().uuid().optional().nullable(),

    // Legacy fuel fields
}).merge(legacyFuelFieldsSchema);

/**
 * Change status input schema
 */
export const changeStatusSchema = z.object({
    status: z.enum(['DRAFT', 'SUBMITTED', 'POSTED', 'CANCELLED']),
});

// Export types
export type CreateWaybillInput = z.infer<typeof createWaybillSchema>;
export type UpdateWaybillInput = z.infer<typeof updateWaybillSchema>;
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;
export type FuelLineInput = z.infer<typeof fuelLineSchema>;

/**
 * Map legacy fuel fields to fuelLines array
 * If legacy fields are present and fuelLines is empty, create a fuel line from them
 */
export function mapLegacyFuelFields(data: CreateWaybillInput | UpdateWaybillInput): void {
    // Skip if fuelLines already populated
    if (data.fuelLines && data.fuelLines.length > 0) {
        return;
    }

    // Check if any legacy fuel fields are present
    const hasLegacyFields =
        data.fuelAtStart !== undefined ||
        data.fuelFilled !== undefined ||
        data.fuelAtEnd !== undefined ||
        data.fuelConsumed !== undefined ||
        data.fuelPlanned !== undefined;

    if (!hasLegacyFields) {
        return;
    }

    // Need stockItemId to create fuel line
    if (!data.stockItemId) {
        console.warn('[WB-401] Legacy fuel fields present but no stockItemId - skipping fuel line creation');
        return;
    }

    // Create fuel line from legacy fields
    const fuelLine: FuelLineInput = {
        stockItemId: data.stockItemId,
        fuelStart: data.fuelAtStart ?? null,
        fuelReceived: data.fuelFilled ?? null,
        fuelConsumed: data.fuelConsumed ?? null,
        fuelEnd: data.fuelAtEnd ?? null,
        fuelPlanned: data.fuelPlanned ?? null,
    };

    // Initialize fuelLines if needed
    if (!data.fuelLines) {
        (data as any).fuelLines = [];
    }
    (data as any).fuelLines.push(fuelLine);

    console.log('[WB-401] Mapped legacy fuel fields to fuelLines[0]:', fuelLine);
}
