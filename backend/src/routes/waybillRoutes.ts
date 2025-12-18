import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { auditMiddleware } from '../middleware/auditMiddleware';
import * as waybillController from '../controllers/waybillController';
import { checkPermission } from '../middleware/checkPermission';
import { checkWaybillStatusPermission } from '../middleware/checkWaybillStatusPermission';

export const router = Router();

router.use(authMiddleware);
router.use(auditMiddleware('waybill'));

router.get('/', checkPermission('waybill.read'), waybillController.listWaybills);
router.post('/', checkPermission('waybill.create'), waybillController.createWaybill);
router.get('/:id', checkPermission('waybill.read'), waybillController.getWaybillById);
router.put('/:id', checkPermission('waybill.update'), waybillController.updateWaybill);
router.delete('/:id', checkPermission('waybill.delete'), waybillController.deleteWaybill);
// WB-601: Status-specific permissions (waybill.submit, waybill.post, waybill.cancel)
router.patch('/:id/status', checkWaybillStatusPermission(), waybillController.changeWaybillStatus);

