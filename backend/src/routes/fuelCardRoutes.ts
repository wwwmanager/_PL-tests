import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import * as fuelCardController from '../controllers/fuelCardController';
import * as fuelCardService from '../services/fuelCardService';

export const router = Router();

router.use(authMiddleware);

router.get('/', fuelCardController.listFuelCards);
router.post('/', fuelCardController.createFuelCard);

// FUEL-CARD-SEARCH-BE-010: Search by card number (must be before /:id)
router.get('/search', fuelCardController.searchFuelCards);

// FUEL-CARDS-RULES-BE-010: List all rules (must be before /:id)
router.get('/topup-rules', fuelCardController.listTopUpRules);
router.get('/reset-rules', fuelCardController.listResetRules);

// REL-601: Get fuel cards for specific driver (must be before /:id to avoid conflict)
router.get('/driver/:driverId', fuelCardController.getFuelCardsForDriver);

router.get('/:id', fuelCardController.getFuelCardById);
router.put('/:id', fuelCardController.updateFuelCard);
router.delete('/:id', fuelCardController.deleteFuelCard);
router.patch('/:id/assign', fuelCardController.assignFuelCard);

// FUEL-001: Top-up rules
router.get('/:id/topup-rule', fuelCardController.getTopUpRule);
router.put('/:id/topup-rule', fuelCardController.upsertTopUpRule);
router.delete('/:id/topup-rule', fuelCardController.deleteTopUpRule);

// FUEL-001: Transactions
router.get('/:id/transactions', fuelCardController.getTransactions);
router.post('/:id/transactions', fuelCardController.createTransaction);

// FUEL-CARD-RESET-BE-010: Manual reset
router.post('/:id/reset', fuelCardController.resetFuelCard);

// GET /api/fuel-cards/:id/reserve - Get fuel reserved in DRAFT waybills
router.get('/:id/reserve', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { excludeWaybillId } = req.query;
        // User is attached by requireAuth
        const result = await fuelCardService.getDraftReserve(req.user as any, id, typeof excludeWaybillId === 'string' ? excludeWaybillId : undefined);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});
