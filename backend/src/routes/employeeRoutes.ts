import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { auditMiddleware } from '../middleware/auditMiddleware';
import * as employeeController from '../controllers/employeeController';

export const router = Router();

router.use(authMiddleware);
router.use(auditMiddleware('employee'));

router.get('/', employeeController.listEmployees);
router.post('/', employeeController.createEmployee);
router.get('/:id', employeeController.getEmployeeById);
router.put('/:id', employeeController.updateEmployee);
router.delete('/:id', employeeController.deleteEmployee);
