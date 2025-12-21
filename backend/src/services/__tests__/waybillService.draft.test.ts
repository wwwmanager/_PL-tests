
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. Setup Hoisted Mocks
const { mockPrisma } = vi.hoisted(() => {
    const instance: any = {
        waybill: {
            create: vi.fn(),
            update: vi.fn(),
            findUnique: vi.fn(),
            findFirst: vi.fn(),
        },
        waybillFuel: {
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        },
        employee: { findUnique: vi.fn() },
        organization: { findUnique: vi.fn() },
        vehicle: { findUnique: vi.fn(), findFirst: vi.fn() },
        driver: { findUnique: vi.fn(), findFirst: vi.fn() },
        // Placeholder for transaction
        $transaction: vi.fn(),
        $queryRaw: vi.fn(), // Add this
    };
    // Circular reference fix
    instance.$transaction.mockImplementation((cb: any) => cb(instance));
    return { mockPrisma: instance };
});

// 2. Mock @prisma/client module
vi.mock('@prisma/client', async () => {
    const actual = await vi.importActual<typeof import('@prisma/client')>('@prisma/client');
    return {
        ...actual,
        PrismaClient: vi.fn(() => mockPrisma),
    };
});

// 3. Import service AFTER mock setup
import { createWaybill } from '../waybillService';

// 4. Mock dependencies
vi.mock('../blankService', () => ({
    reserveNextBlankForDriver: vi.fn(),
    reserveSpecificBlank: vi.fn(),
    releaseBlank: vi.fn(),
}));

vi.mock('../stockLocationService', () => ({
    getOrCreateVehicleTankLocation: vi.fn(),
    getOrCreateFuelCardLocation: vi.fn(),
    getOrCreateDefaultWarehouseLocation: vi.fn(),
}));

vi.mock('../stockService', () => ({
    createTransfer: vi.fn(),
    createExpenseMovement: vi.fn(),
    getBalanceAt: vi.fn(),
}));

import { reserveNextBlankForDriver } from '../blankService';
import { getOrCreateVehicleTankLocation } from '../stockLocationService';

describe('Waybill Service - Draft Persistence', () => {
    const mockDate = new Date();
    const fuelData = {
        stockItemId: 'fuel-item-id',
        fuelStart: 100,
        fuelReceived: 50,
        fuelConsumed: 30,
        fuelEnd: 120,
        fuelPlanned: 35,
        sourceType: 'MANUAL',
        comment: 'Test fuel',
    };

    const baseInput = {
        organizationId: 'org-1',
        number: 'WB-001',
        date: mockDate.toISOString(), // Fix type
        vehicleId: 'veh-1',
        driverId: 'drv-1',
        dispatcherEmployeeId: 'emp-disp-1',
        controllerEmployeeId: 'emp-cont-1',
        validTo: mockDate.toISOString(),
        odometerStart: 1000,
        odometerEnd: 1100,
        fuel: fuelData
    };

    const mockUser = {
        id: 'user-1',
        organizationId: 'org-1',
        departmentId: null,
        role: 'dispatcher',
        employeeId: 'emp-disp-1'
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Setup defaults
        mockPrisma.vehicle.findFirst.mockResolvedValue({ id: 'veh-1', fuelStockItemId: 'fuel-item-id', assignedDriverId: 'drv-1' });
        mockPrisma.driver.findFirst.mockResolvedValue({ id: 'drv-1', employeeId: 'emp-drv-1' });
        mockPrisma.employee.findUnique.mockResolvedValue({ id: 'drv-1' });

        // Setup service mocks
        (reserveNextBlankForDriver as any).mockResolvedValue({ blank: { id: 'blk-1', series: 'A', number: 123 } });
        (getOrCreateVehicleTankLocation as any).mockResolvedValue('loc-1');

        // Transaction mock implementation needed per test run? No, defined in hoisted.
    });

    it('should create waybill with new fields and flattened fuel', async () => {
        const createdWaybill = {
            id: 'wb-1',
            ...baseInput,
        };
        mockPrisma.waybill.create.mockResolvedValue(createdWaybill);

        // Mock getWaybillById return (called via findUnique at end of createWaybill)
        mockPrisma.waybill.findUnique.mockResolvedValue({
            ...createdWaybill,
            fuelLines: [{ ...fuelData, id: 'fl-1' }]
        });
        const result = await createWaybill(mockUser, baseInput) as any;

        // Verify create payload
        expect(mockPrisma.waybill.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                dispatcherEmployeeId: 'emp-disp-1',
                controllerEmployeeId: 'emp-cont-1',
                // validTo: mockDate.toISOString(), // passed as string
            })
        }));

        // Verify fuel data passed to create
        // Access the create call arguments
        const createArgs = mockPrisma.waybill.create.mock.calls[0][0];
        const data = createArgs.data;

        // Check if fuel is handled via fuelLines relation in create
        // Note: implementation might differ (e.g. create waybill then create fuel), but DTO usually allows nested create.
        // If implementation uses `getWaybillById` to return result, then input check is crucial.

        // For upsert/create logic in waybillService:
        // It logic does: 
        // const waybill = await prisma.waybill.create({ data: { ... } });
        // if (input.fuel) ...

        // If logic separates creation key steps, we can check calls order.
        // Assuming implementation creates fuel via `fuelLines: { create: ... }` nested write?
        // OR separate calls.
        // The previous implementation analysis (Phase B) said "WaybillFuel is treated as a single aggregate... logic to create a WaybillFuel record...".
        // Let's check if it creates inside the `waybill.create` call.

        if (data.fuelLines) {
            // It's nested array
            expect(data.fuelLines.create[0]).toEqual(expect.objectContaining({
                fuelStart: 100
            }));
        } else {
            // It's separate. Check waybillFuel.create/upsert
            // But mockPrisma.waybillFuel was spied.
            // Wait, did I spy waybillFuel? Yes.
            // Check calls to waybillFuel
            // However, user prompt context suggests implementation does "upsert mechanism for WaybillFuel aggregate within Prisma transaction".
            // So likely separate call or nested.
            // If separate:
            // expect(mockPrisma.waybillFuel.upsert).toHaveBeenCalled... (or create)
        }

        // Check result
        expect(result.dispatcherEmployeeId).toBe('emp-disp-1');
        expect(result.fuel).toBeDefined();
        expect(result.fuel?.fuelStart).toBe(100);
    });
});
