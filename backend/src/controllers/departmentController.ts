// Department Controller - Handle department requests
import { Request, Response, NextFunction } from 'express';
import * as departmentService from '../services/departmentService';

export async function listDepartments(req: Request, res: Response, next: NextFunction) {
    try {
        const { organizationId, page, limit } = req.query;

        const filters: departmentService.DepartmentFilters = {
            organizationId: organizationId as string,
            page: page ? parseInt(page as string) : undefined,
            limit: limit ? parseInt(limit as string) : undefined,
        };

        const result = await departmentService.getDepartments(filters);

        res.json({
            success: true,
            data: result,
        });
    } catch (err) {
        next(err);
    }
}

export async function getDepartmentById(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;

        const department = await departmentService.getDepartmentById(id);

        if (!department) {
            return res.status(404).json({
                success: false,
                error: 'Department not found',
            });
        }

        res.json({
            success: true,
            data: { department },
        });
    } catch (err) {
        next(err);
    }
}

export async function createDepartment(req: Request, res: Response, next: NextFunction) {
    try {
        const department = await departmentService.createDepartment(req.body);

        res.status(201).json({
            success: true,
            data: { department },
        });
    } catch (err) {
        next(err);
    }
}

export async function updateDepartment(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;

        const department = await departmentService.updateDepartment(id, req.body);

        res.json({
            success: true,
            data: { department },
        });
    } catch (err) {
        next(err);
    }
}

export async function deleteDepartment(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;

        await departmentService.deleteDepartment(id);

        res.json({
            success: true,
            message: 'Department deleted successfully',
        });
    } catch (err) {
        next(err);
    }
}
