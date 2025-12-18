
import { Request, Response } from 'express';
import * as service from '../services/recalculationService';
import { logger } from '../utils/logger';

export const runRecalculation = async (req: Request, res: Response) => {
    try {
        // Run all
        await service.recalculateStockBalances();
        await service.recalculateVehicleStats();
        await service.recalculateDriverBalances();

        res.json({ success: true, message: 'Recalculation completed successfully' });
    } catch (error) {
        logger.error({ error }, 'Recalculation failed');
        res.status(500).json({ error: 'Recalculation failed' });
    }
};
