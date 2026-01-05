import { authMiddleware } from '../middleware/authMiddleware';

import { Router } from 'express';
import * as brandController from '../controllers/brandController'; // REL-300

export const router = Router();

router.use(authMiddleware);

router.get('/', brandController.getAll);
router.post('/', brandController.create);
