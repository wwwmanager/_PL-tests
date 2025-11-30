import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService';

export async function login(req: Request, res: Response, next: NextFunction) {
    try {
        const { email, password } = req.body;
        const result = await authService.login(email, password);
        res.json(result);
    } catch (err) {
        next(err);
    }
}

export async function getProfile(req: Request, res: Response, next: NextFunction) {
    try {
        // req.user is set by authMiddleware
        const userId = (req as any).user?.id;

        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const user = await authService.findUserById(userId);

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    displayName: user.fullName,
                    organizationId: user.organizationId
                }
            }
        });
    } catch (err) {
        next(err);
    }
}
