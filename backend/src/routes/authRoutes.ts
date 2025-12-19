import { Router } from 'express';
import * as authController from '../controllers/authController';
import { authMiddleware } from '../middleware/authMiddleware';

export const router = Router();

router.post('/login', authController.login);
router.post('/refresh', authController.refresh);  // REL-402: No auth required, uses refresh token
router.get('/me', authMiddleware, authController.getProfile);
router.post('/logout', authMiddleware, authController.logout);
router.post('/logout-all', authMiddleware, authController.logoutAll);

export default router;
