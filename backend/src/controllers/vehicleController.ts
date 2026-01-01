import { Request, Response, NextFunction } from 'express';
import * as vehicleService from '../services/vehicleService';
import fs from 'fs';
import path from 'path';

const LOG_FILE = 'c:/_PL-tests/request-logs.txt';
function logToFile(msg: string) {
    try {
        fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`);
    } catch { }
}

export async function listVehicles(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user!;
        const orgId = user.organizationId;
        const departmentId = user.departmentId;

        // RLS-SCOPE-020: Driver sees only assigned vehicles
        const options = user.role === 'driver' && user.employeeId
            ? { driverEmployeeId: user.employeeId }
            : undefined;

        logToFile(`🌐 GET /vehicles - User Org: ${orgId}, Dept: ${departmentId}, Role: ${user.role}, DriverFilter: ${options?.driverEmployeeId || 'none'}`);
        const vehicles = await vehicleService.listVehicles(orgId, departmentId, options);
        logToFile(`🌐 Found ${vehicles.length} vehicles for org ${orgId}`);
        res.json(vehicles);
    } catch (err: any) {
        logToFile(`🌐 Error in listVehicles: ${err.message}`);
        next(err);
    }
}

export async function getVehicleById(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;
        const { id } = req.params;
        const vehicle = await vehicleService.getVehicleById(orgId, id);
        if (!vehicle) return res.status(404).json({ error: 'Не найдено' });
        res.json(vehicle);
    } catch (err) {
        next(err);
    }
}

export async function createVehicle(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;
        const data = req.body;
        console.log(`🌐 [vehicleController] POST /vehicles - User Org: ${orgId}. Body Org: ${data.organizationId}`);
        const vehicle = await vehicleService.createVehicle(orgId, data);
        console.log(`🌐 [vehicleController] Created vehicle: ${vehicle.registrationNumber} (ID: ${vehicle.id}) in org ${vehicle.organizationId}`);
        res.status(201).json(vehicle);
    } catch (err) {
        console.error(`🌐 [vehicleController] Error in createVehicle:`, err);
        next(err);
    }
}

export async function updateVehicle(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;
        const { id } = req.params;
        const data = req.body;
        const vehicle = await vehicleService.updateVehicle(orgId, id, data);
        res.json(vehicle);
    } catch (err) {
        next(err);
    }
}

export async function deleteVehicle(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;
        const { id } = req.params;
        await vehicleService.deleteVehicle(orgId, id);
        res.json({ message: 'Удалено' });
    } catch (err) {
        next(err);
    }
}
