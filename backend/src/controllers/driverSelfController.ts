import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { getOrCreateFuelCardLocation, getOrCreateVehicleTankLocation } from '../services/stockLocationService';
import { getBalanceAt } from '../services/stockService';

const prisma = new PrismaClient();

/**
 * GET /api/drivers/self
 * DRIVER-SELF-BE-010: Driver gets all their related data
 * 
 * Returns:
 * - user info
 * - employee/driver details
 * - assigned vehicles
 * - fuel cards with ledger balances
 * - waybill count
 */
export async function getDriverSelf(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user!;

        if (!user.employeeId) {
            return res.status(400).json({
                error: 'NO_EMPLOYEE_LINK',
                message: 'Пользователь не связан с сотрудником'
            });
        }

        // 1. Load Employee with Driver
        const employee = await prisma.employee.findUnique({
            where: { id: user.employeeId },
            include: {
                department: { select: { id: true, name: true } },
                driver: true,
            }
        });

        if (!employee) {
            return res.status(404).json({
                error: 'EMPLOYEE_NOT_FOUND',
                message: 'Сотрудник не найден'
            });
        }

        // 2. Load assigned vehicles
        const vehicles = await prisma.vehicle.findMany({
            where: { assignedDriverId: user.employeeId },
            select: {
                id: true,
                registrationNumber: true,
                brand: true,
                model: true,
                fuelStockItemId: true,
                fuelStockItem: { select: { id: true, name: true } },
                fuelTankCapacity: true,
            }
        });

        // 3. Load fuel cards assigned to driver
        const fuelCards = employee.driver
            ? await prisma.fuelCard.findMany({
                where: {
                    assignedToDriverId: employee.driver.id,
                    isActive: true
                },
                select: {
                    id: true,
                    cardNumber: true,
                    provider: true,
                    isActive: true,
                }
            })
            : [];

        // 4. Calculate ledger balances for each fuel card
        const cardsWithBalances = await Promise.all(fuelCards.map(async (card) => {
            try {
                const location = await getOrCreateFuelCardLocation(card.id);

                // Get balance for default fuel type (from first vehicle)
                const defaultStockItemId = vehicles[0]?.fuelStockItemId;
                let balance = 0;
                if (defaultStockItemId) {
                    balance = await getBalanceAt(location.id, defaultStockItemId, new Date());
                }

                return {
                    ...card,
                    stockLocationId: location.id,
                    balanceLiters: balance,
                    stockItemId: defaultStockItemId || null,
                };
            } catch (e) {
                console.warn(`[getDriverSelf] Failed to get balance for card ${card.id}`, e);
                return {
                    ...card,
                    stockLocationId: null,
                    balanceLiters: 0,
                    stockItemId: null,
                };
            }
        }));

        // 5. Count waybills
        const waybillCount = employee.driver
            ? await prisma.waybill.count({
                where: {
                    driverId: employee.driver.id,
                    organizationId: user.organizationId
                }
            })
            : 0;

        // 6. Get vehicle tank balances
        const vehiclesWithTankBalance = await Promise.all(vehicles.map(async (v) => {
            try {
                const tankLocation = await getOrCreateVehicleTankLocation(v.id);
                let tankBalance = 0;
                if (v.fuelStockItemId) {
                    tankBalance = await getBalanceAt(tankLocation.id, v.fuelStockItemId, new Date());
                }
                return {
                    ...v,
                    fuelTankCapacity: v.fuelTankCapacity ? Number(v.fuelTankCapacity) : null,
                    tankLocationId: tankLocation.id,
                    tankBalance,
                };
            } catch (e) {
                console.warn(`[getDriverSelf] Failed to get tank balance for vehicle ${v.id}`, e);
                return {
                    ...v,
                    fuelTankCapacity: v.fuelTankCapacity ? Number(v.fuelTankCapacity) : null,
                    tankLocationId: null,
                    tankBalance: 0,
                };
            }
        }));

        return res.json({
            user: {
                id: user.id,
                role: user.role,
                organizationId: user.organizationId,
            },
            employee: {
                id: employee.id,
                fullName: employee.fullName,
                employeeType: employee.employeeType,
                departmentId: employee.departmentId,
                departmentName: employee.department?.name || null,
            },
            driver: employee.driver
                ? {
                    id: employee.driver.id,
                    licenseNumber: employee.driver.licenseNumber,
                    licenseCategory: employee.driver.licenseCategory,
                }
                : null,
            vehicles: vehiclesWithTankBalance,
            fuelCards: cardsWithBalances,
            stats: {
                waybillCount,
                vehicleCount: vehicles.length,
                fuelCardCount: fuelCards.length,
            }
        });
    } catch (err) {
        next(err);
    }
}
