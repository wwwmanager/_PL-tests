import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { auditMiddleware } from '../middleware/auditMiddleware';
import * as waybillController from '../controllers/waybillController';
import { checkPermission } from '../middleware/checkPermission';

export const router = Router();

router.use(authMiddleware);
router.use(auditMiddleware('waybill'));

router.get('/', checkPermission('waybill.read'), waybillController.listWaybills);
router.post('/', checkPermission('waybill.create'), waybillController.createWaybill);
router.get('/:id', checkPermission('waybill.read'), waybillController.getWaybillById);
router.put('/:id', checkPermission('waybill.update'), waybillController.updateWaybill);
router.delete('/:id', checkPermission('waybill.delete'), waybillController.deleteWaybill);
router.patch('/:id/status', checkPermission('waybill.approve'), waybillController.changeWaybillStatus); // Assuming 'approve' or specific status permission
