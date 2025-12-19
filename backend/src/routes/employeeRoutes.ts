import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { auditMiddleware } from '../middleware/auditMiddleware';
import * as employeeController from '../controllers/employeeController';
import { validateDto } from '../middleware/validateDto';
import { employeeSchema } from '../dto/employeeDto';

export const router = Router();

router.use(authMiddleware);
router.use(auditMiddleware('employee'));

router.get('/', employeeController.listEmployees);
router.post('/', validateDto(employeeSchema), employeeController.createEmployee);
router.get('/:id', employeeController.getEmployeeById);
router.put('/:id', validateDto(employeeSchema), employeeController.updateEmployee);
router.delete('/:id', employeeController.deleteEmployee);
