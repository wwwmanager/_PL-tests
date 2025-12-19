import { Request, Response, NextFunction } from 'express';
import * as userService from '../services/userService';

export async function listUsers(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.role === 'admin' ? undefined : req.user!.organizationId;
        const users = await userService.listUsers(orgId);
        res.json(users);
    } catch (err) {
        next(err);
    }
}

export async function getUser(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.role === 'admin' ? undefined : req.user!.organizationId;
        const { id } = req.params;
        const user = await userService.getUser(id, orgId);
        res.json(user);
    } catch (err) {
        next(err);
    }
}

export async function createUser(req: Request, res: Response, next: NextFunction) {
    try {
        // Only admin can create users for now, or allow org admins later
        // For now, enforce orgId from token unless admin
        const orgId = req.user!.role === 'admin' ? (req.body.organizationId || req.user!.organizationId) : req.user!.organizationId;

        const data = {
            ...req.body,
            organizationId: orgId
        };

        console.log('🔧 [userController] Creating user with data:', JSON.stringify(data, null, 2));
        const user = await userService.createUser(data);
        console.log('✅ [userController] User created:', user.id);
        res.status(201).json(user);
    } catch (err: any) {
        console.error('❌ [userController] Error creating user:', err.message, err.stack);
        next(err);
    }
}


export async function updateUser(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.role === 'admin' ? undefined : req.user!.organizationId;
        const { id } = req.params;

        const user = await userService.updateUser(id, orgId, req.body);
        res.json(user);
    } catch (err) {
        next(err);
    }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.role === 'admin' ? undefined : req.user!.organizationId;
        const { id } = req.params;

        await userService.deleteUser(id, orgId);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
}
