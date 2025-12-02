import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import {
    listRoutes,
    createRoute,
    updateRoute,
    deleteRoute
} from '../controllers/routeController';

export const router = Router();

router.use(authMiddleware);

// GET /api/routes - список маршрутов
router.get('/', listRoutes);

// POST /api/routes - создать маршрут
router.post('/', createRoute);

// PUT /api/routes/:id - обновить маршрут
router.put('/:id', updateRoute);

// DELETE /api/routes/:id - удалить маршрут
router.delete('/:id', deleteRoute);
