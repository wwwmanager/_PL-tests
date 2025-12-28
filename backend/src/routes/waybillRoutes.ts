import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { auditMiddleware } from '../middleware/auditMiddleware';
import * as waybillController from '../controllers/waybillController';
import * as waybillPrefillController from '../controllers/waybillPrefillController';
import { checkPermission } from '../middleware/checkPermission';
import { checkWaybillStatusPermission } from '../middleware/checkWaybillStatusPermission';
import { validateDto } from '../middleware/validateDto';
import { createWaybillSchema, updateWaybillSchema, changeStatusSchema } from '../dto/waybillDto';

export const router = Router();

router.use(authMiddleware);
router.use(auditMiddleware('waybill'));

router.get('/', checkPermission('waybill.read'), waybillController.listWaybills);

// WB-PREFILL-020: Prefill endpoint
router.get('/prefill/:vehicleId', checkPermission('waybill.create'), waybillPrefillController.getWaybillPrefill);

router.post('/', checkPermission('waybill.create'), validateDto(createWaybillSchema), waybillController.createWaybill);
router.get('/:id', checkPermission('waybill.read'), waybillController.getWaybillById);
router.put('/:id', checkPermission('waybill.update'), validateDto(updateWaybillSchema), waybillController.updateWaybill);
router.delete('/:id', checkPermission('waybill.delete'), waybillController.deleteWaybill);
// WB-DEL-005: Bulk delete
router.post('/bulk-delete', checkPermission('waybill.delete'), waybillController.bulkDeleteWaybills);

// WB-601: Status-specific permissions (waybill.submit, waybill.post, waybill.cancel)
router.patch('/:id/status', checkWaybillStatusPermission(), validateDto(changeStatusSchema), waybillController.changeWaybillStatus);

