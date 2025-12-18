import { Router } from 'express';
import * as authController from '../controllers/authController';
import { authMiddleware } from '../middleware/authMiddleware';

export const router = Router();

router.post('/login', authController.login);
router.get('/me', authMiddleware, authController.getProfile);
router.post('/logout', authMiddleware, authController.logout);
