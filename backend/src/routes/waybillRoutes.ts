import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { auditMiddleware } from '../middleware/auditMiddleware';
import * as waybillController from '../controllers/waybillController';

export const router = Router();

router.use(authMiddleware);
router.use(auditMiddleware('waybill'));

router.get('/', waybillController.listWaybills);
router.post('/', waybillController.createWaybill);
router.get('/:id', waybillController.getWaybillById);
router.put('/:id', waybillController.updateWaybill);
router.delete('/:id', waybillController.deleteWaybill);
router.patch('/:id/status', waybillController.changeWaybillStatus);
