import { Router } from 'express';
import * as routeController from '../controllers/routeController';
import { authMiddleware } from '../middleware/authMiddleware';

export const router = Router();

// All route routes require authentication
router.use(authMiddleware);

// GET /api/routes - List all routes
router.get('/', routeController.listRoutes);

// GET /api/routes/:id - Get route by ID
router.get('/:id', routeController.getRouteById);

// POST /api/routes - Create new route
router.post('/', routeController.createRoute);

// PUT /api/routes/:id - Update route
router.put('/:id', routeController.updateRoute);

// DELETE /api/routes/:id - Delete route
router.delete('/:id', routeController.deleteRoute);
