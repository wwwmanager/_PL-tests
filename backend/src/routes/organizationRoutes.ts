import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import {
    getMyOrganization,
    listOrganizations,
    createOrganization,
    updateOrganization,
    deleteOrganization
} from '../controllers/organizationController';

export const router = Router();

router.use(authMiddleware);

// GET /api/organizations/me - текущая организация пользователя
router.get('/me', getMyOrganization);

// GET /api/organizations - список всех организаций
router.get('/', listOrganizations);

// POST /api/organizations - создать организацию
router.post('/', createOrganization);

// PUT /api/organizations/:id - обновить организацию
router.put('/:id', updateOrganization);

// DELETE /api/organizations/:id - удалить организацию
router.delete('/:id', deleteOrganization);
