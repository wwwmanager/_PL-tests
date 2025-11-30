import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { auditMiddleware } from '../middleware/auditMiddleware';
import * as departmentController from '../controllers/departmentController';

export const router = Router();

router.use(authMiddleware);
router.use(auditMiddleware('department'));

router.get('/', departmentController.listDepartments);
router.post('/', departmentController.createDepartment);
router.get('/:id', departmentController.getDepartmentById);
router.put('/:id', departmentController.updateDepartment);
router.delete('/:id', departmentController.deleteDepartment);
