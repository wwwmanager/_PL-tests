import { Request, Response, NextFunction } from 'express';
import * as roleService from '../services/roleService';
import { invalidatePermissionCache } from '../middleware/checkPermission';

export async function listRoles(req: Request, res: Response, next: NextFunction) {
    try {
        const roles = await roleService.listRoles();
        res.json(roles);
    } catch (err) {
        next(err);
    }
}

export async function getRole(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;
        const role = await roleService.getRole(id);
        res.json(role);
    } catch (err) {
        next(err);
    }
}

export async function createRole(req: Request, res: Response, next: NextFunction) {
    try {
        const role = await roleService.createRole(req.body);
        invalidatePermissionCache();
        res.status(201).json(role);
    } catch (err) {
        next(err);
    }
}

export async function updateRole(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;
        const role = await roleService.updateRole(id, req.body);
        invalidatePermissionCache();
        res.json(role);
    } catch (err) {
        next(err);
    }
}

export async function deleteRole(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;
        await roleService.deleteRole(id);
        invalidatePermissionCache();
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
}
