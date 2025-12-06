import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { auditMiddleware } from '../middleware/auditMiddleware';
import { checkPermission } from '../middleware/checkPermission';
import * as blankController from '../controllers/blankController';

export const router = Router();

router.use(authMiddleware);
router.use(auditMiddleware('blank'));

// List blanks (read permission)
router.get('/', checkPermission('blank.read'), blankController.listBlanks);

// List batches (read permission)
router.get('/batches', checkPermission('blank.read'), blankController.listBatches);

// Create batch (create permission)
router.post('/batches', checkPermission('blank.create'), blankController.createBatch);

// Materialize batch (create permission) - for E2E test clarity, though createBatch already does this
router.post('/batches/:id/materialize', checkPermission('blank.create'), blankController.materializeBatch);

// Issue blank (update/issue permission)
// Assuming 'blank.issue' is a specific permission, or reusing 'blank.update'
router.post('/issue', checkPermission('blank.update'), blankController.issueBlank);

// Get driver blank summary (read permission)
router.get('/summary/driver/:driverId', checkPermission('blank.read'), blankController.getDriverSummary);

