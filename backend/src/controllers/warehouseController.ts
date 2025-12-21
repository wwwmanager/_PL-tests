import { Request, Response, NextFunction } from 'express';
import * as warehouseService from '../services/warehouseService';

/**
 * List all warehouses for the authenticated user's organization
 */
export async function listWarehouses(req: Request, res: Response, next: NextFunction) {
    try {
        const organizationId = req.user!.organizationId;
        const warehouses = await warehouseService.listWarehouses(organizationId);
        res.json({ data: warehouses });
    } catch (err) {
        next(err);
    }
}

/**
 * Get warehouse by ID
 */
export async function getWarehouseById(req: Request, res: Response, next: NextFunction) {
    try {
        const organizationId = req.user!.organizationId;
        const { id } = req.params;

        const warehouse = await warehouseService.getWarehouseById(organizationId, id);

        if (!warehouse) {
            return res.status(404).json({ error: 'Warehouse not found' });
        }

        res.json({ data: warehouse });
    } catch (err) {
        next(err);
    }
}

/**
 * Create new warehouse
 * WH-FIX-RESP-LOC-001: Added support for responsibleEmployeeId and other fields
 */
export async function createWarehouse(req: Request, res: Response, next: NextFunction) {
    try {
        const organizationId = req.user!.organizationId;
        const { name, address, departmentId, responsibleEmployeeId, description, type, status } = req.body;

        // Validation
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ error: 'Name is required' });
        }

        const warehouse = await warehouseService.createWarehouse({
            organizationId,
            name: name.trim(),
            address: address || null,
            departmentId: departmentId || null,
            responsibleEmployeeId: responsibleEmployeeId || null,
            description: description || null,
            type: type || null,
            status: status || 'active',
        });

        res.status(201).json({ data: warehouse });
    } catch (err) {
        next(err);
    }
}

/**
 * Update warehouse
 * WH-FIX-RESP-LOC-001: Added support for responsibleEmployeeId and other fields
 */
export async function updateWarehouse(req: Request, res: Response, next: NextFunction) {
    try {
        const organizationId = req.user!.organizationId;
        const { id } = req.params;
        const { name, address, departmentId, responsibleEmployeeId, description, type, status } = req.body;

        const warehouse = await warehouseService.updateWarehouse(organizationId, id, {
            name,
            address,
            departmentId,
            responsibleEmployeeId,
            description,
            type,
            status,
        });

        res.json({ data: warehouse });
    } catch (err) {
        next(err);
    }
}

/**
 * Delete warehouse
 */
export async function deleteWarehouse(req: Request, res: Response, next: NextFunction) {
    try {
        const organizationId = req.user!.organizationId;
        const { id } = req.params;

        await warehouseService.deleteWarehouse(organizationId, id);

        res.json({ message: 'Warehouse deleted successfully' });
    } catch (err) {
        next(err);
    }
}
