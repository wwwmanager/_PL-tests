import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import * as fuelCardController from '../controllers/fuelCardController';

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
