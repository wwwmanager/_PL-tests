import { describe, it, expect } from 'vitest';
import { vehicleSchema } from '../../../src/dto/vehicleDto';

describe('Vehicle DTO Validation', () => {
    it('should parse valid JSON string for fuelConsumptionRates', () => {
        const input = {
            registrationNumber: 'TEST001',
            fuelConsumptionRates: JSON.stringify({ summerRate: "20.5", winterRate: 25 })
        };

        const result = vehicleSchema.parse(input);
        expect(result.fuelConsumptionRates).toEqual(
            expect.objectContaining({
                summerRate: 20.5,
                winterRate: 25
            })
        );
    });

    it('should parse valid object for fuelConsumptionRates', () => {
        const input = {
            registrationNumber: 'TEST002',
            fuelConsumptionRates: { summerRate: 20.5, winterRate: 25 }
        };

        const result = vehicleSchema.parse(input);
        expect(result.fuelConsumptionRates).toEqual(
            expect.objectContaining({
                summerRate: 20.5,
                winterRate: 25
            })
        );
    });

    it('should handle invalid JSON string by returning null', () => {
        const input = {
            registrationNumber: 'TEST003',
            fuelConsumptionRates: 'invalid-json}'
        };

        const result = vehicleSchema.parse(input);
        expect(result.fuelConsumptionRates).toBeNull();
    });

    it('should handle empty string as null', () => {
        const input = {
            registrationNumber: 'TEST004',
            fuelConsumptionRates: ''
        };

        const result = vehicleSchema.parse(input);
        expect(result.fuelConsumptionRates).toBeNull();
    });
});
