// Employee Controller - Handle employee requests
import { Request, Response, NextFunction } from 'express';
import * as employeeService from '../services/employeeService';

export async function listEmployees(req: Request, res: Response, next: NextFunction) {
    try {
        // Extract organizationId from authenticated user (set by auth middleware)
        const organizationId = req.user!.organizationId;
        const { departmentId, isActive, page, limit } = req.query;

        const filters: employeeService.EmployeeFilters = {
            organizationId,  // Always filter by user's organization
            departmentId: departmentId as string,
            isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
            page: page ? parseInt(page as string) : undefined,
            limit: limit ? parseInt(limit as string) : undefined,
        };

        const result = await employeeService.getEmployees(filters);

        res.json({
            success: true,
            data: result,
        });
    } catch (err) {
        next(err);
    }
}

export async function getEmployeeById(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;

        const employee = await employeeService.getEmployeeById(id);

        if (!employee) {
            return res.status(404).json({
                success: false,
                error: 'Employee not found',
            });
        }

        res.json({
            success: true,
            data: { employee },
        });
    } catch (err) {
        next(err);
    }
}

export async function createEmployee(req: Request, res: Response, next: NextFunction) {
    try {
        // Extract organizationId from authenticated user (set by auth middleware)
        const organizationId = req.user!.organizationId;

        const employee = await employeeService.createEmployee({
            ...req.body,
            organizationId  // Override/add organizationId from token
        });

        res.status(201).json({
            success: true,
            data: { employee },
        });
    } catch (err) {
        next(err);
    }
}

export async function updateEmployee(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;

        const employee = await employeeService.updateEmployee(id, req.body);

        res.json({
            success: true,
            data: { employee },
        });
    } catch (err) {
        next(err);
    }
}

export async function deleteEmployee(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;

        await employeeService.deleteEmployee(id);

        res.json({
            success: true,
            message: 'Employee deleted successfully',
        });
    } catch (err) {
        next(err);
    }
}
