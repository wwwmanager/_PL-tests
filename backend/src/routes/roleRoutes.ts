import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import * as roleController from '../controllers/roleController';

export const router = Router();

router.use(authMiddleware);

// TODO: Add permission checks (e.g. role.read, role.write)
// For now, assuming only admins can access this via UI or generic auth check

router.get('/', roleController.listRoles);
router.get('/:id', roleController.getRole);
router.post('/', roleController.createRole);
router.put('/:id', roleController.updateRole);
router.delete('/:id', roleController.deleteRole);
