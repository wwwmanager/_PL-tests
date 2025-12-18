import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import * as userController from '../controllers/userController';

export const router = Router();

// Ensure all routes are protected
router.use(authMiddleware);

// List users (requires user.read permission)
// For now, let's assume 'admin' role or 'user.read' permission
// We'll use requireStartWith('user.read') if we have granular permissions
// OR just check role in controller. Let's use authenticate for now and controller checks org.
router.get('/', userController.listUsers);

router.get('/:id', userController.getUser);

router.post('/', userController.createUser);

router.put('/:id', userController.updateUser);

router.delete('/:id', userController.deleteUser);
