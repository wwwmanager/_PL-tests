import { Router } from 'express';
import * as authController from '../controllers/authController';

export const router = Router();

router.post('/login', authController.login);
