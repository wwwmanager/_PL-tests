import { Request, Response, NextFunction } from 'express';
import * as fuelCardService from '../services/fuelCardService';

export async function listFuelCards(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user!;
        const fuelCards = await fuelCardService.listFuelCards(user);
        res.json(fuelCards);
    } catch (err) {
        next(err);
    }
}

export async function getFuelCardById(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user!;
        const { id } = req.params;
        const fuelCard = await fuelCardService.getFuelCardById(user, id);
        if (!fuelCard) return res.status(404).json({ error: 'Топливная карта не найдена' });
        res.json(fuelCard);
    } catch (err) {
        next(err);
    }
}

export async function createFuelCard(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user!;
        const fuelCard = await fuelCardService.createFuelCard(user, req.body);
        res.status(201).json(fuelCard);
    } catch (err) {
        next(err);
    }
}

export async function updateFuelCard(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user!;
        const { id } = req.params;
        const fuelCard = await fuelCardService.updateFuelCard(user, id, req.body);
        res.json(fuelCard);
    } catch (err) {
        next(err);
    }
}

export async function deleteFuelCard(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user!;
        const { id } = req.params;
        await fuelCardService.deleteFuelCard(user, id);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
}

export async function assignFuelCard(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user!;
        const { id } = req.params;
        const { driverId, vehicleId } = req.body as { driverId?: string; vehicleId?: string };
        const fuelCard = await fuelCardService.assignFuelCard(user, id, driverId, vehicleId);
        res.json(fuelCard);
    } catch (err) {
        next(err);
    }
}

/**
 * REL-601: Get fuel cards for a specific driver
 */
export async function getFuelCardsForDriver(req: Request, res: Response, next: NextFunction) {
    try {
        const { driverId } = req.params;
        const fuelCards = await fuelCardService.getFuelCardsForDriver(req.user!.organizationId, driverId);
        res.json({ data: fuelCards });
    } catch (err) {
        next(err);
    }
}

/**
 * FUEL-CARD-SEARCH-BE-010: Search fuel cards by card number
 * GET /fuel-cards/search?q=1234&onlyUnassigned=true&limit=20
 */
export async function searchFuelCards(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user!;
        const { q, onlyUnassigned, limit } = req.query as {
            q?: string;
            onlyUnassigned?: string;
            limit?: string;
        };

        const fuelCards = await fuelCardService.searchFuelCards(
            user.organizationId,
            q || '',
            onlyUnassigned === 'true',
            parseInt(limit || '20', 10)
        );
        res.json({ data: fuelCards });
    } catch (err) {
        next(err);
    }
}

// ============================================================================
// FUEL-001: Top-Up Rules and Transactions
// ============================================================================

/**
 * FUEL-CARDS-RULES-BE-010: List all top-up rules for organization
 * GET /fuel-cards/topup-rules
 */
export async function listTopUpRules(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user!;
        const rules = await fuelCardService.listTopUpRules(user.organizationId);
        res.json({ success: true, data: rules });
    } catch (err) {
        next(err);
    }
}

/**
 * FUEL-CARDS-RULES-BE-010: List all reset rules for organization
 * GET /fuel-cards/reset-rules
 */
export async function listResetRules(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user!;
        const rules = await fuelCardService.listResetRules(user.organizationId);
        res.json({ success: true, data: rules });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /fuel-cards/:id/topup-rule
 */
export async function getTopUpRule(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;
        const rule = await fuelCardService.getTopUpRule(req.user!.organizationId, id);
        res.json(rule);
    } catch (err) {
        next(err);
    }
}

/**
 * PUT /fuel-cards/:id/topup-rule
 */
export async function upsertTopUpRule(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;
        const rule = await fuelCardService.upsertTopUpRule(req.user!.organizationId, id, req.body);
        res.json(rule);
    } catch (err) {
        next(err);
    }
}

/**
 * DELETE /fuel-cards/:id/topup-rule
 */
export async function deleteTopUpRule(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;
        await fuelCardService.deleteTopUpRule(req.user!.organizationId, id);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
}

/**
 * GET /fuel-cards/:id/transactions
 */
export async function getTransactions(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;
        const { from, to } = req.query as { from?: string; to?: string };
        const transactions = await fuelCardService.getTransactions(req.user!.organizationId, id, from, to);
        res.json(transactions);
    } catch (err) {
        next(err);
    }
}

/**
 * POST /fuel-cards/:id/transactions (manual adjustment)
 */
export async function createTransaction(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;
        const transaction = await fuelCardService.createTransaction(req.user!, id, req.body);
        res.status(201).json(transaction);
    } catch (err) {
        next(err);
    }
}
