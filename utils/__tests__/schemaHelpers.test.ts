import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
    isFieldRequired,
    getRequiredFields,
    getRequiredFieldsWithErrors,
    isNestedFieldRequired,
    createRequiredProps,
    getAllFields,
} from '../schemaHelpers';

describe('schemaHelpers', () => {
    describe('isFieldRequired', () => {
        it('returns true for required string field with min(1)', () => {
            const schema = z.object({
                name: z.string().min(1, 'Name is required'),
            });

            expect(isFieldRequired(schema, 'name')).toBe(true);
        });

        it('returns false for optional string field', () => {
            const schema = z.object({
                name: z.string().optional(),
            });

            expect(isFieldRequired(schema, 'name')).toBe(false);
        });

        it('returns false for nullable string field', () => {
            const schema = z.object({
                name: z.string().nullable(),
            });

            expect(isFieldRequired(schema, 'name')).toBe(false);
        });

        it('returns true for required number field', () => {
            const schema = z.object({
                age: z.number(),
            });

            expect(isFieldRequired(schema, 'age')).toBe(true);
        });

        it('returns false for optional number field', () => {
            const schema = z.object({
                age: z.number().optional(),
            });

            expect(isFieldRequired(schema, 'age')).toBe(false);
        });

        it('returns true for enum field', () => {
            const schema = z.object({
                status: z.enum(['active', 'inactive']),
            });

            expect(isFieldRequired(schema, 'status')).toBe(true);
        });

        it('returns false for optional enum field', () => {
            const schema = z.object({
                status: z.enum(['active', 'inactive']).optional(),
            });

            expect(isFieldRequired(schema, 'status')).toBe(false);
        });

        it('returns true for native enum field', () => {
            enum Status {
                Active = 'active',
                Inactive = 'inactive',
            }

            const schema = z.object({
                status: z.nativeEnum(Status),
            });

            expect(isFieldRequired(schema, 'status')).toBe(true);
        });

        it('returns false for array without min constraint', () => {
            const schema = z.object({
                items: z.array(z.string()),
            });

            expect(isFieldRequired(schema, 'items')).toBe(false);
        });

        it('returns true for array with min(1)', () => {
            const schema = z.object({
                items: z.array(z.string()).min(1),
            });

            expect(isFieldRequired(schema, 'items')).toBe(true);
        });

        it('returns false for field with default value', () => {
            const schema = z.object({
                count: z.number().default(0),
            });

            expect(isFieldRequired(schema, 'count')).toBe(false);
        });

        it('returns false for non-existent field', () => {
            const schema = z.object({
                name: z.string(),
            });

            expect(isFieldRequired(schema, 'nonExistent')).toBe(false);
        });
    });

    describe('getRequiredFields', () => {
        it('returns all required fields', () => {
            const schema = z.object({
                name: z.string().min(1),
                age: z.number(),
                email: z.string().optional(),
                phone: z.string().nullable(),
                status: z.enum(['active', 'inactive']),
            });

            const required = getRequiredFields(schema);
            expect(required).toContain('name');
            expect(required).toContain('age');
            expect(required).toContain('status');
            expect(required).not.toContain('email');
            expect(required).not.toContain('phone');
        });

        it('returns empty array for schema with no required fields', () => {
            const schema = z.object({
                name: z.string().optional(),
                age: z.number().optional(),
            });

            const required = getRequiredFields(schema);
            expect(required).toEqual([]);
        });

        it('handles complex schema correctly', () => {
            const schema = z.object({
                id: z.string(),
                plateNumber: z.string().min(1, 'Required'),
                brand: z.string().min(1, 'Required'),
                year: z.number().optional(),
                mileage: z.number(),
                notes: z.string().optional().nullable(),
            });

            const required = getRequiredFields(schema);
            expect(required).toHaveLength(3);
            expect(required).toContain('plateNumber');
            expect(required).toContain('brand');
            expect(required).toContain('mileage');
            expect(required).not.toContain('id'); // id is string without min(1), so not required
        });
    });

    describe('getRequiredFieldsWithErrors', () => {
        it('returns required fields with error messages', () => {
            const schema = z.object({
                name: z.string().min(1, 'Name is required'),
                age: z.number(),
            });

            const fieldsWithErrors = getRequiredFieldsWithErrors(schema);
            expect(fieldsWithErrors).toHaveProperty('name');
            expect(fieldsWithErrors).toHaveProperty('age');
            expect(fieldsWithErrors.name).toBe('Name is required');
        });

        it('returns default error message when custom message not provided', () => {
            const schema = z.object({
                email: z.string().min(1),
            });

            const fieldsWithErrors = getRequiredFieldsWithErrors(schema);
            expect(fieldsWithErrors.email).toContain('email');
            expect(fieldsWithErrors.email).toContain('обязателен');
        });
    });

    describe('isNestedFieldRequired', () => {
        it('returns true for required nested field', () => {
            const schema = z.object({
                user: z.object({
                    name: z.string().min(1),
                    email: z.string().optional(),
                }),
            });

            expect(isNestedFieldRequired(schema, 'user.name')).toBe(true);
        });

        it('returns false for optional nested field', () => {
            const schema = z.object({
                user: z.object({
                    name: z.string().min(1),
                    email: z.string().optional(),
                }),
            });

            expect(isNestedFieldRequired(schema, 'user.email')).toBe(false);
        });

        it('handles deeply nested fields', () => {
            const schema = z.object({
                vehicle: z.object({
                    fuelConsumptionRates: z.object({
                        summerRate: z.number(),
                        winterRate: z.number(),
                        cityIncreasePercent: z.number().optional(),
                    }),
                }),
            });

            expect(isNestedFieldRequired(schema, 'vehicle.fuelConsumptionRates.summerRate')).toBe(true);
            expect(isNestedFieldRequired(schema, 'vehicle.fuelConsumptionRates.winterRate')).toBe(true);
            expect(isNestedFieldRequired(schema, 'vehicle.fuelConsumptionRates.cityIncreasePercent')).toBe(false);
        });

        it('returns false for non-existent nested path', () => {
            const schema = z.object({
                user: z.object({
                    name: z.string(),
                }),
            });

            expect(isNestedFieldRequired(schema, 'user.nonExistent')).toBe(false);
            expect(isNestedFieldRequired(schema, 'nonExistent.field')).toBe(false);
        });
    });

    describe('createRequiredProps', () => {
        it('creates object with boolean values for all fields', () => {
            const schema = z.object({
                name: z.string().min(1),
                age: z.number(),
                email: z.string().optional(),
            });

            const props = createRequiredProps(schema);
            expect(props.name).toBe(true);
            expect(props.age).toBe(true);
            expect(props.email).toBe(false);
        });

        it('includes all fields from schema', () => {
            const schema = z.object({
                field1: z.string(),
                field2: z.number().optional(),
                field3: z.boolean(),
            });

            const props = createRequiredProps(schema);
            expect(Object.keys(props)).toHaveLength(3);
            expect(props).toHaveProperty('field1');
            expect(props).toHaveProperty('field2');
            expect(props).toHaveProperty('field3');
        });
    });

    describe('getAllFields', () => {
        it('returns all field names from schema', () => {
            const schema = z.object({
                name: z.string(),
                age: z.number(),
                email: z.string().optional(),
            });

            const fields = getAllFields(schema);
            expect(fields).toHaveLength(3);
            expect(fields).toContain('name');
            expect(fields).toContain('age');
            expect(fields).toContain('email');
        });

        it('returns empty array for empty schema', () => {
            const schema = z.object({});

            const fields = getAllFields(schema);
            expect(fields).toEqual([]);
        });
    });

    describe('Real-world schema examples', () => {
        it('correctly identifies required fields in vehicle schema', () => {
            const fuelConsumptionRatesSchema = z.object({
                summerRate: z.number().positive(),
                winterRate: z.number().positive(),
                cityIncreasePercent: z.number().min(0).optional().nullable(),
                warmingIncreasePercent: z.number().min(0).optional().nullable(),
            });

            const vehicleSchema = z.object({
                id: z.string().optional(),
                plateNumber: z.string().min(1, 'Гос. номер обязателен'),
                brand: z.string().min(1, 'Марка/модель обязательна'),
                vin: z.string().min(1, 'VIN обязателен'),
                mileage: z.number().min(0),
                fuelTypeId: z.string().min(1, 'Тип топлива обязателен'),
                fuelConsumptionRates: fuelConsumptionRatesSchema,
                assignedDriverId: z.string().nullable(),
                organizationId: z.string().optional().nullable(),
                year: z.number().optional().nullable(),
                notes: z.string().optional().nullable(),
            });

            const required = getRequiredFields(vehicleSchema);

            // Required fields
            expect(required).toContain('plateNumber');
            expect(required).toContain('brand');
            expect(required).toContain('vin');
            expect(required).toContain('mileage');
            expect(required).toContain('fuelTypeId');
            expect(required).toContain('fuelConsumptionRates');

            // Optional fields
            expect(required).not.toContain('id');
            expect(required).not.toContain('assignedDriverId');
            expect(required).not.toContain('organizationId');
            expect(required).not.toContain('year');
            expect(required).not.toContain('notes');

            // Nested fields
            expect(isNestedFieldRequired(vehicleSchema, 'fuelConsumptionRates.summerRate')).toBe(true);
            expect(isNestedFieldRequired(vehicleSchema, 'fuelConsumptionRates.winterRate')).toBe(true);
            expect(isNestedFieldRequired(vehicleSchema, 'fuelConsumptionRates.cityIncreasePercent')).toBe(false);
        });

        it('correctly identifies required fields in employee schema', () => {
            const employeeSchema = z.object({
                id: z.string().optional(),
                fullName: z.string().min(1, 'ФИО обязательно'),
                shortName: z.string().min(1, 'Сокращенное ФИО обязательно'),
                employeeType: z.enum(['driver', 'dispatcher', 'controller']),
                position: z.string().optional().nullable(),
                organizationId: z.string().nullable(),
                status: z.enum(['Active', 'Inactive']),
                phone: z.string().optional().nullable(),
                notes: z.string().optional().nullable(),
            });

            const required = getRequiredFields(employeeSchema);

            expect(required).toContain('fullName');
            expect(required).toContain('shortName');
            expect(required).toContain('employeeType');
            expect(required).toContain('status');

            expect(required).not.toContain('id');
            expect(required).not.toContain('position');
            expect(required).not.toContain('organizationId');
            expect(required).not.toContain('phone');
            expect(required).not.toContain('notes');
        });
    });
});
